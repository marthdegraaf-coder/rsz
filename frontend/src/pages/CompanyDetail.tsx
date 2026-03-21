import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Save, X, ExternalLink } from 'lucide-react'
import { fetchCompany, updateCompany } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import { Input, Textarea } from '../components/FormField'

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const companyId = Number(id)

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => fetchCompany(companyId),
  })

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})

  const updateMutation = useMutation({
    mutationFn: () => updateCompany(companyId, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', companyId] })
      qc.invalidateQueries({ queryKey: ['companies'] })
      setEditing(false)
    },
  })

  if (isLoading) return <div className="p-6 text-slate-400">Laden...</div>
  if (!company) return <div className="p-6 text-red-500">Bedrijf niet gevonden</div>

  const startEdit = () => {
    setEditForm({
      name: company.name,
      website: company.website ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      address: company.address ?? '',
      industry: company.industry ?? '',
      notes: company.notes ?? '',
    })
    setEditing(true)
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/companies')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
        {company.industry && (
          <span className="text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{company.industry}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Bedrijfsgegevens</h2>
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
              <Input label="Naam" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Website" value={editForm.website} onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))} />
                <Input label="Branche" value={editForm.industry} onChange={(e) => setEditForm((f) => ({ ...f, industry: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="E-mail" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                <Input label="Telefoon" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <Input label="Adres" value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
              <Textarea label="Notities" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              {[
                { label: 'E-mail', value: company.email },
                { label: 'Telefoon', value: company.phone },
                { label: 'Adres', value: company.address },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-slate-900">{value ?? '—'}</dd>
                </div>
              ))}
              {company.website && (
                <div>
                  <dt className="text-xs text-slate-500">Website</dt>
                  <dd>
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> {company.website}
                    </a>
                  </dd>
                </div>
              )}
              {company.notes && (
                <div>
                  <dt className="text-xs text-slate-500">Notities</dt>
                  <dd className="whitespace-pre-wrap text-slate-700 mt-1">{company.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">
            Contacten ({(company as any).contacts?.length ?? 0})
          </h2>
          {(company as any).contacts?.length === 0 ? (
            <p className="text-sm text-slate-400">Geen contacten</p>
          ) : (
            <ul className="space-y-2">
              {(company as any).contacts?.map((c: any) => (
                <li key={c.id} className="flex items-center justify-between">
                  <Link to={`/contacts/${c.id}`} className="text-sm text-slate-900 hover:text-indigo-600">
                    {c.first_name} {c.last_name}
                  </Link>
                  <StatusBadge status={c.status} type="contact" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
