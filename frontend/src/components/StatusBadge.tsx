import type { ContactStatus, EventStatus, RSVPStatus } from '../api/types'

const contactColors: Record<ContactStatus, string> = {
  lead: 'bg-blue-100 text-blue-700',
  prospect: 'bg-yellow-100 text-yellow-700',
  customer: 'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-500',
}

const eventColors: Record<EventStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-indigo-100 text-indigo-700',
}

const rsvpColors: Record<RSVPStatus, string> = {
  invited: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
  attended: 'bg-indigo-100 text-indigo-700',
}

const labels: Record<string, string> = {
  lead: 'Lead',
  prospect: 'Prospect',
  customer: 'Klant',
  inactive: 'Inactief',
  draft: 'Concept',
  published: 'Gepubliceerd',
  cancelled: 'Geannuleerd',
  completed: 'Afgelopen',
  invited: 'Uitgenodigd',
  confirmed: 'Bevestigd',
  declined: 'Geweigerd',
  attended: 'Aanwezig',
}

interface Props {
  status: ContactStatus | EventStatus | RSVPStatus
  type: 'contact' | 'event' | 'rsvp'
}

export default function StatusBadge({ status, type }: Props) {
  const colorMap = type === 'contact' ? contactColors : type === 'event' ? eventColors : rsvpColors
  const color = (colorMap as Record<string, string>)[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {labels[status] ?? status}
    </span>
  )
}
