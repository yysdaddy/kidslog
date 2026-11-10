import { useState } from 'react'
import { api, type User } from '../api'
import { KeyRound, LogOut, ShieldAlert } from 'lucide-react'

type Props = {
  user: User
  onDone: (u: User) => void
  onLogout: () => void
}

export default function ForcePassword({ user, onDone, onLogout }: Props) {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPw.length < 6) return setError('新密码至少 6 位')
    if (newPw !== confirmPw) return setError('两次输入的新密码不一致')
    if (newPw === oldPw) return setError('新密码不能与临时密码相同')
    setBusy(true)
    try {
      const r = await api.changePassword(oldPw, newPw)
      onDone(r.user)
    } catch (err: any) {
      setError(err?.message || '修改失败')
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'w-full px-4 py-3.5 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300'

  return (
    <div className="min-h-full flex flex-col justify-center px-6 py-10 bg-gradient-to-b from-brand-50 via-white to-mint-50">
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center mb-3">
          <ShieldAlert className="w-8 h-8 text-white" strokeWidth={1.8} />
        </div>
        <h1 className="text-lg font-semibold text-brand-800">请先设置新密码</h1>
        <p className="text-xs text-slate-400 mt-2 text-center leading-relaxed">
          你的密码已被管理员重置，需要修改后才能继续使用
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} type="password" placeholder="当前临时密码" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        <input className={inputCls} type="password" placeholder="新密码（至少 6 位）" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <input className={inputCls} type="password" placeholder="再次输入新密码" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        {error && <p className="text-sm text-rose-500 px-1">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-3.5 rounded-xl bg-brand-500 text-white text-base font-medium shadow-lift disabled:opacity-60 flex items-center justify-center gap-2">
          <KeyRound className="w-4 h-4" /> {busy ? '提交中…' : '设置新密码'}
        </button>
        <button type="button" onClick={onLogout} className="w-full py-3 text-slate-400 text-sm flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> 退出登录
        </button>
      </form>
    </div>
  )
}
