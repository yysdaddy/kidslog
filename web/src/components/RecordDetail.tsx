import { useState } from 'react'
import { api, type RecordItem } from '../api'
import { typeMap, optionLabel } from '../recordTypes'
import { hhmm } from '../utils'
import Lightbox from './Lightbox'
import { X, Pencil, Play, Trash2 } from 'lucide-react'
import { useScrollLock } from '../hooks/useScrollLock'

type Props = {
  record: RecordItem
  onClose: () => void
  onEdit: (r: RecordItem) => void
  onDeleted: () => void
}

export default function RecordDetail({ record, onClose, onEdit, onDeleted }: Props) {
  useScrollLock()
  const def = typeMap[record.type]
  const Icon = def?.icon
  const [view, setView] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const atts = record.attachments || []

  const rows: { label: string; value: string }[] = []
  for (const f of def?.fields || []) {
    const v = record.payload?.[f.key]
    if (v === undefined || v === null || v === '') continue
    let text = String(v)
    if (f.type === 'select') text = String(optionLabel(def!, f.key, v))
    else if (f.unit) text = `${v}${f.unit}`
    rows.push({ label: f.label, value: text })
  }
  if (record.type === 'diaper' && record.payload?.kind) {
    rows.unshift({ label: '类型', value: optionLabel(def!, 'kind', record.payload.kind) })
  }

  async function remove() {
    await api.deleteRecord(record.id).catch(() => {})
    onDeleted()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 animate-fade-in overscroll-contain" onClick={onClose}>
      <div
        className="w-full max-h-[88vh] bg-white rounded-t-3xl flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '88dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 sticky top-0 z-30 bg-white/95 backdrop-blur rounded-t-3xl">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-400">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-base font-medium text-brand-900">记录详情</h2>
          <button onClick={() => onEdit(record)} className="p-2 -mr-2 text-brand-500">
            <Pencil className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain overscroll-contain min-h-0 px-4 pb-6">
          <div className="flex items-center gap-3 py-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${def?.color || 'bg-slate-100 text-slate-500'}`}>
              {Icon ? <Icon className="w-6 h-6" strokeWidth={1.8} /> : null}
            </div>
            <div>
              <p className="text-base font-medium text-brand-900">{def?.label || record.type}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(record.occurredAt).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit' }).replace(/\//g, '-')}
                {' '}{hhmm(record.occurredAt)}
                {record.endedAt ? ` — ${hhmm(record.endedAt)}` : ''}
              </p>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="bg-[#F7FAFC] rounded-2xl px-4 py-1 mt-1">
              {rows.map((r) => (
                <div key={r.label} className="flex items-start justify-between py-2.5 border-b border-white last:border-0">
                  <span className="text-xs text-slate-400">{r.label}</span>
                  <span className="text-sm text-brand-800 text-right ml-4 break-words">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {record.note && (
            <div className="bg-[#F7FAFC] rounded-2xl px-4 py-3 mt-3">
              <p className="text-xs text-slate-400 mb-1">备注</p>
              <p className="text-sm text-brand-800 leading-relaxed whitespace-pre-wrap">{record.note}</p>
            </div>
          )}

          {atts.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-2">照片 / 视频（{atts.length}）</p>
              <div className="grid grid-cols-3 gap-1.5">
                {atts.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setView(i)}
                    className="relative aspect-square rounded-lg overflow-hidden bg-slate-100"
                  >
                    <img src={a.thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    {a.kind === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="w-5 h-5 text-white" fill="currentColor" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-300 mt-5 text-center">
            {record.creatorName ? `${record.creatorName} 记录` : ''} · {new Date(record.createdAt).toLocaleString('zh-CN', { hour12: false })}
          </p>

          <button
            onClick={() => setConfirm(true)}
            className="w-full mt-4 py-3 rounded-xl text-rose-500 text-sm flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> 删除记录
          </button>
        </div>
      </div>

      {view !== null && (
        <Lightbox items={atts} index={view} onClose={() => setView(null)} onDeleted={() => { setView(null); onDeleted() }} />
      )}

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-8 animate-fade-in overscroll-contain" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-xs bg-white rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-medium text-brand-900 text-center">删除这条记录？</p>
            <p className="text-xs text-slate-400 text-center mt-1.5">附带的照片和视频也会一起删除</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm">取消</button>
              <button onClick={remove} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-sm">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
