import { useCallback, useEffect, useState } from 'react'
import { api, type Child, type RecordItem, type User } from '../api'
import { typeMap } from '../recordTypes'
import { quickTypes, stageOf } from '../recordOrder'
import Timeline from '../components/Timeline'
import RecordSheet from '../components/RecordSheet'
import RecordDetail from '../components/RecordDetail'
import { todayStr, shiftDate, weekdayLabel, ageLabel } from '../utils'
import { Plus, ChevronLeft, ChevronRight, UserPlus, HeartPulse, CalendarDays, MoreHorizontal } from 'lucide-react'

type Props = {
  user: User
  children: Child[]
  activeId: string
  date: string
  onDateChange: (d: string) => void
  onSelectChild: (id: string) => void
  onAddChild: () => void
  onOpenCalendar: () => void
  onOpenHealth: () => void
}

export default function Home({
  user, children, activeId, date, onDateChange, onSelectChild, onAddChild, onOpenCalendar, onOpenHealth,
}: Props) {
  const [records, setRecords] = useState<RecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetType, setSheetType] = useState<string | null>(null)
  const [editing, setEditing] = useState<RecordItem | null>(null)
  const [detail, setDetail] = useState<RecordItem | null>(null)

  const loadRecords = useCallback(async () => {
    if (!activeId) { setRecords([]); setLoading(false); return }
    try {
      const r = await api.records({ childId: activeId, date })
      setRecords(r.records)
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [activeId, date])

  useEffect(() => { setLoading(true); loadRecords() }, [loadRecords])

  const activeChild = children.find((c) => c.id === activeId)
  const stage = stageOf(activeChild?.birthDate)
  const quick = quickTypes(activeChild?.birthDate, 8)

  const stats = {
    count: records.length,
    feeding: records.filter((r) => r.type === 'feeding').length,
    sleep: records.filter((r) => r.type === 'sleep').length,
    maxTemp: records
      .filter((r) => r.type === 'temperature')
      .reduce((m, r) => Math.max(m, Number(r.payload?.value) || 0), 0),
  }
  const sleepMin = records
    .filter((r) => r.type === 'sleep' && r.endedAt)
    .reduce((s, r) => s + Math.max(0, (new Date(r.endedAt!).getTime() - new Date(r.occurredAt).getTime()) / 60000), 0)

  if (!children.length) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-8 bg-gradient-to-b from-brand-50 to-white">
        <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
          <UserPlus className="w-8 h-8 text-brand-500" strokeWidth={1.6} />
        </div>
        <h2 className="text-lg font-medium text-brand-900 mb-1">先添加一个孩子</h2>
        <p className="text-sm text-slate-400 text-center mb-6 leading-relaxed">
          填上姓名和出生日期<br />就可以开始记录每一天了
        </p>
        <button onClick={onAddChild} className="px-8 py-3.5 rounded-xl bg-brand-500 text-white text-base shadow-lift active:scale-[0.99] transition">
          添加孩子
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white px-4 pt-3 pb-2 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-mint-300 flex items-center justify-center text-white text-sm font-medium shrink-0">
              {(activeChild?.nickname || activeChild?.name || '?').slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-[15px] font-medium text-brand-900 truncate">
                  {activeChild?.nickname || activeChild?.name}
                </h1>
                {activeChild?.birthDate && (
                  <span className="text-[11px] text-slate-400 shrink-0">{ageLabel(activeChild.birthDate)}</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">{user.familyName || '我的家庭'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onOpenHealth} className="p-2 text-slate-400" aria-label="健康档案">
              <HeartPulse className="w-5 h-5" strokeWidth={1.8} />
            </button>
            <button onClick={onOpenCalendar} className="p-2 -mr-2 text-slate-400" aria-label="日历">
              <CalendarDays className="w-5 h-5" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {children.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectChild(c.id)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs transition ${
                  c.id === activeId ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {c.nickname || c.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-1 min-w-0">
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 text-[11px]">
            {stage.label}
            {stage.months !== null ? ` · ${stage.months} 个月` : ''}
          </span>
          <span className="text-[10px] text-slate-400 truncate">{stage.hint}</span>
        </div>

        <div className="flex items-center justify-between mt-1">
          <button onClick={() => onDateChange(shiftDate(date, -1))} className="p-2 -ml-2 text-slate-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-brand-800">{weekdayLabel(date)}</span>
            <span className="text-xs text-slate-400">{date.slice(5).replace('-', '/')}</span>
            {date !== todayStr() && (
              <button
                onClick={() => onDateChange(todayStr())}
                className="text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600"
              >
                回今天
              </button>
            )}
          </div>
          <button
            onClick={() => onDateChange(shiftDate(date, 1))}
            disabled={date >= todayStr()}
            className="p-2 -mr-2 text-slate-400 disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="px-4 pt-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '记录', value: String(stats.count), warn: false },
            { label: '喂养', value: String(stats.feeding), warn: false },
            { label: '睡眠', value: sleepMin ? `${Math.round(sleepMin / 60 * 10) / 10}h` : '—', warn: false },
            { label: '最高体温', value: stats.maxTemp ? `${stats.maxTemp}` : '—', warn: stats.maxTemp >= 37.5 },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl py-2.5 text-center shadow-soft">
              <p className={`text-base font-semibold ${s.warn ? 'text-rose-500' : 'text-brand-800'}`}>{s.value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 px-4 py-3 pb-44">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-300">加载中…</div>
        ) : (
          <Timeline records={records} onOpen={(r) => setDetail(r)} />
        )}
      </main>

      <div
        className="fixed left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-100 z-20"
        style={{ bottom: 'calc(60px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => { setEditing(null); setSheetType(null); setSheetOpen(true) }}
            className="shrink-0 w-12 h-12 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-lift active:scale-95 transition"
          >
            <Plus className="w-6 h-6" strokeWidth={2.2} />
          </button>
          {quick.types.map((type) => typeMap[type]).filter(Boolean).map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.type}
                onClick={() => { setEditing(null); setSheetType(t.type); setSheetOpen(true) }}
                className="shrink-0 w-14 py-1.5 flex flex-col items-center gap-1 active:scale-95 transition"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.color}`}>
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </div>
                <span className="text-[10px] text-slate-500">{t.label}</span>
              </button>
            )
          })}
          <button
            onClick={() => { setEditing(null); setSheetType(null); setSheetOpen(true) }}
            className="shrink-0 w-14 py-1.5 flex flex-col items-center gap-1 active:scale-95 transition"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-500">
              <MoreHorizontal className="w-5 h-5" strokeWidth={1.8} />
            </div>
            <span className="text-[10px] text-slate-500">更多</span>
          </button>
        </div>
      </div>

      {sheetOpen && activeId && (
        <RecordSheet
          childId={activeId}
          birthDate={activeChild?.birthDate}
          initialType={sheetType}
          editing={editing}
          onClose={() => { setSheetOpen(false); setEditing(null) }}
          onSaved={() => { loadRecords(); setDetail(null) }}
        />
      )}

      {detail && (
        <RecordDetail
          record={detail}
          onClose={() => setDetail(null)}
          onEdit={(r) => { setEditing(r); setSheetOpen(true) }}
          onDeleted={loadRecords}
        />
      )}
    </div>
  )
}
