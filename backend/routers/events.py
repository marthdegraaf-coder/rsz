from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
import models
import schemas
from database import get_db

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/", response_model=List[schemas.Event])
def list_events(
    q: Optional[str] = Query(None),
    status: Optional[models.EventStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(models.Event)
    if q:
        query = query.filter(
            or_(
                models.Event.title.ilike(f"%{q}%"),
                models.Event.location.ilike(f"%{q}%"),
            )
        )
    if status:
        query = query.filter(models.Event.status == status)
    return query.order_by(models.Event.start_at).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.Event, status_code=201)
def create_event(event: schemas.EventCreate, db: Session = Depends(get_db)):
    db_event = models.Event(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("/{event_id}", response_model=schemas.Event)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.put("/{event_id}", response_model=schemas.Event)
def update_event(event_id: int, update: schemas.EventUpdate, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()


@router.get("/{event_id}/attendees", response_model=List[schemas.Attendee])
def list_attendees(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event.attendees


@router.post("/{event_id}/attendees", response_model=schemas.Attendee, status_code=201)
def add_attendee(event_id: int, attendee: schemas.AttendeeCreate, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    existing = db.query(models.Attendee).filter(
        models.Attendee.event_id == event_id,
        models.Attendee.contact_id == attendee.contact_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Contact is already an attendee")
    db_attendee = models.Attendee(**attendee.model_dump(), event_id=event_id)
    db.add(db_attendee)
    db.commit()
    db.refresh(db_attendee)
    return db_attendee


@router.put("/{event_id}/attendees/{attendee_id}", response_model=schemas.Attendee)
def update_attendee(
    event_id: int,
    attendee_id: int,
    update: schemas.AttendeeUpdate,
    db: Session = Depends(get_db),
):
    attendee = db.query(models.Attendee).filter(
        models.Attendee.id == attendee_id,
        models.Attendee.event_id == event_id,
    ).first()
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(attendee, key, value)
    db.commit()
    db.refresh(attendee)
    return attendee


@router.delete("/{event_id}/attendees/{attendee_id}", status_code=204)
def remove_attendee(event_id: int, attendee_id: int, db: Session = Depends(get_db)):
    attendee = db.query(models.Attendee).filter(
        models.Attendee.id == attendee_id,
        models.Attendee.event_id == event_id,
    ).first()
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")
    db.delete(attendee)
    db.commit()
