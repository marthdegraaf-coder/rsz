import json
import re
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import requests as http

import models
from database import get_db

# --- Event-product helpers ---

_DUTCH_MONTHS = {
    'januari': 1, 'februari': 2, 'maart': 3, 'april': 4,
    'mei': 5, 'juni': 6, 'juli': 7, 'augustus': 8,
    'september': 9, 'oktober': 10, 'november': 11, 'december': 12,
}

_EVENT_CATEGORY_KW = {
    'evenement', 'evenementen', 'event', 'events',
    'workshop', 'workshops', 'cursus', 'cursussen',
    'training', 'trainingen', 'seminar', 'webinar', 'opleiding',
}

_DATE_KEYS = {'datum', 'date', 'startdatum', 'start datum', 'event datum', 'start_date', 'event_date'}
_END_DATE_KEYS = {'einddatum', 'end date', 'end_date', 'einde', 'einddatum'}
_LOCATION_KEYS = {'locatie', 'location', 'adres', 'venue', 'plaats'}


def _parse_date(s: str) -> Optional[datetime]:
    s = s.strip()
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    m = re.match(r'(\d{1,2})\s+(\w+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?', s.lower())
    if m:
        month = _DUTCH_MONTHS.get(m.group(2))
        if month:
            try:
                return datetime(int(m.group(3)), month, int(m.group(1)),
                                int(m.group(4) or 10), int(m.group(5) or 0))
            except ValueError:
                pass
    return None


def _attr_value(product: dict, keys: set) -> Optional[str]:
    for attr in product.get('attributes', []):
        if attr.get('name', '').lower().strip() in keys:
            opts = attr.get('options', [])
            if opts:
                return opts[0]
    for meta in product.get('meta_data', []):
        key = meta.get('key', '').lower().lstrip('_')
        if key in keys:
            val = meta.get('value')
            if val:
                return str(val)
    return None


def _is_event_product(product: dict) -> bool:
    for cat in product.get('categories', []):
        for field in (cat.get('name', ''), cat.get('slug', '')):
            if any(kw in field.lower() for kw in _EVENT_CATEGORY_KW):
                return True
    return False

router = APIRouter(prefix="/woocommerce", tags=["woocommerce"])


class WooConfigIn(BaseModel):
    store_url: str
    consumer_key: str
    consumer_secret: str


class WooConfigOut(BaseModel):
    store_url: str
    last_synced_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class SyncResult(BaseModel):
    contacts_created: int
    contacts_updated: int
    orders_synced: int
    products_synced: int
    events_synced: int


def get_woo_config(db: Session) -> models.WooConfig:
    config = db.query(models.WooConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="WooCommerce niet geconfigureerd")
    return config


def woo_get(config: models.WooConfig, endpoint: str, params: dict = None, per_page: int = 100) -> list:
    """Fetch all pages from a WooCommerce endpoint."""
    # Ensure HTTPS so Basic auth headers are not stripped on redirect
    base = config.store_url.rstrip("/")
    if base.startswith("http://"):
        base = "https://" + base[7:]

    results = []
    page = 1
    while True:
        # Use query-param auth (works on HTTP and HTTPS, survives redirects)
        p = {
            "consumer_key": config.consumer_key,
            "consumer_secret": config.consumer_secret,
            "per_page": per_page,
            "page": page,
            **(params or {}),
        }
        resp = http.get(
            f"{base}/wp-json/wc/v3/{endpoint}",
            params=p,
            timeout=60,
            allow_redirects=True,
        )
        if resp.status_code == 204 or not resp.text.strip():
            break
        if resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=502,
                detail=f"WooCommerce API fout ({resp.status_code}): {resp.text[:300]}",
            )
        try:
            data = resp.json()
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"WooCommerce API antwoord is geen geldige JSON voor '{endpoint}' pagina {page}: {e}",
            )
        if not isinstance(data, list):
            raise HTTPException(
                status_code=502,
                detail=f"WooCommerce API onverwacht antwoord voor '{endpoint}': {str(data)[:300]}",
            )
        if not data:
            break
        results.extend(data)
        if len(data) < per_page:
            break
        page += 1
    return results


@router.get("/config", response_model=Optional[WooConfigOut])
def get_config(db: Session = Depends(get_db)):
    return db.query(models.WooConfig).first()


@router.post("/config", response_model=WooConfigOut)
def save_config(data: WooConfigIn, db: Session = Depends(get_db)):
    # Test connection first
    base = data.store_url.rstrip("/")
    if base.startswith("http://"):
        base = "https://" + base[7:]
    try:
        resp = http.get(
            f"{base}/wp-json/wc/v3/system_status",
            params={"consumer_key": data.consumer_key, "consumer_secret": data.consumer_secret},
            timeout=10,
        )
        if resp.status_code == 401:
            raise HTTPException(status_code=400, detail="Ongeldige API-sleutels")
        if resp.status_code not in (200, 404):
            raise HTTPException(status_code=400, detail=f"Kan geen verbinding maken: HTTP {resp.status_code}")
    except http.exceptions.ConnectionError:
        raise HTTPException(status_code=400, detail="Kan winkel-URL niet bereiken")

    config = db.query(models.WooConfig).first()
    normalized_url = base  # already converted to https
    if config:
        config.store_url = normalized_url
        config.consumer_key = data.consumer_key
        config.consumer_secret = data.consumer_secret
    else:
        config = models.WooConfig(
            store_url=normalized_url,
            consumer_key=data.consumer_key,
            consumer_secret=data.consumer_secret,
        )
        db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.post("/sync", response_model=SyncResult)
def sync(db: Session = Depends(get_db)):
    config = get_woo_config(db)

    contacts_created = 0
    contacts_updated = 0
    orders_synced = 0
    products_synced = 0
    events_synced = 0

    # --- Sync products ---
    # Use small per_page (10) because composite products have large payloads
    woo_products = woo_get(config, "products", {"status": "publish"}, per_page=10)
    for wp in woo_products:
        product = db.query(models.Product).filter(models.Product.woo_id == wp["id"]).first()
        categories = json.dumps([c["name"] for c in wp.get("categories", [])])
        image_url = wp["images"][0]["src"] if wp.get("images") else None

        def to_float(val):
            try:
                return float(val) if val else None
            except (ValueError, TypeError):
                return None

        data = dict(
            woo_id=wp["id"],
            name=wp.get("name", ""),
            sku=wp.get("sku"),
            price=to_float(wp.get("price")),
            regular_price=to_float(wp.get("regular_price")),
            sale_price=to_float(wp.get("sale_price")),
            stock_quantity=wp.get("stock_quantity"),
            stock_status=wp.get("stock_status"),
            status=wp.get("status"),
            description=wp.get("description", ""),
            short_description=wp.get("short_description", ""),
            categories=categories,
            image_url=image_url,
            permalink=wp.get("permalink"),
            synced_at=datetime.utcnow(),
        )
        if product:
            for k, v in data.items():
                setattr(product, k, v)
        else:
            product = models.Product(**data)
            db.add(product)
        products_synced += 1
    db.commit()

    # --- Sync events from event-category products ---
    for wp in woo_products:
        if not _is_event_product(wp):
            continue

        date_str = _attr_value(wp, _DATE_KEYS)
        end_date_str = _attr_value(wp, _END_DATE_KEYS)
        location = _attr_value(wp, _LOCATION_KEYS) or ""

        start_at = _parse_date(date_str) if date_str else None
        if not start_at:
            continue  # No usable date — skip this product as event

        end_at = _parse_date(end_date_str) if end_date_str else start_at + timedelta(hours=8)

        woo_status = wp.get("status", "publish")
        event_status = (
            models.EventStatus.published if woo_status == "publish"
            else models.EventStatus.draft
        )

        event = db.query(models.Event).filter(models.Event.woo_product_id == wp["id"]).first()
        event_data = dict(
            title=wp.get("name", ""),
            description=wp.get("short_description") or wp.get("description") or "",
            location=location,
            start_at=start_at,
            end_at=end_at,
            max_attendees=wp.get("stock_quantity"),
            status=event_status,
            woo_product_id=wp["id"],
        )
        if event:
            for k, v in event_data.items():
                setattr(event, k, v)
        else:
            event = models.Event(**event_data)
            db.add(event)
        events_synced += 1

    db.commit()

    # Build product lookup
    product_lookup = {p.woo_id: p.id for p in db.query(models.Product).all()}

    # --- Sync customers → contacts ---
    woo_customers = woo_get(config, "customers")
    email_to_contact = {c.email: c for c in db.query(models.Contact).filter(models.Contact.email.isnot(None)).all()}

    for wc in woo_customers:
        email = wc.get("email", "").strip().lower()
        first = wc.get("first_name") or wc.get("billing", {}).get("first_name") or "Onbekend"
        last = wc.get("last_name") or wc.get("billing", {}).get("last_name") or ""
        phone = wc.get("billing", {}).get("phone", "")

        if email and email in email_to_contact:
            contact = email_to_contact[email]
            contact.phone = contact.phone or phone
            contact.status = models.ContactStatus.customer
            contacts_updated += 1
        else:
            contact = models.Contact(
                first_name=first or "Onbekend",
                last_name=last,
                email=email or None,
                phone=phone or None,
                status=models.ContactStatus.customer,
            )
            db.add(contact)
            db.flush()
            if email:
                email_to_contact[email] = contact
            contacts_created += 1

    db.commit()

    # Refresh lookup after flush
    email_to_contact = {c.email: c for c in db.query(models.Contact).filter(models.Contact.email.isnot(None)).all()}

    # --- Sync orders ---
    existing_woo_ids = {o.woo_id for o in db.query(models.Order.woo_id).all()}
    woo_orders = woo_get(config, "orders")

    for wo in woo_orders:
        billing = wo.get("billing", {})
        billing_address = json.dumps(billing)
        shipping_address = json.dumps(wo.get("shipping", {}))

        email = billing.get("email", "").strip().lower()
        contact = email_to_contact.get(email)

        def parse_dt(s):
            try:
                return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None
            except Exception:
                return None

        def to_float(val):
            try:
                return float(val) if val else 0.0
            except (ValueError, TypeError):
                return 0.0

        if wo["id"] in existing_woo_ids:
            order = db.query(models.Order).filter(models.Order.woo_id == wo["id"]).first()
            order.status = wo.get("status")
            order.total = to_float(wo.get("total"))
            order.synced_at = datetime.utcnow()
        else:
            order = models.Order(
                woo_id=wo["id"],
                contact_id=contact.id if contact else None,
                status=wo.get("status"),
                currency=wo.get("currency"),
                total=to_float(wo.get("total")),
                subtotal=to_float(wo.get("subtotal")),
                total_tax=to_float(wo.get("total_tax")),
                shipping_total=to_float(wo.get("shipping_total")),
                discount_total=to_float(wo.get("discount_total")),
                payment_method=wo.get("payment_method"),
                payment_method_title=wo.get("payment_method_title"),
                billing_email=email or None,
                billing_first_name=billing.get("first_name"),
                billing_last_name=billing.get("last_name"),
                billing_address=billing_address,
                shipping_address=shipping_address,
                customer_note=wo.get("customer_note"),
                ordered_at=parse_dt(wo.get("date_created")),
            )
            db.add(order)
            db.flush()

            for li in wo.get("line_items", []):
                item = models.OrderItem(
                    order_id=order.id,
                    product_id=product_lookup.get(li.get("product_id")),
                    woo_product_id=li.get("product_id"),
                    name=li.get("name", ""),
                    sku=li.get("sku"),
                    quantity=li.get("quantity"),
                    price=to_float(li.get("price")),
                    total=to_float(li.get("total")),
                )
                db.add(item)

        orders_synced += 1

    db.commit()

    config.last_synced_at = datetime.utcnow()
    db.commit()

    return SyncResult(
        contacts_created=contacts_created,
        contacts_updated=contacts_updated,
        orders_synced=orders_synced,
        products_synced=products_synced,
        events_synced=events_synced,
    )


@router.get("/debug")
def debug(db: Session = Depends(get_db)):
    """Show raw WooCommerce API response for debugging."""
    config = get_woo_config(db)
    base = config.store_url.rstrip("/")
    if base.startswith("http://"):
        base = "https://" + base[7:]

    results = {}
    for endpoint in ("products", "customers", "orders"):
        try:
            p = {
                "consumer_key": config.consumer_key,
                "consumer_secret": config.consumer_secret,
                "per_page": 2,
                "page": 1,
                **({"status": "publish"} if endpoint == "products" else {}),
            }
            resp = http.get(f"{base}/wp-json/wc/v3/{endpoint}", params=p, timeout=15, allow_redirects=True)
            results[endpoint] = {
                "url": resp.url,
                "status_code": resp.status_code,
                "content_length": len(resp.text),
                "content_type": resp.headers.get("content-type", ""),
                "body_preview": resp.text[:500],
            }
        except Exception as e:
            results[endpoint] = {"error": str(e)}
    return results


@router.get("/orders")
def list_orders(
    contact_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(models.Order)
    if contact_id:
        query = query.filter(models.Order.contact_id == contact_id)
    orders = query.order_by(models.Order.ordered_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": o.id,
            "woo_id": o.woo_id,
            "status": o.status,
            "total": o.total,
            "currency": o.currency,
            "ordered_at": o.ordered_at,
            "billing_first_name": o.billing_first_name,
            "billing_last_name": o.billing_last_name,
            "billing_email": o.billing_email,
            "payment_method_title": o.payment_method_title,
            "items": [
                {"name": i.name, "quantity": i.quantity, "total": i.total, "sku": i.sku}
                for i in o.items
            ],
        }
        for o in orders
    ]


@router.get("/products")
def list_products(
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(models.Product)
    if q:
        query = query.filter(models.Product.name.ilike(f"%{q}%"))
    products = query.order_by(models.Product.name).offset(skip).limit(limit).all()
    return [
        {
            "id": p.id,
            "woo_id": p.woo_id,
            "name": p.name,
            "sku": p.sku,
            "price": p.price,
            "regular_price": p.regular_price,
            "sale_price": p.sale_price,
            "stock_quantity": p.stock_quantity,
            "stock_status": p.stock_status,
            "categories": json.loads(p.categories) if p.categories else [],
            "image_url": p.image_url,
            "permalink": p.permalink,
            "short_description": p.short_description,
        }
        for p in products
    ]
