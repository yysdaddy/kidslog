import { db } from '../db.js'

function assertChild(fid, childId) {
  return db.prepare('SELECT id FROM children WHERE id = ? AND family_id = ?').get(childId, fid)
}

function startIso(date) {
  return `${date}T00:00:00+08:00`
}
// 右开区间：次日零点，避免毫秒边界与本地偏移混用导致漏算
function endIso(date) {
  return `${shift(date, 1)}T00:00:00+08:00`
}
function shift(date, delta) {
  const d = new Date(`${date}T12:00:00+08:00`)
  d.setDate(d.getDate() + delta)
  const p = (n) => (n < 10 ? `0${n}` : String(n))
  // 用北京时间取日期
  const bj = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${bj.getUTCFullYear()}-${p(bj.getUTCMonth() + 1)}-${p(bj.getUTCDate())}`
}

function aggregate(childId, from, to) {
  const rows = db.prepare(`SELECT * FROM records WHERE child_id = ? AND deleted_at IS NULL
                           AND datetime(occurred_at) >= datetime(?) AND datetime(occurred_at) < datetime(?)`)
    .all(childId, startIso(from), endIso(to))

  const byType = new Map()
  const days = new Set()
  let sleepMinutes = 0
  let maxTemp = 0

  for (const r of rows) {
    byType.set(r.type, (byType.get(r.type) || 0) + 1)
    days.add(new Date(new Date(r.occurred_at).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10))
    if (r.type === 'sleep' && r.ended_at) {
      sleepMinutes += Math.max(0, (new Date(r.ended_at).getTime() - new Date(r.occurred_at).getTime()) / 60000)
    }
    if (r.type === 'temperature') {
      let payload = {}
      try { payload = JSON.parse(r.payload || '{}') } catch { payload = {} }
      maxTemp = Math.max(maxTemp, Number(payload.value) || 0)
    }
  }

  return {
    total: rows.length,
    activeDays: days.size,
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    sleepMinutes: Math.round(sleepMinutes),
    feedingCount: byType.get('feeding') || 0,
    maxTemp: maxTemp ? Math.round(maxTemp * 10) / 10 : null,
    visitCount: byType.get('visit') || 0,
    growthCount: byType.get('growth') || 0,
  }
}


function bjDate(iso) {
  return new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

function parsePayload(raw) {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function emptyDay(date) {
  return {
    date,
    total: 0,
    feedingCount: 0,
    milkMl: 0,
    solidCount: 0,
    poopCount: 0,
    peeCount: 0,
    diaperCount: 0,
    sleepMinutes: 0,
    maxTemp: null,
    medicineCount: 0,
    outingCount: 0,
    visitCount: 0,
    growthCount: 0,
    byType: {},
  }
}

function dailySeries(childId, from, to) {
  const rows = db.prepare(`SELECT * FROM records WHERE child_id = ? AND deleted_at IS NULL
                           AND datetime(occurred_at) >= datetime(?) AND datetime(occurred_at) < datetime(?)
                           ORDER BY occurred_at ASC`)
    .all(childId, startIso(from), endIso(to))

  const map = new Map()
  // 先按天补零，保证没有记录的日期也有数据点
  let cursor = from
  let guard = 0
  while (cursor <= to && guard < 400) {
    map.set(cursor, emptyDay(cursor))
    cursor = shift(cursor, 1)
    guard += 1
  }

  for (const r of rows) {
    const date = bjDate(r.occurred_at)
    const day = map.get(date) || emptyDay(date)
    map.set(date, day)

    day.total += 1
    day.byType[r.type] = (day.byType[r.type] || 0) + 1

    if (r.type === 'feeding') {
      const p = parsePayload(r.payload)
      day.feedingCount += 1
      if (['formula', 'breast', 'mixed'].includes(String(p.method))) {
        day.milkMl += Number(p.amountMl) || 0
      }
      if (['solid', 'meal'].includes(String(p.method))) day.solidCount += 1
    } else if (r.type === 'diaper') {
      const p = parsePayload(r.payload)
      day.diaperCount += 1
      const kind = String(p.kind || '')
      if (kind === 'poop' || kind === 'both') day.poopCount += 1
      if (kind === 'pee' || kind === 'both') day.peeCount += 1
    } else if (r.type === 'sleep') {
      if (r.ended_at) {
        day.sleepMinutes += Math.max(0, (new Date(r.ended_at).getTime() - new Date(r.occurred_at).getTime()) / 60000)
      }
    } else if (r.type === 'temperature') {
      const v = Number(parsePayload(r.payload).value) || 0
      if (v) day.maxTemp = Math.max(day.maxTemp || 0, v)
    } else if (r.type === 'medicine') {
      day.medicineCount += 1
    } else if (r.type === 'outing' || r.type === 'commute') {
      day.outingCount += 1
    } else if (r.type === 'visit') {
      day.visitCount += 1
    } else if (r.type === 'growth') {
      day.growthCount += 1
    }
  }

  const days = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  for (const d of days) d.sleepMinutes = Math.round(d.sleepMinutes)

  const totals = {
    total: 0, feedingCount: 0, milkMl: 0, solidCount: 0, poopCount: 0, peeCount: 0,
    diaperCount: 0, sleepMinutes: 0, maxTemp: null, medicineCount: 0,
    outingCount: 0, visitCount: 0, growthCount: 0,
  }
  for (const d of days) {
    for (const k of Object.keys(totals)) {
      if (k === 'maxTemp') {
        if (d.maxTemp) totals.maxTemp = Math.max(totals.maxTemp || 0, d.maxTemp)
      } else {
        totals[k] += d[k] || 0
      }
    }
  }

  return { days, totals, dayCount: days.length }
}

export default async function statsRoutes(app) {
  app.get('/api/stats/range', async (req, reply) => {
    const { childId, from, to } = req.query || {}
    if (!childId || !from || !to) return reply.code(400).send({ error: '参数缺失' })
    if (!assertChild(req.user.fid, childId)) return reply.code(403).send({ error: '无权访问' })
    if (from > to) return reply.code(400).send({ error: '时间范围不合法' })

    const span = Math.round((new Date(`${to}T00:00:00+08:00`) - new Date(`${from}T00:00:00+08:00`)) / 86400000) + 1
    const prevTo = shift(from, -1)
    const prevFrom = shift(prevTo, -(span - 1))

    const current = aggregate(childId, from, to)
    const prev = aggregate(childId, prevFrom, prevTo)

    return { from, to, ...current, prev: { from: prevFrom, to: prevTo, ...prev } }
  })

  app.get('/api/stats/daily', async (req, reply) => {
    const { childId, from, to } = req.query || {}
    if (!childId || !from || !to) return reply.code(400).send({ error: '参数缺失' })
    if (!assertChild(req.user.fid, childId)) return reply.code(403).send({ error: '无权访问' })
    if (from > to) return reply.code(400).send({ error: '时间范围不合法' })

    const span = Math.round((new Date(`${to}T00:00:00+08:00`) - new Date(`${from}T00:00:00+08:00`)) / 86400000) + 1
    if (span > 92) return reply.code(400).send({ error: '时间跨度最多 92 天' })

    return { from, to, ...dailySeries(childId, from, to) }
  })
}
