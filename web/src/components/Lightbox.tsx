import { useEffect, useState } from 'react'
import { api, type Attachment } from '../api'
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useScrollLock } from '../hooks/useScrollLock'
import { mediaSrc } from '../server'

type Props = {
  items: Attachment[]
  index: number
  onClose: () => void
  onDeleted?: (id: string) => void
}

export default function Lightbox({ items, index, onClose, onDeleted }: Props) {
  useScrollLock()
  const [i, setI] = useState(index)
  const cur = items[i]

  useEffect(() => { setI(index) }, [index])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1))
      if (e.key === 'ArrowRight') setI((v) => Math.min(items.length - 1, v + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, onClose])

  if (!cur) return null

  async function remove() {
    if (!confirm('从相册删除这张照片/视频？')) return
    await api.deleteMedia(cur.id).catch(() => {})
    onDeleted?.(cur.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col overscroll-contain" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-white/80 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="p-2 -ml-2">
          <X className="w-6 h-6" />
        </button>
        <span className="text-xs text-white/50">{i + 1} / {items.length}</span>
        <button onClick={remove} className="p-2 -mr-2">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative min-h-0" onClick={(e) => e.stopPropagation()}>
        {cur.kind === 'video' ? (
          <video
            key={cur.id}
            src={mediaSrc(cur.url)}
            className="max-w-full max-h-full"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img key={cur.id} src={mediaSrc(cur.url)} alt="" className="max-w-full max-h-full object-contain" />
        )}

        {i > 0 && (
          <button
            onClick={() => setI(i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {i < items.length - 1 && (
          <button
            onClick={() => setI(i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-4 py-3 text-center text-[11px] text-white/40 shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        {new Date(cur.createdAt).toLocaleString('zh-CN', { hour12: false })}
      </div>
    </div>
  )
}
