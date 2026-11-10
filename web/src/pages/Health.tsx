import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api, type Child, type HealthOverview, type RecordItem, type Vaccine,
} from '../api'
import { useScrollLock } from '../hooks/useScrollLock'
import RecordSheet from '../components/RecordSheet'
import RecordDetail from '../components/RecordDetail'
import DateField from '../components/DateField'
import { todayStr } from '../utils'
import {
  Plus, Syringe, Stethoscope, CalendarClock, AlertCircle, Check, X, Trash2, ChevronRight,
} from 'lucide-react'

type Props = { child: Child }

type Mode = 'create' | 'record' | 'edit'

const STATUS_META: Record<Vaccine['status'], { label: string; cls: string }> = {
  done: { label: '已接种', cls: 'text-teal-600 bg-teal-50' },
  overdue: { label: '逾期', cls: 'text-rose-600 bg-rose-50' },
  dueSoon: { label: '临近', cls: 'text-amber-600 bg-amber-50' },
  pending: { label: '待接种', cls: 'text-slate-500 bg-slate-100' },
}

function statusText(v: Vaccine) {
  if (v.status === 'done') return v.doneDate || '已接种'
  if (v.status === 'overdue') return `逾期 ${Math.abs(v.daysLeft || 0)} 天`
  if (v.status === 'dueSoon') return v.daysLeft === 0 ? '就在今天' : `还有 ${v.daysLeft} 天`
  return v.dueDate ? `${v.dueDate.slice(5)} 计划` : '待安排'
}

export default function Health({ child }: Props) {
  const [tab, setTab] = useState<'vaccine' | 'visit'>('visit')
  const [overview, setOverview] = useState<HealthOverview | null>(null)
  const [vaccines, setVaccines] = useState<Vaccine[]>([])
  const [visits, setVisits] = useState<RecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [vacSheet, setVacSheet] = useState<{ mode: Mode; vaccine: Vaccine | null } | null>(null)
  const [visitSheet, setVisitSheet] = useState(false)
  const [detail, setDetail] = useState<RecordItem | null>(null)
  const [editingVisit, setEditingVisit] = useState<RecordItem | null>(null)

  const load = useCallback(async () => {
    try {
      const [ov, vs, vv] = await Promise.all([
        api.healthOverview(child.id),
        api.vaccines(child.id),
        api.records({ childId: child.id, type: 'visit', limit: 100 }),
      ])
      setOverview(ov)
      setVaccines(vs.vaccines)
      setVisits(vv.records)
    } catch {
      setOverview(null)
      setVaccines([])
      setVisits([])
    } finally {
      setLoading(false)
    }
  }, [child.id])

  useEffect(() => { setLoading(true); load() }, [load])

  const sorted = useMemo(() => {
    const rank: Record<string, number> = { overdue: 0, dueSoon: 1, pending: 2, done: 3 }
    return vaccines.slice().sort((a, b) => {
      const r = rank[a.status] - rank[b.status]
      if (r !== 0) return r
      if (a.status === 'done') return (b.doneDate || '') > (a.doneDate || '') ? 1 : -1
      return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1
    })
  }, [vaccines])

  const pending = sorted.filter((v) => v.status !== 'done')
  const done = sorted.filter((v) => v.status === 'done')
  const next = overview?.nextVaccine

  return (
    <div className="pb-28">
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-medium text-brand-900">健康档案</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">疫苗计划与就医记录</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-600">已接种 {done.length}</span>
            {(overview?.overdueCount || 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">逾期 {overview?.overdueCount}</span>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="bg-gradient-to-br from-teal-50 to-white rounded-2xl p-4 shadow-soft">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                <Syringe className="w-5 h-5" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400">下一针</p>
                {next ? (
                  <>
                    <p className="text-sm font-medium text-brand-900 mt-0.5 truncate">
                      {next.name} 第 {next.doseNo} 剂
                    </p>
                    <p className={`text-[11px] mt-0.5 ${
                      next.status === 'overdue' ? 'text-rose-500' : 'text-slate-500'
                    }`}>
                      {next.dueDate} · {statusText(next)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 mt-1">暂无待接种计划</p>
                )}
              </div>
              {next && next.status !== 'done' && (
                <button
                  onClick={() => setVacSheet({ mode: 'record', vaccine: next })}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-teal-500 text-white text-[11px]"
                >
                  登记接种
                </button>
              )}
            </div>
          </div>

          {overview?.nextFollowup && (
            <div className="bg-white rounded-2xl px-4 py-3 shadow-soft flex items-center gap-3">
              <CalendarClock className="w-5 h-5 text-cyan-600 shrink-0" strokeWidth={1.8} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400">下次复诊</p>
                <p className="text-sm text-brand-900 mt-0.5 truncate">
                  {overview.nextFollowup.followupAt} · 还有 {overview.nextFollowup.daysLeft} 天
                </p>
              </div>
              <span className="text-[11px] text-slate-400 truncate max-w-[90px]">
                {overview.nextFollowup.hospital || ''}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 bg-slate-100 rounded-xl p-1 flex">
          {([['vaccine', '疫苗'], ['visit', '就医']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-lg text-xs transition ${
                tab === k ? 'bg-white text-brand-900 shadow-soft font-medium' : 'text-slate-500'
              }`}
            >
              {label}{k === 'vaccine' ? ` ${pending.length}` : ` ${visits.length}`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3">
        {loading ? (
          <p className="text-xs text-slate-300 py-10 text-center">加载中…</p>
        ) : tab === 'vaccine' ? (
          <>
            {pending.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] text-slate-400 mb-1.5">待接种</p>
                <ul className="space-y-2">
                  {pending.map((v) => (
                    <li key={v.id}>
                      <button
                        onClick={() => setVacSheet({ mode: 'record', vaccine: v })}
                        className="w-full text-left bg-white rounded-xl shadow-soft px-4 py-3 flex items-center gap-3"
                      >
                        <div className={`w-1.5 h-8 rounded-full shrink-0 ${
                          v.status === 'overdue' ? 'bg-rose-400' : v.status === 'dueSoon' ? 'bg-amber-400' : 'bg-slate-200'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-brand-900 truncate">{v.name} 第 {v.doseNo} 剂</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">计划 {v.dueDate || '未定'}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${STATUS_META[v.status].cls}`}>
                          {statusText(v)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {done.length > 0 && (
              <div>
                <p className="text-[11px] text-slate-400 mb-1.5">已接种</p>
                <ul className="space-y-2">
                  {done.map((v) => (
                    <li key={v.id}>
                      <button
                        onClick={() => setVacSheet({ mode: 'edit', vaccine: v })}
                        className="w-full text-left bg-white rounded-xl shadow-soft px-4 py-2.5 flex items-center gap-3"
                      >
                        <Check className="w-4 h-4 text-teal-500 shrink-0" strokeWidth={2.4} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-brand-900 truncate">{v.name} 第 {v.doseNo} 剂</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {v.doneDate}{v.place ? ` · ${v.place}` : ''}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!vaccines.length && (
              <div className="py-12 text-center">
                <AlertCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs text-slate-400">暂无疫苗计划</p>
                {!child.birthDate && <p className="text-[11px] text-slate-300 mt-1">先在「我的」里补上出生日期</p>}
              </div>
            )}
          </>
        ) : (
          <>
            {visits.length === 0 ? (
              <div className="py-12 text-center">
                <Stethoscope className="w-8 h-8 text-slate-200 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-xs text-slate-400">还没有就医记录</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {visits.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => setDetail(v)}
                      className="w-full text-left bg-white rounded-2xl shadow-soft px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-brand-900 truncate">
                          {v.payload?.hospital || '就医'}
                          {v.payload?.department ? ` · ${v.payload.department}` : ''}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">{v.occurredAt.slice(5, 10)}</span>
                      </div>
                      {v.payload?.diagnosis && (
                        <p className="text-[12px] text-slate-500 mt-1 break-words">{v.payload.diagnosis}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {v.payload?.prescription && (
                          <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                            {v.payload.prescription}
                          </span>
                        )}
                        {v.payload?.followupAt && (
                          <span className="text-[10px] text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded">
                            复诊 {v.payload.followupAt}
                          </span>
                        )}
                        {v.payload?.feeYuan ? (
                          <span className="text-[10px] text-slate-400">¥{v.payload.feeYuan}</span>
                        ) : null}
                        {(v.attachments?.length || 0) > 0 && (
                          <span className="text-[10px] text-slate-400">{v.attachments!.length} 张照片</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <button
        onClick={() => (tab === 'vaccine'
          ? setVacSheet({ mode: 'create', vaccine: null })
          : setVisitSheet(true))}
        className="fixed right-4 bottom-[76px] w-12 h-12 rounded-full bg-teal-500 text-white shadow-lift flex items-center justify-center active:scale-95 transition z-20"
        aria-label={tab === 'vaccine' ? '新增疫苗' : '新增就医记录'}
      >
        <Plus className="w-6 h-6" strokeWidth={2.2} />
      </button>

      {vacSheet && (
        <VaccineSheet
          childId={child.id}
          mode={vacSheet.mode}
          vaccine={vacSheet.vaccine}
          onClose={() => setVacSheet(null)}
          onSaved={() => { setVacSheet(null); load() }}
        />
      )}

      {visitSheet && (
        <RecordSheet
          childId={child.id}
          birthDate={child.birthDate}
          initialType="visit"
          editing={editingVisit}
          onClose={() => { setVisitSheet(false); setEditingVisit(null) }}
          onSaved={() => { load(); setDetail(null) }}
        />
      )}

      {detail && (
        <RecordDetail
          record={detail}
          onClose={() => setDetail(null)}
          onEdit={(r) => { setEditingVisit(r); setVisitSheet(true) }}
          onDeleted={load}
        />
      )}
    </div>
  )
}

function VaccineSheet({
  childId, mode, vaccine, onClose, onSaved,
}: {
  childId: string
  mode: Mode
  vaccine: Vaccine | null
  onClose: () => void
  onSaved: () => void
}) {
  useScrollLock()
  const [name, setName] = useState(vaccine?.name || '')
  const [doseNo, setDoseNo] = useState(String(vaccine?.doseNo || 1))
  const [dueDate, setDueDate] = useState(vaccine?.dueDate || '')
  const [doneDate, setDoneDate] = useState(vaccine?.doneDate || (mode === 'record' ? todayStr() : ''))
  const [place, setPlace] = useState(vaccine?.place || '')
  const [batchNo, setBatchNo] = useState(vaccine?.batchNo || '')
  const [reaction, setReaction] = useState(vaccine?.reaction || '')
  const [note, setNote] = useState(vaccine?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim()) { setError('请填写疫苗名称'); return }
    setBusy(true); setError('')
    try {
      const body = {
        name: name.trim(),
        doseNo: Number(doseNo) || 1,
        dueDate: dueDate || undefined,
        doneDate: doneDate || undefined,
        place: place || undefined,
        batchNo: batchNo || undefined,
        reaction: reaction || undefined,
        note: note || undefined,
      }
      if (mode === 'create') {
        await api.createVaccine({ ...body, childId })
      } else if (vaccine) {
        await api.updateVaccine(vaccine.id, body as any)
      }
      onSaved()
    } catch (e: any) {
      setError(e.message || '保存失败')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!vaccine) return
    setBusy(true)
    try {
      await api.deleteVaccine(vaccine.id)
      onSaved()
    } catch (e: any) {
      setError(e.message || '删除失败')
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-white shadow-soft text-sm outline-none focus:ring-2 focus:ring-teal-300'
  const labelCls = 'text-xs text-slate-400 mb-1 block'

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 animate-fade-in overscroll-contain" onClick={onClose}>
      <div
        className="w-full max-h-[90vh] bg-[#F7FAFC] rounded-t-3xl flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 sticky top-0 z-30 bg-[#F7FAFC]/95 backdrop-blur rounded-t-3xl">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-400"><X className="w-5 h-5" /></button>
          <h2 className="text-base font-medium text-brand-900">
            {mode === 'create' ? '新增疫苗' : mode === 'record' ? '登记接种' : '疫苗详情'}
          </h2>
          {mode === 'edit' ? (
            <button onClick={remove} className="p-2 -mr-2 text-slate-300 active:text-rose-500">
              <Trash2 className="w-5 h-5" strokeWidth={1.8} />
            </button>
          ) : <div className="w-9" />}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain overscroll-contain min-h-0 px-4 pb-4 space-y-3">
          <div>
            <label className={labelCls}>疫苗名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={mode !== 'create'} className={inputCls} placeholder="如：流感疫苗" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>剂次</label>
              <input type="number" inputMode="numeric" value={doseNo} onChange={(e) => setDoseNo(e.target.value)} disabled={mode !== 'create'} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>计划日期</label>
              <DateField value={dueDate} onChange={setDueDate} disabled={mode !== 'create'} placeholder="选择计划日期" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>实际接种日期{mode === 'record' ? '（默认今天）' : ''}</label>
            <DateField value={doneDate} onChange={setDoneDate} max={todayStr()} placeholder="选择接种日期" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>接种地点</label>
              <input value={place} onChange={(e) => setPlace(e.target.value)} className={inputCls} placeholder="如：社区卫生服务中心" />
            </div>
            <div>
              <label className={labelCls}>疫苗批号</label>
              <input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} className={inputCls} placeholder="选填" />
            </div>
          </div>
          <div>
            <label className={labelCls}>接种后反应</label>
            <input value={reaction} onChange={(e) => setReaction(e.target.value)} className={inputCls} placeholder="如：无 / 低热半天" />
          </div>
          <div>
            <label className={labelCls}>备注</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>

        <div className="px-4 pt-2 pb-4 border-t border-slate-100">
          <button
            onClick={save}
            disabled={busy}
            className="w-full py-3.5 rounded-xl bg-teal-500 text-white text-base font-medium shadow-lift disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" /> {busy ? '保存中…' : mode === 'record' ? '确认接种' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
