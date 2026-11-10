import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type Child, type RecordItem } from '../api'
import GrowthChart, { type GrowthPoint } from '../components/GrowthChart'
import RecordSheet from '../components/RecordSheet'
import RecordDetail from '../components/RecordDetail'
import { ageMonths } from '../recordOrder'
import { METRIC_META, bandLabel, refAt, refSeries, type Metric } from '../who'
import { todayStr } from '../utils'
import { ChevronDown, ChevronUp, Plus, Ruler } from 'lucide-react'

type Props = { child: Child }

type MetricKey = Metric
const KEYS: { key: MetricKey; payload: 'heightCm' | 'weightKg' | 'headCm' }[] = [
  { key: 'height', payload: 'heightCm' },
  { key: 'weight', payload: 'weightKg' },
  { key: 'head', payload: 'headCm' },
]

function monthOfRecord(birthDate: string | null | undefined, iso: string) {
  if (!birthDate) return null
  return ageMonths(birthDate, new Date(iso))
}

export default function Growth({ child }: Props) {
  const [records, setRecords] = useState<RecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [metric, setMetric] = useState<MetricKey>('height')
  const [headOpen, setHeadOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<RecordItem | null>(null)
  const [detail, setDetail] = useState<RecordItem | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await api.records({ childId: child.id, type: 'growth', limit: 200 })
      setRecords(r.records)
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [child.id])

  useEffect(() => { setLoading(true); load() }, [load])

  const asc = useMemo(
    () => records.slice().sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1)),
    [records],
  )

  const cards = KEYS.map(({ key, payload }) => {
    const list = asc.filter((r) => Number(r.payload?.[payload]) > 0)
    const latest = list[list.length - 1]
    const prev = list[list.length - 2]
    const value = latest ? Number(latest.payload[payload]) : null
    const prevValue = prev ? Number(prev.payload[payload]) : null
    const month = latest ? monthOfRecord(child.birthDate, latest.occurredAt) : null
    const ref = month !== null ? refAt(refSeries(child.gender, key), month) : null
    const band = value ? bandLabel(value, ref) : null
    return {
      key, payload, latest, value, prevValue,
      delta: value && prevValue ? Math.round((value - prevValue) * 10) / 10 : null,
      band,
      meta: METRIC_META[key],
    }
  })

  const points: GrowthPoint[] = asc
    .map((r) => {
      const key = KEYS.find((k) => k.key === metric)!
      const v = Number(r.payload?.[key.payload])
      const m = monthOfRecord(child.birthDate, r.occurredAt)
      return v > 0 && m !== null ? { month: m, value: v, date: r.occurredAt.slice(0, 10) } : null
    })
    .filter(Boolean) as GrowthPoint[]

  const toneCls = (tone?: string) =>
    tone === 'low' ? 'text-amber-600 bg-amber-50' : tone === 'high' ? 'text-orange-600 bg-orange-50' : 'text-teal-600 bg-teal-50'

  return (
    <div className="px-4 pt-3 pb-28">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-base font-medium text-brand-900">成长曲线</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {child.birthDate ? `出生 ${child.birthDate}` : '未填写出生日期'}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setSheetOpen(true) }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-teal-500 text-white text-xs"
        >
          <Plus className="w-3.5 h-3.5" /> 记一次
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {cards.filter((c) => c.key !== 'head').map((c) => (
          <div key={c.key} className="bg-white rounded-2xl shadow-soft p-3">
            <p className="text-[11px] text-slate-400">{c.meta.label}（{c.meta.unit}）</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-semibold text-brand-900 tabular-nums">{c.value ?? '—'}</span>
              {c.delta !== null && (
                <span className={`text-[11px] ${c.delta >= 0 ? 'text-teal-600' : 'text-slate-400'}`}>
                  {c.delta >= 0 ? '+' : ''}{c.delta}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-slate-300">{c.latest ? c.latest.occurredAt.slice(0, 10) : '暂无记录'}</span>
              {c.band && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${toneCls(c.band.tone)}`}>{c.band.label}</span>
              )}
            </div>
          </div>
        ))}
        <button
          onClick={() => setHeadOpen((v) => !v)}
          className="bg-white rounded-2xl shadow-soft p-3 text-left"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400">头围（cm）</p>
            {headOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-300" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300" />}
          </div>
          {headOpen ? (
            <>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-semibold text-brand-900 tabular-nums">{cards[2].value ?? '—'}</span>
                {cards[2].delta !== null && (
                  <span className={`text-[11px] ${(cards[2].delta || 0) >= 0 ? 'text-teal-600' : 'text-slate-400'}`}>
                    {(cards[2].delta || 0) >= 0 ? '+' : ''}{cards[2].delta}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-300">{cards[2].latest ? cards[2].latest.occurredAt.slice(0, 10) : '暂无记录'}</span>
                {cards[2].band && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${toneCls(cards[2].band.tone)}`}>{cards[2].band.label}</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-[10px] text-slate-300 mt-2">点开查看头围趋势</p>
          )}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-soft mt-3 p-3">
        <div className="flex gap-1.5 mb-2">
          {(Object.keys(METRIC_META) as MetricKey[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 rounded-full text-xs transition ${
                metric === m ? 'bg-teal-500 text-white' : 'bg-slate-50 text-slate-500'
              }`}
            >
              {METRIC_META[m].label}
            </button>
          ))}
        </div>

        {points.length ? (
          <GrowthChart
            points={points}
            metric={metric}
            gender={child.gender}
            maxMonth={METRIC_META[metric].maxMonth}
            unit={METRIC_META[metric].unit}
          />
        ) : (
          <div className="py-12 text-center">
            <Ruler className="w-8 h-8 text-slate-200 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-xs text-slate-400">还没有{METRIC_META[metric].label}数据</p>
          </div>
        )}

        <p className="text-[10px] text-slate-300 mt-1 text-center">
          阴影带为 WHO 参考范围 P3–P97（近似值，仅供参考）
        </p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-brand-900">成长记录</p>
          <span className="text-[11px] text-slate-400">{records.length} 次测量</span>
        </div>
        {loading ? (
          <p className="text-xs text-slate-300 py-6 text-center">加载中…</p>
        ) : records.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">记下第一次身高体重吧</p>
        ) : (
          <ul className="space-y-2">
            {records.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setDetail(r)}
                  className="w-full text-left bg-white rounded-xl shadow-soft px-4 py-2.5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-[13px] text-brand-900">
                      {r.payload?.heightCm ? `${r.payload.heightCm}cm` : ''}
                      {r.payload?.weightKg ? ` · ${r.payload.weightKg}kg` : ''}
                      {r.payload?.headCm ? ` · 头围${r.payload.headCm}cm` : ''}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{r.occurredAt.slice(0, 10)}</p>
                  </div>
                  <span className="text-[10px] text-slate-300">
                    {monthOfRecord(child.birthDate, r.occurredAt) ?? '—'} 月龄
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {sheetOpen && (
        <RecordSheet
          childId={child.id}
          birthDate={child.birthDate}
          initialType="growth"
          editing={editing}
          onClose={() => { setSheetOpen(false); setEditing(null) }}
          onSaved={() => { load(); setDetail(null) }}
        />
      )}

      {detail && (
        <RecordDetail
          record={detail}
          onClose={() => setDetail(null)}
          onEdit={(r) => { setEditing(r); setSheetOpen(true) }}
          onDeleted={load}
        />
      )}
    </div>
  )
}
