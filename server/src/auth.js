import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// 安全要求：不内置硬编码默认密钥（否则任何人都能伪造登录态）。
// 密钥来源优先级：
//   1) 环境变量 JWT_SECRET（显式提供，长度需 ≥ 32）
//   2) DATA_DIR/.jwt_secret —— 首次启动时自动生成随机密钥并持久化到数据卷，
//      重启后复用同一密钥。适用于「不想配置 .env」的一键部署场景。
function resolveSecret() {
  const fromEnv = process.env.JWT_SECRET
  if (fromEnv && fromEnv.trim()) {
    const s = fromEnv.trim()
    if (s.length < 32) {
      console.error(
        '[fatal] 环境变量 JWT_SECRET 长度不足 32 位。\n' +
          '  生成方式：openssl rand -hex 32\n' +
          '  或留空，由服务在数据目录自动生成（docker-compose.noenv.yml）。',
      )
      process.exit(1)
    }
    return s
  }

  const dataDir = process.env.DATA_DIR || '/data'
  const keyFile = path.join(dataDir, '.jwt_secret')
  try {
    if (fs.existsSync(keyFile)) {
      const saved = fs.readFileSync(keyFile, 'utf8').trim()
      if (saved.length >= 32) return saved
    }
    fs.mkdirSync(dataDir, { recursive: true })
    const generated = crypto.randomBytes(32).toString('hex')
    fs.writeFileSync(keyFile, `${generated}\n`, { mode: 0o600 })
    console.warn(
      `[warn] 未设置 JWT_SECRET，已自动生成随机密钥并保存到 ${keyFile}（重启沿用，删除该文件会导致所有人登录态失效）。`,
    )
    return generated
  } catch (err) {
    console.error(
      '[fatal] 未设置 JWT_SECRET，且无法在数据目录自动生成密钥：' +
        `${err?.message || err}\n` +
        '  请显式设置环境变量 JWT_SECRET（openssl rand -hex 32），或确认数据目录可写。',
    )
    process.exit(1)
  }
}

const SECRET = resolveSecret()
const TTL_DAYS = 7

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = crypto.scryptSync(pw, salt, 64).toString('hex')
  return `scrypt$${salt}$${key}`
}

export function verifyPassword(pw, stored) {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, key] = parts
  const calc = crypto.scryptSync(pw, salt, 64)
  const expected = Buffer.from(key, 'hex')
  if (calc.length !== expected.length) return false
  return crypto.timingSafeEqual(calc, expected)
}

export function signToken(payload, days = TTL_DAYS) {
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + days * 24 * 3600 * 1000,
  })).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export const COOKIE_NAME = 'kidslog_token'
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: TTL_DAYS * 24 * 3600,
}

export function makeInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i++) out += chars[crypto.getRandomValues(new Uint8Array(1))[0] % chars.length]
  return out
}
