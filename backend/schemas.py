from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from models import ContactStatus, EventStatus, RSVPStatus


# Tag schemas
class TagBase(BaseModel):
    name: str
    color: str = "#6366f1"


class TagCreate(TagBase):
    pass


class Tag(TagBase):
    id: int
    model_config = {"from_attributes": True}


# Company schemas
class CompanyBase(BaseModel):
    name: str
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    industry: Optional[str] = None
    notes: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(CompanyBase):
    name: Optional[str] = None


class Company(CompanyBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class CompanyWithContacts(Company):
    contacts: List["ContactSummary"] = []


# Contact schemas
class ContactSummary(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    job_title: Optional[str] = None
    status: ContactStatus
    model_config = {"from_attributes": True}


class ContactBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    status: ContactStatus = ContactStatus.lead
    company_id: Optional[int] = None
    notes: Optional[str] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(ContactBase):
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class Contact(ContactBase):
    id: int
    created_at: datetime
    updated_at: datetime
    company: Optional[Company] = None
    tags: List[Tag] = []
    model_config = {"from_attributes": True}


# Activity schemas
class ActivityBase(BaseModel):
    type: str
    title: str
    description: Optional[str] = None
    occurred_at: Optional[datetime] = None


class ActivityCreate(ActivityBase):
    contact_id: int


class Activity(ActivityBase):
    id: int
    contact_id: int
    created_at: datetime
    model_config = {"from_attributes": True}


# Todo schemas
class TodoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    activity_id: Optional[int] = None


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    done: Optional[bool] = None


class Todo(BaseModel):
    id: int
    contact_id: int
    activity_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    done: bool
    clickup_task_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# Attendee schemas
class AttendeeBase(BaseModel):
    contact_id: int
    rsvp_status: RSVPStatus = RSVPStatus.invited
    notes: Optional[str] = None


class AttendeeCreate(AttendeeBase):
    pass


class AttendeeUpdate(BaseModel):
    rsvp_status: Optional[RSVPStatus] = None
    notes: Optional[str] = None


class Attendee(AttendeeBase):
    id: int
    event_id: int
    registered_at: datetime
    contact: ContactSummary
    model_config = {"from_attributes": True}


# Event schemas
class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_at: datetime
    end_at: datetime
    max_attendees: Optional[int] = None
    status: EventStatus = EventStatus.draft


class EventCreate(EventBase):
    pass


class EventUpdate(EventBase):
    title: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None


class Event(EventBase):
    id: int
    created_at: datetime
    updated_at: datetime
    attendees: List[Attendee] = []
    tags: List[Tag] = []
    model_config = {"from_attributes": True}


class EventSummary(EventBase):
    id: int
    created_at: datetime
    attendee_count: int = 0
    model_config = {"from_attributes": True}


CompanyWithContacts.model_rebuild()
