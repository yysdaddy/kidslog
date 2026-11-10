import { useEffect } from 'react'

let lockCount = 0
let savedY = 0
let saved: { body: Record<string, string>; htmlOverflow: string } | null = null

/**
 * 弹层打开期间锁住页面滚动，避免背景随手指滑动（移动端滚动穿透）。
 * 采用 body position:fixed + top 补偿，iOS / 微信 WebView 均有效。
 * 支持多层弹层叠加：仅最外层加锁，最后一个卸载时恢复原滚动位置。
 */
export function useScrollLock() {
  useEffect(() => {
    lockCount += 1
    if (lockCount === 1) {
      const b = document.body
      savedY = window.scrollY || document.documentElement.scrollTop || 0
      saved = {
        body: {
          position: b.style.position,
          top: b.style.top,
          left: b.style.left,
          right: b.style.right,
          width: b.style.width,
          overflow: b.style.overflow,
        },
        htmlOverflow: document.documentElement.style.overflow,
      }
      b.style.position = 'fixed'
      b.style.top = `-${savedY}px`
      b.style.left = '0'
      b.style.right = '0'
      b.style.width = '100%'
      b.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0 && saved) {
        const b = document.body
        b.style.position = saved.body.position || ''
        b.style.top = saved.body.top || ''
        b.style.left = saved.body.left || ''
        b.style.right = saved.body.right || ''
        b.style.width = saved.body.width || ''
        b.style.overflow = saved.body.overflow || ''
        document.documentElement.style.overflow = saved.htmlOverflow || ''
        const y = savedY
        saved = null
        window.scrollTo(0, y)
      }
    }
  }, [])
}
