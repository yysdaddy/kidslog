import { db, now, uid } from '../db.js'
import { VACCINE_PLAN, dueDateFor, dateOf } from '../vaccinePlan.js'

function assertChild(fid, childId) {
  return db.prepare('SELECT * FROM children WHERE id = ? AND family_id = ?').get(childId, fid)
}

function today() {
  return dateOf(new Date())
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000)
}

function statusOf(row, t = today()) {
  if (row.done_date) return 'done'
  if (!row.due_date) return 'pending'
  const diff = daysBetween(t, row.due_date)
  if (diff < 0) return 'overdue'
  if (diff <= 30) return 'dueSoon'
  return 'pending'
}

function rowToVaccine(row) {
  const status = statusOf(row)
  const t = today()
  return {
    id: row.id,
    childId: row.child_id,
    code: row.code,
    name: row.name,
    doseNo: row.dose_no,
    dueDate: row.due_date,
    doneDate: row.done_date,
    place: row.place,
    batchNo: row.batch_no,
    reaction: row.reaction,
    note: row.note,
    source: row.source,
    autoDone: !!row.auto_done,
    status,
    daysLeft: row.due_date && !row.done_date ? daysBetween(t, row.due_date) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// 到当前日期（含今天）应接种的计划内疫苗，默认登记为已接种；
// 用户手动清空接种日期后 auto_done 置 1，不再自动补登
function autoCompleteDue(child) {
  const t = today()
  const r = db.prepare(`UPDATE vaccinations
    SET done_date = due_date, auto_done = 1, updated_at = ?
    WHERE child_id = ? AND deleted_at IS NULL AND source = 'plan'
      AND done_date IS NULL AND auto_done = 0
      AND due_date IS NOT NULL AND due_date <= ?`).run(now(), child.id, t)
  return r.changes || 0
}

function ensurePlan(child) {
  if (!child?.birth_date) return 0
  const ts = now()
  let added = 0
  const exists = db.prepare(
    'SELECT id FROM vaccinations WHERE child_id = ? AND code = ? AND dose_no = ? AND deleted_at IS NULL',
  )
  const insert = db.prepare(`INSERT INTO vaccinations
    (id, child_id, code, name, dose_no, due_date, done_date, place, batch_no, reaction, note, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 'plan', ?, ?)`)
  for (const p of VACCINE_PLAN) {
    if (exists.get(child.id, p.code, p.doseNo)) continue
    insert.run(uid('vac_'), child.id, p.code, p.name, p.doseNo, dueDateFor(child.birth_date, p.month), ts, ts)
    added += 1
  }
  return added
}

export default async function healthRoutes(app) {
  // 疫苗列表
  app.get('/api/vaccines', async (req, reply) => {
    const { childId, status } = req.query || {}
    if (!childId) return reply.code(400).send({ error: 'childId 必填' })
    const child = assertChild(req.user.fid, childId)
    if (!child) return reply.code(403).send({ error: '无权访问' })

    ensurePlan(child)
    autoCompleteDue(child)

    let rows = db.prepare(
      'SELECT * FROM vaccinations WHERE child_id = ? AND deleted_at IS NULL ORDER BY CASE WHEN done_date IS NULL THEN 0 ELSE 1 END, COALESCE(due_date, done_date) ASC',
    ).all(childId)

    let list = rows.map(rowToVaccine)
    if (status === 'pending') list = list.filter((v) => v.status !== 'done')
    if (status === 'done') list = list.filter((v) => v.status === 'done')
    if (status === 'pending') {
      list.sort((a, b) => {
        const rank = { overdue: 0, dueSoon: 1, pending: 2 }
        const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
        if (r !== 0) return r
        return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1
      })
    }

    return { vaccines: list }
  })

  // 幂等生成内置计划
  app.post('/api/vaccines/plan', async (req, reply) => {
    const { childId } = req.body || {}
    const child = assertChild(req.user.fid, childId)
    if (!child) return reply.code(403).send({ error: '无权访问' })
    if (!child.birth_date) return reply.code(400).send({ error: '请先填写孩子出生日期' })
    const added = ensurePlan(child)
    return { added }
  })

  // 新增（自定义疫苗 / 计划外剂次）
  app.post('/api/vaccines', async (req, reply) => {
    const b = req.body || {}
    if (!b.childId || !b.name) return reply.code(400).send({ error: '参数缺失' })
    const child = assertChild(req.user.fid, b.childId)
    if (!child) return reply.code(403).send({ error: '无权访问' })

    const id = uid('vac_')
    const ts = now()
    db.prepare(`INSERT INTO vaccinations
      (id, child_id, code, name, dose_no, due_date, done_date, place, batch_no, reaction, note, source, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'custom', ?, ?)`)
      .run(id, b.childId, String(b.name).trim(), Number(b.doseNo) || 1,
        b.dueDate || null, b.doneDate || null, b.place || null,
        b.batchNo || null, b.reaction || null, b.note || null, ts, ts)

    const row = db.prepare('SELECT * FROM vaccinations WHERE id = ?').get(id)
    return { vaccine: rowToVaccine(row) }
  })

  // 编辑 / 登记接种
  app.patch('/api/vaccines/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM vaccinations WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
    if (!row) return reply.code(404).send({ error: '未找到' })
    if (!assertChild(req.user.fid, row.child_id)) return reply.code(403).send({ error: '无权访问' })

    const b = req.body || {}
    const sets = [], vals = []
    const map = {
      name: 'name', doseNo: 'dose_no', dueDate: 'due_date', doneDate: 'done_date',
      place: 'place', batchNo: 'batch_no', reaction: 'reaction', note: 'note',
    }
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { sets.push(`${col} = ?`); vals.push(b[k] === '' ? null : b[k]) }
    }
    // 手动填写接种日期 -> 记为真实登记；手动清空 -> 标记放弃自动补登
    if (b.doneDate !== undefined) {
      sets.push('auto_done = ?'); vals.push(b.doneDate ? 0 : 1)
    }
    if (!sets.length) return { vaccine: rowToVaccine(row) }
    sets.push('updated_at = ?'); vals.push(now())
    vals.push(row.id)
    db.prepare(`UPDATE vaccinations SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
    return { vaccine: rowToVaccine(db.prepare('SELECT * FROM vaccinations WHERE id = ?').get(row.id)) }
  })

  // 删除（软删除并释放计划唯一约束）
  app.delete('/api/vaccines/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM vaccinations WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
    if (!row) return reply.code(404).send({ error: '未找到' })
    if (!assertChild(req.user.fid, row.child_id)) return reply.code(403).send({ error: '无权访问' })
    db.prepare('UPDATE vaccinations SET deleted_at = ?, code = NULL, updated_at = ? WHERE id = ?')
      .run(now(), now(), row.id)
    return { ok: true }
  })

  // 健康页待办摘要
  app.get('/api/health/overview', async (req, reply) => {
    const { childId } = req.query || {}
    const child = assertChild(req.user.fid, childId)
    if (!child) return reply.code(403).send({ error: '无权访问' })
    ensurePlan(child)
    autoCompleteDue(child)

    const rows = db.prepare('SELECT * FROM vaccinations WHERE child_id = ? AND deleted_at IS NULL').all(childId)
    const list = rows.map(rowToVaccine)
    const done = list.filter((v) => v.status === 'done')
    const pending = list.filter((v) => v.status !== 'done')
    const overdue = pending.filter((v) => v.status === 'overdue')
    const next = [...pending].sort((a, b) => (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1)[0] || null

    // 就医：最近一次 + 下次复诊
    const visits = db.prepare(`SELECT * FROM records WHERE child_id = ? AND type = 'visit' AND deleted_at IS NULL
                               ORDER BY occurred_at DESC LIMIT 100`).all(childId)
    const parsed = visits.map((v) => {
      let payload = {}
      try { payload = JSON.parse(v.payload || '{}') } catch { payload = {} }
      return { id: v.id, occurredAt: v.occurred_at, payload }
    })
    const t = today()
    const followups = parsed
      .filter((v) => v.payload?.followupAt && v.payload.followupAt >= t)
      .sort((a, b) => (a.payload.followupAt < b.payload.followupAt ? -1 : 1))
    const nextFollowup = followups[0]
      ? { ...followups[0], daysLeft: daysBetween(t, followups[0].payload.followupAt) }
      : null

    return {
      nextVaccine: next,
      overdueCount: overdue.length,
      doneCount: done.length,
      pendingCount: pending.length,
      totalCount: list.length,
      lastVisit: parsed[0] ? { id: parsed[0].id, occurredAt: parsed[0].occurredAt, ...parsed[0].payload } : null,
      nextFollowup,
    }
  })
}
