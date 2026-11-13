import { db, now, uid } from '../db.js'
import { hashPassword, verifyPassword, makeInviteCode, signToken, COOKIE_NAME, cookieOptions } from '../auth.js'
import { fullUser } from './auth.js'

function currentUser(uidStr) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(uidStr)
}

export default async function accountRoutes(app) {
  // 账号信息（含注册时间、家庭内成员数）
  app.get('/api/me/account', async (req, reply) => {
    const u = currentUser(req.user.uid)
    if (!u) return reply.code(401).send({ error: '未登录' })
    const members = db.prepare('SELECT COUNT(*) AS n FROM users WHERE family_id = ?').get(u.family_id)?.n || 0
    return { user: { ...fullUser(u.id), memberCount: members } }
  })

  // 修改昵称
  app.patch('/api/me', async (req, reply) => {
    const name = String(req.body?.displayName ?? '').trim()
    if (name.length < 1 || name.length > 20) return reply.code(400).send({ error: '昵称需要 1-20 个字符' })
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(name, req.user.uid)
    return { ok: true, user: fullUser(req.user.uid) }
  })

  // 修改密码：校验原密码；改完后旧令牌全部失效，当前设备重新签发
  app.post('/api/me/password', async (req, reply) => {
    const { oldPassword, newPassword } = req.body || {}
    if (!oldPassword || !newPassword) return reply.code(400).send({ error: '请输入原密码和新密码' })
    if (String(newPassword).length < 6) return reply.code(400).send({ error: '新密码至少 6 位' })
    if (String(newPassword).length > 64) return reply.code(400).send({ error: '新密码过长' })
    if (String(newPassword) === String(oldPassword)) return reply.code(400).send({ error: '新密码不能与原密码相同' })

    const u = currentUser(req.user.uid)
    if (!u) return reply.code(401).send({ error: '未登录' })
    if (!(await verifyPassword(String(oldPassword), u.password_hash))) {
      return reply.code(400).send({ error: '原密码不正确' })
    }
    db.prepare(`UPDATE users SET password_hash = ?, must_change_pw = 0, token_version = token_version + 1
                WHERE id = ?`).run(await hashPassword(String(newPassword)), u.id)
    const fresh = currentUser(u.id)
    const token = signToken({ uid: fresh.id, fid: fresh.family_id, tv: fresh.token_version || 0 })
    reply.setCookie(COOKIE_NAME, token, cookieOptions)
    return { ok: true, user: fullUser(u.id), token }
  })

  // 家庭成员列表
  app.get('/api/family/members', async (req, reply) => {
    const me = currentUser(req.user.uid)
    if (!me) return reply.code(401).send({ error: '未登录' })
    const rows = db.prepare(`SELECT id, username, display_name AS displayName, role,
                                    is_admin AS isAdmin, status, created_at AS createdAt
                             FROM users WHERE family_id = ?
                             ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC`)
      .all(me.family_id)
    const stat = db.prepare(`SELECT created_by AS uid, COUNT(*) AS n FROM records
                             WHERE deleted_at IS NULL GROUP BY created_by`).all()
    const countMap = Object.fromEntries(stat.map((s) => [s.uid, s.n]))
    return {
      members: rows.map((r) => ({
        ...r,
        isAdmin: !!r.isAdmin,
        isMe: r.id === me.id,
        recordCount: countMap[r.id] || 0,
      })),
      canManage: me.role === 'owner' || !!me.is_admin,
    }
  })

  // 修改家庭名称（仅 owner）
  app.patch('/api/family', async (req, reply) => {
    const me = currentUser(req.user.uid)
    if (!me) return reply.code(401).send({ error: '未登录' })
    if (me.role !== 'owner') return reply.code(403).send({ error: '仅家庭创建者可修改' })
    const name = String(req.body?.name ?? '').trim()
    if (name.length < 1 || name.length > 20) return reply.code(400).send({ error: '家庭名称需要 1-20 个字符' })
    db.prepare('UPDATE families SET name = ? WHERE id = ?').run(name, me.family_id)
    return { ok: true, familyName: name }
  })

  // 重置邀请码（仅 owner），旧码立即失效
  app.post('/api/family/invite/rotate', async (req, reply) => {
    const me = currentUser(req.user.uid)
    if (!me) return reply.code(401).send({ error: '未登录' })
    if (me.role !== 'owner') return reply.code(403).send({ error: '仅家庭创建者可重置邀请码' })
    let code = makeInviteCode()
    while (db.prepare('SELECT id FROM families WHERE invite_code = ?').get(code)) code = makeInviteCode()
    db.prepare('UPDATE families SET invite_code = ? WHERE id = ?').run(code, me.family_id)
    return { ok: true, inviteCode: code }
  })

  // 移除成员（仅 owner）。成员会被迁入独立家庭，原家庭的历史记录保留
  app.delete('/api/family/members/:id', async (req, reply) => {
    const me = currentUser(req.user.uid)
    if (!me) return reply.code(401).send({ error: '未登录' })
    if (me.role !== 'owner') return reply.code(403).send({ error: '仅家庭创建者可移除成员' })
    const target = currentUser(req.params.id)
    if (!target || target.family_id !== me.family_id) return reply.code(404).send({ error: '成员不存在' })
    if (target.id === me.id) return reply.code(400).send({ error: '不能移除自己' })
    if (target.role === 'owner') return reply.code(400).send({ error: '不能移除家庭创建者' })

    const newFam = uid('fam_')
    db.prepare('INSERT INTO families (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)')
      .run(newFam, `${target.display_name}的家`, makeInviteCode(), now())
    db.prepare("UPDATE users SET family_id = ?, role = 'owner' WHERE id = ?").run(newFam, target.id)
    return { ok: true }
  })
}
