import type { InputHTMLAttributes, ReactNode } from 'react'
import { FileCheck2 } from 'lucide-react'

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="registration-section border-b border-slate-200 py-7 last:border-b-0 dark:border-white/10">
      <h2 className="flex items-center gap-3 text-xl font-black tracking-tight text-slate-950 dark:text-white"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,.12)]" />{title}</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">{children}</div>
    </section>
  )
}

export function Field({
  label,
  name,
  placeholder,
  required = false,
  type = 'text',
  wide = false,
  action,
  ...inputProps
}: {
  label: string
  name: string
  placeholder: string
  required?: boolean
  type?: string
  wide?: boolean
  action?: ReactNode
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'placeholder' | 'required' | 'type'>) {
  return (
    <label className={`grid gap-2 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <span className="registration-input flex overflow-hidden rounded-2xl border border-slate-200 bg-white transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100 dark:border-white/10 dark:bg-white/10 dark:focus-within:ring-emerald-400/10">
        <input
          name={name}
          placeholder={placeholder}
          required={required}
          type={type}
          {...inputProps}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none"
        />
        {action}
      </span>
    </label>
  )
}

export function SelectField({ label, name, options, required = false }: { label: string; name: string; options: string[]; required?: boolean }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <select
        name={name}
        required={required}
        className="registration-input rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/10 dark:focus:ring-emerald-400/10"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

export function UploadBox({ title }: { title: string }) {
  return (
    <div className="registration-upload rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-emerald-400/10">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <FileCheck2 size={23} />
        </span>
        <div>
          <p className="font-black text-slate-950 dark:text-white">{title}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upload PDF, JPG, or PNG</p>
          <button type="button" className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-white/10 dark:text-emerald-100 dark:ring-emerald-400/20">
            Choose File
          </button>
        </div>
      </div>
    </div>
  )
}
