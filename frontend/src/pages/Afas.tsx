import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Settings, RefreshCw, CheckCircle, Users, Building2 } from 'lucide-react'
import { Input } from '../components/FormField'

interface AfasConfig {
  environment_id: string
  contacts_connector: string
  companies_connector: string | null
  last_synced_at: string | null
}

interface SyncResult {
  contacts_created: number
  contacts_updated: number
  companies_created: number
  companies_updated: number
}

const api = axios.create({ baseURL: '/api' })

export default function AfasPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    environment_id: '',
    api_token: '',
    contacts_connector: 'KP_Contactpersoon',
    companies_connector: '',
  })
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [configError, setConfigError] = useState('')

  const { data: config } = useQuery<AfasConfig | null>({
    queryKey: ['afas-config'],
    queryFn: () => api.get('/afas/config').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: () => api.post('/afas/config', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['afas-config'] })
      setConfigError('')
    },
    onError: (e: any) => {
      setConfigError(e.response?.data?.detail ?? 'Verbinding mislukt')
    },
  })

  const syncMutation = useMutation({
    mutationFn: (): Promise<SyncResult> => api.post('/afas/sync').then((r) => r.data),
    onSuccess: (data) => {
      setSyncResult(data)
      qc.invalidateQueries({ queryKey: ['afas-config'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings size={22} /> AFAS Koppeling
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Importeer contactpersonen en organisaties vanuit AFAS Profit
        </p>
      </div>

      {/* Config form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">API Instellingen</h2>
        <p className="text-sm text-slate-500">
          Maak een App Connector aan in AFAS via <strong>Beheer → App Connector</strong>. Gebruik het token dat je daar aanmaakt.
        </p>
        <Input
          label="Omgevingsnummer"
          placeholder="bijv. 12345"
          value={form.environment_id}
          onChange={(e) => set('environment_id', e.target.value)}
        />
        <Input
          label="API Token"
          type="password"
          placeholder="Plak hier je AFAS App Connector token"
          value={form.api_token}
          onChange={(e) => set('api_token', e.target.value)}
        />
        <Input
          label="Contactpersonen connector"
          placeholder="KP_Contactpersoon"
          value={form.contacts_connector}
          onChange={(e) => set('contacts_connector', e.target.value)}
        />
        <Input
          label="Organisaties connector (optioneel)"
          placeholder="bijv. KP_ZktDeb — laat leeg om over te slaan"
          value={form.companies_connector}
          onChange={(e) => set('companies_connector', e.target.value)}
        />
        {configError && <p className="text-sm text-red-500">{configError}</p>}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={
            !form.environment_id ||
            !form.api_token ||
            !form.contacts_connector ||
            saveMutation.isPending
          }
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Verbinden...' : 'Verbinding opslaan & testen'}
        </button>
        {saveMutation.isSuccess && (
          <p className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle size={14} /> Verbinding succesvol!
          </p>
        )}
      </div>

      {/* Sync */}
      {config && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Synchroniseren</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Omgeving <strong>{config.environment_id}</strong> · connector{' '}
                <strong>{config.contacts_connector}</strong>
                {config.companies_connector && (
                  <> + <strong>{config.companies_connector}</strong></>
                )}
              </p>
              {config.last_synced_at && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Laatste sync: {new Date(config.last_synced_at).toLocaleString('nl-NL')}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setSyncResult(null)
                syncMutation.mutate()
              }}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <RefreshCw size={15} className={syncMutation.isPending ? 'animate-spin' : ''} />
              {syncMutation.isPending ? 'Bezig met synchroniseren...' : 'Nu synchroniseren'}
            </button>
          </div>

          {syncMutation.isError && (
            <p className="text-sm text-red-500">
              Fout: {(syncMutation.error as any)?.response?.data?.detail ?? 'Synchronisatie mislukt'}
            </p>
          )}

          {syncResult && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-indigo-50 rounded-lg p-4 flex items-center gap-3">
                <Users size={20} className="text-indigo-600" />
                <div>
                  <p className="text-lg font-bold text-indigo-700">{syncResult.contacts_created}</p>
                  <p className="text-xs text-indigo-600">Nieuwe contacten</p>
                </div>
              </div>
              <div className="bg-sky-50 rounded-lg p-4 flex items-center gap-3">
                <Users size={20} className="text-sky-600" />
                <div>
                  <p className="text-lg font-bold text-sky-700">{syncResult.contacts_updated}</p>
                  <p className="text-xs text-sky-600">Contacten bijgewerkt</p>
                </div>
              </div>
              <div className="bg-violet-50 rounded-lg p-4 flex items-center gap-3">
                <Building2 size={20} className="text-violet-600" />
                <div>
                  <p className="text-lg font-bold text-violet-700">{syncResult.companies_created}</p>
                  <p className="text-xs text-violet-600">Nieuwe bedrijven</p>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 flex items-center gap-3">
                <Building2 size={20} className="text-emerald-600" />
                <div>
                  <p className="text-lg font-bold text-emerald-700">{syncResult.companies_updated}</p>
                  <p className="text-xs text-emerald-600">Bedrijven bijgewerkt</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="font-medium text-slate-700 mb-2">Wat wordt er gesynchroniseerd?</h3>
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <Users size={14} className="text-indigo-500" />
            <strong>Contactpersonen</strong> → naam, e-mail, telefoon, functie (gematcht op AFAS-ID of e-mail)
          </li>
          <li className="flex items-center gap-2">
            <Building2 size={14} className="text-violet-500" />
            <strong>Organisaties</strong> → naam, website, telefoon (alleen indien connector ingesteld)
          </li>
        </ul>
        <p className="text-xs text-slate-400 mt-3">
          Standaard veldnamen: <code>BcCo</code> (ID), <code>FiNm</code> (voornaam), <code>LaNm</code> (achternaam),{' '}
          <code>Em</code> (e-mail), <code>MbNr</code>/<code>TeNr</code> (telefoon), <code>FuNm</code> (functie).
          Pas de connector aan in AFAS als de veldnamen afwijken.
        </p>
      </div>
    </div>
  )
}
