import { useEffect, useMemo, useState } from 'react'
import { api, type StatsDaily, type StatsDay } from '../api'
import { todayStr, pad, shiftDate } from '../utils'
import DateField from './DateField'
import { SlidersHorizontal, Check } from 'lucide-react'

type Props = { childId: string; month: string }

type Preset = 'week' | 'd14' | 'd30' | 'current' | 'custom'

type Metric = {
  key: Exclude<keyof StatsDay, 'date' | 'byType'>
  label: string
  unit: string
  digits?: number
  hours?: boolean
}

const METRICS: Metric[] = [
  { key: 'feedingCount', label: '喂养次数', unit: '次' },
  { key: 'milkMl', label: '奶量', unit: 'ml' },
  { key: 'solidCount', label: '辅食正餐', unit: '次' },
  { key: 'poopCount', label: '排便', unit: '次' },
  { key: 'peeCount', label: '排尿', unit: '次' },
  { key: 'sleepMinutes', label: '睡眠', unit: '小时', hours: true, digits: 1 },
  { key: 'maxTemp', label: '最高体温', unit: '℃', digits: 1 },
  { key: 'medicineCount', label: '用药', unit: '次' },
  { key: 'outingCount', label: '外出', unit: '次' },
  { key: 'visitCount', label: '就医', unit: '次' },
  { key: 'growthCount', label: '测量', unit: '次' },
]

const DEFAULT_METRICS = ['feedingCount', 'milkMl', 'poopCount']
const STORE_KEY = 'kidslog.stats.metrics'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'week', label: '近 7 天' },
  { key: 'd14', label: '近 14 天' },
  { key: 'd30', label: '近 30 天' },
  { key: 'current', label: '当月' },
  { key: 'custom', label: '自定义' },
]

function bounds(preset: Preset, customFrom: string, customTo: string, month: string) {
  const today = todayStr()
  if (preset === 'week') return { from: shiftDate(today, -6), to: today }
  if (preset === 'd14') return { from: shiftDate(today, -13), to: today }
  if (preset === 'd30') return { from: shiftDate(today, -29), to: today }
  if (preset === 'current') {
    const [y, m] = month.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    const isThisMonth = month === today.slice(0, 7)
    return { from: `${month}-01`, to: isThisMonth ? today : `${month}-${pad(last)}` }
  }
  return { from: customFrom, to: customTo }
}

const WEEK_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function dayLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const w = new Date(y, m - 1, d).getDay()
  const isToday = date === todayStr()
  return { md: `${pad(m)}/${pad(d)}`, w: isToday ? '今天' : WEEK_LABEL[w] }
}

function fmt(m: Metric, v: number | null) {
  if (v === null || v === undefined) return '—'
  if (m.hours) {
    const h = v / 60
    return h ? h.toFixed(1) : '0'
  }
  const num = m.digits ? Math.round(v * 10) / 10 : Math.round(v)
  return String(num)
}

export default function StatsView({ childId, month }: Props) {
  const [preset, setPreset] = useState<Preset>('week')
  const [customFrom, setCustomFrom] = useState(shiftDate(todayStr(), -6))
  const [customTo, setCustomTo] = useState(todayStr())
  const [metrics, setMetrics] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      const arr = raw ? JSON.parse(raw) : null
      if (Array.isArray(arr) && arr.length) return arr.filter((k) => METRICS.some((m) => m.key === k))
    } catch {}
    return DEFAULT_METRICS
  })
  const [picking, setPicking] = useState(false)
  const [data, setData] = useState<StatsDaily | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const { from, to } = useMemo(() => bounds(preset, customFrom, customTo, month), [preset, customFrom, customTo, month])

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(metrics)) } catch {}
  }, [metrics])

  useEffect(() => {
    if (!from || !to || from > to) { setError('时间范围不合法'); return }
    let alive = true
    setLoading(true)
    setError('')
    api.statsDaily(childId, from, to)
      .then((r) => { if (alive) setData(r) })
      .catch((e) => { if (alive) { setData(null); setError(e.message || '统计失败') } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [childId, from, to])

  const active = METRICS.filter((m) => metrics.includes(m.key))
  const days = data?.days || []
  const primary = active[0]
  const primaryMax = primary
    ? Math.max(1, ...days.map((d) => Number(d[primary.key]) || 0))
    : 1

  function toggle(key: string) {
    setMetrics((list) => {
      if (list.includes(key)) {
        const next = list.filter((k) => k !== key)
        return next.length ? next : list
      }
      return [...list, key]
    })
  }

  return (
    <div className="pb-4">
      <div className="flex gap-2 flex-wrap mb-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs transition ${
              preset === p.key ? 'bg-brand-500 text-white' : 'bg-white text-slate-500 shadow-soft'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-2 mb-2 bg-white rounded-xl shadow-soft px-3 py-2">
          <DateField
            value={customFrom}
            onChange={setCustomFrom}
            min={shiftDate(todayStr(), -90)}
            max={customTo || todayStr()}
            className="flex-1 text-xs bg-transparent outline-none text-brand-900"
          />
          <span className="text-xs text-slate-300">至</span>
          <DateField
            value={customTo}
            onChange={setCustomTo}
            min={customFrom}
            max={todayStr()}
            className="flex-1 text-xs bg-transparent outline-none text-brand-900"
          />
        </div>
      )}

      <button
        onClick={() => setPicking((v) => !v)}
        className="w-full flex items-center justify-between bg-white rounded-xl shadow-soft px-3 py-2.5 mb-2"
      >
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          统计项 <span className="text-slate-300">已选 {active.length} 项</span>
        </span>
        <span className="text-[11px] text-brand-600">{picking ? '收起' : '自定义'}</span>
      </button>

      {picking && (
        <div className="bg-white rounded-xl shadow-soft p-3 mb-2 flex flex-wrap gap-2">
          {METRICS.map((m) => {
            const on = metrics.includes(m.key)
            return (
              <button
                key={m.key}
                onClick={() => toggle(m.key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition ${
                  on ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'bg-slate-50 text-slate-500'
                }`}
              >
                {on && <Check className="w-3 h-3" />}
                {m.label}
              </button>
            )
          })}
          <p className="w-full text-[10px] text-slate-300 mt-0.5">选择要统计的指标，按天展示；至少保留 1 项</p>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-300 py-16 text-center">统计中…</p>
      ) : error ? (
        <p className="text-xs text-rose-400 py-16 text-center">{error}</p>
      ) : !data ? (
        <p className="text-xs text-slate-400 py-16 text-center">暂无统计数据</p>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-soft p-3">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] text-slate-400">区间合计 · 日均</p>
              <p className="text-[10px] text-slate-300">{data.from} ~ {data.to}（{data.dayCount} 天）</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {active.map((m) => {
                const total = Number((data.totals as any)[m.key]) || 0
                const avg = data.dayCount ? total / data.dayCount : 0
                return (
                  <div key={m.key} className="bg-[#F7FAFC] rounded-xl px-2 py-2 text-center">
                    <p className="text-[10px] text-slate-400 truncate">{m.label}</p>
                    <p className="text-sm font-semibold text-brand-800 tabular-nums mt-0.5">
                      {m.key === 'maxTemp'
                        ? fmt(m, total || null)
                        : fmt(m, total)}
                      <span className="text-[9px] font-normal text-slate-400 ml-0.5">{m.unit}</span>
                    </p>
                    <p className="text-[9px] text-slate-300 tabular-nums">
                      日均 {m.key === 'maxTemp' ? '—' : fmt(m, avg)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-soft mt-3 overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <p className="text-[11px] text-slate-400">每日明细</p>
              {primary && <p className="text-[10px] text-slate-300">条形为「{primary.label}」当日量</p>}
            </div>
            <div className="max-h-[52vh] overflow-y-auto overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-white/95 backdrop-blur">
                  <tr className="text-slate-400">
                    <th className="text-left font-normal px-3 py-2 sticky left-0 bg-white/95">日期</th>
                    {active.map((m) => (
                      <th key={m.key} className="text-right font-normal px-2 py-2 whitespace-nowrap">
                        {m.label}
                        <span className="text-[9px] text-slate-300 ml-0.5">{m.unit}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.length === 0 ? (
                    <tr><td colSpan={active.length + 1} className="text-center text-slate-300 py-8">该时段没有记录</td></tr>
                  ) : (
                    days.map((d) => {
                      const lb = dayLabel(d.date)
                      const empty = d.total === 0
                      return (
                        <tr key={d.date} className={`border-t border-slate-50 ${empty ? 'opacity-45' : ''}`}>
                          <td className="px-3 py-2 sticky left-0 bg-white">
                            <span className="text-brand-900 tabular-nums">{lb.md}</span>
                            <span className="text-[9px] text-slate-300 ml-1">{lb.w}</span>
                          </td>
                          {active.map((m) => (
                            <td key={m.key} className="px-2 py-2 text-right text-brand-800 tabular-nums whitespace-nowrap">
                              {fmt(m, d[m.key] as number | null)}
                            </td>
                          ))}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {primary && (
              <div className="px-3 py-3 border-t border-slate-50">
                <p className="text-[10px] text-slate-400 mb-2">{primary.label} · 每日趋势</p>
                <div className="flex items-end gap-1 h-24 overflow-x-auto no-scrollbar">
                  {days.slice(-31).map((d) => {
                    const v = Number(d[primary.key]) || 0
                    const h = Math.max(2, Math.round((v / primaryMax) * 88))
                    return (
                      <div key={d.date} className="shrink-0 w-3 flex flex-col items-center justify-end h-full" title={`${d.date} ${fmt(primary, v)}${primary.unit}`}>
                        <div
                          className={`w-2 rounded-t ${v ? 'bg-gradient-to-t from-brand-300 to-mint-400' : 'bg-slate-100'}`}
                          style={{ height: `${v ? h : 2}px` }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-slate-300 mt-1">
                  <span>{days.length ? dayLabel(days[Math.max(0, days.length - 31)].date).md : ''}</span>
                  <span>{days.length ? dayLabel(days[days.length - 1].date).md : ''}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
