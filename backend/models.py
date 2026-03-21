from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Table
from sqlalchemy.orm import relationship
from database import Base
import enum


class ContactStatus(str, enum.Enum):
    lead = "lead"
    prospect = "prospect"
    customer = "customer"
    inactive = "inactive"


class EventStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    cancelled = "cancelled"
    completed = "completed"


class RSVPStatus(str, enum.Enum):
    invited = "invited"
    confirmed = "confirmed"
    declined = "declined"
    attended = "attended"


event_tags = Table(
    "event_tags",
    Base.metadata,
    Column("event_id", Integer, ForeignKey("events.id")),
    Column("tag_id", Integer, ForeignKey("tags.id")),
)

contact_tags = Table(
    "contact_tags",
    Base.metadata,
    Column("contact_id", Integer, ForeignKey("contacts.id")),
    Column("tag_id", Integer, ForeignKey("tags.id")),
)


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    website = Column(String(255))
    phone = Column(String(50))
    email = Column(String(255))
    address = Column(Text)
    industry = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contacts = relationship("Contact", back_populates="company")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    job_title = Column(String(100))
    status = Column(Enum(ContactStatus), default=ContactStatus.lead)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", back_populates="contacts")
    activities = relationship("Activity", back_populates="contact", cascade="all, delete-orphan")
    attendances = relationship("Attendee", back_populates="contact", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=contact_tags, back_populates="contacts")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    color = Column(String(7), default="#6366f1")

    contacts = relationship("Contact", secondary=contact_tags, back_populates="tags")
    events = relationship("Event", secondary=event_tags, back_populates="tags")


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    type = Column(String(50), nullable=False)  # call, email, meeting, note
    title = Column(String(255), nullable=False)
    description = Column(Text)
    occurred_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    contact = relationship("Contact", back_populates="activities")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    location = Column(String(255))
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    max_attendees = Column(Integer)
    status = Column(Enum(EventStatus), default=EventStatus.draft)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attendees = relationship("Attendee", back_populates="event", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=event_tags, back_populates="events")


class Attendee(Base):
    __tablename__ = "attendees"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    rsvp_status = Column(Enum(RSVPStatus), default=RSVPStatus.invited)
    notes = Column(Text)
    registered_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="attendees")
    contact = relationship("Contact", back_populates="attendances")
