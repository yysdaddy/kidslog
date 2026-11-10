import { useEffect, useState } from 'react'
import { api, type Child, type User } from '../api'
import { ageLabel } from '../utils'
import { UserPlus, LogOut, HardDrive, Copy, Check, ChevronRight, KeyRound, Users, UserCog, ShieldCheck, Pencil } from 'lucide-react'
import AccountSheet from '../components/AccountSheet'
import FamilySheet from '../components/FamilySheet'

type Props = {
  user: User
  children: Child[]
  activeId: string
  onSelectChild: (id: string) => void
  onAddChild: () => void
  onEditChild: (c: Child) => void
  onLogout: () => void
  onUserChange: (u: User) => void
  onOpenAdmin: () => void
}

function fmtSize(bytes: number) {
  if (!bytes) return '0 MB'
  const mb = bytes / 1024 / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

export default function Me({ user, children, activeId, onSelectChild, onAddChild, onEditChild, onLogout, onUserChange, onOpenAdmin }: Props) {
  const [storage, setStorage] = useState<{ usedBytes: number; quotaBytes: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [sheet, setSheet] = useState<'profile' | 'password' | 'family' | null>(null)

  useEffect(() => {
    api.storage().then(setStorage).catch(() => {})
    api.account().then((r) => onUserChange({ ...user, ...r.user })).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function copyCode() {
    if (!user.inviteCode) return
    try {
      await navigator.clipboard.writeText(user.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  const pct = storage ? Math.min(100, (storage.usedBytes / storage.quotaBytes) * 100) : 0

  const rowCls = 'w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 transition'

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <button onClick={() => setSheet('profile')} className="w-full text-left bg-white rounded-2xl shadow-soft p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-mint-300 flex items-center justify-center text-white text-lg font-medium shrink-0">
            {(user.displayName || '?').slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-brand-900 truncate">{user.displayName}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">@{user.username} · {user.familyName || '我的家庭'}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
        </div>
      </button>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <p className="text-xs text-slate-400 px-4 pt-3.5 pb-1">账户与安全</p>
        <button onClick={() => setSheet('profile')} className={rowCls}>
          <UserCog className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
          <span className="flex-1 text-left text-sm text-brand-900">个人资料</span>
          <span className="text-[11px] text-slate-400 mr-1 max-w-[40%] truncate">{user.displayName}</span>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
        <button onClick={() => setSheet('password')} className={`${rowCls} border-t border-slate-50`}>
          <KeyRound className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
          <span className="flex-1 text-left text-sm text-brand-900">修改密码</span>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
        <button onClick={() => setSheet('family')} className={`${rowCls} border-t border-slate-50`}>
          <Users className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
          <span className="flex-1 text-left text-sm text-brand-900">家庭成员</span>
          <span className="text-[11px] text-slate-400 mr-1">
            {user.memberCount ? `${user.memberCount} 人` : user.role === 'owner' ? '管理' : ''}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      {user.isAdmin && (
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <button onClick={onOpenAdmin} className={rowCls}>
            <ShieldCheck className="w-4 h-4 text-brand-500" strokeWidth={1.9} />
            <span className="flex-1 text-left text-sm text-brand-900">系统管理</span>
            <span className="text-[11px] text-slate-400 mr-1">全部账号与家庭</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400">家庭邀请码</p>
            <p className="text-base font-mono tracking-[0.18em] text-brand-800 mt-0.5">{user.inviteCode || '—'}</p>
          </div>
          <button onClick={copyCode} className="flex items-center gap-1 text-xs text-brand-500 px-3 py-2 rounded-lg bg-[#F7FAFC] shrink-0">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <p className="text-[11px] text-slate-300 mt-2">把邀请码发给家人，他们注册时填上就能一起记录</p>
        <button onClick={() => setSheet('family')} className="mt-3 w-full flex items-center justify-center gap-1 py-2.5 rounded-xl bg-[#F7FAFC] text-slate-500 text-xs">
          <Users className="w-3.5 h-3.5" strokeWidth={1.8} /> 家庭成员与邀请码管理
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <p className="text-xs text-slate-400 px-4 pt-3.5 pb-1">孩子</p>
        {children.map((c) => (
          <div key={c.id} className="w-full flex items-center gap-1 pr-2 active:bg-slate-50 transition">
            <button onClick={() => onSelectChild(c.id)} className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-sm">
                {(c.nickname || c.name).slice(0, 1)}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm text-brand-900 truncate">
                  {c.nickname || c.name}
                  {c.id === activeId && <span className="ml-2 text-[10px] text-mint-500">当前</span>}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {c.birthDate ? `生日 ${c.birthDate} · ${ageLabel(c.birthDate)}` : '未填出生日期'}
                </p>
              </div>
            </button>
            <button onClick={() => onEditChild(c)} aria-label="编辑孩子"
              className="p-2.5 rounded-xl text-slate-400 active:bg-slate-100">
              <Pencil className="w-4 h-4" strokeWidth={1.8} />
            </button>
          </div>
        ))}
        <button onClick={onAddChild} className="w-full flex items-center gap-3 px-4 py-3 text-brand-600 active:bg-slate-50 transition border-t border-slate-50">
          <UserPlus className="w-4 h-4" strokeWidth={1.8} />
          <span className="text-sm">添加孩子</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
          <span className="text-sm text-brand-800">存储占用</span>
          <span className="ml-auto text-[11px] text-slate-400">
            {storage ? `${fmtSize(storage.usedBytes)} / ${fmtSize(storage.quotaBytes)}` : '—'}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-brand-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <button onClick={onLogout} className="w-full py-3.5 bg-white rounded-2xl shadow-soft text-rose-500 text-sm flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> 退出登录
      </button>

      <p className="text-[11px] text-slate-300 text-center">成长记录</p>

      {sheet === 'profile' && (
        <AccountSheet mode="profile" user={user} onClose={() => setSheet(null)} onUserChange={onUserChange} />
      )}
      {sheet === 'password' && (
        <AccountSheet mode="password" user={user} onClose={() => setSheet(null)} onUserChange={onUserChange} />
      )}
      {sheet === 'family' && (
        <FamilySheet
          user={user}
          onClose={() => setSheet(null)}
          onUserChange={(patch) => onUserChange({ ...user, ...patch })}
        />
      )}
    </div>
  )
}
