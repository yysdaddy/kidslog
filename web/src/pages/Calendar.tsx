import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import StatsView from '../components/StatsView'
import { todayStr, pad } from '../utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  childId: string
  onPickDate: (date: string) => void
}

function monthOf(date: string) {
  return date.slice(0, 7)
}

function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export default function CalendarView({ childId, onPickDate }: Props) {
  const [month, setMonth] = useState(monthOf(todayStr()))
  const [days, setDays] = useState<{ d: string; c: number; t: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'stats'>('stats')

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.calendar(childId, month)
      .then((r) => { if (alive) setDays(r.days) })
      .catch(() => { if (alive) setDays([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [childId, month])

  const map = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of days) m.set(d.d, d.c)
    return m
  }, [days])

  const [y, mo] = month.split('-').map(Number)
  const first = new Date(y, mo - 1, 1)
  const daysInMonth = new Date(y, mo, 0).getDate()
  // 周一为每周第一天
  const leading = (first.getDay() + 6) % 7
  const cells: (string | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const total = days.reduce((s, d) => s + d.c, 0)
  const activeDays = days.filter((d) => d.c > 0).length

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="p-2 -ml-2 text-slate-400">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-base font-medium text-brand-900">{y} 年 {mo} 月</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {loading ? '加载中…' : `${activeDays} 天有记录 · 共 ${total} 条`}
          </p>
        </div>
        <button
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={month >= monthOf(todayStr())}
          className="p-2 -mr-2 text-slate-400 disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-slate-100 rounded-xl p-1 flex mb-3">
        {([['grid', '月历'], ['stats', '统计']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`flex-1 py-2 rounded-lg text-xs transition ${
              view === k ? 'bg-white text-brand-900 shadow-soft font-medium' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'stats' && <StatsView childId={childId} month={month} />}

      {view === 'grid' && (
      <>
      <div className="bg-white rounded-2xl shadow-soft p-3">
        <div className="grid grid-cols-7 mb-1">
          {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
            <div key={w} className="text-center text-[11px] text-slate-300 py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />
            const count = map.get(d) || 0
            const isToday = d === todayStr()
            const future = d > todayStr()
            return (
              <button
                key={d}
                disabled={future}
                onClick={() => onPickDate(d)}
                className="relative flex flex-col items-center py-1.5 rounded-xl active:bg-brand-50 transition disabled:opacity-30"
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] tabular-nums ${
                    isToday ? 'bg-brand-500 text-white font-medium' : count ? 'text-brand-800' : 'text-slate-400'
                  }`}
                >
                  {Number(d.slice(-2))}
                </span>
                <span className={`mt-0.5 h-1 rounded-full transition-all ${
                  count === 0 ? 'w-0' : count < 4 ? 'w-1 bg-mint-300' : count < 8 ? 'w-2 bg-mint-400' : 'w-3 bg-mint-500'
                }`} />
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-slate-300 text-center mt-4">点日期查看当天记录</p>
      </>
      )}
    </div>
  )
}
