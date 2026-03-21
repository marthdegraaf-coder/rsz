import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import requests as http

import models
from database import get_db

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


def get_woo_config(db: Session) -> models.WooConfig:
    config = db.query(models.WooConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="WooCommerce niet geconfigureerd")
    return config


def woo_get(config: models.WooConfig, endpoint: str, params: dict = None) -> list:
    """Fetch all pages from a WooCommerce endpoint."""
    base = config.store_url.rstrip("/")
    auth = (config.consumer_key, config.consumer_secret)
    results = []
    page = 1
    while True:
        p = {"per_page": 100, "page": page, **(params or {})}
        resp = http.get(
            f"{base}/wp-json/wc/v3/{endpoint}",
            auth=auth,
            params=p,
            timeout=30,
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
        except Exception:
            break
        if not data:
            break
        results.extend(data)
        if len(data) < 100:
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
    try:
        resp = http.get(
            f"{base}/wp-json/wc/v3/system_status",
            auth=(data.consumer_key, data.consumer_secret),
            timeout=10,
        )
        if resp.status_code == 401:
            raise HTTPException(status_code=400, detail="Ongeldige API-sleutels")
        if resp.status_code not in (200, 404):
            raise HTTPException(status_code=400, detail=f"Kan geen verbinding maken: HTTP {resp.status_code}")
    except http.exceptions.ConnectionError:
        raise HTTPException(status_code=400, detail="Kan winkel-URL niet bereiken")

    config = db.query(models.WooConfig).first()
    if config:
        config.store_url = data.store_url
        config.consumer_key = data.consumer_key
        config.consumer_secret = data.consumer_secret
    else:
        config = models.WooConfig(**data.model_dump())
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

    # --- Sync products ---
    woo_products = woo_get(config, "products", {"status": "publish"})
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
    )


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
