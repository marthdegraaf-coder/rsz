from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models
import schemas
from database import get_db

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/", response_model=List[schemas.Tag])
def list_tags(db: Session = Depends(get_db)):
    return db.query(models.Tag).all()


@router.post("/", response_model=schemas.Tag, status_code=201)
def create_tag(tag: schemas.TagCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Tag).filter(models.Tag.name == tag.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tag already exists")
    db_tag = models.Tag(**tag.model_dump())
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
