import type { RecordItem } from '../api'
import { typeMap, recordSummary } from '../recordTypes'
import { hhmm } from '../utils'
import { Play } from 'lucide-react'
import { mediaSrc } from '../server'

export default function Timeline({
  records, onOpen,
}: { records: RecordItem[]; onOpen: (r: RecordItem) => void }) {
  if (!records.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mb-3">
          <span className="text-2xl text-brand-300">·</span>
        </div>
        <p className="text-sm text-slate-400">这一天还没有记录</p>
        <p className="text-xs text-slate-300 mt-1">点下方按钮，随手记一笔</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {records.map((r) => {
        const def = typeMap[r.type]
        const Icon = def?.icon
        const summary = recordSummary(r)
        const atts = r.attachments || []
        return (
          <li key={r.id}>
            <button
              onClick={() => onOpen(r)}
              className="w-full text-left bg-white rounded-2xl shadow-soft px-4 py-3 flex items-start gap-3 active:scale-[0.995] transition"
            >
              <div className="text-xs text-slate-400 pt-1 w-11 shrink-0 tabular-nums">
                {hhmm(r.occurredAt)}
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${def?.color || 'bg-slate-100 text-slate-500'}`}>
                {Icon ? <Icon className="w-5 h-5" strokeWidth={1.8} /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-brand-900">{def?.label || r.type}</span>
                  {r.endedAt && (
                    <span className="text-xs text-slate-400">至 {hhmm(r.endedAt)}</span>
                  )}
                </div>
                <p className="text-[13px] text-slate-500 mt-0.5 break-words leading-snug">{summary}</p>

                {atts.length > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    {atts.slice(0, 3).map((a) => (
                      <div key={a.id} className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100">
                        <img src={mediaSrc(a.thumbUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />
                        {a.kind === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Play className="w-3.5 h-3.5 text-white" fill="currentColor" />
                          </div>
                        )}
                      </div>
                    ))}
                    {atts.length > 3 && (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 text-[11px] text-slate-500 flex items-center justify-center">
                        +{atts.length - 3}
                      </div>
                    )}
                  </div>
                )}

                {r.creatorName && (
                  <p className="text-[11px] text-slate-300 mt-1">{r.creatorName}</p>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
