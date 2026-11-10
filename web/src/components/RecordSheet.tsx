import { useMemo, useRef, useState } from 'react'
import { RECORD_TYPES, type RecordTypeDef } from '../recordTypes'
import { adaptFields, orderedTypes } from '../recordOrder'
import { api, type Attachment, type RecordItem } from '../api'
import { toLocalInput, fromLocalInput, todayStr } from '../utils'
import MediaPicker from './MediaPicker'
import DateField from './DateField'
import { X, Check, ArrowLeft, Trash2 } from 'lucide-react'
import { useScrollLock } from '../hooks/useScrollLock'

type Props = {
  childId: string
  birthDate?: string | null
  initialType?: string | null
  editing?: RecordItem | null
  onClose: () => void
  onSaved: () => void
}

function cleanPayload(payload: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(payload || {})) {
    if (v === '' || v === null || v === undefined) continue
    if (typeof v === 'number' && Number.isNaN(v)) continue
    out[k] = v
  }
  return out
}

export default function RecordSheet({ childId, birthDate, initialType, editing, onClose, onSaved }: Props) {
  useScrollLock()
  const editDef = editing ? RECORD_TYPES.find((t) => t.type === editing.type) || null : null
  const [selected, setSelected] = useState<RecordTypeDef | null>(
    editDef || (initialType ? RECORD_TYPES.find((t) => t.type === initialType) || null : null),
  )
  const [occurredAt, setOccurredAt] = useState<string>(
    editing ? toLocalInput(editing.occurredAt) : toLocalInput(new Date().toISOString()),
  )
  const [endedAt, setEndedAt] = useState<string>(editing?.endedAt ? toLocalInput(editing.endedAt) : '')
  const [payload, setPayload] = useState<Record<string, any>>(
    editing ? { ...editing.payload } : (selected?.defaultPayload ? selected.defaultPayload() : {}),
  )
  const [note, setNote] = useState(editing?.note || '')
  const [attachments, setAttachments] = useState<Attachment[]>(editing?.attachments || [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const savedRef = useRef(false)

  // 关闭时清理本次上传但未保存绑定记录的附件
  function close() {
    if (!savedRef.current) {
      for (const a of attachments) {
        if (!a.recordId) api.deleteMedia(a.id).catch(() => {})
      }
    }
    onClose()
  }

  function pick(t: RecordTypeDef) {
    setSelected(t)
    setPayload(t.defaultPayload ? t.defaultPayload() : {})
    setError('')
  }

  function setField(key: string, value: any) {
    setPayload((p) => ({ ...p, [key]: value }))
  }

  const fields = useMemo(
    () => (selected ? adaptFields(selected, birthDate) : []),
    [selected, birthDate],
  )

  const canSave = useMemo(() => {
    if (!selected) return false
    if (selected.type === 'temperature') return Number(payload.value) > 30
    return true
  }, [selected, payload])

  async function save() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      const body: any = {
        occurredAt: fromLocalInput(occurredAt),
        endedAt: endedAt ? fromLocalInput(endedAt) : null,
        payload: cleanPayload(payload),
        note: note.trim() || null,
        attachmentIds: attachments.map((a) => a.id),
      }
      if (editing) {
        await api.updateRecord(editing.id, body)
      } else {
        await api.createRecord({ ...body, childId, type: selected.type })
      }
      savedRef.current = true
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message || '保存失败')
    } finally {
      setBusy(false)
    }
  }

  async function removeRecord() {
    if (!editing) return
    setBusy(true)
    try {
      await api.deleteRecord(editing.id)
      savedRef.current = true
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message || '删除失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 animate-fade-in overscroll-contain" onClick={close}>
      <div
        className="w-full max-h-[90vh] bg-[#F7FAFC] rounded-t-3xl flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 sticky top-0 z-30 bg-[#F7FAFC]/95 backdrop-blur rounded-t-3xl">
          <button
            onClick={() => (selected && !initialType && !editing ? (setSelected(null), setPayload({})) : close())}
            className="p-2 -ml-2 text-slate-400 w-9 h-9 flex items-center justify-center"
            aria-label="关闭"
          >
            {selected && !initialType && !editing ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
          <h2 className="flex-1 text-center text-base font-medium text-brand-900 truncate px-1">
            {editing ? `编辑${selected?.label || ''}记录` : selected ? selected.label : '记一笔'}
          </h2>
          {editing ? (
            <button onClick={() => setConfirmDelete(true)} className="p-2 -mr-2 text-slate-300 active:text-rose-500 w-9 h-9 flex items-center justify-center">
              <Trash2 className="w-5 h-5" strokeWidth={1.8} />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain overscroll-contain px-4 pb-4 min-h-0">
          {!selected && (
            <div className="grid grid-cols-3 gap-3 pt-2">
              {orderedTypes(birthDate).types
                .map((type) => RECORD_TYPES.find((t) => t.type === type))
                .filter((t): t is RecordTypeDef => Boolean(t))
                .map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.type}
                    onClick={() => pick(t)}
                    className="bg-white rounded-2xl shadow-soft py-5 flex flex-col items-center gap-2 active:scale-[0.97] transition"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${t.color}`}>
                      <Icon className="w-6 h-6" strokeWidth={1.8} />
                    </div>
                    <span className="text-[13px] text-brand-800">{t.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {selected && (
            <div className="space-y-4 pt-1">
              {fields.some((f) => f.quick?.length) && (
                <div className="space-y-3">
                  {fields.filter((f) => f.quick?.length).map((f) => (
                    <div key={f.key}>
                      <label className="text-xs text-slate-400 mb-1.5 block">{f.label}（{f.unit}）</label>
                      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
                        {f.quick!.map((v) => (
                          <button
                            key={String(v)}
                            onClick={() => setField(f.key, Number(v))}
                            className={`shrink-0 px-4 py-2.5 rounded-xl text-sm transition ${
                              Number(payload[f.key]) === Number(v)
                                ? 'bg-brand-500 text-white shadow-sm'
                                : 'bg-white text-slate-600 shadow-soft'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={payload[f.key] ?? ''}
                        onChange={(e) => setField(f.key, e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={`自定义${f.label}`}
                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {fields
                  .filter((f) => !f.quick?.length)
                  .map((f) => (
                    <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                      <label className="text-xs text-slate-400 mb-1.5 block">{f.label}</label>
                      {f.type === 'select' ? (
                        <div className="flex flex-wrap gap-2">
                          {f.options!.map((o) => (
                            <button
                              key={o.value}
                              onClick={() => setField(f.key, o.value)}
                              className={`px-3.5 py-2 rounded-xl text-sm transition ${
                                payload[f.key] === o.value
                                  ? 'bg-brand-500 text-white shadow-sm'
                                  : 'bg-white text-slate-600 shadow-soft'
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      ) : f.type === 'number' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={payload[f.key] ?? ''}
                            onChange={(e) => setField(f.key, e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-4 py-3 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300"
                          />
                          {f.unit && <span className="text-sm text-slate-400 shrink-0">{f.unit}</span>}
                        </div>
                      ) : f.type === 'date' ? (
                        <DateField
                          value={String(payload[f.key] ?? '')}
                          onChange={(v) => setField(f.key, v)}
                          className="w-full px-4 py-3 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300"
                        />
                      ) : (
                        <input
                          type="text"
                          value={payload[f.key] ?? ''}
                          onChange={(e) => setField(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="w-full px-4 py-3 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300"
                        />
                      )}
                    </div>
                  ))}
              </div>

              <div className="bg-white rounded-2xl shadow-soft p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-14 shrink-0">发生时间</span>
                  <DateField
                    mode="datetime"
                    value={occurredAt}
                    onChange={setOccurredAt}
                    className="flex-1 text-sm bg-transparent outline-none text-brand-900"
                  />
                </div>
                {selected.hasEndTime && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400 w-14 shrink-0">结束时间</span>
                    <DateField
                      mode="datetime"
                      value={endedAt}
                      onChange={setEndedAt}
                      placeholder="设置结束时间"
                      className="flex-1 text-sm bg-transparent outline-none text-brand-900"
                    />
                  </div>
                )}
              </div>

              <MediaPicker childId={childId} value={attachments} onChange={setAttachments} />

              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">备注</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="补充一点细节…"
                  className="w-full px-4 py-3 rounded-xl bg-white shadow-soft text-base outline-none resize-none focus:ring-2 focus:ring-brand-300"
                />
              </div>

              {error && <p className="text-sm text-rose-500 px-1">{error}</p>}
            </div>
          )}
        </div>

        {selected && (
          <div className="px-4 pt-2 pb-4 shrink-0 border-t border-slate-100 bg-[#F7FAFC]">
            <button
              onClick={save}
              disabled={!canSave || busy}
              className="w-full py-3.5 rounded-xl bg-brand-500 text-white text-base font-medium shadow-lift active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" strokeWidth={2} />
              {busy ? '保存中…' : '保存'}
            </button>
          </div>
        )}
      </div>

      {confirmDelete && editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-8 animate-fade-in overscroll-contain" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-xs bg-white rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-medium text-brand-900 text-center">删除这条记录？</p>
            <p className="text-xs text-slate-400 text-center mt-1.5">附带的照片和视频也会一起删除</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm">取消</button>
              <button onClick={removeRecord} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-sm">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
