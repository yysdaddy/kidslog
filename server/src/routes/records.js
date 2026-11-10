import { db, now, uid, rowToRecord, attachmentToApi } from '../db.js'
import { removeAttachmentFiles } from '../media.js'

const VALID_TYPES = ['feeding', 'sleep', 'diaper', 'temperature', 'medicine', 'outing', 'commute', 'note', 'growth', 'visit']

// 北京时间日期
function bjDate(iso) {
  return new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

// 成长记录：同一孩子同一天只允许一条
function growthConflict(childId, occurredAt, excludeId = null) {
  const month = bjDate(occurredAt).slice(0, 7)
  const [my, mm] = month.split('-').map(Number)
  const next = new Date(my, mm, 1)
  const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  const rows = db.prepare(`SELECT id, occurred_at FROM records
                           WHERE child_id = ? AND type = 'growth' AND deleted_at IS NULL
                           AND datetime(occurred_at) >= datetime(?) AND datetime(occurred_at) < datetime(?)`)
    .all(childId, `${month}-01T00:00:00+08:00`, `${nextMonth}-01T00:00:00+08:00`)
  const day = bjDate(occurredAt)
  return rows.some((r) => r.id !== excludeId && bjDate(r.occurred_at) === day)
}

function growthEmpty(payload) {
  const p = payload || {}
  return !Number(p.heightCm) && !Number(p.weightKg) && !Number(p.headCm)
}

function assertChild(fid, childId) {
  return db.prepare('SELECT id FROM children WHERE id = ? AND family_id = ?').get(childId, fid)
}

function attachmentsByRecord(recordIds) {
  const map = new Map()
  if (!recordIds.length) return map
  const marks = recordIds.map(() => '?').join(',')
  const rows = db.prepare(`SELECT * FROM attachments WHERE record_id IN (${marks}) ORDER BY created_at ASC`)
    .all(...recordIds)
  for (const r of rows) {
    if (!map.has(r.record_id)) map.set(r.record_id, [])
    map.get(r.record_id).push(attachmentToApi(r))
  }
  return map
}

function withAttachments(records) {
  const map = attachmentsByRecord(records.map((r) => r.id))
  return records.map((r) => ({ ...r, attachments: map.get(r.id) || [] }))
}

function getRecord(id) {
  const row = db.prepare(`SELECT r.*, u.display_name AS creator_name FROM records r
                          LEFT JOIN users u ON u.id = r.created_by WHERE r.id = ?`).get(id)
  if (!row) return null
  return withAttachments([rowToRecord(row)])[0]
}

// 把附件绑定到记录；已解绑的附件从列表移除并清理文件
function syncAttachments(recordId, childId, keepIds) {
  const current = db.prepare('SELECT * FROM attachments WHERE record_id = ?').all(recordId)
  const keep = new Set(keepIds || [])
  for (const a of current) {
    if (!keep.has(a.id)) {
      db.prepare('DELETE FROM attachments WHERE id = ?').run(a.id)
      removeAttachmentFiles(a.child_id, a.id).catch(() => {})
      keep.delete(a.id)
    }
  }
  for (const id of keep) {
    const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id)
    if (!row || row.child_id !== childId) continue
    if (row.record_id && row.record_id !== recordId) continue
    db.prepare('UPDATE attachments SET record_id = ? WHERE id = ?').run(recordId, id)
  }
}

export default async function recordRoutes(app) {
  // 列表：按日期或日期范围
  app.get('/api/records', async (req, reply) => {
    const { childId, date, from, to, type, limit } = req.query || {}
    if (!childId) return reply.code(400).send({ error: 'childId 必填' })
    if (!assertChild(req.user.fid, childId)) return reply.code(403).send({ error: '无权访问' })

    let sql = `SELECT r.*, u.display_name AS creator_name FROM records r
               LEFT JOIN users u ON u.id = r.created_by
               WHERE r.child_id = ? AND r.deleted_at IS NULL`
    const args = [childId]

    if (date) {
      const next = new Date(`${date}T00:00:00+08:00`)
      next.setDate(next.getDate() + 1)
      const nextDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
      sql += ' AND datetime(r.occurred_at) >= datetime(?) AND datetime(r.occurred_at) < datetime(?)'
      args.push(`${date}T00:00:00+08:00`, `${nextDate}T00:00:00+08:00`)
    } else {
      if (from) { sql += ' AND datetime(r.occurred_at) >= datetime(?)'; args.push(from) }
      if (to) { sql += ' AND datetime(r.occurred_at) <= datetime(?)'; args.push(to) }
    }
    if (type) { sql += ' AND r.type = ?'; args.push(type) }

    sql += ' ORDER BY r.occurred_at DESC LIMIT ?'
    args.push(Number(limit) || 200)

    const rows = db.prepare(sql).all(...args)
    return { records: withAttachments(rows.map(rowToRecord)) }
  })

  // 日历打点：某月每天记录数 + 类型分布
  app.get('/api/calendar', async (req, reply) => {
    const { childId, month } = req.query || {}
    if (!childId || !month) return reply.code(400).send({ error: '参数缺失' })
    if (!assertChild(req.user.fid, childId)) return reply.code(403).send({ error: '无权访问' })
    const start = new Date(`${month}-01T00:00:00+08:00`)
    const end = new Date(start); end.setMonth(end.getMonth() + 1)
    const p2 = (n) => String(n).padStart(2, '0')
    const nextMonth = `${end.getFullYear()}-${p2(end.getMonth() + 1)}`
    const rows = db.prepare(`
      SELECT substr(datetime(occurred_at, '+8 hours'), 1, 10) AS d, COUNT(*) AS c,
             COUNT(DISTINCT type) AS t
      FROM records
      WHERE child_id = ? AND deleted_at IS NULL
        AND datetime(occurred_at) >= datetime(?) AND datetime(occurred_at) < datetime(?)
      GROUP BY d ORDER BY d`).all(childId, `${month}-01T00:00:00+08:00`, `${nextMonth}-01T00:00:00+08:00`)
    return { days: rows }
  })

  // 创建
  app.post('/api/records', async (req, reply) => {
    const b = req.body || {}
    if (!b.childId || !b.type) return reply.code(400).send({ error: '参数缺失' })
    if (!VALID_TYPES.includes(b.type)) return reply.code(400).send({ error: '未知记录类型' })
    if (!assertChild(req.user.fid, b.childId)) return reply.code(403).send({ error: '无权访问' })

    const id = uid('rec_')
    const ts = now()
    const occurredAt = b.occurredAt ? new Date(b.occurredAt).toISOString() : ts
    if (b.type === 'growth') {
      if (growthEmpty(b.payload)) return reply.code(400).send({ error: '请至少填写身高、体重、头围中的一项' })
      if (growthConflict(b.childId, occurredAt)) return reply.code(409).send({ error: '今天已有成长记录，可直接编辑那条' })
    }
    db.prepare(`INSERT INTO records (id, child_id, type, occurred_at, ended_at, payload, note, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, b.childId, b.type, occurredAt, b.endedAt ? new Date(b.endedAt).toISOString() : null,
           JSON.stringify(b.payload || {}), b.note || null, req.user.uid, ts, ts)

    if (Array.isArray(b.attachmentIds) && b.attachmentIds.length) {
      syncAttachments(id, b.childId, b.attachmentIds)
    }
    return { record: getRecord(id) }
  })

  // 详情
  app.get('/api/records/:id', async (req, reply) => {
    const rec = getRecord(req.params.id)
    if (!rec) return reply.code(404).send({ error: '未找到' })
    if (!assertChild(req.user.fid, rec.childId)) return reply.code(403).send({ error: '无权访问' })
    return { record: rec }
  })

  // 编辑
  app.patch('/api/records/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM records WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
    if (!row) return reply.code(404).send({ error: '未找到' })
    if (!assertChild(req.user.fid, row.child_id)) return reply.code(403).send({ error: '无权访问' })
    const b = req.body || {}
    if (row.type === 'growth') {
      const occurred = b.occurredAt || row.occurred_at
      const payload = b.payload !== undefined ? b.payload : JSON.parse(row.payload || '{}')
      if (growthEmpty(payload)) return reply.code(400).send({ error: '请至少填写身高、体重、头围中的一项' })
      if (growthConflict(row.child_id, occurred, row.id)) return reply.code(409).send({ error: '该日期已有成长记录' })
    }
    const sets = [], vals = []
    if (b.occurredAt !== undefined) { sets.push('occurred_at = ?'); vals.push(new Date(b.occurredAt).toISOString()) }
    if (b.endedAt !== undefined) { sets.push('ended_at = ?'); vals.push(b.endedAt ? new Date(b.endedAt).toISOString() : null) }
    if (b.payload !== undefined) { sets.push('payload = ?'); vals.push(JSON.stringify(b.payload)) }
    if (b.note !== undefined) { sets.push('note = ?'); vals.push(b.note) }
    sets.push('updated_at = ?'); vals.push(now())
    vals.push(req.params.id)
    db.prepare(`UPDATE records SET ${sets.join(', ')} WHERE id = ?`).run(...vals)

    if (Array.isArray(b.attachmentIds)) {
      syncAttachments(req.params.id, row.child_id, b.attachmentIds)
    }
    return { record: getRecord(req.params.id) }
  })

  // 删除（软删除，附件一并清理）
  app.delete('/api/records/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM records WHERE id = ? AND deleted_at IS NULL').get(req.params.id)
    if (!row) return reply.code(404).send({ error: '未找到' })
    if (!assertChild(req.user.fid, row.child_id)) return reply.code(403).send({ error: '无权访问' })
    db.prepare('UPDATE records SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now(), now(), req.params.id)
    const atts = db.prepare('SELECT * FROM attachments WHERE record_id = ?').all(req.params.id)
    for (const a of atts) {
      db.prepare('DELETE FROM attachments WHERE id = ?').run(a.id)
      removeAttachmentFiles(a.child_id, a.id).catch(() => {})
    }
    return { ok: true }
  })
}
