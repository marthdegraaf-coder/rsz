export type ContactStatus = 'lead' | 'prospect' | 'customer' | 'inactive'
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed'
export type RSVPStatus = 'invited' | 'confirmed' | 'declined' | 'attended'
export type ActivityType = 'call' | 'email' | 'meeting' | 'note'

export interface Tag {
  id: number
  name: string
  color: string
}

export interface Company {
  id: number
  name: string
  website?: string
  phone?: string
  email?: string
  address?: string
  industry?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface ContactSummary {
  id: number
  first_name: string
  last_name: string
  email?: string
  job_title?: string
  status: ContactStatus
}

export interface Contact {
  id: number
  first_name: string
  last_name: string
  email?: string
  phone?: string
  job_title?: string
  status: ContactStatus
  company_id?: number
  notes?: string
  created_at: string
  updated_at: string
  company?: Company
  tags: Tag[]
}

export interface Activity {
  id: number
  contact_id: number
  type: ActivityType
  title: string
  description?: string
  occurred_at: string
  created_at: string
}

export interface Attendee {
  id: number
  event_id: number
  contact_id: number
  rsvp_status: RSVPStatus
  notes?: string
  registered_at: string
  contact: ContactSummary
}

export interface Event {
  id: number
  title: string
  description?: string
  location?: string
  start_at: string
  end_at: string
  max_attendees?: number
  status: EventStatus
  created_at: string
  updated_at: string
  attendees: Attendee[]
  tags: Tag[]
}

export interface Todo {
  id: number
  contact_id: number
  activity_id?: number
  title: string
  description?: string
  due_date?: string
  done: boolean
  clickup_task_id?: string
  created_at: string
  updated_at: string
}

export interface Stats {
  total_contacts: number
  total_companies: number
  total_events: number
  upcoming_events: number
  customers: number
}
