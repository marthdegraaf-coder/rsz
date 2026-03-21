import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Save, X, Plus, Trash2, MapPin, Clock, Users } from 'lucide-react'
import {
  fetchEvent, updateEvent, fetchContacts,
  addAttendee, updateAttendee, removeAttendee,
} from '../api/client'
import type { EventStatus, RSVPStatus } from '../api/types'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { Input, Select, Textarea } from '../components/FormField'

const rsvpStatuses: RSVPStatus[] = ['invited', 'confirmed', 'declined', 'attended']
const rsvpLabels: Record<RSVPStatus, string> = {
  invited: 'Uitgenodigd', confirmed: 'Bevestigd', declined: 'Geweigerd', attended: 'Aanwezig',
}

function AddAttendeeModal({ eventId, existingContactIds, onClose }: {
  eventId: number
  existingContactIds: number[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => fetchContacts() })
  const available = contacts.filter((c) => !existingContactIds.includes(c.id))
  const [contactId, setContactId] = useState('')

  const mutation = useMutation({
    mutationFn: () => addAttendee(eventId, { contact_id: Number(contactId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event', eventId] }); onClose() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
      <Select label="Contact *" required value={contactId} onChange={(e) => setContactId(e.target.value)}>
        <option value="">— Selecteer contact —</option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.email ? `(${c.email})` : ''}</option>
        ))}
      </Select>
      {available.length === 0 && <p className="text-sm text-slate-500">Alle contacten zijn al uitgenodigd.</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Annuleren</button>
        <button type="submit" disabled={mutation.isPending || !contactId} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          Toevoegen
        </button>
      </div>
    </form>
  )
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const eventId = Number(id)

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => fetchEvent(eventId),
  })

  const [editing, setEditing] = useState(false)
  const [showAddAttendee, setShowAddAttendee] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})

  const updateMutation = useMutation({
    mutationFn: () => updateEvent(eventId, {
      ...editForm,
      start_at: new Date(editForm.start_at).toISOString(),
      end_at: new Date(editForm.end_at).toISOString(),
      max_attendees: editForm.max_attendees ? Number(editForm.max_attendees) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] })
      qc.invalidateQueries({ queryKey: ['events'] })
      setEditing(false)
    },
  })

  const removeAttendeeMutation = useMutation({
    mutationFn: ({ attendeeId }: { attendeeId: number }) => removeAttendee(eventId, attendeeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const updateRSVP = useMutation({
    mutationFn: ({ attendeeId, status }: { attendeeId: number; status: RSVPStatus }) =>
      updateAttendee(eventId, attendeeId, { rsvp_status: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  if (isLoading) return <div className="p-6 text-slate-400">Laden...</div>
  if (!event) return <div className="p-6 text-red-500">Evenement niet gevonden</div>

  const startEdit = () => {
    setEditForm({
      title: event.title,
      description: event.description ?? '',
      location: event.location ?? '',
      start_at: event.start_at.slice(0, 16),
      end_at: event.end_at.slice(0, 16),
      max_attendees: String(event.max_attendees ?? ''),
      status: event.status,
    })
    setEditing(true)
  }

  const confirmedCount = event.attendees.filter((a) => a.rsvp_status === 'confirmed' || a.rsvp_status === 'attended').length

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/events')} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{event.title}</h1>
        <StatusBadge status={event.status} type="event" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Event info */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Evenementdetails</h2>
            {editing ? (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                <button onClick={() => updateMutation.mutate()} className="flex items-center gap-1 text-indigo-600 text-sm font-medium">
                  <Save size={16} /> Opslaan
                </button>
              </div>
            ) : (
              <button onClick={startEdit} className="flex items-center gap-1 text-slate-400 hover:text-slate-600 text-sm">
                <Edit2 size={15} /> Bewerken
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <Input label="Titel" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              <Textarea label="Beschrijving" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              <Input label="Locatie" value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Start" type="datetime-local" value={editForm.start_at} onChange={(e) => setEditForm((f) => ({ ...f, start_at: e.target.value }))} />
                <Input label="Einde" type="datetime-local" value={editForm.end_at} onChange={(e) => setEditForm((f) => ({ ...f, end_at: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Max deelnemers" type="number" value={editForm.max_attendees} onChange={(e) => setEditForm((f) => ({ ...f, max_attendees: e.target.value }))} />
                <Select label="Status" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                  {(['draft', 'published', 'cancelled', 'completed'] as EventStatus[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Clock size={15} className="text-slate-400 mt-0.5" />
                <div>
                  <dt className="text-xs text-slate-500">Datum & tijd</dt>
                  <dd className="text-slate-900">
                    {new Date(event.start_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' → '}
                    {new Date(event.end_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </dd>
                </div>
              </div>
              {event.location && (
                <div className="flex items-start gap-2">
                  <MapPin size={15} className="text-slate-400 mt-0.5" />
                  <div>
                    <dt className="text-xs text-slate-500">Locatie</dt>
                    <dd className="text-slate-900">{event.location}</dd>
                  </div>
                </div>
              )}
              {event.description && (
                <div>
                  <dt className="text-xs text-slate-500">Beschrijving</dt>
                  <dd className="text-slate-700 mt-1 whitespace-pre-wrap">{event.description}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Statistieken</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{event.attendees.length}</p>
              <p className="text-xs text-slate-500">Uitgenodigd</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{confirmedCount}</p>
              <p className="text-xs text-green-600">Bevestigd</p>
            </div>
          </div>
          {event.max_attendees && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Capaciteit</span>
                <span>{event.attendees.length} / {event.max_attendees}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (event.attendees.length / event.max_attendees) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attendees */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Users size={17} /> Deelnemers ({event.attendees.length})
          </h2>
          <button onClick={() => setShowAddAttendee(true)} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
            <Plus size={15} /> Toevoegen
          </button>
        </div>
        {event.attendees.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nog geen deelnemers</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">Naam</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">E-mail</th>
                <th className="text-left px-5 py-3 text-slate-500 font-medium">RSVP</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {event.attendees.map((attendee) => (
                <tr key={attendee.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {attendee.contact.first_name} {attendee.contact.last_name}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{attendee.contact.email ?? '—'}</td>
                  <td className="px-5 py-3">
                    <select
                      value={attendee.rsvp_status}
                      onChange={(e) => updateRSVP.mutate({ attendeeId: attendee.id, status: e.target.value as RSVPStatus })}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {rsvpStatuses.map((s) => <option key={s} value={s}>{rsvpLabels[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => { if (confirm('Deelnemer verwijderen?')) removeAttendeeMutation.mutate({ attendeeId: attendee.id }) }}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddAttendee && (
        <Modal title="Deelnemer toevoegen" onClose={() => setShowAddAttendee(false)}>
          <AddAttendeeModal
            eventId={eventId}
            existingContactIds={event.attendees.map((a) => a.contact_id)}
            onClose={() => setShowAddAttendee(false)}
          />
        </Modal>
      )}
    </div>
  )
}
