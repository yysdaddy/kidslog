// 运行时服务器地址管理
// 浏览器（同源部署）时 base 为空，请求走相对路径；App 内由原生配置页写入绝对地址。
const LS_KEY = 'kidslog.server.base'

let base = ''

export function normalizeServer(u: string): string {
  let s = (u || '').trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s
  return s.replace(/\/+$/, '')
}

export function setServerBase(u: string) {
  base = normalizeServer(u)
  try {
    if (base) localStorage.setItem(LS_KEY, base)
    else localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}

export function getServerBase(): string {
  return base
}

export function loadServerBaseFromStorage(): string {
  try {
    const s = localStorage.getItem(LS_KEY) || ''
    base = normalizeServer(s)
  } catch {
    base = ''
  }
  return base
}

/** 把接口路径转成绝对地址（已带协议或是 data/blob 的直接返回） */
export function apiUrl(path: string): string {
  if (!path) return path
  if (/^[a-z]+:\/\//i.test(path) || /^(data|blob|file):/i.test(path)) return path
  if (!base) return path
  return base + (path.startsWith('/') ? path : '/' + path)
}

/** 媒体资源地址（后端返回的多为 /api/media/... 相对路径） */
export function mediaSrc(path?: string | null): string {
  if (!path) return ''
  return apiUrl(path)
}
