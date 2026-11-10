import { db, now, uid } from '../db.js'
import { hashPassword, makeInviteCode } from '../auth.js'

function requireAdmin(req, reply) {
  if (!req.user?.isAdmin) {
    reply.code(403).send({ error: '需要管理员权限' })
    return false
  }
  return true
}

function writeLog(req, action, targetType, targetId, targetName, detail) {
  db.prepare(`INSERT INTO admin_logs (id, actor_id, actor_name, action, target_type, target_id, target_name, detail, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(uid('log_'), req.user.uid, req.user.displayName || req.user.username, action,
      targetType, targetId, targetName || null, detail ? JSON.stringify(detail) : null, now())
}

function activeAdminCount(excludeId = '') {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND status = 'active' AND id <> ?")
    .get(excludeId)?.n || 0
}

function newInviteCode() {
  let code = makeInviteCode()
  while (db.prepare('SELECT id FROM families WHERE invite_code = ?').get(code)) code = makeInviteCode()
  return code
}

// 把用户迁入目标家庭并维护 owner 归属：原家庭若失去 owner，则提拔最早加入的其他成员
function moveUserToFamily(target, newFamilyId) {
  if (target.family_id === newFamilyId) return null
  const fam = db.prepare('SELECT id, name FROM families WHERE id = ?').get(newFamilyId)
  if (!fam) return { error: '目标家庭不存在' }

  if (target.role === 'owner') {
    const others = db.prepare('SELECT id FROM users WHERE family_id = ? AND id <> ? ORDER BY created_at ASC')
      .all(target.family_id, target.id)
    if (others.length) db.prepare("UPDATE users SET role = 'owner' WHERE id = ?").run(others[0].id)
  }
  const hasOwner = db.prepare("SELECT id FROM users WHERE family_id = ? AND role = 'owner' AND id <> ?")
    .get(newFamilyId, target.id)
  const role = hasOwner ? 'member' : 'owner'
  db.prepare('UPDATE users SET family_id = ?, role = ?, token_version = token_version + 1 WHERE id = ?')
    .run(newFamilyId, role, target.id)
  return { familyName: fam.name, role }
}

export default async function adminRoutes(app) {
  // 账号列表
  app.get('/api/admin/users', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const q = String(req.query?.q || '').trim()
    const familyId = String(req.query?.familyId || '').trim()
    let sql = `SELECT u.id, u.username, u.display_name AS displayName, u.family_id AS familyId,
                      u.role, u.is_admin AS isAdmin, u.status, u.must_change_pw AS mustChangePw,
                      u.created_at AS createdAt, f.name AS familyName, f.invite_code AS inviteCode,
                      (SELECT COUNT(*) FROM children c WHERE c.family_id = u.family_id AND c.archived = 0) AS familyChildCount,
                      (SELECT COUNT(*) FROM records r JOIN children c ON c.id = r.child_id
                        WHERE c.family_id = u.family_id AND r.deleted_at IS NULL) AS familyRecordCount,
                      (SELECT COUNT(*) FROM records r WHERE r.created_by = u.id AND r.deleted_at IS NULL) AS ownRecordCount
               FROM users u LEFT JOIN families f ON f.id = u.family_id WHERE 1 = 1`
    const args = []
    if (q) {
      sql += ' AND (u.username LIKE ? OR u.display_name LIKE ? OR f.name LIKE ?)'
      args.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }
    if (familyId) {
      sql += ' AND u.family_id = ?'
      args.push(familyId)
    }
    sql += ' ORDER BY u.is_admin DESC, u.created_at ASC'
    const rows = db.prepare(sql).all(...args)
    return {
      users: rows.map((r) => ({
        ...r,
        isAdmin: !!r.isAdmin,
        mustChangePw: !!r.mustChangePw,
        isMe: r.id === req.user.uid,
      })),
    }
  })

  // 修改账号：昵称 / 家庭 / 状态 / 管理员标记
  app.patch('/api/admin/users/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
    if (!target) return reply.code(404).send({ error: '账号不存在' })
    const body = req.body || {}
    const isSelf = target.id === req.user.uid

    if ((body.status !== undefined || body.isAdmin !== undefined) && isSelf) {
      return reply.code(400).send({ error: '不能修改自己的状态或管理员权限' })
    }
    if (body.familyId !== undefined && body.familyId !== target.family_id && isSelf) {
      return reply.code(400).send({ error: '不能调整自己所在的家庭' })
    }
    if (body.status !== undefined && !['active', 'disabled'].includes(body.status)) {
      return reply.code(400).send({ error: '状态值无效' })
    }
    // 保护：不能停用/降级最后一个可用管理员
    const willDisable = body.status === 'disabled' && target.is_admin === 1
    const willDemote = body.isAdmin !== undefined && !body.isAdmin && target.is_admin === 1
    if ((willDisable || willDemote) && activeAdminCount(target.id) === 0) {
      return reply.code(400).send({ error: '系统至少需要保留一个启用中的管理员' })
    }

    const changed = []
    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim()
      if (name.length < 1 || name.length > 20) return reply.code(400).send({ error: '昵称需要 1-20 个字符' })
      db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name, target.id)
      changed.push('displayName')
    }
    if (body.status !== undefined && body.status !== target.status) {
      db.prepare('UPDATE users SET status = ?, token_version = token_version + 1 WHERE id = ?')
        .run(body.status, target.id)
      changed.push(body.status === 'disabled' ? '禁用' : '启用')
    }
    if (body.isAdmin !== undefined && !!body.isAdmin !== !!target.is_admin) {
      db.prepare('UPDATE users SET is_admin = ?, token_version = token_version + 1 WHERE id = ?')
        .run(body.isAdmin ? 1 : 0, target.id)
      changed.push(body.isAdmin ? '设为管理员' : '取消管理员')
    }
    if (body.familyId !== undefined && body.familyId !== target.family_id) {
      const moved = moveUserToFamily(target, body.familyId)
      if (moved?.error) return reply.code(400).send({ error: moved.error })
      changed.push(`移入家庭「${moved.familyName}」`)
    }

    if (changed.length) {
      const fresh = db.prepare('SELECT display_name FROM users WHERE id = ?').get(target.id)
      writeLog(req, 'user.update', 'user', target.id, fresh?.display_name, { changes: changed })
    }
    return { ok: true, user: { id: target.id, changes: changed } }
  })

  // 重置密码：管理员设定新密码，旧会话立即失效，并强制下次登录修改
  app.post('/api/admin/users/:id/password', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
    if (!target) return reply.code(404).send({ error: '账号不存在' })
    if (target.id === req.user.uid) return reply.code(400).send({ error: '请使用「修改密码」修改自己的密码' })
    const { newPassword, forceChange = true } = req.body || {}
    if (!newPassword || String(newPassword).length < 6) return reply.code(400).send({ error: '新密码至少 6 位' })
    if (String(newPassword).length > 64) return reply.code(400).send({ error: '新密码过长' })
    db.prepare(`UPDATE users SET password_hash = ?, must_change_pw = ?, token_version = token_version + 1
                WHERE id = ?`).run(hashPassword(String(newPassword)), forceChange ? 1 : 0, target.id)
    writeLog(req, 'user.reset_password', 'user', target.id, target.display_name, { forceChange: !!forceChange })
    return { ok: true }
  })

  // 家庭列表
  app.get('/api/admin/families', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const rows = db.prepare(`SELECT f.id, f.name, f.invite_code AS inviteCode, f.created_at AS createdAt,
                                    (SELECT COUNT(*) FROM users u WHERE u.family_id = f.id) AS memberCount,
                                    (SELECT COUNT(*) FROM children c WHERE c.family_id = f.id AND c.archived = 0) AS childCount,
                                    (SELECT COUNT(*) FROM records r JOIN children c ON c.id = r.child_id
                                      WHERE c.family_id = f.id AND r.deleted_at IS NULL) AS recordCount,
                                    (SELECT u.display_name FROM users u
                                      WHERE u.family_id = f.id AND u.role = 'owner' ORDER BY u.created_at ASC LIMIT 1) AS ownerName
                             FROM families f ORDER BY f.created_at ASC`).all()
    return { families: rows }
  })

  // 新建空家庭
  app.post('/api/admin/families', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const name = String(req.body?.name ?? '').trim()
    if (name.length < 1 || name.length > 20) return reply.code(400).send({ error: '家庭名称需要 1-20 个字符' })
    const id = uid('fam_')
    db.prepare('INSERT INTO families (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)')
      .run(id, name, newInviteCode(), now())
    writeLog(req, 'family.create', 'family', id, name)
    return { ok: true, family: { id, name } }
  })

  // 家庭改名
  app.patch('/api/admin/families/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const fam = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id)
    if (!fam) return reply.code(404).send({ error: '家庭不存在' })
    const name = String(req.body?.name ?? '').trim()
    if (name.length < 1 || name.length > 20) return reply.code(400).send({ error: '家庭名称需要 1-20 个字符' })
    if (name === fam.name) return { ok: true, family: { id: fam.id, name } }
    db.prepare('UPDATE families SET name = ? WHERE id = ?').run(name, fam.id)
    writeLog(req, 'family.rename', 'family', fam.id, name, { before: fam.name, after: name })
    return { ok: true, family: { id: fam.id, name } }
  })

  // 解散空家庭（有成员或有孩子则拒绝）
  app.delete('/api/admin/families/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const fam = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id)
    if (!fam) return reply.code(404).send({ error: '家庭不存在' })
    const members = db.prepare('SELECT COUNT(*) AS n FROM users WHERE family_id = ?').get(fam.id)?.n || 0
    const kids = db.prepare('SELECT COUNT(*) AS n FROM children WHERE family_id = ?').get(fam.id)?.n || 0
    if (members > 0 || kids > 0) return reply.code(400).send({ error: '家庭内还有成员或孩子，不能解散' })
    db.prepare('DELETE FROM families WHERE id = ?').run(fam.id)
    writeLog(req, 'family.delete', 'family', fam.id, fam.name)
    return { ok: true }
  })

  // 管理操作日志
  app.get('/api/admin/logs', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 50)))
    const rows = db.prepare(`SELECT id, actor_name AS actorName, action, target_type AS targetType,
                                    target_id AS targetId, target_name AS targetName, detail, created_at AS createdAt
                             FROM admin_logs ORDER BY created_at DESC LIMIT ?`).all(limit)
    return { logs: rows }
  })
}
