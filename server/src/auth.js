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

// scrypt 参数：N=16384 / r=8 / p=1 为 OWASP 推荐的交互式登录基线（约 16MB 内存开销）。
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEYLEN = 64
// 密码长度上限：超长输入直接拒绝，避免把任意长度字符串喂给 KDF
const MAX_PW_LEN = 1024

function scryptAsync(pw, salt) {
  return new Promise((resolve, reject) => {
    // 使用异步版本，避免阻塞事件循环（同步 scrypt 会让单线程服务在登录高峰期卡死）
    crypto.scrypt(String(pw), salt, KEYLEN, SCRYPT, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

export async function hashPassword(pw) {
  if (typeof pw !== 'string' || pw.length > MAX_PW_LEN) throw new Error('密码格式非法')
  const salt = crypto.randomBytes(16).toString('hex')
  const key = await scryptAsync(pw, salt)
  return `scrypt$${salt}$${key.toString('hex')}`
}

export async function verifyPassword(pw, stored) {
  if (typeof stored !== 'string' || typeof pw !== 'string' || pw.length > MAX_PW_LEN) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, key] = parts
  const expected = Buffer.from(key, 'hex')
  if (expected.length !== KEYLEN) return false
  let calc
  try {
    calc = await scryptAsync(pw, salt)
  } catch {
    return false
  }
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

// 邀请码：10 位 base32（去掉了易混字符 0/O/1/I），信息熵约 50 bit。
// 旧版为 8 位（40 bit），在线爆破成本偏低；校验处不做长度强约束，历史邀请码仍可继续使用。
export function makeInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 个字符，256 % 32 === 0 无取模偏差
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[crypto.randomInt(chars.length)]
  return out
}
