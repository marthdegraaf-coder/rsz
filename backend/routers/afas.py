import base64
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import requests as http

import models
from database import get_db

router = APIRouter(prefix="/afas", tags=["afas"])


# ---------------------------------------------------------------------------
# AFAS API helpers
# ---------------------------------------------------------------------------

def _afas_headers(token: str) -> dict:
    """Builds the Authorization header expected by AFAS REST."""
    token_xml = f"<token><version>1</version><data>{token}</data></token>"
    encoded = base64.b64encode(token_xml.encode()).decode()
    return {
        "Authorization": f"AfasToken {encoded}",
        "Content-Type": "application/json",
    }


def _base_url(environment_id: str) -> str:
    return f"https://{environment_id}.rest.afas.online/ProfitRestServices"


def afas_get(config: models.AfasConfig, connector: str) -> list:
    """Fetch all rows from an AFAS GetConnector, paginating automatically."""
    base = _base_url(config.environment_id)
    headers = _afas_headers(config.api_token)
    rows = []
    skip = 0
    take = 100
    while True:
        resp = http.get(
            f"{base}/connectors/{connector}",
            headers=headers,
            params={"skip": skip, "take": take},
            timeout=30,
        )
        if resp.status_code == 401:
            raise HTTPException(status_code=400, detail="AFAS: ongeldige API-token")
        if resp.status_code == 404:
            raise HTTPException(status_code=400, detail=f"AFAS: connector '{connector}' niet gevonden")
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"AFAS API fout ({resp.status_code}): {resp.text[:300]}",
            )
        data = resp.json()
        batch = data.get("rows", [])
        rows.extend(batch)
        if len(batch) < take:
            break
        skip += take
    return rows


def _field(row: dict, *keys: str) -> Optional[str]:
    """Return the first non-empty value from a list of possible field names."""
    for k in keys:
        v = row.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return None


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AfasConfigIn(BaseModel):
    environment_id: str
    api_token: str
    contacts_connector: str = "KP_Contactpersoon"
    companies_connector: Optional[str] = None


class AfasConfigOut(BaseModel):
    environment_id: str
    contacts_connector: str
    companies_connector: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class AfasSyncResult(BaseModel):
    contacts_created: int
    contacts_updated: int
    companies_created: int
    companies_updated: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/config", response_model=Optional[AfasConfigOut])
def get_config(db: Session = Depends(get_db)):
    return db.query(models.AfasConfig).first()


@router.post("/config", response_model=AfasConfigOut)
def save_config(data: AfasConfigIn, db: Session = Depends(get_db)):
    # Test connection: fetch the first row of the contacts connector
    test_cfg = models.AfasConfig(
        environment_id=data.environment_id.strip(),
        api_token=data.api_token.strip(),
        contacts_connector=data.contacts_connector.strip(),
    )
    base = _base_url(test_cfg.environment_id)
    headers = _afas_headers(test_cfg.api_token)
    try:
        resp = http.get(
            f"{base}/connectors/{test_cfg.contacts_connector}",
            headers=headers,
            params={"skip": 0, "take": 1},
            timeout=10,
        )
    except http.exceptions.ConnectionError:
        raise HTTPException(status_code=400, detail="Kan AFAS omgeving niet bereiken")

    if resp.status_code == 401:
        raise HTTPException(status_code=400, detail="Ongeldige AFAS token")
    if resp.status_code == 404:
        raise HTTPException(
            status_code=400,
            detail=f"Connector '{test_cfg.contacts_connector}' niet gevonden in AFAS omgeving {data.environment_id}",
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"AFAS antwoordde met HTTP {resp.status_code}")

    config = db.query(models.AfasConfig).first()
    if config:
        config.environment_id = data.environment_id.strip()
        config.api_token = data.api_token.strip()
        config.contacts_connector = data.contacts_connector.strip()
        config.companies_connector = (data.companies_connector or "").strip() or None
    else:
        config = models.AfasConfig(
            environment_id=data.environment_id.strip(),
            api_token=data.api_token.strip(),
            contacts_connector=data.contacts_connector.strip(),
            companies_connector=(data.companies_connector or "").strip() or None,
        )
        db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.post("/sync", response_model=AfasSyncResult)
def sync(db: Session = Depends(get_db)):
    config = db.query(models.AfasConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="AFAS niet geconfigureerd")

    contacts_created = 0
    contacts_updated = 0
    companies_created = 0
    companies_updated = 0

    # --- Sync companies (optioneel) ---
    afas_company_map: dict[str, int] = {}  # afas_id → Company.id

    if config.companies_connector:
        rows = afas_get(config, config.companies_connector)
        for row in rows:
            afas_id = _field(row, "BcCo", "DbId", "Id")
            name = _field(row, "Nm", "CdNm", "Name")
            if not name:
                continue

            company = (
                db.query(models.Company).filter(models.Company.afas_id == afas_id).first()
                if afas_id else None
            )
            if company:
                company.name = name
                company.website = _field(row, "Url", "Website") or company.website
                company.phone = _field(row, "TeNr", "PhoneNr") or company.phone
                company.email = _field(row, "Em", "Email") or company.email
                companies_updated += 1
            else:
                company = models.Company(
                    name=name,
                    website=_field(row, "Url", "Website"),
                    phone=_field(row, "TeNr", "PhoneNr"),
                    email=_field(row, "Em", "Email"),
                    afas_id=afas_id,
                )
                db.add(company)
                db.flush()
                companies_created += 1

            if afas_id:
                afas_company_map[afas_id] = company.id

        db.commit()

    # --- Sync contacts ---
    rows = afas_get(config, config.contacts_connector)
    email_to_contact = {
        c.email.lower(): c
        for c in db.query(models.Contact).filter(models.Contact.email.isnot(None)).all()
    }
    afas_to_contact = {
        c.afas_id: c
        for c in db.query(models.Contact).filter(models.Contact.afas_id.isnot(None)).all()
    }

    for row in rows:
        afas_id = _field(row, "BcCo", "KpId", "Id")

        # Name resolution: try dedicated first/last name fields, fall back to splitting Nm
        first = _field(row, "FiNm", "VoNm", "FirstName")
        last = _field(row, "LaNm", "Nm", "LastName")
        if not first and last and " " in last:
            parts = last.split(" ", 1)
            first, last = parts[0], parts[1]
        if not last:
            last = _field(row, "Nm", "CdNm") or "Onbekend"
        if not first:
            first = "Onbekend"

        email = (_field(row, "Em", "Email") or "").lower() or None
        phone = _field(row, "MbNr", "TeNr", "PhoneNr")
        job_title = _field(row, "FuNm", "FunctionName", "Functie")

        # Resolve linked company
        company_afas_id = _field(row, "DbId", "OrgBcCo")
        company_id = afas_company_map.get(company_afas_id) if company_afas_id else None

        # Find existing contact: by AFAS ID first, then e-mail
        contact = afas_to_contact.get(afas_id) if afas_id else None
        if not contact and email:
            contact = email_to_contact.get(email)

        if contact:
            contact.first_name = first
            contact.last_name = last
            contact.phone = phone or contact.phone
            contact.job_title = job_title or contact.job_title
            contact.afas_id = afas_id or contact.afas_id
            if company_id:
                contact.company_id = company_id
            contacts_updated += 1
        else:
            contact = models.Contact(
                first_name=first,
                last_name=last,
                email=email,
                phone=phone,
                job_title=job_title,
                afas_id=afas_id,
                company_id=company_id,
                status=models.ContactStatus.lead,
            )
            db.add(contact)
            db.flush()
            if email:
                email_to_contact[email] = contact
            if afas_id:
                afas_to_contact[afas_id] = contact
            contacts_created += 1

    db.commit()

    config.last_synced_at = datetime.utcnow()
    db.commit()

    return AfasSyncResult(
        contacts_created=contacts_created,
        contacts_updated=contacts_updated,
        companies_created=companies_created,
        companies_updated=companies_updated,
    )
