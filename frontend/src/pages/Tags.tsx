import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { fetchTags, createTag } from '../api/client'
import axios from 'axios'

const presetColors = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6b7280',
]

export default function Tags() {
  const qc = useQueryClient()
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: fetchTags })
  const [name, setName] = useState('')
  const [color, setColor] = useState(presetColors[0])
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: () => createTag({ name: name.trim(), color }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); setName(''); setError('') },
    onError: (e) => {
      if (axios.isAxiosError(e) && e.response?.status === 409) setError('Tag bestaat al')
      else setError('Er ging iets mis')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`/api/tags/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tags</h1>
        <p className="text-slate-500 text-sm mt-1">Beheer labels voor contacten en evenementen</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Nieuwe tag</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) createMutation.mutate() }}
          className="space-y-3"
        >
          <div className="flex gap-3">
            <input
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Tagnaam..."
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
            />
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus size={16} /> Toevoegen
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {presetColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-white text-xs font-medium"
              style={{ background: color }}
            >
              {name || 'Voorbeeld tag'}
            </span>
            <span className="text-slate-400">Voorbeeld</span>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Bestaande tags ({tags.length})</h2>
        </div>
        {tags.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nog geen tags aangemaakt</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tags.map((tag) => (
              <li key={tag.id} className="px-5 py-3 flex items-center justify-between">
                <span
                  className="inline-flex items-center px-3 py-1 rounded-full text-white text-sm font-medium"
                  style={{ background: tag.color }}
                >
                  {tag.name}
                </span>
                <button
                  onClick={() => { if (confirm('Tag verwijderen?')) deleteMutation.mutate(tag.id) }}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
