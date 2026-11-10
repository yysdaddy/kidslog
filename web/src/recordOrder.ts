// 按孩子月龄调整记录类型顺序：高频入口前置
export type AgeBand = {
  key: string
  label: string
  minMonth: number
  maxMonth: number
  order: string[]
}

const DEFAULT_ORDER = [
  'feeding', 'sleep', 'diaper', 'temperature', 'medicine',
  'outing', 'commute', 'growth', 'visit', 'note',
]

export const AGE_BANDS: AgeBand[] = [
  {
    key: 'newborn', label: '新生儿', minMonth: 0, maxMonth: 6,
    order: ['feeding', 'sleep', 'diaper', 'temperature', 'medicine', 'note', 'growth', 'outing', 'commute', 'visit'],
  },
  {
    key: 'infant', label: '婴儿', minMonth: 7, maxMonth: 12,
    order: ['feeding', 'sleep', 'diaper', 'temperature', 'medicine', 'outing', 'growth', 'note', 'visit', 'commute'],
  },
  {
    key: 'toddler', label: '幼儿', minMonth: 13, maxMonth: 24,
    order: ['feeding', 'sleep', 'diaper', 'temperature', 'medicine', 'outing', 'growth', 'visit', 'note', 'commute'],
  },
  {
    key: 'preschool', label: '学龄前', minMonth: 25, maxMonth: 48,
    order: ['feeding', 'sleep', 'diaper', 'temperature', 'outing', 'growth', 'visit', 'medicine', 'commute', 'note'],
  },
  {
    key: 'school', label: '学龄', minMonth: 49, maxMonth: 84,
    order: ['feeding', 'sleep', 'temperature', 'outing', 'commute', 'growth', 'medicine', 'visit', 'diaper', 'note'],
  },
]

export const GENERIC_BAND: AgeBand = {
  key: 'generic', label: '通用', minMonth: 85, maxMonth: 999,
  order: DEFAULT_ORDER,
}

export function ageMonths(birthDate?: string | null, at = new Date()): number | null {
  if (!birthDate) return null
  const b = new Date(`${birthDate}T12:00:00`)
  if (Number.isNaN(b.getTime())) return null
  let months = (at.getFullYear() - b.getFullYear()) * 12 + (at.getMonth() - b.getMonth())
  if (at.getDate() < b.getDate()) months -= 1
  return months < 0 ? null : months
}

export function bandOf(months: number | null): AgeBand {
  if (months === null) return GENERIC_BAND
  return AGE_BANDS.find((b) => months >= b.minMonth && months <= b.maxMonth) || GENERIC_BAND
}

export function orderedTypes(birthDate?: string | null): { types: string[]; band: AgeBand } {
  const band = bandOf(ageMonths(birthDate))
  const seen = new Set(band.order)
  const rest = DEFAULT_ORDER.filter((t) => !seen.has(t))
  return { types: [...band.order, ...rest], band }
}

export function quickTypes(birthDate?: string | null, count = 8): { types: string[]; band: AgeBand } {
  const { types, band } = orderedTypes(birthDate)
  return { types: types.slice(0, count), band }
}

const STAGE_LABEL: Record<string, string> = {
  newborn: '新生儿期',
  infant: '婴儿期',
  toddler: '幼儿期',
  preschool: '学龄前期',
  school: '学龄期',
  generic: '通用',
}

export type Stage = { months: number | null; band: AgeBand; label: string; hint: string }

export function stageOf(birthDate?: string | null, at = new Date()): Stage {
  const months = ageMonths(birthDate, at)
  const band = bandOf(months)
  const label = STAGE_LABEL[band.key] || '通用'
  const hint =
    months === null
      ? '未填写出生日期，按通用顺序展示'
      : band.key === 'newborn'
        ? '以喂养、睡眠、排便为核心高频记录'
        : band.key === 'infant'
          ? '喂养仍为主，开始关注辅食与外出'
          : band.key === 'toddler'
            ? '以正餐、睡眠、外出为主，奶量逐步减少'
            : band.key === 'preschool'
              ? '入园节奏，睡眠与外出、用药记录更常用'
              : band.key === 'school'
                ? '以正餐、睡眠、体温与行程为主'
                : '按通用顺序展示'
  return { months, band, label, hint }
}

// 依据月龄裁剪/重排记录表单字段与选项
export function adaptFields<T extends { type: string; fields: any[] }>(def: T, birthDate?: string | null): T['fields'] {
  const months = ageMonths(birthDate)
  if (months === null) return def.fields

  if (def.type === 'feeding') {
    const prefer =
      months <= 6
        ? ['formula', 'breast']
        : months <= 12
          ? ['formula', 'breast', 'solid', 'water']
          : months <= 24
            ? ['formula', 'breast', 'solid', 'meal', 'water']
            : ['meal', 'solid', 'water', 'formula']
    const allowed =
      months <= 6
        ? ['formula', 'breast', 'mixed']
        : months <= 12
          ? ['formula', 'breast', 'solid', 'water', 'mixed']
          : prefer

    return def.fields.map((f: any) => {
      if (f.key !== 'method' || !f.options) return f
      const opts = f.options.filter((o: any) => allowed.includes(o.value))
      const rank = (v: string) => {
        const i = prefer.indexOf(v)
        return i === -1 ? 99 : i
      }
      opts.sort((a: any, b: any) => rank(a.value) - rank(b.value))
      return { ...f, options: opts.length ? opts : f.options }
    })
  }

  if (def.type === 'diaper' && months >= 36) {
    return def.fields.filter((f: any) => f.key === 'kind' || f.key === 'amount')
  }

  return def.fields
}
