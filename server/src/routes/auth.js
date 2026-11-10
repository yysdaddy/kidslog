import { db, now, uid } from '../db.js'
import { hashPassword, verifyPassword, signToken, verifyToken, makeInviteCode, COOKIE_NAME, cookieOptions } from '../auth.js'

export function fullUser(userId) {
  const u = db.prepare(`SELECT u.id, u.username, u.display_name AS displayName, u.family_id AS familyId,
                               u.role, u.is_admin AS isAdmin, u.status, u.must_change_pw AS mustChangePw,
                               u.created_at AS createdAt, f.name AS familyName, f.invite_code AS inviteCode
                        FROM users u LEFT JOIN families f ON f.id = u.family_id
                        WHERE u.id = ?`).get(userId)
  if (!u) return null
  return { ...u, isAdmin: !!u.isAdmin, mustChangePw: !!u.mustChangePw }
}

function issueToken(reply, user) {
  reply.setCookie(
    COOKIE_NAME,
    signToken({ uid: user.id, fid: user.family_id, tv: user.token_version || 0 }),
    cookieOptions,
  )
}

export default async function authRoutes(app) {
  // 初始化状态：系统内还没有管理员时，下一个注册者将成为管理员
  app.get('/api/auth/setup', async () => {
    const adminCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get()?.n || 0
    const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get()?.n || 0
    return { needsSetup: adminCount === 0, userCount }
  })

  // 注册：创建家庭 + owner 账号；系统内尚无管理员时，第一个注册者成为管理员
  app.post('/api/auth/register', async (req, reply) => {
    const { username, password, displayName, familyName } = req.body || {}
    if (!username || !password) return reply.code(400).send({ error: '用户名和密码必填' })
    if (String(password).length < 6) return reply.code(400).send({ error: '密码至少 6 位' })
    if (String(username).length < 2) return reply.code(400).send({ error: '用户名至少 2 位' })

    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (exists) return reply.code(409).send({ error: '用户名已存在' })

    const adminCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get()?.n || 0
    const isFirstAdmin = adminCount === 0
    // 公网部署可设 ALLOW_REGISTRATION=false 关闭自助建家（首个管理员不受影响，其余需邀请码加入）
    if (!isFirstAdmin && process.env.ALLOW_REGISTRATION === 'false') {
      return reply.code(403).send({ error: '本实例已关闭自助注册，请使用邀请码加入家庭' })
    }

    const familyId = uid('fam_')
    const userId = uid('usr_')
    const ts = now()
    db.prepare('INSERT INTO families (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)')
      .run(familyId, familyName || `${displayName || username}的家`, makeInviteCode(), ts)
    db.prepare(`INSERT INTO users (id, family_id, username, password_hash, display_name, role, is_admin, created_at)
                VALUES (?, ?, ?, ?, ?, 'owner', ?, ?)`)
      .run(userId, familyId, username, hashPassword(password), displayName || username, isFirstAdmin ? 1 : 0, ts)

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    issueToken(reply, created)
    return { ok: true, user: fullUser(userId), isFirstAdmin }
  })

  // 加入家庭
  app.post('/api/auth/join', async (req, reply) => {
    const { username, password, displayName, inviteCode } = req.body || {}
    if (!username || !password || !inviteCode) return reply.code(400).send({ error: '信息不完整' })
    const fam = db.prepare('SELECT * FROM families WHERE invite_code = ?').get(String(inviteCode).toUpperCase())
    if (!fam) return reply.code(404).send({ error: '邀请码无效' })
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      return reply.code(409).send({ error: '用户名已存在' })
    }
    const userId = uid('usr_')
    db.prepare(`INSERT INTO users (id, family_id, username, password_hash, display_name, role, created_at)
                VALUES (?, ?, ?, ?, ?, 'member', ?)`)
      .run(userId, fam.id, username, hashPassword(password), displayName || username, now())
    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    issueToken(reply, created)
    return { ok: true, user: fullUser(userId) }
  })

  // 登录
  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = req.body || {}
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ error: '用户名或密码错误' })
    }
    if ((user.status || 'active') !== 'active') {
      return reply.code(403).send({ error: '账号已被停用，请联系管理员' })
    }
    issueToken(reply, user)
    return { ok: true, user: fullUser(user.id) }
  })

  app.post('/api/auth/logout', async (req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' })
    return { ok: true }
  })

  app.get('/api/me', async (req, reply) => {
    const p = verifyToken(req.cookies?.[COOKIE_NAME])
    if (!p) return reply.code(401).send({ error: '未登录' })
    const user = fullUser(p.uid)
    if (!user) return reply.code(401).send({ error: '未登录' })
    return { user }
  })
}
