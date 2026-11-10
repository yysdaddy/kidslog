import { useState } from 'react'
import { api, type Child } from '../api'
import DateField from './DateField'
import { todayStr } from '../utils'
import { X, Trash2 } from 'lucide-react'
import { useScrollLock } from '../hooks/useScrollLock'

export default function ChildForm({
  child, onClose, onSaved, onDeleted,
}: {
  child?: Child | null
  onClose: () => void
  onSaved: (c: Child) => void
  onDeleted?: (id: string) => void
}) {
  useScrollLock()
  const editing = !!child
  const [name, setName] = useState(child?.name || '')
  const [nickname, setNickname] = useState(child?.nickname || '')
  const [gender, setGender] = useState(child?.gender || '')
  const [birthDate, setBirthDate] = useState(child?.birthDate || '')
  const [allergies, setAllergies] = useState(child?.allergies || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save() {
    if (!name.trim()) { setError('请填写姓名'); return }
    setBusy(true); setError('')
    try {
      const body = {
        name: name.trim(),
        nickname: nickname.trim() || null,
        gender: gender || null,
        birthDate: birthDate || null,
        allergies: allergies.trim() || null,
      }
      const r = editing
        ? await api.updateChild(child!.id, body)
        : await api.createChild(body as Partial<Child>)
      onSaved(r.child)
      onClose()
    } catch (e: any) {
      setError(e.message || '保存失败')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!editing) return
    setBusy(true); setError('')
    try {
      await api.deleteChild(child!.id)
      onDeleted?.(child!.id)
      onClose()
    } catch (e: any) {
      setError(e.message || '删除失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30 animate-fade-in overscroll-contain" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl animate-slide-up px-5 pt-3 pb-6 max-h-[85vh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '85dvh', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between mb-4 sticky top-0 z-20 -mx-5 px-5 bg-white/95 backdrop-blur pt-1 pb-2">
          <h2 className="text-base font-medium text-brand-900">{editing ? '编辑孩子' : '添加孩子'}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">姓名 *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="孩子姓名"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 text-base outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">小名</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="如：小满"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 text-base outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">出生日期</label>
            <DateField value={birthDate} onChange={setBirthDate} max={todayStr()} placeholder="选择出生日期"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 text-base outline-none focus:ring-2 focus:ring-brand-300" />
            <p className="text-[11px] text-slate-300 mt-1">从出生开始记录，会用于月龄与成长曲线</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">性别</label>
            <div className="flex gap-2">
              {[['male', '男孩'], ['female', '女孩'], ['other', '不填']].map(([v, l]) => (
                <button key={v} onClick={() => setGender(gender === v ? '' : v)}
                  className={`px-4 py-2 rounded-xl text-sm ${gender === v ? 'bg-brand-500 text-white' : 'bg-slate-50 text-slate-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">过敏史</label>
            <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="如：牛奶蛋白过敏"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 text-base outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button onClick={save} disabled={busy}
            className="w-full py-3.5 rounded-xl bg-brand-500 text-white text-base font-medium shadow-lift disabled:opacity-60">
            {busy ? '保存中…' : '保存'}
          </button>

          {editing && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} disabled={busy}
              className="w-full py-3 rounded-xl bg-white border border-rose-100 text-rose-500 text-sm flex items-center justify-center gap-1.5">
              <Trash2 className="w-4 h-4" /> 删除这个孩子
            </button>
          )}
          {editing && confirmDelete && (
            <div className="rounded-xl bg-rose-50/70 border border-rose-100 p-3">
              <p className="text-sm text-rose-600">确定删除「{child!.nickname || child!.name}」？</p>
              <p className="text-[11px] text-rose-400 mt-1">删除后该孩子的记录与照片将不再显示，且无法自行恢复。</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setConfirmDelete(false)} disabled={busy}
                  className="flex-1 py-2.5 rounded-lg bg-white text-slate-500 text-sm">取消</button>
                <button onClick={remove} disabled={busy}
                  className="flex-1 py-2.5 rounded-lg bg-rose-500 text-white text-sm disabled:opacity-60">
                  {busy ? '删除中…' : '确认删除'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
