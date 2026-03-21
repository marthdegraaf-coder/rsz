import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { fetchContacts, createContact, deleteContact, fetchCompanies } from '../api/client'
import type { ContactStatus } from '../api/types'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import { Input, Select, Textarea } from '../components/FormField'

const statuses: ContactStatus[] = ['lead', 'prospect', 'customer', 'inactive']
const statusLabels: Record<ContactStatus, string> = {
  lead: 'Lead', prospect: 'Prospect', customer: 'Klant', inactive: 'Inactief',
}

function ContactForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: () => fetchCompanies() })
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    job_title: '', status: 'lead' as ContactStatus, company_id: '', notes: '',
  })

  const mutation = useMutation({
    mutationFn: () => createContact({
      ...form,
      company_id: form.company_id ? Number(form.company_id) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['stats'] }); onClose() },
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Voornaam *" required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
        <Input label="Achternaam *" required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="E-mail" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Input label="Telefoon" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Functietitel" value={form.job_title} onChange={(e) => set('job_title', e.target.value)} />
        <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
          {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </Select>
      </div>
      <Select label="Bedrijf" value={form.company_id} onChange={(e) => set('company_id', e.target.value)}>
        <option value="">— Geen bedrijf —</option>
        {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Textarea label="Notities" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Annuleren</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {mutation.isPending ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </form>
  )
}

export default function Contacts() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | ''>('')
  const [showAdd, setShowAdd] = useState(false)

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', q, statusFilter],
    queryFn: () => fetchContacts({ q: q || undefined, status: statusFilter || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['stats'] }) },
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacten</h1>
          <p className="text-slate-500 text-sm mt-1">{contacts.length} contacten</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> Nieuw contact
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
          onChange={(e) => setStatusFilter(e.target.value as ContactStatus | '')}
        >
          <option value="">Alle statussen</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <p className="text-center text-slate-400 py-12 text-sm">Laden...</p>
        ) : contacts.length === 0 ? (
          <p className="text-center text-slate-400 py-12 text-sm">Geen contacten gevonden</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Naam</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">E-mail</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Functie</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Bedrijf</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/contacts/${contact.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {contact.first_name} {contact.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{contact.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{contact.job_title ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{contact.company?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={contact.status} type="contact" />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { if (confirm('Contact verwijderen?')) deleteMutation.mutate(contact.id) }}
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

      {showAdd && (
        <Modal title="Nieuw contact" onClose={() => setShowAdd(false)}>
          <ContactForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}
    </div>
  )
}
