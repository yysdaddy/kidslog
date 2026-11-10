// WHO 0-5 岁生长标准近似锚点（P3 / P50 / P97），按月龄线性插值
// 仅用于趋势参考，不构成医学诊断依据
type Series = { x: number[]; p3: number[]; p50: number[]; p97: number[] }

const MONTHS = [0, 3, 6, 9, 12, 18, 24, 36, 48, 60]

const DATA: Record<'boy' | 'girl', Record<'height' | 'weight' | 'head', Series>> = {
  boy: {
    height: {
      x: MONTHS,
      p3: [46.3, 57.6, 63.6, 67.7, 71.0, 77.0, 81.7, 90.0, 96.7, 102.9],
      p50: [49.9, 61.4, 67.6, 72.0, 75.7, 82.3, 87.1, 96.1, 103.3, 110.0],
      p97: [53.4, 65.3, 71.6, 76.2, 80.2, 87.7, 92.9, 102.4, 110.0, 117.2],
    },
    weight: {
      x: MONTHS,
      p3: [2.5, 5.0, 6.4, 7.1, 7.7, 8.8, 9.7, 11.3, 12.7, 14.4],
      p50: [3.3, 6.4, 7.9, 8.9, 9.6, 10.9, 12.2, 14.3, 16.3, 18.3],
      p97: [4.4, 8.0, 9.8, 11.0, 12.0, 13.7, 15.3, 18.0, 20.9, 23.4],
    },
    head: {
      x: [0, 3, 6, 9, 12, 18, 24, 36],
      p3: [32.1, 38.2, 41.0, 42.6, 43.6, 44.9, 45.7, 46.6],
      p50: [34.5, 40.5, 43.3, 45.0, 46.1, 47.4, 48.3, 49.5],
      p97: [36.9, 42.8, 45.6, 47.4, 48.6, 50.0, 51.0, 52.4],
    },
  },
  girl: {
    height: {
      x: MONTHS,
      p3: [45.6, 55.8, 61.8, 65.9, 69.4, 75.4, 80.3, 88.9, 95.9, 102.1],
      p50: [49.1, 59.8, 65.7, 70.1, 74.0, 80.7, 85.7, 95.1, 102.7, 109.4],
      p97: [52.7, 63.8, 69.6, 74.2, 78.5, 86.0, 91.2, 101.3, 109.4, 116.7],
    },
    weight: {
      x: MONTHS,
      p3: [2.4, 4.5, 5.8, 6.6, 7.1, 8.1, 9.0, 10.8, 12.3, 13.7],
      p50: [3.2, 5.8, 7.3, 8.2, 8.9, 10.2, 11.5, 13.9, 15.9, 17.9],
      p97: [4.2, 7.5, 9.2, 10.4, 11.5, 13.2, 14.9, 17.8, 20.6, 23.1],
    },
    head: {
      x: [0, 3, 6, 9, 12, 18, 24, 36],
      p3: [31.7, 37.1, 39.8, 41.3, 42.3, 43.6, 44.4, 45.2],
      p50: [33.9, 39.5, 42.2, 43.8, 44.9, 46.2, 47.2, 48.3],
      p97: [36.1, 41.9, 44.6, 46.3, 47.5, 48.8, 49.8, 51.1],
    },
  },
}

export type Metric = 'height' | 'weight' | 'head'

export interface RefPoint {
  p3: number
  p50: number
  p97: number
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function refAt(series: Series, month: number): RefPoint | null {
  if (month < series.x[0] || month > series.x[series.x.length - 1]) return null
  for (let i = 0; i < series.x.length - 1; i++) {
    const x0 = series.x[i], x1 = series.x[i + 1]
    if (month >= x0 && month <= x1) {
      const t = x1 === x0 ? 0 : (month - x0) / (x1 - x0)
      return {
        p3: lerp(series.p3[i], series.p3[i + 1], t),
        p50: lerp(series.p50[i], series.p50[i + 1], t),
        p97: lerp(series.p97[i], series.p97[i + 1], t),
      }
    }
  }
  return null
}

export function refSeries(gender: string | null | undefined, metric: Metric): Series {
  return DATA[gender === 'female' || gender === 'girl' ? 'girl' : 'boy'][metric]
}

// 区间标签：低于 P3 / P3-P50 / P50-P97 / 高于 P97
export function bandLabel(value: number, ref: RefPoint | null): { label: string; tone: 'low' | 'normal' | 'high' } | null {
  if (!ref || !value) return null
  if (value < ref.p3) return { label: '低于 P3', tone: 'low' }
  if (value > ref.p97) return { label: '高于 P97', tone: 'high' }
  if (value < ref.p50) return { label: 'P3–P50', tone: 'normal' }
  return { label: 'P50–P97', tone: 'normal' }
}

export const METRIC_META: Record<Metric, { label: string; unit: string; maxMonth: number }> = {
  height: { label: '身高', unit: 'cm', maxMonth: 60 },
  weight: { label: '体重', unit: 'kg', maxMonth: 60 },
  head: { label: '头围', unit: 'cm', maxMonth: 36 },
}
