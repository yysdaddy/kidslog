import { useEffect, useState } from 'react'
import { api, type User } from '../api'
import { Baby, ShieldCheck } from 'lucide-react'

type Mode = 'login' | 'register' | 'join'

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    api.setup().then((r) => {
      setNeedsSetup(r.needsSetup)
      if (r.needsSetup) setMode('register')
    }).catch(() => {})
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      let r: { user: User }
      if (mode === 'login') r = await api.login(username.trim(), password)
      else if (mode === 'register') r = await api.register({
        username: username.trim(), password, displayName: displayName.trim() || undefined,
        familyName: familyName.trim() || undefined,
      })
      else r = await api.join({
        username: username.trim(), password, displayName: displayName.trim() || undefined,
        inviteCode: inviteCode.trim().toUpperCase(),
      })
      onLogin(r.user)
    } catch (err: any) {
      setError(err.message || '操作失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col justify-center px-6 py-10 bg-gradient-to-b from-brand-50 via-white to-mint-50">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lift mb-3">
          <Baby className="w-9 h-9 text-white" strokeWidth={1.8} />
        </div>
        <h1 className="text-xl font-semibold text-brand-800 tracking-wide">成长记录</h1>
        <p className="text-sm text-slate-400 mt-1">每天的小事，都是长大的证据</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="flex bg-white rounded-xl p-1 shadow-soft">
          {([
            ['login', '登录'],
            ['register', '创建家庭'],
            ['join', '加入家庭'],
          ] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError('') }}
              className={`flex-1 py-2 text-sm rounded-lg transition ${
                mode === m ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          className="w-full px-4 py-3.5 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <input
          className="w-full px-4 py-3.5 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300"
          placeholder="密码（至少 6 位）"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode !== 'login' && (
          <input
            className="w-full px-4 py-3.5 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="你的称呼，如：妈妈"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        {mode === 'register' && needsSetup && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-brand-50 text-[11px] text-brand-700 leading-relaxed">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>系统还没有管理员，现在注册的账号将成为管理员，可管理所有账号与家庭。</span>
          </div>
        )}

        {mode === 'register' && (
          <input
            className="w-full px-4 py-3.5 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300"
            placeholder="家庭名称，如：小满的家"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        )}
        {mode === 'join' && (
          <input
            className="w-full px-4 py-3.5 rounded-xl bg-white shadow-soft text-base outline-none focus:ring-2 focus:ring-brand-300 uppercase tracking-widest"
            placeholder="8 位邀请码"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            maxLength={8}
          />
        )}

        {error && <p className="text-sm text-rose-500 px-1">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3.5 rounded-xl bg-brand-500 text-white text-base font-medium shadow-lift active:scale-[0.99] transition disabled:opacity-60"
        >
          {busy ? '请稍候…' : mode === 'login' ? '登录' : mode === 'register' ? '创建并进入' : '加入'}
        </button>
      </form>

      <p className="text-xs text-slate-400 text-center mt-8 leading-relaxed">
        数据保存在你自己的服务器上<br />不与任何第三方共享
      </p>
    </div>
  )
}
