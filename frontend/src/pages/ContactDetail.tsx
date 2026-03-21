import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Phone, Mail, Building2, Edit2, Save, X, Plus, ShoppingCart, CheckSquare, Square, Trash2, ExternalLink } from 'lucide-react'
import axios from 'axios'
import {
  fetchContact, updateContact, fetchContactActivities,
  addActivity, fetchCompanies, fetchTodos, createTodo, updateTodo, deleteTodo,
} from '../api/client'
import type { Contact, ContactStatus, ActivityType, Todo } from '../api/types'
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

function AddTodoModal({ contactId, onClose }: { contactId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ title: '', description: '', due_date: '' })
  const mutation = useMutation({
    mutationFn: () => createTodo(contactId, {
      title: form.title,
      description: form.description || undefined,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['todos', contactId] }); onClose() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
      <Input label="Titel *" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      <Textarea label="Omschrijving / verslag" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <Input label="Deadline" type="datetime-local" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Annuleren</button>
        <button type="submit" disabled={mutation.isPending || !form.title} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          Opslaan{mutation.isPending ? '…' : ''}
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

  const { data: todos = [] } = useQuery({
    queryKey: ['todos', contactId],
    queryFn: () => fetchTodos(contactId),
  })

  const [editing, setEditing] = useState(false)
  const [showAddActivity, setShowAddActivity] = useState(false)
  const [showAddTodo, setShowAddTodo] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Contact>>({})

  const updateMutation = useMutation({
    mutationFn: () => updateContact(contactId, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditing(false)
    },
  })

  const toggleTodo = useMutation({
    mutationFn: ({ todo }: { todo: Todo }) => updateTodo(contactId, todo.id, { done: !todo.done }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos', contactId] }),
  })

  const removeTodo = useMutation({
    mutationFn: ({ todoId }: { todoId: number }) => deleteTodo(contactId, todoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos', contactId] }),
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

      {/* Todos */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <CheckSquare size={17} />
            Opvolging
            {todos.filter((t) => !t.done).length > 0 && (
              <span className="ml-1 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {todos.filter((t) => !t.done).length} open
              </span>
            )}
          </h2>
          <button onClick={() => setShowAddTodo(true)} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
            <Plus size={15} /> Toevoegen
          </button>
        </div>
        {todos.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Geen openstaande acties</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {todos.map((todo) => (
              <li key={todo.id} className={`px-5 py-3 flex gap-3 items-start ${todo.done ? 'opacity-50' : ''}`}>
                <button
                  onClick={() => toggleTodo.mutate({ todo })}
                  className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors flex-shrink-0"
                >
                  {todo.done ? <CheckSquare size={18} className="text-green-500" /> : <Square size={18} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium text-slate-900 ${todo.done ? 'line-through' : ''}`}>{todo.title}</p>
                  {todo.description && (
                    <p className="text-sm text-slate-500 mt-0.5 whitespace-pre-wrap">{todo.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {todo.due_date && (
                      <span className={`text-xs ${!todo.done && new Date(todo.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                        Deadline: {new Date(todo.due_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {todo.clickup_task_id && (
                      <span className="text-xs text-purple-500 flex items-center gap-1">
                        <ExternalLink size={11} /> ClickUp
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm('Actie verwijderen?')) removeTodo.mutate({ todoId: todo.id }) }}
                  className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
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

      {/* Orders */}
      <OrderHistory contactId={contactId} />

      {showAddActivity && (
        <Modal title="Activiteit toevoegen" onClose={() => setShowAddActivity(false)}>
          <AddActivityModal contactId={contactId} onClose={() => setShowAddActivity(false)} />
        </Modal>
      )}

      {showAddTodo && (
        <Modal title="Opvolgactie toevoegen" onClose={() => setShowAddTodo(false)}>
          <AddTodoModal contactId={contactId} onClose={() => setShowAddTodo(false)} />
        </Modal>
      )}
    </div>
  )
}

const orderStatusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-600',
  refunded: 'bg-slate-100 text-slate-500',
  failed: 'bg-red-100 text-red-600',
  'on-hold': 'bg-orange-100 text-orange-700',
}

const orderStatusLabels: Record<string, string> = {
  completed: 'Voltooid',
  processing: 'In behandeling',
  pending: 'In afwachting',
  cancelled: 'Geannuleerd',
  refunded: 'Terugbetaald',
  failed: 'Mislukt',
  'on-hold': 'In de wacht',
}

function OrderHistory({ contactId }: { contactId: number }) {
  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ['woo-orders', contactId],
    queryFn: () => axios.get('/api/woocommerce/orders', { params: { contact_id: contactId } }).then((r) => r.data),
  })

  if (orders.length === 0) return null

  const totalSpent = orders.filter((o) => o.status === 'completed').reduce((sum, o) => sum + (o.total ?? 0), 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <ShoppingCart size={17} /> Bestellingen ({orders.length})
        </h2>
        <span className="text-sm text-slate-500">Totaal besteed: <strong className="text-slate-900">€{totalSpent.toFixed(2)}</strong></span>
      </div>
      <ul className="divide-y divide-slate-100">
        {orders.map((order) => (
          <li key={order.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-900 text-sm">Bestelling #{order.woo_id}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${orderStatusColors[order.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {orderStatusLabels[order.status] ?? order.status}
                  </span>
                </div>
                <ul className="text-xs text-slate-500 space-y-0.5">
                  {order.items.map((item: any, i: number) => (
                    <li key={i}>{item.quantity}× {item.name} — €{Number(item.total).toFixed(2)}</li>
                  ))}
                </ul>
                {order.ordered_at && (
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(order.ordered_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {order.payment_method_title && ` · ${order.payment_method_title}`}
                  </p>
                )}
              </div>
              <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">€{Number(order.total).toFixed(2)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
