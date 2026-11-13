import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type Attachment } from '../api'
import Lightbox from '../components/Lightbox'
import { Play, Loader2 } from 'lucide-react'
import { mediaSrc } from '../server'

type Props = { childId: string }

type Filter = 'all' | 'image' | 'video'

const PAGE = 60

export default function Gallery({ childId }: Props) {
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.media({ childId, limit: PAGE })
      setItems(r.attachments)
      setHasMore(r.attachments.length >= PAGE)
    } catch {
      setItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [childId])

  async function loadMore() {
    if (moreLoading || !items.length) return
    setMoreLoading(true)
    try {
      const r = await api.media({ childId, limit: PAGE, before: items[items.length - 1].createdAt })
      setItems((p) => [...p, ...r.attachments])
      setHasMore(r.attachments.length >= PAGE)
    } catch {
      setHasMore(false)
    } finally {
      setMoreLoading(false)
    }
  }

  useEffect(() => { load() }, [load])

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((a) => a.kind === filter)),
    [items, filter],
  )

  const groups = useMemo(() => {
    const map = new Map<string, Attachment[]>()
    for (const a of filtered) {
      const d = new Date(a.createdAt)
      const key = `${d.getFullYear()}年${d.getMonth() + 1}月`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="flex gap-2 mb-3">
        {([['all', '全部'], ['image', '照片'], ['video', '视频']] as [Filter, string][]).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-4 py-1.5 rounded-full text-xs transition ${
              filter === v ? 'bg-brand-500 text-white' : 'bg-white text-slate-500 shadow-soft'
            }`}
          >
            {l}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-slate-300">{filtered.length} 个</span>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-slate-300">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : !filtered.length ? (
        <div className="py-20 text-center">
          <p className="text-sm text-slate-400">还没有照片或视频</p>
          <p className="text-xs text-slate-300 mt-1">记一笔时拍张照，就会出现在这里</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([label, list]) => (
            <section key={label}>
              <h3 className="text-xs text-slate-400 mb-2 px-0.5">{label}</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {list.map((a) => {
                  const idx = filtered.findIndex((x) => x.id === a.id)
                  return (
                    <button
                      key={a.id}
                      onClick={() => setViewIndex(idx)}
                      className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 active:opacity-80 transition"
                    >
                      <img src={mediaSrc(a.thumbUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {a.kind === 'video' && (
                        <>
                          <div className="absolute inset-0 bg-black/15" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="w-6 h-6 text-white drop-shadow" fill="currentColor" />
                          </div>
                          <span className="absolute bottom-1 right-1 text-[10px] text-white/90 bg-black/35 px-1 rounded">
                            {a.durationMs ? `${Math.floor(a.durationMs / 60000)}:${String(Math.floor((a.durationMs % 60000) / 1000)).padStart(2, '0')}` : '视频'}
                          </span>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
          {hasMore && (
            <div className="pt-1 text-center">
              <button
                onClick={loadMore}
                disabled={moreLoading}
                className="px-5 py-2 rounded-full bg-white shadow-soft text-xs text-slate-500 inline-flex items-center gap-1.5"
              >
                {moreLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {moreLoading ? '加载中' : '加载更多'}
              </button>
            </div>
          )}
        </div>
      )}

      {viewIndex !== null && (
        <Lightbox
          items={filtered}
          index={viewIndex}
          onClose={() => setViewIndex(null)}
          onDeleted={() => { setItems((p) => p.filter((x) => x.id !== filtered[viewIndex!]?.id)); setViewIndex(null) }}
        />
      )}
    </div>
  )
}
