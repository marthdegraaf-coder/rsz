import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2, MapPin, Users } from 'lucide-react'
import { fetchEvents, createEvent, deleteEvent } from '../api/client'
import type { EventStatus } from '../api/types'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { Input, Select, Textarea } from '../components/FormField'

const statuses: EventStatus[] = ['draft', 'published', 'cancelled', 'completed']
const statusLabels: Record<EventStatus, string> = {
  draft: 'Concept', published: 'Gepubliceerd', cancelled: 'Geannuleerd', completed: 'Afgelopen',
}

function EventForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const now = new Date()
  const defaultStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  const defaultEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)

  const [form, setForm] = useState({
    title: '', description: '', location: '',
    start_at: defaultStart, end_at: defaultEnd,
    max_attendees: '', status: 'draft' as EventStatus,
  })

  const mutation = useMutation({
    mutationFn: () => createEvent({
      ...form,
      max_attendees: form.max_attendees ? Number(form.max_attendees) : undefined,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); qc.invalidateQueries({ queryKey: ['stats'] }); onClose() },
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
      <Input label="Titel *" required value={form.title} onChange={(e) => set('title', e.target.value)} />
      <Textarea label="Beschrijving" value={form.description} onChange={(e) => set('description', e.target.value)} />
      <Input label="Locatie" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Adres of online link" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Start *" required type="datetime-local" value={form.start_at} onChange={(e) => set('start_at', e.target.value)} />
        <Input label="Einde *" required type="datetime-local" value={form.end_at} onChange={(e) => set('end_at', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Max deelnemers" type="number" min="1" value={form.max_attendees} onChange={(e) => set('max_attendees', e.target.value)} />
        <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
          {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Annuleren</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {mutation.isPending ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </form>
  )
}

export default function Events() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<EventStatus | ''>('')
  const [showAdd, setShowAdd] = useState(false)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', q, statusFilter],
    queryFn: () => fetchEvents({ q: q || undefined, status: statusFilter || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); qc.invalidateQueries({ queryKey: ['stats'] }) },
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Evenementen</h1>
          <p className="text-slate-500 text-sm mt-1">{events.length} evenementen</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> Nieuw evenement
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Zoeken..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EventStatus | '')}
        >
          <option value="">Alle statussen</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Laden...</p>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">Geen evenementen gevonden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-200 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <Link to={`/events/${event.id}`} className="font-semibold text-slate-900 hover:text-indigo-600 block">
                    {event.title}
                  </Link>
                  <div className="mt-1">
                    <StatusBadge status={event.status} type="event" />
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm('Evenement verwijderen?')) deleteMutation.mutate(event.id) }}
                  className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">📅</span>
                  {new Date(event.start_at).toLocaleDateString('nl-NL', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </div>
                {event.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-slate-400" />
                    <span className="truncate">{event.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-slate-400" />
                  {event.attendees.length} deelnemers
                  {event.max_attendees ? ` / ${event.max_attendees}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Nieuw evenement" onClose={() => setShowAdd(false)} size="lg">
          <EventForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}
    </div>
  )
}
