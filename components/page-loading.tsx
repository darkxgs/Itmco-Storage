import { Loader2 } from "lucide-react"

// Full-screen loading state in the app's dark theme
export function PageLoading({ label = "جاري التحميل..." }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-slate-300">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  )
}
