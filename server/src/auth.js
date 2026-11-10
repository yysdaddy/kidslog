import crypto from 'node:crypto'

// 安全要求：JWT_SECRET 必须显式提供，禁止内置默认值（否则任何人都能伪造登录态）
const SECRET = process.env.JWT_SECRET
if (!SECRET || SECRET.length < 32) {
  console.error(
    '[fatal] 环境变量 JWT_SECRET 未设置或长度不足 32 位。\n' +
      '  生成方式：openssl rand -hex 32\n' +
      '  然后写入项目根目录的 .env 文件（或容器环境变量）后重启。',
  )
  process.exit(1)
}
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
