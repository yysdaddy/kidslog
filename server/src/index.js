import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { verifyToken, readToken } from './auth.js'
import { db } from './db.js'
import authRoutes from './routes/auth.js'
import childrenRoutes from './routes/children.js'
import recordRoutes from './routes/records.js'
import mediaRoutes from './routes/media.js'
import statsRoutes from './routes/stats.js'
import healthRoutes from './routes/health.js'
import accountRoutes from './routes/account.js'
import adminRoutes from './routes/admin.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.join(__dirname, '..', 'public')

// trustProxy：部署在 Nginx / Caddy / Cloudflare Tunnel 之后时，req.ip 才能取到真实客户端地址，
// 登录限流才不会退化成「全站共用一个 IP 桶」。
//   - 默认信任 X-Forwarded-For（反代场景，反代会覆写该头）；
//   - 若服务直接暴露在公网、前面没有反代，请设 TRUST_PROXY=false，
//     否则客户端可伪造 X-Forwarded-For 为每个请求换「IP」绕过限流。
const trustProxy = process.env.TRUST_PROXY === 'false' ? false : true
const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  bodyLimit: 1024 * 1024,
  trustProxy,
})

// 安卓 App 以 https://localhost 加载本地前端包，与 API 不同源，需要允许携带凭据的跨域请求
await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})
await app.register(cookie)
await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024, files: 1 } })

const OPEN_PATHS = new Set(['/api/health', '/api/auth/setup', '/api/auth/login', '/api/auth/register', '/api/auth/join'])
// 被管理员重置密码后，只允许这些接口，其余全部拦截，强制先改密
const PW_CHANGE_ALLOWED = new Set(['/api/me', '/api/me/account', '/api/me/password', '/api/auth/logout'])
const userStmt = db.prepare(`SELECT id, family_id, display_name, username, role, is_admin, status,
                                    must_change_pw, token_version
                             FROM users WHERE id = ?`)

// 鉴权：挂载 req.user（每次请求校验账号状态与令牌版本，停用/改密立即失效）
app.decorateRequest('user', null)
app.addHook('preHandler', async (req, reply) => {
  if (!req.url.startsWith('/api/')) return
  const pathname = req.url.split('?')[0]
  if (OPEN_PATHS.has(pathname)) return
  const payload = verifyToken(readToken(req))
  if (!payload) return reply.code(401).send({ error: '未登录' })
  const u = userStmt.get(payload.uid)
  if (!u || (u.status || 'active') !== 'active') {
    return reply.code(401).send({ error: '登录状态已失效，请重新登录' })
  }
  if ((u.token_version || 0) !== (payload.tv || 0)) {
    return reply.code(401).send({ error: '登录状态已失效，请重新登录' })
  }
  if (u.must_change_pw && !PW_CHANGE_ALLOWED.has(pathname)) {
    return reply.code(403).send({ error: '请先修改密码', code: 'must_change_pw' })
  }
  req.user = {
    uid: u.id,
    fid: u.family_id,
    isAdmin: !!u.is_admin,
    mustChangePw: !!u.must_change_pw,
    displayName: u.display_name,
    username: u.username,
  }
})

app.get('/api/health', async () => ({ ok: true, ts: Date.now() }))

await app.register(authRoutes)
await app.register(childrenRoutes)
await app.register(recordRoutes)
await app.register(mediaRoutes)
await app.register(statsRoutes)
await app.register(healthRoutes)
await app.register(accountRoutes)
await app.register(adminRoutes)

// 前端静态资源 + SPA 回退
if (fs.existsSync(PUBLIC_DIR)) {
  await app.register(fastifyStatic, { root: PUBLIC_DIR, prefix: '/' })
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' })
    return reply.sendFile('index.html')
  })
}

const port = Number(process.env.PORT || 8080)
app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info(`成长记录 已启动 http://0.0.0.0:${port}`)
})
