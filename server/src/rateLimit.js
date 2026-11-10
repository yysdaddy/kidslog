// 轻量内存限流：按「客户端 IP + 桶名」统计滑动窗口内的请求次数，超限返回 429。
// 设计取舍：
//   - 单实例 + 单进程部署（本项目定位），进程内 Map 足够；多实例需换 Redis 等共享存储。
//   - 只保护 /api/auth/* 这类可被在线爆破的入口，避免影响正常高频读取。
//   - 反代部署时需 Fastify 开启 trustProxy，req.ip 才能取到真实客户端地址。
//   - 压测或特殊部署可设 RATE_LIMIT_DISABLED=1 关闭。

const buckets = new Map() // key -> number[]（窗口内的请求时间戳，升序）

// 周期性清理过期桶，避免长期运行后 Map 无限增长
const SWEEP_MS = 60_000
const sweeper = setInterval(() => {
  const deadline = Date.now() - 10 * 60_000
  for (const [key, hits] of buckets) {
    if (!hits.length || hits[hits.length - 1] < deadline) buckets.delete(key)
  }
}, SWEEP_MS)
if (typeof sweeper.unref === 'function') sweeper.unref()

function envInt(name, fallback) {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/**
 * 生成 Fastify preHandler。
 * @param {string} name 桶名（不同接口互不影响）
 * @param {number} max 窗口内允许的最大请求数
 * @param {number} windowMs 窗口长度（毫秒），默认 60s
 */
export function rateLimit(name, max, windowMs = 60_000) {
  return async function rateLimitHandler(req, reply) {
    if (process.env.RATE_LIMIT_DISABLED === '1') return
    if (max <= 0) return

    const key = `${name}:${req.ip || 'unknown'}`
    const ts = Date.now()
    const hits = (buckets.get(key) || []).filter((t) => ts - t < windowMs)

    if (hits.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (ts - hits[0])) / 1000))
      buckets.set(key, hits)
      return reply
        .code(429)
        .header('Retry-After', String(retryAfter))
        .send({ error: `操作过于频繁，请 ${retryAfter} 秒后重试` })
    }

    hits.push(ts)
    buckets.set(key, hits)
  }
}

// 各入口阈值（可用环境变量覆盖；0 表示关闭该桶）
export const limitLogin = rateLimit('login', envInt('RATE_LIMIT_LOGIN', 10), 60_000)
export const limitRegister = rateLimit('register', envInt('RATE_LIMIT_REGISTER', 5), 60_000)
export const limitJoin = rateLimit('join', envInt('RATE_LIMIT_JOIN', 10), 60_000)
