import {
  Milk, Moon, Baby, Thermometer, Pill, Trees, Car, PencilLine,
  Ruler, Stethoscope, type LucideIcon,
} from 'lucide-react'

export type FieldType = 'select' | 'number' | 'text' | 'time' | 'date'

export type FieldDef = {
  key: string
  label: string
  type: FieldType
  options?: { value: string; label: string }[]
  placeholder?: string
  unit?: string
  quick?: (number | string)[]
  span?: 1 | 2
}

export type RecordTypeDef = {
  type: string
  label: string
  icon: LucideIcon
  color: string       // tailwind bg class for icon chip
  ring: string        // tailwind ring/border accent
  fields: FieldDef[]
  hasEndTime?: boolean
  defaultPayload?: () => Record<string, any>
}

export const RECORD_TYPES: RecordTypeDef[] = [
  {
    type: 'feeding',
    label: '喂养',
    icon: Milk,
    color: 'bg-amber-100 text-amber-600',
    ring: 'border-amber-200',
    fields: [
      {
        key: 'method', label: '方式', type: 'select',
        options: [
          { value: 'formula', label: '配方奶' },
          { value: 'breast', label: '母乳' },
          { value: 'solid', label: '辅食' },
          { value: 'meal', label: '正餐' },
          { value: 'water', label: '喝水' },
        ],
      },
      { key: 'amountMl', label: '奶量', type: 'number', unit: 'ml', quick: [120, 150, 180, 210] },
      { key: 'foods', label: '食物内容', type: 'text', placeholder: '如：小米粥、鸡蛋羹', span: 2 },
      { key: 'durationMin', label: '时长', type: 'number', unit: '分钟' },
    ],
    defaultPayload: () => ({ method: 'formula' }),
  },
  {
    type: 'sleep',
    label: '睡眠',
    icon: Moon,
    color: 'bg-indigo-100 text-indigo-600',
    ring: 'border-indigo-200',
    hasEndTime: true,
    fields: [
      {
        key: 'quality', label: '睡眠质量', type: 'select',
        options: [
          { value: 'good', label: '安稳' },
          { value: 'fair', label: '一般' },
          { value: 'poor', label: '易醒' },
        ],
      },
    ],
    defaultPayload: () => ({ quality: 'good' }),
  },
  {
    type: 'diaper',
    label: '排便',
    icon: Baby,
    color: 'bg-orange-100 text-orange-600',
    ring: 'border-orange-200',
    fields: [
      {
        key: 'kind', label: '类型', type: 'select',
        options: [
          { value: 'pee', label: '尿' },
          { value: 'poop', label: '便' },
          { value: 'both', label: '尿+便' },
        ],
      },
      {
        key: 'consistency', label: '性状', type: 'select',
        options: [
          { value: 'normal', label: '正常' },
          { value: 'loose', label: '偏稀' },
          { value: 'watery', label: '水样' },
          { value: 'hard', label: '偏干' },
        ],
      },
      {
        key: 'color', label: '颜色', type: 'select',
        options: [
          { value: 'yellow', label: '黄' },
          { value: 'green', label: '绿' },
          { value: 'brown', label: '褐' },
          { value: 'black', label: '黑' },
          { value: 'red', label: '带血丝' },
        ],
      },
    ],
    defaultPayload: () => ({ kind: 'poop', consistency: 'normal' }),
  },
  {
    type: 'temperature',
    label: '体温',
    icon: Thermometer,
    color: 'bg-rose-100 text-rose-600',
    ring: 'border-rose-200',
    fields: [
      { key: 'value', label: '体温', type: 'number', unit: '℃', quick: [36.5, 37.0, 37.5, 38.0, 38.5, 39.0] },
      {
        key: 'method', label: '测量方式', type: 'select',
        options: [
          { value: 'armpit', label: '腋温' },
          { value: 'ear', label: '耳温' },
          { value: 'forehead', label: '额温' },
          { value: 'rectal', label: '肛温' },
        ],
      },
    ],
    defaultPayload: () => ({ method: 'armpit' }),
  },
  {
    type: 'medicine',
    label: '用药',
    icon: Pill,
    color: 'bg-purple-100 text-purple-600',
    ring: 'border-purple-200',
    fields: [
      { key: 'name', label: '药名', type: 'text', placeholder: '如：布洛芬混悬液', span: 2 },
      { key: 'dose', label: '剂量', type: 'number' },
      {
        key: 'unit', label: '单位', type: 'select',
        options: [
          { value: 'ml', label: 'ml' },
          { value: 'mg', label: 'mg' },
          { value: 'tablet', label: '片' },
          { value: 'bag', label: '包' },
        ],
      },
      {
        key: 'route', label: '途径', type: 'select',
        options: [
          { value: 'oral', label: '口服' },
          { value: 'external', label: '外用' },
          { value: 'spray', label: '喷雾' },
        ],
      },
    ],
    defaultPayload: () => ({ unit: 'ml', route: 'oral' }),
  },
  {
    type: 'outing',
    label: '外出',
    icon: Trees,
    color: 'bg-emerald-100 text-emerald-600',
    ring: 'border-emerald-200',
    fields: [
      { key: 'place', label: '地点', type: 'text', placeholder: '如：小区花园' },
      { key: 'companions', label: '同行人', type: 'text', placeholder: '如：奶奶' },
      { key: 'durationMin', label: '时长', type: 'number', unit: '分钟' },
    ],
    defaultPayload: () => ({}),
  },
  {
    type: 'commute',
    label: '接送',
    icon: Car,
    color: 'bg-sky-100 text-sky-600',
    ring: 'border-sky-200',
    fields: [
      {
        key: 'direction', label: '方向', type: 'select',
        options: [
          { value: 'dropoff', label: '送去' },
          { value: 'pickup', label: '接回' },
        ],
      },
      { key: 'who', label: '执行人', type: 'text', placeholder: '如：爸爸' },
      { key: 'place', label: '地点', type: 'text', placeholder: '如：幼儿园' },
    ],
    defaultPayload: () => ({ direction: 'dropoff' }),
  },
  {
    type: 'growth',
    label: '成长',
    icon: Ruler,
    color: 'bg-teal-100 text-teal-600',
    ring: 'border-teal-200',
    fields: [
      { key: 'heightCm', label: '身高', type: 'number', unit: 'cm', quick: [75, 80, 85, 90, 95, 100] },
      { key: 'weightKg', label: '体重', type: 'number', unit: 'kg' },
      { key: 'headCm', label: '头围', type: 'number', unit: 'cm' },
    ],
    defaultPayload: () => ({}),
  },
  {
    type: 'visit',
    label: '就医',
    icon: Stethoscope,
    color: 'bg-cyan-100 text-cyan-700',
    ring: 'border-cyan-200',
    fields: [
      { key: 'hospital', label: '医院', type: 'text', placeholder: '如：市妇幼保健院' },
      { key: 'department', label: '科室', type: 'text', placeholder: '如：儿科' },
      { key: 'doctor', label: '医生', type: 'text', placeholder: '选填' },
      { key: 'diagnosis', label: '诊断', type: 'text', placeholder: '如：急性上呼吸道感染', span: 2 },
      { key: 'prescription', label: '用药 / 处置', type: 'text', placeholder: '如：布洛芬混悬液 5ml', span: 2 },
      { key: 'feeYuan', label: '费用', type: 'number', unit: '元' },
      { key: 'followupAt', label: '复诊日期', type: 'date' },
    ],
    defaultPayload: () => ({}),
  },
  {
    type: 'note',
    label: '随手记',
    icon: PencilLine,
    color: 'bg-slate-100 text-slate-600',
    ring: 'border-slate-200',
    fields: [],
    defaultPayload: () => ({}),
  },
]

export const typeMap: Record<string, RecordTypeDef> = Object.fromEntries(
  RECORD_TYPES.map((t) => [t.type, t]),
)

export function optionLabel(t: RecordTypeDef, key: string, value: any) {
  const f = t.fields.find((x) => x.key === key)
  return f?.options?.find((o) => o.value === value)?.label ?? value
}

export function recordSummary(r: { type: string; payload: any; note?: string | null }): string {
  const def = typeMap[r.type]
  const p = r.payload || {}
  const parts: string[] = []
  if (r.type === 'feeding') {
    if (p.method) parts.push(optionLabel(def, 'method', p.method))
    if (p.amountMl) parts.push(`${p.amountMl}ml`)
    if (p.foods) parts.push(p.foods)
    if (p.durationMin) parts.push(`${p.durationMin}分钟`)
  } else if (r.type === 'sleep') {
    if (p.quality) parts.push(optionLabel(def, 'quality', p.quality))
  } else if (r.type === 'diaper') {
    if (p.kind) parts.push(optionLabel(def, 'kind', p.kind))
    if (p.consistency) parts.push(optionLabel(def, 'consistency', p.consistency))
    if (p.color && p.color !== 'yellow') parts.push(optionLabel(def, 'color', p.color))
  } else if (r.type === 'temperature') {
    if (p.value) parts.push(`${p.value}℃`)
    if (p.method) parts.push(optionLabel(def, 'method', p.method))
  } else if (r.type === 'medicine') {
    if (p.name) parts.push(p.name)
    if (p.dose) parts.push(`${p.dose}${p.unit || ''}`)
    if (p.route) parts.push(optionLabel(def, 'route', p.route))
  } else if (r.type === 'outing') {
    if (p.place) parts.push(p.place)
    if (p.companions) parts.push(`和${p.companions}`)
    if (p.durationMin) parts.push(`${p.durationMin}分钟`)
  } else if (r.type === 'commute') {
    if (p.direction) parts.push(optionLabel(def, 'direction', p.direction))
    if (p.who) parts.push(p.who)
    if (p.place) parts.push(p.place)
  } else if (r.type === 'growth') {
    if (p.heightCm) parts.push(`身高 ${p.heightCm}cm`)
    if (p.weightKg) parts.push(`体重 ${p.weightKg}kg`)
    if (p.headCm) parts.push(`头围 ${p.headCm}cm`)
  } else if (r.type === 'visit') {
    if (p.hospital) parts.push(p.hospital)
    if (p.department) parts.push(p.department)
    if (p.diagnosis) parts.push(p.diagnosis)
    if (p.followupAt) parts.push(`复诊 ${String(p.followupAt).slice(5)}`)
  }
  let text = parts.join(' · ')
  if (r.note) text = text ? `${text}｜${r.note}` : r.note
  return text || '（无详情）'
}
