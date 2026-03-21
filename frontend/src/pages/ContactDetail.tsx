import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Phone, Mail, Building2, Edit2, Save, X, Plus } from 'lucide-react'
import {
  fetchContact, updateContact, fetchContactActivities,
  addActivity, fetchCompanies,
} from '../api/client'
import type { Contact, ContactStatus, ActivityType } from '../api/types'
import StatusBadge from '../components/StatusBadge'
import { Input, Select, Textarea } from '../components/FormField'
import Modal from '../components/Modal'

const activityIcons: Record<ActivityType, string> = {
  call: '📞', email: '✉️', meeting: '🤝', note: '📝',
}

const activityLabels: Record<ActivityType, string> = {
  call: 'Telefoongesprek', email: 'E-mail', meeting: 'Vergadering', note: 'Notitie',
}

function AddActivityModal({ contactId, onClose }: { contactId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ type: 'note' as ActivityType, title: '', description: '', occurred_at: '' })
  const mutation = useMutation({
    mutationFn: () => addActivity(contactId, { type: form.type, title: form.title, description: form.description || undefined, occurred_at: form.occurred_at || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['activities', contactId] }); onClose() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
      <Select label="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ActivityType }))}>
        {(Object.keys(activityLabels) as ActivityType[]).map((t) => (
          <option key={t} value={t}>{activityLabels[t]}</option>
        ))}
      </Select>
      <Input label="Titel *" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      <Textarea label="Beschrijving" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <Input label="Datum" type="datetime-local" value={form.occurred_at} onChange={(e) => setForm((f) => ({ ...f, occurred_at: e.target.value }))} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Annuleren</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          Toevoegen
        </button>
      </div>
    </form>
  )
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const contactId = Number(id)

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => fetchContact(contactId),
  })

  const { data: activities = [] } = useQuery({
    queryKey: ['activities', contactId],
    queryFn: () => fetchContactActivities(contactId),
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => fetchCompanies(),
  })

  const [editing, setEditing] = useState(false)
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Contact>>({})

  const updateMutation = useMutation({
    mutationFn: () => updateContact(contactId, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditing(false)
    },
  })

  if (isLoading) return <div className="p-6 text-slate-400">Laden...</div>
  if (!contact) return <div className="p-6 text-red-500">Contact niet gevonden</div>

  const startEdit = () => {
    setEditForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      job_title: contact.job_title,
      status: contact.status,
      company_id: contact.company_id,
      notes: contact.notes,
    })
    setEditing(true)
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/contacts')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          {contact.first_name} {contact.last_name}
        </h1>
        <StatusBadge status={contact.status} type="contact" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Contact info card */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Contactgegevens</h2>
            {editing ? (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-sm font-medium">
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
              <div className="grid grid-cols-2 gap-3">
                <Input label="Voornaam" value={editForm.first_name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} />
                <Input label="Achternaam" value={editForm.last_name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="E-mail" type="email" value={editForm.email ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                <Input label="Telefoon" value={editForm.phone ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Functietitel" value={editForm.job_title ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, job_title: e.target.value }))} />
                <Select label="Status" value={editForm.status ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as ContactStatus }))}>
                  {(['lead', 'prospect', 'customer', 'inactive'] as ContactStatus[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
              <Select label="Bedrijf" value={String(editForm.company_id ?? '')} onChange={(e) => setEditForm((f) => ({ ...f, company_id: e.target.value ? Number(e.target.value) : undefined }))}>
                <option value="">— Geen bedrijf —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Textarea label="Notities" value={editForm.notes ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          ) : (
            <dl className="space-y-3">
              {[
                { label: 'E-mail', value: contact.email, icon: <Mail size={14} /> },
                { label: 'Telefoon', value: contact.phone, icon: <Phone size={14} /> },
                { label: 'Functietitel', value: contact.job_title, icon: null },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">{icon}</span>
                  <div>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-sm text-slate-900">{value ?? '—'}</dd>
                  </div>
                </div>
              ))}
              {contact.company && (
                <div className="flex items-start gap-2">
                  <Building2 size={14} className="text-slate-400 mt-0.5" />
                  <div>
                    <dt className="text-xs text-slate-500">Bedrijf</dt>
                    <dd className="text-sm">
                      <Link to={`/companies/${contact.company.id}`} className="text-indigo-600 hover:underline">
                        {contact.company.name}
                      </Link>
                    </dd>
                  </div>
                </div>
              )}
              {contact.notes && (
                <div>
                  <dt className="text-xs text-slate-500">Notities</dt>
                  <dd className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{contact.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Tags</h2>
          {contact.tags.length === 0 ? (
            <p className="text-sm text-slate-400">Geen tags</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {contact.tags.map((tag) => (
                <span key={tag.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: tag.color }}>
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-3">
            Aangemeld: {new Date(contact.created_at).toLocaleDateString('nl-NL')}
          </p>
        </div>
      </div>

      {/* Activities */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Activiteiten</h2>
          <button onClick={() => setShowAddActivity(true)} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
            <Plus size={15} /> Toevoegen
          </button>
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nog geen activiteiten</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...activities].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).map((act) => (
              <li key={act.id} className="px-5 py-3 flex gap-3">
                <span className="text-lg">{activityIcons[act.type as ActivityType]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900">{act.title}</p>
                  {act.description && <p className="text-sm text-slate-500 mt-0.5">{act.description}</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(act.occurred_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAddActivity && (
        <Modal title="Activiteit toevoegen" onClose={() => setShowAddActivity(false)}>
          <AddActivityModal contactId={contactId} onClose={() => setShowAddActivity(false)} />
        </Modal>
      )}
    </div>
  )
}
