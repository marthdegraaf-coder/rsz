import { useQuery } from '@tanstack/react-query'
import { fetchStats, fetchEvents, fetchContacts } from '../api/client'
import { Users, Building2, Calendar, TrendingUp } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { Link } from 'react-router-dom'

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: fetchStats })
  const { data: events } = useQuery({ queryKey: ['events'], queryFn: () => fetchEvents({ status: 'published' }) })
  const { data: contacts } = useQuery({ queryKey: ['contacts-recent'], queryFn: () => fetchContacts() })

  const upcomingEvents = events?.filter((e) => new Date(e.start_at) >= new Date()).slice(0, 5) ?? []
  const recentContacts = contacts?.slice(0, 5) ?? []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overzicht van je CRM & evenementen</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Contacten" value={stats?.total_contacts ?? 0} icon={Users} color="bg-indigo-500" />
        <StatCard label="Bedrijven" value={stats?.total_companies ?? 0} icon={Building2} color="bg-sky-500" />
        <StatCard label="Evenementen" value={stats?.total_events ?? 0} icon={Calendar} color="bg-emerald-500" />
        <StatCard label="Klanten" value={stats?.customers ?? 0} icon={TrendingUp} color="bg-violet-500" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Upcoming events */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Aankomende Evenementen</h2>
            <Link to="/events" className="text-xs text-indigo-600 hover:underline">Alle evenementen</Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Geen aankomende evenementen</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingEvents.map((event) => (
                <li key={event.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                  <Link to={`/events/${event.id}`} className="block">
                    <p className="font-medium text-slate-900 text-sm">{event.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(event.start_at).toLocaleDateString('nl-NL', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                      {event.location && ` · ${event.location}`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent contacts */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recente Contacten</h2>
            <Link to="/contacts" className="text-xs text-indigo-600 hover:underline">Alle contacten</Link>
          </div>
          {recentContacts.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Nog geen contacten</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentContacts.map((contact) => (
                <li key={contact.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                  <Link to={`/contacts/${contact.id}`} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{contact.first_name} {contact.last_name}</p>
                      <p className="text-xs text-slate-500">{contact.job_title ?? contact.email ?? '—'}</p>
                    </div>
                    <StatusBadge status={contact.status} type="contact" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
