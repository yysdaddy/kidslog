import { refSeries, type Metric } from '../who'

export type GrowthPoint = { month: number; value: number; date: string }

type Props = {
  points: GrowthPoint[]
  metric: Metric
  gender?: string | null
  maxMonth: number
  unit: string
}

const W = 340
const H = 190
const PAD = { l: 34, r: 10, t: 12, b: 22 }

export default function GrowthChart({ points, metric, gender, maxMonth, unit }: Props) {
  const series = refSeries(gender, metric)
  const xs = series.x.filter((x) => x <= maxMonth)
  const idx = xs.map((x) => series.x.indexOf(x))
  const p3 = idx.map((i) => series.p3[i])
  const p50 = idx.map((i) => series.p50[i])
  const p97 = idx.map((i) => series.p97[i])

  const usable = points.filter((p) => p.month >= 0 && p.month <= maxMonth)
  const values = [...p3, ...p97, ...usable.map((p) => p.value)]
  let min = Math.min(...values)
  let max = Math.max(...values)
  const span = max - min || 10
  min = Math.floor(min - span * 0.08)
  max = Math.ceil(max + span * 0.08)

  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const sx = (m: number) => PAD.l + (Math.min(Math.max(m, 0), maxMonth) / maxMonth) * iw
  const sy = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * ih

  const bandPts = [
    ...xs.map((x, i) => `${sx(x)},${sy(p97[i])}`),
    ...xs.slice().reverse().map((x, i) => `${sx(x)},${sy(p3[xs.length - 1 - i])}`),
  ].join(' ')

  const p50Line = xs.map((x, i) => `${sx(x)},${sy(p50[i])}`).join(' ')
  const kidLine = usable
    .slice()
    .sort((a, b) => a.month - b.month)
    .map((p) => `${sx(p.month)},${sy(p.value)}`)
    .join(' ')

  const yTicks = 4
  const ticks = Array.from({ length: yTicks }, (_, i) => min + ((max - min) / (yTicks - 1)) * i)
  const xTicks = [0, 12, 24, 36, 48, 60].filter((m) => m <= maxMonth)

  const last = usable.slice().sort((a, b) => a.month - b.month).pop()

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="#F1F5F9" strokeWidth="1" />
            <text x={PAD.l - 6} y={sy(t) + 3} textAnchor="end" fontSize="8" fill="#CBD5E1">
              {Math.round(t)}
            </text>
          </g>
        ))}

        <polygon points={bandPts} fill="#5EEAD4" opacity="0.16" />
        <polyline points={p50Line} fill="none" stroke="#99F6E4" strokeWidth="1.5" strokeDasharray="4 3" />

        {usable.length > 1 && (
          <polyline points={kidLine} fill="none" stroke="#0D9488" strokeWidth="1.8" strokeLinejoin="round" />
        )}
        {usable.map((p, i) => (
          <circle key={`${p.date}-${i}`} cx={sx(p.month)} cy={sy(p.value)} r="2.6" fill="#fff" stroke="#0D9488" strokeWidth="1.6" />
        ))}

        {last && (
          <g>
            <circle cx={sx(last.month)} cy={sy(last.value)} r="4" fill="#0D9488" opacity="0.18" />
            <text x={sx(last.month)} y={sy(last.value) - 8} textAnchor="middle" fontSize="9" fill="#0F766E" fontWeight="600">
              {last.value}{unit}
            </text>
          </g>
        )}

        {xTicks.map((m) => (
          <text key={m} x={sx(m)} y={H - 6} textAnchor="middle" fontSize="8" fill="#CBD5E1">
            {m}月
          </text>
        ))}
      </svg>
    </div>
  )
}
