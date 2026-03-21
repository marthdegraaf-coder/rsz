from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import requests as http

import models
import schemas
from database import get_db

router = APIRouter(tags=["todos"])


# --- ClickUp helpers ---

class ClickUpConfigIn(BaseModel):
    api_token: str
    list_id: str


class ClickUpConfigOut(BaseModel):
    list_id: str
    model_config = {"from_attributes": True}


def _get_clickup_config(db: Session) -> Optional[models.ClickUpConfig]:
    return db.query(models.ClickUpConfig).first()


def _push_to_clickup(
    todo: models.Todo,
    contact: models.Contact,
    config: models.ClickUpConfig,
) -> Optional[str]:
    headers = {
        "Authorization": config.api_token,
        "Content-Type": "application/json",
    }
    due_ts = int(todo.due_date.timestamp() * 1000) if todo.due_date else None
    contact_name = f"{contact.first_name} {contact.last_name}".strip()
    desc_parts = [f"Contact: {contact_name}"]
    if contact.email:
        desc_parts.append(f"E-mail: {contact.email}")
    if todo.description:
        desc_parts.append(f"\n{todo.description}")

    payload: dict = {
        "name": todo.title,
        "description": "\n".join(desc_parts),
        "notify_all": False,
    }
    if due_ts:
        payload["due_date"] = due_ts

    try:
        resp = http.post(
            f"https://api.clickup.com/api/v2/list/{config.list_id}/task",
            json=payload,
            headers=headers,
            timeout=10,
        )
        if resp.ok:
            return resp.json().get("id")
    except Exception:
        pass
    return None


def _update_clickup_task(task_id: str, done: bool, config: models.ClickUpConfig) -> None:
    headers = {
        "Authorization": config.api_token,
        "Content-Type": "application/json",
    }
    # Mark as closed (status) when done
    try:
        http.put(
            f"https://api.clickup.com/api/v2/task/{task_id}",
            json={"status": "complete" if done else "to do"},
            headers=headers,
            timeout=10,
        )
    except Exception:
        pass


# --- ClickUp config endpoints ---

@router.get("/clickup/config", response_model=Optional[ClickUpConfigOut])
def get_clickup_config(db: Session = Depends(get_db)):
    return _get_clickup_config(db)


@router.post("/clickup/config", response_model=ClickUpConfigOut)
def save_clickup_config(data: ClickUpConfigIn, db: Session = Depends(get_db)):
    config = db.query(models.ClickUpConfig).first()
    if config:
        config.api_token = data.api_token
        config.list_id = data.list_id
    else:
        config = models.ClickUpConfig(api_token=data.api_token, list_id=data.list_id)
        db.add(config)
    db.commit()
    db.refresh(config)
    return config


# --- Todo endpoints ---

@router.get("/contacts/{contact_id}/todos", response_model=List[schemas.Todo])
def list_todos(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return (
        db.query(models.Todo)
        .filter(models.Todo.contact_id == contact_id)
        .order_by(models.Todo.done, models.Todo.due_date.asc().nullslast(), models.Todo.created_at.desc())
        .all()
    )


@router.post("/contacts/{contact_id}/todos", response_model=schemas.Todo, status_code=201)
def create_todo(contact_id: int, data: schemas.TodoCreate, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    todo = models.Todo(
        contact_id=contact_id,
        activity_id=data.activity_id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        done=False,
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)

    # Push to ClickUp if configured
    config = _get_clickup_config(db)
    if config:
        task_id = _push_to_clickup(todo, contact, config)
        if task_id:
            todo.clickup_task_id = task_id
            db.commit()
            db.refresh(todo)

    return todo


@router.put("/contacts/{contact_id}/todos/{todo_id}", response_model=schemas.Todo)
def update_todo(contact_id: int, todo_id: int, data: schemas.TodoUpdate, db: Session = Depends(get_db)):
    todo = db.query(models.Todo).filter(
        models.Todo.id == todo_id,
        models.Todo.contact_id == contact_id,
    ).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    was_done = todo.done
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(todo, key, value)
    db.commit()
    db.refresh(todo)

    # Sync done-status to ClickUp
    if todo.clickup_task_id and data.done is not None and data.done != was_done:
        config = _get_clickup_config(db)
        if config:
            _update_clickup_task(todo.clickup_task_id, todo.done, config)

    return todo


@router.delete("/contacts/{contact_id}/todos/{todo_id}", status_code=204)
def delete_todo(contact_id: int, todo_id: int, db: Session = Depends(get_db)):
    todo = db.query(models.Todo).filter(
        models.Todo.id == todo_id,
        models.Todo.contact_id == contact_id,
    ).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    db.delete(todo)
    db.commit()
