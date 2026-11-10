import { db, now, uid, rowToChild } from '../db.js'

export default async function childrenRoutes(app) {
  app.get('/api/children', async (req) => {
    const rows = db.prepare('SELECT * FROM children WHERE family_id = ? AND archived = 0 ORDER BY sort_order, created_at')
      .all(req.user.fid)
    return { children: rows.map(rowToChild) }
  })

  app.post('/api/children', async (req, reply) => {
    const { name, nickname, gender, birthDate, allergies, medicalHistory, note } = req.body || {}
    if (!name) return reply.code(400).send({ error: '姓名必填' })
    const id = uid('chi_')
    db.prepare(`INSERT INTO children (id, family_id, name, nickname, gender, birth_date, allergies, medical_history, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, req.user.fid, name, nickname || null, gender || null, birthDate || null,
           allergies || null, medicalHistory || null, note || null, now())
    const row = db.prepare('SELECT * FROM children WHERE id = ?').get(id)
    return { child: rowToChild(row) }
  })

  app.patch('/api/children/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM children WHERE id = ? AND family_id = ?').get(req.params.id, req.user.fid)
    if (!row) return reply.code(404).send({ error: '未找到' })
    const b = req.body || {}
    const map = { name: 'name', nickname: 'nickname', gender: 'gender', birthDate: 'birth_date',
                  allergies: 'allergies', medicalHistory: 'medical_history', note: 'note' }
    const sets = [], vals = []
    for (const [k, col] of Object.entries(map)) {
      if (b[k] !== undefined) { sets.push(`${col} = ?`); vals.push(b[k]) }
    }
    if (sets.length) {
      vals.push(req.params.id)
      db.prepare(`UPDATE children SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
    }
    return { child: rowToChild(db.prepare('SELECT * FROM children WHERE id = ?').get(req.params.id)) }
  })

  // 删除孩子（归档，记录与照片保留不物理删除）
  app.delete('/api/children/:id', async (req, reply) => {
    const row = db.prepare('SELECT * FROM children WHERE id = ? AND family_id = ? AND archived = 0')
      .get(req.params.id, req.user.fid)
    if (!row) return reply.code(404).send({ error: '未找到该孩子' })
    db.prepare('UPDATE children SET archived = 1 WHERE id = ?').run(row.id)
    return { ok: true, id: row.id }
  })
}
