import axios from 'axios'
import type {
  Contact,
  Company,
  Event,
  Tag,
  Activity,
  Attendee,
  Todo,
  Stats,
  ContactStatus,
  EventStatus,
} from './types'

const api = axios.create({ baseURL: '/api' })

// Stats
export const fetchStats = (): Promise<Stats> =>
  api.get('/stats').then((r) => r.data)

// Contacts
export const fetchContacts = (params?: { q?: string; status?: ContactStatus }) =>
  api.get<Contact[]>('/contacts', { params }).then((r) => r.data)

export const fetchContact = (id: number) =>
  api.get<Contact>(`/contacts/${id}`).then((r) => r.data)

export const createContact = (data: Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'company' | 'tags'>) =>
  api.post<Contact>('/contacts', data).then((r) => r.data)

export const updateContact = (id: number, data: Partial<Contact>) =>
  api.put<Contact>(`/contacts/${id}`, data).then((r) => r.data)

export const deleteContact = (id: number) =>
  api.delete(`/contacts/${id}`)

export const fetchContactActivities = (id: number) =>
  api.get<Activity[]>(`/contacts/${id}/activities`).then((r) => r.data)

export const addActivity = (contactId: number, data: { type: string; title: string; description?: string; occurred_at?: string }) =>
  api.post<Activity>(`/contacts/${contactId}/activities`, data).then((r) => r.data)

// Companies
export const fetchCompanies = (params?: { q?: string }) =>
  api.get<Company[]>('/companies', { params }).then((r) => r.data)

export const fetchCompany = (id: number) =>
  api.get<Company & { contacts: Contact[] }>(`/companies/${id}`).then((r) => r.data)

export const createCompany = (data: Omit<Company, 'id' | 'created_at' | 'updated_at'>) =>
  api.post<Company>('/companies', data).then((r) => r.data)

export const updateCompany = (id: number, data: Partial<Company>) =>
  api.put<Company>(`/companies/${id}`, data).then((r) => r.data)

export const deleteCompany = (id: number) =>
  api.delete(`/companies/${id}`)

// Events
export const fetchEvents = (params?: { q?: string; status?: EventStatus }) =>
  api.get<Event[]>('/events', { params }).then((r) => r.data)

export const fetchEvent = (id: number) =>
  api.get<Event>(`/events/${id}`).then((r) => r.data)

export const createEvent = (data: Omit<Event, 'id' | 'created_at' | 'updated_at' | 'attendees' | 'tags'>) =>
  api.post<Event>('/events', data).then((r) => r.data)

export const updateEvent = (id: number, data: Partial<Event>) =>
  api.put<Event>(`/events/${id}`, data).then((r) => r.data)

export const deleteEvent = (id: number) =>
  api.delete(`/events/${id}`)

export const addAttendee = (eventId: number, data: { contact_id: number; rsvp_status?: string }) =>
  api.post<Attendee>(`/events/${eventId}/attendees`, data).then((r) => r.data)

export const updateAttendee = (eventId: number, attendeeId: number, data: { rsvp_status?: string; notes?: string }) =>
  api.put<Attendee>(`/events/${eventId}/attendees/${attendeeId}`, data).then((r) => r.data)

export const removeAttendee = (eventId: number, attendeeId: number) =>
  api.delete(`/events/${eventId}/attendees/${attendeeId}`)

// Todos
export const fetchTodos = (contactId: number) =>
  api.get<Todo[]>(`/contacts/${contactId}/todos`).then((r) => r.data)

export const createTodo = (contactId: number, data: { title: string; description?: string; due_date?: string; activity_id?: number }) =>
  api.post<Todo>(`/contacts/${contactId}/todos`, data).then((r) => r.data)

export const updateTodo = (contactId: number, todoId: number, data: { title?: string; description?: string; due_date?: string; done?: boolean }) =>
  api.put<Todo>(`/contacts/${contactId}/todos/${todoId}`, data).then((r) => r.data)

export const deleteTodo = (contactId: number, todoId: number) =>
  api.delete(`/contacts/${contactId}/todos/${todoId}`)

// ClickUp config
export const fetchClickUpConfig = () =>
  api.get('/clickup/config').then((r) => r.data)

export const saveClickUpConfig = (data: { api_token: string; list_id: string }) =>
  api.post('/clickup/config', data).then((r) => r.data)

// Tags
export const fetchTags = () =>
  api.get<Tag[]>('/tags').then((r) => r.data)

export const createTag = (data: { name: string; color: string }) =>
  api.post<Tag>('/tags', data).then((r) => r.data)
