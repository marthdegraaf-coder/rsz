import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Settings, RefreshCw, CheckCircle, Package, ShoppingCart, Users, Calendar } from 'lucide-react'
import { Input } from '../components/FormField'

interface WooConfig {
  store_url: string
  last_synced_at: string | null
}

interface SyncResult {
  contacts_created: number
  contacts_updated: number
  orders_synced: number
  products_synced: number
  events_synced: number
}

const api = axios.create({ baseURL: '/api' })

export default function WooCommercePage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ store_url: '', consumer_key: '', consumer_secret: '' })
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [configError, setConfigError] = useState('')

  const { data: config } = useQuery<WooConfig | null>({
    queryKey: ['woo-config'],
    queryFn: () => api.get('/woocommerce/config').then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: () => api.post('/woocommerce/config', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['woo-config'] })
      setConfigError('')
    },
    onError: (e: any) => {
      setConfigError(e.response?.data?.detail ?? 'Verbinding mislukt')
    },
  })

  const syncMutation = useMutation({
    mutationFn: (): Promise<SyncResult> => api.post('/woocommerce/sync').then((r) => r.data),
    onSuccess: (data) => {
      setSyncResult(data)
      qc.invalidateQueries({ queryKey: ['woo-config'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['woo-products'] })
      qc.invalidateQueries({ queryKey: ['woo-orders'] })
      qc.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings size={22} /> WooCommerce Koppeling
        </h1>
        <p className="text-slate-500 text-sm mt-1">Importeer klanten, bestellingen en producten vanuit je webshop</p>
      </div>

      {/* Config form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">API Instellingen</h2>
        <p className="text-sm text-slate-500">
          Maak API-sleutels aan via <strong>WooCommerce → Instellingen → Geavanceerd → REST API</strong> met <strong>Lezen</strong> rechten.
        </p>
        <Input
          label="Winkel URL"
          placeholder="https://jouwwinkel.nl"
          value={form.store_url}
          onChange={(e) => set('store_url', e.target.value)}
        />
        <Input
          label="Consumer Key"
          placeholder="ck_..."
          value={form.consumer_key}
          onChange={(e) => set('consumer_key', e.target.value)}
        />
        <Input
          label="Consumer Secret"
          type="password"
          placeholder="cs_..."
          value={form.consumer_secret}
          onChange={(e) => set('consumer_secret', e.target.value)}
        />
        {configError && <p className="text-sm text-red-500">{configError}</p>}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!form.store_url || !form.consumer_key || !form.consumer_secret || saveMutation.isPending}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Verbinden...' : 'Verbinding opslaan & testen'}
        </button>
        {saveMutation.isSuccess && (
          <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle size={14} /> Verbinding succesvol!</p>
        )}
      </div>

      {/* Sync */}
      {config && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Synchroniseren</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Verbonden met <strong>{config.store_url}</strong>
              </p>
              {config.last_synced_at && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Laatste sync: {new Date(config.last_synced_at).toLocaleString('nl-NL')}
                </p>
              )}
            </div>
            <button
              onClick={() => { setSyncResult(null); syncMutation.mutate() }}
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
              <div className="bg-emerald-50 rounded-lg p-4 flex items-center gap-3">
                <ShoppingCart size={20} className="text-emerald-600" />
                <div>
                  <p className="text-lg font-bold text-emerald-700">{syncResult.orders_synced}</p>
                  <p className="text-xs text-emerald-600">Bestellingen gesynchroniseerd</p>
                </div>
              </div>
              <div className="bg-violet-50 rounded-lg p-4 flex items-center gap-3">
                <Package size={20} className="text-violet-600" />
                <div>
                  <p className="text-lg font-bold text-violet-700">{syncResult.products_synced}</p>
                  <p className="text-xs text-violet-600">Producten gesynchroniseerd</p>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 flex items-center gap-3 col-span-2">
                <Calendar size={20} className="text-emerald-600" />
                <div>
                  <p className="text-lg font-bold text-emerald-700">{syncResult.events_synced}</p>
                  <p className="text-xs text-emerald-600">Evenementen gesynchroniseerd vanuit producten</p>
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
          <li className="flex items-center gap-2"><Users size={14} className="text-indigo-500" /> <strong>Klanten</strong> → worden automatisch als contacten toegevoegd (gematcht op e-mail)</li>
          <li className="flex items-center gap-2"><ShoppingCart size={14} className="text-emerald-500" /> <strong>Bestellingen</strong> → zichtbaar op de contactpagina met alle bestelregels</li>
          <li className="flex items-center gap-2"><Package size={14} className="text-violet-500" /> <strong>Producten</strong> → naam, SKU, prijs, voorraad en categorieën</li>
          <li className="flex items-center gap-2"><Calendar size={14} className="text-emerald-500" /> <strong>Evenementen</strong> → producten in een evenementen-categorie worden als evenement aangemaakt (datum en locatie uit product-attributen)</li>
        </ul>
      </div>
    </div>
  )
}
