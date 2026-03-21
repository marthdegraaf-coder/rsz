interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  children: React.ReactNode
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

const base = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

export function Input({ label, error, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input className={base} {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Select({ label, error, children, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <select className={base} {...props}>{children}</select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, ...props }: TextareaProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <textarea className={`${base} resize-none`} rows={3} {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
