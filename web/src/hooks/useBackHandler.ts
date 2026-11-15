import { useEffect, useRef } from 'react'
import { pushBackHandler } from '../backStack'

/**
 * 让安卓返回键优先关闭当前弹层 / 子页面，而不是直接退出 App。
 *
 * @param onBack 返回键触发的回调（一般是关闭弹层）
 * @param active 是否参与拦截，默认 true；弹层常驻挂载但未展开时可传 false
 */
export function useBackHandler(onBack: () => void, active = true) {
  const ref = useRef(onBack)
  ref.current = onBack

  useEffect(() => {
    if (!active) return
    return pushBackHandler(() => ref.current())
  }, [active])
}
