from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine, Base
import models  # noqa: F401 - ensures models are registered
from routers import contacts, companies, events, tags, woocommerce, afas, todos

Base.metadata.create_all(bind=engine)

# Migrations: add columns that were added after initial DB creation
with engine.connect() as _conn:
    for _stmt in [
        "ALTER TABLE events ADD COLUMN woo_product_id INTEGER",
        "ALTER TABLE contacts ADD COLUMN afas_id VARCHAR(50)",
        "ALTER TABLE companies ADD COLUMN afas_id VARCHAR(50)",
        "CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY, contact_id INTEGER NOT NULL, activity_id INTEGER, title VARCHAR(255) NOT NULL, description TEXT, due_date DATETIME, done BOOLEAN DEFAULT 0, clickup_task_id VARCHAR(100), created_at DATETIME, updated_at DATETIME)",
        "CREATE TABLE IF NOT EXISTS clickup_config (id INTEGER PRIMARY KEY, api_token VARCHAR(255) NOT NULL, list_id VARCHAR(100) NOT NULL)",
    ]:
        try:
            _conn.execute(text(_stmt))
            _conn.commit()
        except Exception:
            pass  # Column already exists

app = FastAPI(title="CRM & Event Management", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contacts.router, prefix="/api")
app.include_router(companies.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(woocommerce.router, prefix="/api")
app.include_router(afas.router, prefix="/api")
app.include_router(todos.router, prefix="/api")


@app.get("/api/stats")
def get_stats(db=None):
    from database import SessionLocal
    from sqlalchemy import func

    db = SessionLocal()
    try:
        from models import Contact, Company, Event, Attendee, ContactStatus, EventStatus

        total_contacts = db.query(func.count(Contact.id)).scalar()
        total_companies = db.query(func.count(Company.id)).scalar()
        total_events = db.query(func.count(Event.id)).scalar()
        upcoming_events = db.query(func.count(Event.id)).filter(
            Event.status == EventStatus.published
        ).scalar()
        customers = db.query(func.count(Contact.id)).filter(
            Contact.status == ContactStatus.customer
        ).scalar()
        return {
            "total_contacts": total_contacts,
            "total_companies": total_companies,
            "total_events": total_events,
            "upcoming_events": upcoming_events,
            "customers": customers,
        }
    finally:
        db.close()
