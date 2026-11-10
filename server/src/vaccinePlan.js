// 国家免疫规划疫苗程序（2021 版，0-6 岁）
// month：建议接种月龄，用于按出生日期推算计划接种日
export const VACCINE_PLAN = [
  { code: 'hepb', name: '乙肝疫苗', doseNo: 1, month: 0 },
  { code: 'bcg', name: '卡介苗', doseNo: 1, month: 0 },
  { code: 'hepb', name: '乙肝疫苗', doseNo: 2, month: 1 },
  { code: 'ipv', name: '脊灰灭活疫苗', doseNo: 1, month: 2 },
  { code: 'ipv', name: '脊灰灭活疫苗', doseNo: 2, month: 3 },
  { code: 'dtap', name: '百白破疫苗', doseNo: 1, month: 3 },
  { code: 'bopv', name: '脊灰减毒活疫苗', doseNo: 3, month: 4 },
  { code: 'dtap', name: '百白破疫苗', doseNo: 2, month: 4 },
  { code: 'dtap', name: '百白破疫苗', doseNo: 3, month: 5 },
  { code: 'hepb', name: '乙肝疫苗', doseNo: 3, month: 6 },
  { code: 'mpsv-a', name: 'A群流脑多糖疫苗', doseNo: 1, month: 6 },
  { code: 'mr', name: '麻腮风疫苗', doseNo: 1, month: 8 },
  { code: 'je-l', name: '乙脑减毒活疫苗', doseNo: 1, month: 8 },
  { code: 'mpsv-a', name: 'A群流脑多糖疫苗', doseNo: 2, month: 9 },
  { code: 'dtap', name: '百白破疫苗', doseNo: 4, month: 18 },
  { code: 'mr', name: '麻腮风疫苗', doseNo: 2, month: 18 },
  { code: 'hepa-l', name: '甲肝减毒活疫苗', doseNo: 1, month: 18 },
  { code: 'je-l', name: '乙脑减毒活疫苗', doseNo: 2, month: 24 },
  { code: 'mpsv-ac', name: 'A群C群流脑多糖疫苗', doseNo: 1, month: 36 },
  { code: 'bopv', name: '脊灰减毒活疫苗', doseNo: 4, month: 48 },
  { code: 'dt', name: '白破疫苗', doseNo: 1, month: 72 },
  { code: 'mpsv-ac', name: 'A群C群流脑多糖疫苗', doseNo: 2, month: 72 },
]

export function pad2(n) {
  return n < 10 ? `0${n}` : String(n)
}

export function dateOf(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// 出生日期 + 月龄 -> 计划接种日（月末溢出时落到当月最后一天）
export function addMonths(birthDate, months) {
  const [y, m, d] = birthDate.split('-').map(Number)
  const base = new Date(y, m - 1 + months, 1)
  const year = base.getFullYear()
  const month = base.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return dateOf(new Date(year, month, Math.min(d, lastDay)))
}

export function dueDateFor(birthDate, month) {
  return addMonths(birthDate, month)
}
