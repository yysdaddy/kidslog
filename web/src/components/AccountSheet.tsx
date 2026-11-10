import { useState } from 'react'
import { api, type User } from '../api'
import { X, KeyRound, UserCog } from 'lucide-react'
import { useScrollLock } from '../hooks/useScrollLock'

type Props = {
  mode: 'profile' | 'password'
  user: User
  onClose: () => void
  onUserChange: (u: User) => void
}

export default function AccountSheet({ mode, user, onClose, onUserChange }: Props) {
  useScrollLock()
  const [name, setName] = useState(user.displayName || '')
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const title = mode === 'profile' ? '个人资料' : '修改密码'

  async function save() {
    if (busy) return
    setError('')
    if (mode === 'profile') {
      const v = name.trim()
      if (!v) return setError('昵称不能为空')
      if (v.length > 20) return setError('昵称最多 20 个字符')
      setBusy(true)
      try {
        const r = await api.updateProfile(v)
        onUserChange(r.user)
        setDone('昵称已更新')
        setTimeout(onClose, 700)
      } catch (e: any) {
        setError(e?.message || '保存失败')
      } finally {
        setBusy(false)
      }
      return
    }

    if (!oldPw) return setError('请输入原密码')
    if (newPw.length < 6) return setError('新密码至少 6 位')
    if (newPw !== confirmPw) return setError('两次输入的新密码不一致')
    if (newPw === oldPw) return setError('新密码不能与原密码相同')
    setBusy(true)
    try {
      await api.changePassword(oldPw, newPw)
      setDone('密码已更新')
      setTimeout(onClose, 700)
    } catch (e: any) {
      setError(e?.message || '修改失败')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full px-3.5 py-3 rounded-xl bg-[#F7FAFC] text-sm text-brand-900 outline-none focus:ring-2 focus:ring-brand-200'

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 animate-fade-in overscroll-contain" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '88dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center px-4 pt-3 pb-2 shrink-0 sticky top-0 z-30 bg-white/95 backdrop-blur rounded-t-3xl">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-400 w-9 h-9 flex items-center justify-center" aria-label="关闭">
            <X className="w-5 h-5" />
          </button>
          <h2 className="flex-1 text-center text-base font-medium text-brand-900">{title}</h2>
          <div className="w-9" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-5 space-y-3">
          {mode === 'profile' ? (
            <>
              <div className="flex items-center gap-3 bg-[#F7FAFC] rounded-xl px-3.5 py-3">
                <UserCog className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
                <span className="text-xs text-slate-400">登录账号</span>
                <span className="ml-auto text-sm text-brand-800 font-mono">{user.username}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5 px-1">昵称</p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  placeholder="家人看到的名字"
                  className={inputCls}
                />
                <p className="text-[11px] text-slate-300 mt-1.5 px-1">会显示在记录创建人、家庭成员列表中</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-[#F7FAFC] rounded-xl px-3.5 py-3">
                <KeyRound className="w-3.5 h-3.5" strokeWidth={1.8} />
                修改后本机保持登录，其他设备需用新密码重新登录
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5 px-1">原密码</p>
                <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} className={inputCls} autoComplete="current-password" />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5 px-1">新密码</p>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputCls} autoComplete="new-password" />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1.5 px-1">确认新密码</p>
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputCls} autoComplete="new-password" />
              </div>
            </>
          )}

          {error && <p className="text-xs text-rose-500 px-1">{error}</p>}
          {done && <p className="text-xs text-mint-500 px-1">{done}</p>}

          <button
            onClick={save}
            disabled={busy}
            className="w-full py-3.5 rounded-xl bg-brand-500 text-white text-sm font-medium disabled:opacity-60 mt-1"
          >
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
