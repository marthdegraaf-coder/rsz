from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
import models
import schemas
from database import get_db

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("/", response_model=List[schemas.Contact])
def list_contacts(
    q: Optional[str] = Query(None),
    status: Optional[models.ContactStatus] = None,
    company_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 10000,
    db: Session = Depends(get_db),
):
    query = db.query(models.Contact)
    if q:
        query = query.filter(
            or_(
                models.Contact.first_name.ilike(f"%{q}%"),
                models.Contact.last_name.ilike(f"%{q}%"),
                models.Contact.email.ilike(f"%{q}%"),
            )
        )
    if status:
        query = query.filter(models.Contact.status == status)
    if company_id:
        query = query.filter(models.Contact.company_id == company_id)
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.Contact, status_code=201)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = models.Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact


@router.get("/{contact_id}", response_model=schemas.Contact)
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.put("/{contact_id}", response_model=schemas.Contact)
def update_contact(contact_id: int, update: schemas.ContactUpdate, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()


@router.get("/{contact_id}/activities", response_model=List[schemas.Activity])
def get_contact_activities(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact.activities


@router.post("/{contact_id}/activities", response_model=schemas.Activity, status_code=201)
def add_activity(contact_id: int, activity: schemas.ActivityBase, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db_activity = models.Activity(**activity.model_dump(), contact_id=contact_id)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    return db_activity


@router.post("/{contact_id}/tags/{tag_id}", response_model=schemas.Contact)
def add_tag(contact_id: int, tag_id: int, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not contact or not tag:
        raise HTTPException(status_code=404, detail="Contact or tag not found")
    if tag not in contact.tags:
        contact.tags.append(tag)
        db.commit()
        db.refresh(contact)
    return contact


@router.delete("/{contact_id}/tags/{tag_id}", response_model=schemas.Contact)
def remove_tag(contact_id: int, tag_id: int, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not contact or not tag:
        raise HTTPException(status_code=404, detail="Contact or tag not found")
    contact.tags = [t for t in contact.tags if t.id != tag_id]
    db.commit()
    db.refresh(contact)
    return contact
