import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, ExternalLink } from 'lucide-react'
import { fetchClickUpConfig, saveClickUpConfig } from '../api/client'
import { Input } from '../components/FormField'

export default function ClickUpPage() {
  const qc = useQueryClient()
  const { data: config, isLoading } = useQuery({
    queryKey: ['clickup-config'],
    queryFn: fetchClickUpConfig,
  })

  const [form, setForm] = useState({ api_token: '', list_id: '' })
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: () => saveClickUpConfig({ api_token: form.api_token, list_id: form.list_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clickup-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  // Pre-fill form when config loads
  const handleFocus = () => {
    if (!form.api_token && !form.list_id && config) {
      setForm({ api_token: '', list_id: config.list_id ?? '' })
    }
  }

  if (isLoading) return <div className="p-6 text-slate-400">Laden...</div>

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ClickUp koppeling</h1>
        <p className="text-sm text-slate-500 mt-1">
          Opvolgacties worden automatisch als taak aangemaakt in ClickUp.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900 mb-1">Status</h2>
          {config?.list_id ? (
            <p className="text-sm text-green-600 font-medium">Gekoppeld — lijst {config.list_id}</p>
          ) : (
            <p className="text-sm text-slate-500">Nog niet geconfigureerd</p>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
          className="space-y-4"
          onFocus={handleFocus}
        >
          <Input
            label="API Token (Personal Token)"
            type="password"
            placeholder="pk_..."
            value={form.api_token}
            onChange={(e) => setForm((f) => ({ ...f, api_token: e.target.value }))}
          />
          <Input
            label="Lijst ID"
            placeholder="bijv. 901234567"
            value={form.list_id}
            onChange={(e) => setForm((f) => ({ ...f, list_id: e.target.value }))}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={mutation.isPending || !form.api_token || !form.list_id}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save size={15} /> Opslaan
            </button>
            {saved && <span className="text-sm text-green-600">Opgeslagen!</span>}
          </div>
        </form>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-2 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Hoe werkt het?</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Ga in ClickUp naar <strong>Instellingen → Apps → API</strong> en genereer een Personal API Token.</li>
          <li>Ga naar de gewenste lijst in ClickUp. De lijst-ID staat in de URL: <code className="bg-white px-1 rounded">/list/<strong>901234567</strong></code></li>
          <li>Vul beide velden in en sla op.</li>
          <li>Elke opvolgactie die je aanmaakt bij een contact wordt automatisch als taak in die lijst gezet.</li>
        </ol>
        <a
          href="https://clickup.com/api"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-indigo-600 hover:underline mt-2"
        >
          ClickUp API documentatie <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}
