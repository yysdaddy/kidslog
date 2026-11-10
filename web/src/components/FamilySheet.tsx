import { useEffect, useState } from 'react'
import { api, type FamilyMember, type User } from '../api'
import { X, Copy, Check, Pencil, Trash2, RefreshCw, Crown } from 'lucide-react'
import { useScrollLock } from '../hooks/useScrollLock'

type Props = {
  user: User
  onClose: () => void
  onUserChange: (patch: Partial<User>) => void
}

function joinDate(v: string) {
  return v ? String(v).slice(0, 10) : '—'
}

export default function FamilySheet({ user, onClose, onUserChange }: Props) {
  useScrollLock()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editingName, setEditingName] = useState(false)
  const [familyName, setFamilyName] = useState(user.familyName || '')
  const [savingName, setSavingName] = useState(false)

  const [inviteCode, setInviteCode] = useState(user.inviteCode || '')
  const [copied, setCopied] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [removing, setRemoving] = useState<FamilyMember | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const r = await api.members()
      setMembers(r.members)
      setCanManage(r.canManage)
    } catch (e: any) {
      setError(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function copyCode() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  async function saveFamilyName() {
    const v = familyName.trim()
    if (!v || v.length > 20) return setError('家庭名称需要 1-20 个字符')
    setSavingName(true)
    setError('')
    try {
      const r = await api.updateFamilyName(v)
      onUserChange({ familyName: r.familyName })
      setEditingName(false)
    } catch (e: any) {
      setError(e?.message || '保存失败')
    } finally {
      setSavingName(false)
    }
  }

  async function rotate() {
    setBusy(true)
    setError('')
    try {
      const r = await api.rotateInvite()
      setInviteCode(r.inviteCode)
      onUserChange({ inviteCode: r.inviteCode })
      setConfirmRotate(false)
    } catch (e: any) {
      setError(e?.message || '重置失败')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!removing) return
    setBusy(true)
    setError('')
    try {
      await api.removeMember(removing.id)
      setMembers((p) => p.filter((m) => m.id !== removing.id))
      setRemoving(null)
    } catch (e: any) {
      setError(e?.message || '移除失败')
    } finally {
      setBusy(false)
    }
  }

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
          <h2 className="flex-1 text-center text-base font-medium text-brand-900">家庭成员</h2>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-5 space-y-4">
          {/* 家庭名称 */}
          <div className="bg-[#F7FAFC] rounded-xl px-3.5 py-3">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-slate-400">家庭</p>
              {canManage && !editingName && (
                <button onClick={() => setEditingName(true)} className="ml-auto text-slate-400 p-1" aria-label="修改家庭名称">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {editingName ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  maxLength={20}
                  className="flex-1 px-3 py-2 rounded-lg bg-white text-sm text-brand-900 outline-none focus:ring-2 focus:ring-brand-200"
                />
                <button
                  onClick={saveFamilyName}
                  disabled={savingName}
                  className="px-3 py-2 rounded-lg bg-brand-500 text-white text-xs disabled:opacity-60"
                >
                  {savingName ? '保存中' : '保存'}
                </button>
                <button onClick={() => { setEditingName(false); setFamilyName(user.familyName || '') }} className="px-3 py-2 rounded-lg bg-white text-slate-500 text-xs">
                  取消
                </button>
              </div>
            ) : (
              <p className="text-sm text-brand-900 mt-1">{user.familyName || '我的家庭'}</p>
            )}
          </div>

          {/* 成员列表 */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <p className="text-xs text-slate-400 px-4 pt-3 pb-1">
              成员 {members.length ? `· ${members.length} 人` : ''}
            </p>
            {loading && <p className="text-xs text-slate-300 px-4 py-4">加载中…</p>}
            {!loading && members.length === 0 && <p className="text-xs text-slate-300 px-4 py-4">暂无成员</p>}
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 first:border-t-0">
                <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-sm shrink-0">
                  {(m.displayName || m.username).slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brand-900 truncate flex items-center gap-1.5">
                    <span className="truncate">{m.displayName}</span>
                    {m.isMe && <span className="text-[10px] text-mint-500 shrink-0">我</span>}
                    {m.role === 'owner' && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 shrink-0">
                        <Crown className="w-3 h-3" strokeWidth={1.8} />创建者
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    @{m.username} · 加入 {joinDate(m.createdAt)} · {m.recordCount} 条记录
                  </p>
                </div>
                {canManage && !m.isMe && m.role !== 'owner' && (
                  <button
                    onClick={() => setRemoving(m)}
                    className="p-2 -mr-2 text-slate-300 active:text-rose-500"
                    aria-label="移除成员"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.8} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 邀请码 */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400">家庭邀请码</p>
                <p className="text-base font-mono tracking-[0.18em] text-brand-800 mt-0.5">{inviteCode || '—'}</p>
              </div>
              <button onClick={copyCode} className="flex items-center gap-1 text-xs text-brand-500 px-3 py-2 rounded-lg bg-[#F7FAFC]">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            {canManage && (
              <button
                onClick={() => setConfirmRotate(true)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#F7FAFC] text-slate-500 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} /> 重置邀请码
              </button>
            )}
            <p className="text-[11px] text-slate-300 mt-2">家人注册时填入邀请码即可加入这个家庭</p>
          </div>

          {error && <p className="text-xs text-rose-500 px-1">{error}</p>}
        </div>

        {confirmRotate && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-8 animate-fade-in overscroll-contain" onClick={() => setConfirmRotate(false)}>
            <div className="w-full max-w-xs bg-white rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-base font-medium text-brand-900 text-center">重置邀请码？</p>
              <p className="text-xs text-slate-400 text-center mt-1.5 leading-relaxed">旧邀请码会立即失效，已加入的成员不受影响</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setConfirmRotate(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm">取消</button>
                <button onClick={rotate} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm disabled:opacity-60">
                  {busy ? '处理中' : '重置'}
                </button>
              </div>
            </div>
          </div>
        )}

        {removing && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-8 animate-fade-in overscroll-contain" onClick={() => setRemoving(null)}>
            <div className="w-full max-w-xs bg-white rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
              <p className="text-base font-medium text-brand-900 text-center">移除 {removing.displayName}？</p>
              <p className="text-xs text-slate-400 text-center mt-1.5 leading-relaxed">
                对方将退出当前家庭，不能再查看家庭内的孩子和记录；其历史记录会保留
              </p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setRemoving(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm">取消</button>
                <button onClick={remove} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-sm disabled:opacity-60">
                  {busy ? '处理中' : '移除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
