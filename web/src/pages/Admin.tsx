import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, type AdminFamily, type AdminUser, type User } from '../api'
import {
  ChevronLeft, Search, ShieldCheck, ShieldOff, Ban, KeyRound, CheckCircle2,
  Home, Plus, Trash2, RefreshCw, X, AlertTriangle, Pencil,
} from 'lucide-react'
import { useScrollLock } from '../hooks/useScrollLock'

type Props = {
  user: User
  onBack: () => void
}

export default function Admin({ user, onBack }: Props) {
  const [tab, setTab] = useState<'users' | 'families'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [families, setFamilies] = useState<AdminFamily[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [newFamily, setNewFamily] = useState('')
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [delTarget, setDelTarget] = useState<AdminFamily | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const flash = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(''), 2600)
  }

  const load = useCallback(async (keyword = '') => {
    setErr('')
    try {
      const [u, f] = await Promise.all([api.adminUsers(keyword), api.adminFamilies()])
      setUsers(u.users)
      setFamilies(f.families)
    } catch (e: any) {
      setErr(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => { load(q.trim()) }, 320)
    return () => clearTimeout(t)
  }, [q, load])

  async function run(fn: () => Promise<any>, okText: string) {
    try {
      await fn()
      flash(okText)
      await load(q.trim())
    } catch (e: any) {
      setErr(e?.message || '操作失败')
    }
  }

  async function saveName(u: AdminUser) {
    const v = nameDraft.trim()
    if (!v) return setErr('昵称不能为空')
    await run(() => api.adminUpdateUser(u.id, { displayName: v }), '昵称已更新')
    setNameDraft('')
  }

  async function doResetPw(u: AdminUser, pw: string) {
    await api.adminResetPassword(u.id, pw)
    flash('密码已重置，该账号下次登录需修改密码')
    setResetTarget(null)
    await load(q.trim())
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-white border border-slate-100 text-sm outline-none focus:ring-2 focus:ring-brand-300'
  const btnCls = 'px-3 py-2 rounded-lg text-xs whitespace-nowrap'

  return (
    <div className="min-h-full bg-[#F7FAFC] pb-10">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="flex items-center h-12 px-2">
          <button onClick={onBack} className="p-2 text-slate-500">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="flex-1 text-sm font-medium text-brand-900">系统管理</p>
          <button onClick={() => load(q.trim())} className="p-2 text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex px-4 gap-1 pb-2">
          {([['users', '账号'], ['families', '家庭']] as ['users' | 'families', string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-lg text-sm transition ${tab === k ? 'bg-brand-500 text-white' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(err || msg) && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-xl text-xs ${err ? 'bg-rose-50 text-rose-600' : 'bg-mint-50 text-mint-600'}`}>
          {err || msg}
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-slate-400 py-16">加载中</p>
      ) : tab === 'users' ? (
        <div className="px-4 pt-3 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索昵称、用户名或家庭"
              className={`${inputCls} pl-9`}
            />
          </div>
          <p className="text-[11px] text-slate-400 px-1">共 {users.length} 个账号</p>

          {users.map((u) => (
            <div key={u.id} className="bg-white rounded-2xl shadow-soft overflow-hidden">
              <button
                onClick={() => { setOpenId(openId === u.id ? null : u.id); setNameDraft(u.displayName); setErr('') }}
                className="w-full text-left px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-brand-900 truncate">{u.displayName}</span>
                  {u.isAdmin && (
                    <span className="flex items-center gap-0.5 text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                      <ShieldCheck className="w-3 h-3" /> 管理员
                    </span>
                  )}
                  {u.status === 'disabled' && (
                    <span className="text-[10px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">已停用</span>
                  )}
                  {u.mustChangePw && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">待改密</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 truncate">
                  @{u.username} · {u.familyName || '无家庭'} · {u.role === 'owner' ? '创建者' : '成员'}
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  家庭：{u.familyChildCount} 个孩子 · {u.familyRecordCount} 条记录 · 本人记录 {u.ownRecordCount}
                </p>
              </button>

              {openId === u.id && (
                <div className="border-t border-slate-50 bg-[#FBFDFE] px-4 py-3 space-y-3">
                  {u.isMe && <p className="text-[11px] text-amber-600">这是你自己的账号，不能停用、降权或调整家庭。</p>}

                  <div className="flex gap-2">
                    <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className={inputCls} placeholder="新的昵称" />
                    <button onClick={() => saveName(u)} className={`${btnCls} bg-brand-500 text-white`}>保存</button>
                  </div>

                  {!u.isMe && (
                    <>
                      <button
                        onClick={() => setResetTarget(u)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-50 text-amber-600 text-xs"
                      >
                        <KeyRound className="w-3.5 h-3.5" /> 重置密码
                      </button>

                      <div className="flex items-center gap-2">
                        <Home className="w-3.5 h-3.5 text-slate-400" />
                        <select
                          value={u.familyId}
                          onChange={(e) => run(() => api.adminUpdateUser(u.id, { familyId: e.target.value }), '家庭归属已调整')}
                          className="flex-1 px-2 py-2 rounded-lg bg-white border border-slate-100 text-xs text-slate-600"
                        >
                          {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => run(() => api.adminUpdateUser(u.id, { status: u.status === 'disabled' ? 'active' : 'disabled' }),
                            u.status === 'disabled' ? '账号已启用' : '账号已停用')}
                          className={`${btnCls} flex-1 flex items-center justify-center gap-1 ${u.status === 'disabled' ? 'bg-mint-50 text-mint-600' : 'bg-rose-50 text-rose-500'}`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {u.status === 'disabled' ? '启用账号' : '停用账号'}
                        </button>
                        <button
                          onClick={() => run(() => api.adminUpdateUser(u.id, { isAdmin: !u.isAdmin }),
                            u.isAdmin ? '已取消管理员' : '已设为管理员')}
                          className={`${btnCls} flex-1 flex items-center justify-center gap-1 bg-slate-100 text-slate-600`}
                        >
                          {u.isAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {u.isAdmin ? '取消管理员' : '设为管理员'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-300 flex items-center gap-1">
                        <KeyRound className="w-3 h-3" /> 停用或重置密码后，该账号已登录的设备会立即失效
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 pt-3 space-y-3">
          <div className="flex gap-2">
            <input value={newFamily} onChange={(e) => setNewFamily(e.target.value)} className={inputCls} placeholder="新家庭名称" />
            <button
              onClick={async () => {
                const v = newFamily.trim()
                if (!v) return setErr('请输入家庭名称')
                await run(() => api.adminCreateFamily(v), '家庭已创建')
                setNewFamily('')
              }}
              className={`${btnCls} bg-brand-500 text-white flex items-center gap-1`}
            >
              <Plus className="w-3.5 h-3.5" /> 新建
            </button>
          </div>

          <p className="text-[11px] text-slate-400 px-1">共 {families.length} 个家庭</p>
          {families.map((f) => (
            <div key={f.id} className="bg-white rounded-2xl shadow-soft px-4 py-3">
              {renameId === f.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-brand-300"
                    maxLength={20}
                  />
                  <button
                    onClick={async () => {
                      const v = renameDraft.trim()
                      if (!v) return setErr('家庭名称不能为空')
                      await run(() => api.adminRenameFamily(f.id, v), '家庭名称已更新')
                      setRenameId(null)
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-brand-500 text-white text-[11px]"
                  >保存</button>
                  <button onClick={() => setRenameId(null)} className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[11px]">取消</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-brand-900 truncate flex-1">{f.name}</p>
                  <button
                    onClick={() => { setRenameId(f.id); setRenameDraft(f.name); setErr('') }}
                    aria-label="重命名家庭"
                    className="p-1.5 rounded-lg text-slate-400 active:bg-slate-100"
                  ><Pencil className="w-3.5 h-3.5" /></button>
                  <span className="text-[10px] text-slate-400 font-mono">{f.inviteCode}</span>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                {f.ownerName || '无创建者'} · {f.memberCount} 位成员 · {f.childCount} 个孩子 · {f.recordCount} 条记录
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-300">创建于 {f.createdAt?.slice(0, 10)}</span>
                {f.memberCount === 0 && f.childCount === 0 && (
                  <button
                    onClick={() => setDelTarget(f)}
                    className="flex items-center gap-1 text-[11px] text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 解散
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-300 text-center mt-8">管理员只能管理账号与家庭，不能查看其他家庭的记录内容</p>

      {resetTarget && (
        <ResetSheet
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          onSubmit={(pw) => doResetPw(resetTarget, pw)}
        />
      )}

      {delTarget && (
        <ConfirmSheet
          title="解散家庭"
          desc={`确定解散空家庭「${delTarget.name}」？解散后不可恢复。`}
          confirmText="解散"
          onCancel={() => setDelTarget(null)}
          onOk={async () => {
            const target = delTarget
            try {
              await api.adminDeleteFamily(target.id)
              setDelTarget(null)
              flash('家庭已解散')
              await load(q.trim())
            } catch (e: any) {
              setDelTarget(null)
              setErr(e?.message || '解散失败')
            }
          }}
        />
      )}
    </div>
  )
}

function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useScrollLock()
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 overscroll-contain" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[88dvh] overflow-y-auto overscroll-contain bg-white rounded-t-3xl px-5 pt-4 pb-7 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function ResetSheet({ target, onClose, onSubmit }: {
  target: AdminUser
  onClose: () => void
  onSubmit: (pw: string) => Promise<void>
}) {
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const cls = 'w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-brand-300'

  async function submit() {
    setErr('')
    if (pw1.length < 6) return setErr('密码至少 6 位')
    if (pw1 !== pw2) return setErr('两次输入的密码不一致')
    setBusy(true)
    try {
      await onSubmit(pw1)
    } catch (e: any) {
      setErr(e?.message || '重置失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-base font-medium text-brand-900">重置密码</p>
        <button onClick={onClose} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">
        重置后 {target.displayName} 的旧密码立即失效，下次登录需先修改密码
      </p>
      <div className="space-y-2">
        <input
          type="password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          placeholder="新密码（至少 6 位）"
          className={cls}
        />
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="再次输入新密码"
          className={cls}
        />
      </div>
      {err && <p className="text-[11px] text-rose-500 mt-2">{err}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm">取消</button>
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 py-3 rounded-xl bg-brand-500 text-white text-sm disabled:opacity-60"
        >
          {busy ? '重置中…' : '确认重置'}
        </button>
      </div>
    </Sheet>
  )
}

function ConfirmSheet({ title, desc, confirmText, onCancel, onOk }: {
  title: string
  desc: string
  confirmText: string
  onCancel: () => void
  onOk: () => Promise<void> | void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet onClose={onCancel}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-rose-500 mt-0.5" />
        <div className="flex-1">
          <p className="text-base font-medium text-brand-900">{title}</p>
          <p className="text-[12px] text-slate-500 mt-1">{desc}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm">取消</button>
        <button
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onOk() } finally { setBusy(false) } }}
          className="flex-1 py-3 rounded-xl bg-rose-500 text-white text-sm disabled:opacity-60"
        >
          {busy ? '处理中…' : confirmText}
        </button>
      </div>
    </Sheet>
  )
}
