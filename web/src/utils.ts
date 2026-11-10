export function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dateStr(d: Date) {
  return todayStr(d)
}

export function shiftDate(s: string, delta: number) {
  const d = new Date(`${s}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return todayStr(d)
}

export function hhmm(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function weekdayLabel(s: string) {
  const d = new Date(`${s}T12:00:00`)
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const today = todayStr()
  if (s === today) return '今天'
  if (s === shiftDate(today, -1)) return '昨天'
  if (s === shiftDate(today, 1)) return '明天'
  return names[d.getDay()]
}

export function toLocalInput(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(v: string) {
  return new Date(v).toISOString()
}

export function dateInputFromIso(iso: string) {
  return toLocalInput(iso)
}

export function ageLabel(birthDate?: string | null) {
  if (!birthDate) return ''
  const b = new Date(`${birthDate}T12:00:00`)
  const n = new Date()
  let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth())
  if (n.getDate() < b.getDate()) months -= 1
  if (months < 0) return ''
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}个月`
  if (m === 0) return `${y}岁`
  return `${y}岁${m}个月`
}
