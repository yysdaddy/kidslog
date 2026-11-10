import { useRef, useState } from 'react'
import { uploadMedia, api, type Attachment } from '../api'
import { Camera, ImagePlus, X, Play, Loader2 } from 'lucide-react'
import { useScrollLock } from '../hooks/useScrollLock'

type Props = {
  childId: string
  value: Attachment[]
  onChange: (next: Attachment[]) => void
  max?: number
}

type Uploading = { key: string; name: string; pct: number }

export default function MediaPicker({ childId, value, onChange, max = 9 }: Props) {
  useScrollLock()
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<Uploading[]>([])
  const [error, setError] = useState('')
  const latest = useRef<Attachment[]>(value)
  latest.current = value

  const full = value.length + uploading.length >= max

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    const list = Array.from(files).slice(0, Math.max(0, max - value.length - uploading.length))
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`
      setUploading((u) => [...u, { key, name: file.name, pct: 0 }])
      try {
        const att = await uploadMedia(childId, file, (pct) => {
          setUploading((u) => u.map((x) => (x.key === key ? { ...x, pct } : x)))
        })
        const next = [...latest.current, att]
        latest.current = next
        onChange(next)
      } catch (e: any) {
        setError(e.message || '上传失败')
      } finally {
        setUploading((u) => u.filter((x) => x.key !== key))
      }
    }
  }

  async function remove(att: Attachment) {
    const next = latest.current.filter((a) => a.id !== att.id)
    latest.current = next
    onChange(next)
    if (!att.recordId) await api.deleteMedia(att.id).catch(() => {})
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-slate-400">照片 / 视频</label>
        <span className="text-[11px] text-slate-300">{value.length}/{max}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {value.map((a) => (
          <div key={a.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
            <img src={a.thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            {a.kind === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="w-6 h-6 text-white drop-shadow" fill="currentColor" />
              </div>
            )}
            <button
              onClick={() => remove(a)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center"
              aria-label="移除"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {uploading.map((u) => (
          <div key={u.key} className="relative aspect-square rounded-xl bg-white shadow-soft flex flex-col items-center justify-center gap-1.5 px-2">
            <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
            <span className="text-[10px] text-slate-400 truncate max-w-full">{u.pct}%</span>
            <div className="absolute bottom-0 left-0 h-0.5 bg-brand-400 transition-all" style={{ width: `${u.pct}%` }} />
          </div>
        ))}

        {!full && (
          <>
            <button
              onClick={() => cameraRef.current?.click()}
              className="aspect-square rounded-xl bg-white shadow-soft flex flex-col items-center justify-center gap-1 text-slate-400 active:scale-95 transition"
            >
              <Camera className="w-5 h-5" strokeWidth={1.8} />
              <span className="text-[11px]">拍照</span>
            </button>
            <button
              onClick={() => albumRef.current?.click()}
              className="aspect-square rounded-xl bg-white shadow-soft flex flex-col items-center justify-center gap-1 text-slate-400 active:scale-95 transition"
            >
              <ImagePlus className="w-5 h-5" strokeWidth={1.8} />
              <span className="text-[11px]">相册</span>
            </button>
          </>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />

      {error && <p className="text-xs text-rose-500 mt-1.5">{error}</p>}
      <p className="text-[11px] text-slate-300 mt-1.5">视频不超过 5 分钟 / 200MB，会自动压缩为 720p</p>
    </div>
  )
}
