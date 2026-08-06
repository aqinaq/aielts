import { Loader2 } from 'lucide-react'

export default function Loader({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Loader2 className="size-8 animate-spin text-indigo-600" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
