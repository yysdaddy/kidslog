/**
 * 安卓返回键处理栈
 *
 * 弹层 / 全屏子页面打开时压入一个处理函数，硬件返回键（或手势返回）
 * 优先交给最上层：先关弹层，弹层全部关闭后由原生侧决定后退或退出 App。
 *
 * 与原生配合：MainActivity.onBackPressed 会调用 window.__kidslogHandleBack()，
 * 返回 true 表示前端已消费（关掉了某个弹层），此时不退出 App。
 */
type Handler = () => void

const stack: Handler[] = []

export function pushBackHandler(h: Handler): () => void {
  stack.push(h)
  return () => {
    const i = stack.lastIndexOf(h)
    if (i >= 0) stack.splice(i, 1)
  }
}

/** 返回 true 表示已被前端消费 */
export function handleBack(): boolean {
  const h = stack[stack.length - 1]
  if (!h) return false
  stack.pop()
  try {
    h()
  } catch {
    // 处理函数异常不应导致返回键失效
  }
  return true
}

export function backStackDepth(): number {
  return stack.length
}

declare global {
  interface Window {
    __kidslogHandleBack?: () => boolean
  }
}

/** 暴露给原生 MainActivity（幂等，可重复调用） */
export function installBackHandlerBridge() {
  window.__kidslogHandleBack = handleBack
}
