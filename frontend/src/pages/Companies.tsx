import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2, ExternalLink } from 'lucide-react'
import { fetchCompanies, createCompany, deleteCompany } from '../api/client'
import Modal from '../components/Modal'
import { Input, Textarea } from '../components/FormField'

function CompanyForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '', website: '', phone: '', email: '', address: '', industry: '', notes: '',
  })
  const mutation = useMutation({
    mutationFn: () => createCompany(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); qc.invalidateQueries({ queryKey: ['stats'] }); onClose() },
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
      <Input label="Bedrijfsnaam *" required value={form.name} onChange={(e) => set('name', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Website" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." />
        <Input label="Branche" value={form.industry} onChange={(e) => set('industry', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="E-mail" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Input label="Telefoon" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>
      <Input label="Adres" value={form.address} onChange={(e) => set('address', e.target.value)} />
      <Textarea label="Notities" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600">Annuleren</button>
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {mutation.isPending ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>
    </form>
  )
}

export default function Companies() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies', q],
    queryFn: () => fetchCompanies({ q: q || undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); qc.invalidateQueries({ queryKey: ['stats'] }) },
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bedrijven</h1>
          <p className="text-slate-500 text-sm mt-1">{companies.length} bedrijven</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> Nieuw bedrijf
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Zoeken..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Laden...</p>
      ) : companies.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-sm">Geen bedrijven gevonden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((company) => (
            <div key={company.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-200 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <Link to={`/companies/${company.id}`} className="font-semibold text-slate-900 hover:text-indigo-600 block truncate">
                    {company.name}
                  </Link>
                  {company.industry && <p className="text-xs text-slate-500 mt-0.5">{company.industry}</p>}
                </div>
                <button
                  onClick={() => { if (confirm('Bedrijf verwijderen?')) deleteMutation.mutate(company.id) }}
                  className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-2 flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <dl className="mt-3 space-y-1.5">
                {company.email && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <span className="text-xs text-slate-400">✉</span> {company.email}
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <span className="text-xs text-slate-400">📞</span> {company.phone}
                  </div>
                )}
                {company.website && (
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={12} /> {company.website}
                  </a>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Nieuw bedrijf" onClose={() => setShowAdd(false)}>
          <CompanyForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}
    </div>
  )
}
