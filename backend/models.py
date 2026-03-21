from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Table, Float, Boolean
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
    afas_id = Column(String(50), nullable=True, unique=True)
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
    afas_id = Column(String(50), nullable=True, unique=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", back_populates="contacts")
    activities = relationship("Activity", back_populates="contact", cascade="all, delete-orphan")
    attendances = relationship("Attendee", back_populates="contact", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=contact_tags, back_populates="contacts")
    orders = relationship("Order", back_populates="contact")

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
    woo_product_id = Column(Integer, nullable=True, unique=True)
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


class WooConfig(Base):
    __tablename__ = "woo_config"

    id = Column(Integer, primary_key=True)
    store_url = Column(String(255), nullable=False)
    consumer_key = Column(String(255), nullable=False)
    consumer_secret = Column(String(255), nullable=False)
    last_synced_at = Column(DateTime, nullable=True)


class AfasConfig(Base):
    __tablename__ = "afas_config"

    id = Column(Integer, primary_key=True)
    environment_id = Column(String(20), nullable=False)   # bijv. "12345"
    api_token = Column(Text, nullable=False)              # AFAS App Connector token
    contacts_connector = Column(String(100), default="KP_Contactpersoon")
    companies_connector = Column(String(100), nullable=True)
    last_synced_at = Column(DateTime, nullable=True)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    woo_id = Column(Integer, unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    sku = Column(String(100))
    price = Column(Float)
    regular_price = Column(Float)
    sale_price = Column(Float)
    stock_quantity = Column(Integer)
    stock_status = Column(String(50))
    status = Column(String(50))
    description = Column(Text)
    short_description = Column(Text)
    categories = Column(Text)  # JSON string
    image_url = Column(String(500))
    permalink = Column(String(500))
    synced_at = Column(DateTime, default=datetime.utcnow)

    order_items = relationship("OrderItem", back_populates="product")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    woo_id = Column(Integer, unique=True, nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    status = Column(String(50))
    currency = Column(String(10))
    total = Column(Float)
    subtotal = Column(Float)
    total_tax = Column(Float)
    shipping_total = Column(Float)
    discount_total = Column(Float)
    payment_method = Column(String(100))
    payment_method_title = Column(String(100))
    billing_email = Column(String(255))
    billing_first_name = Column(String(100))
    billing_last_name = Column(String(100))
    billing_address = Column(Text)
    shipping_address = Column(Text)
    customer_note = Column(Text)
    ordered_at = Column(DateTime)
    synced_at = Column(DateTime, default=datetime.utcnow)

    contact = relationship("Contact", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    woo_product_id = Column(Integer)
    name = Column(String(255), nullable=False)
    sku = Column(String(100))
    quantity = Column(Integer)
    price = Column(Float)
    total = Column(Float)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
