import { useCallback, useEffect, useState } from 'react'
import { api, type Child, type User } from './api'
import Login from './pages/Login'
import Home from './pages/Home'
import Growth from './pages/Growth'
import Calendar from './pages/Calendar'
import Health from './pages/Health'
import Me from './pages/Me'
import Admin from './pages/Admin'
import ChildForm from './components/ChildForm'
import ForcePassword from './components/ForcePassword'
import { todayStr } from './utils'
import { ClipboardList, TrendingUp, CalendarDays, HeartPulse, User as UserIcon } from 'lucide-react'

type Tab = 'home' | 'growth' | 'calendar' | 'health' | 'me'

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'home', label: '记录', icon: ClipboardList },
  { key: 'growth', label: '成长', icon: TrendingUp },
  { key: 'calendar', label: '日历', icon: CalendarDays },
  { key: 'health', label: '健康', icon: HeartPulse },
  { key: 'me', label: '我的', icon: UserIcon },
]

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [booting, setBooting] = useState(true)
  const [children, setChildren] = useState<Child[]>([])
  const [activeId, setActiveId] = useState('')
  const [tab, setTab] = useState<Tab>('home')
  const [date, setDate] = useState(todayStr())
  const [childForm, setChildForm] = useState<{ mode: 'new' } | { mode: 'edit'; child: Child } | null>(null)
  const openAddChild = () => setChildForm({ mode: 'new' })
  const openEditChild = (c: Child) => setChildForm({ mode: 'edit', child: c })
  const [adminOpen, setAdminOpen] = useState(false)

  const loadChildren = useCallback(async () => {
    try {
      const r = await api.children()
      setChildren(r.children)
      setActiveId((prev) => (r.children.some((c) => c.id === prev) ? prev : r.children[0]?.id || ''))
    } catch {
      setChildren([])
    }
  }, [])

  useEffect(() => {
    api.me()
      .then((r) => { setUser(r.user); return loadChildren() })
      .catch(() => setUser(null))
      .finally(() => setBooting(false))
  }, [loadChildren])

  if (booting) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-brand-500">
        <div className="w-10 h-10 rounded-full border-[3px] border-brand-200 border-t-brand-500 animate-spin" />
        <span className="text-sm text-slate-400">加载中</span>
      </div>
    )
  }

  if (!user) return <Login onLogin={(u) => { setUser(u); loadChildren() }} />

  if (user.mustChangePw) {
    return (
      <ForcePassword
        user={user}
        onDone={(u) => { setUser(u); loadChildren() }}
        onLogout={async () => {
          await api.logout().catch(() => {})
          setUser(null)
        }}
      />
    )
  }

  if (adminOpen && user.isAdmin) {
    return (
      <div className="min-h-full bg-[#F7FAFC]">
        <Admin user={user} onBack={() => setAdminOpen(false)} />
      </div>
    )
  }

  const activeChild = children.find((c) => c.id === activeId) || null

  return (
    <div className="min-h-full bg-[#F7FAFC]">
      <div
        style={{
          minHeight: 'calc(100dvh - 60px)',
          // 记录页自带快捷记录条与 pb-44 补偿，其余页面需为固定底栏预留空间
          paddingBottom: tab === 'home' ? 0 : 'calc(60px + env(safe-area-inset-bottom))',
        }}
      >
        {tab === 'home' && (
          <Home
            user={user}
            children={children}
            activeId={activeId}
            date={date}
            onDateChange={setDate}
            onSelectChild={setActiveId}
            onAddChild={openAddChild}
            onOpenCalendar={() => setTab('calendar')}
            onOpenHealth={() => setTab('health')}
          />
        )}

        {tab === 'growth' && (
          activeChild
            ? <Growth child={activeChild} />
            : <Empty onAddChild={openAddChild} />
        )}

        {tab === 'calendar' && (
          activeId ? (
            <Calendar
              childId={activeId}
              onPickDate={(d) => { setDate(d); setTab('home') }}
            />
          ) : <Empty onAddChild={openAddChild} />
        )}

        {tab === 'health' && (
          activeChild
            ? <Health child={activeChild} />
            : <Empty onAddChild={openAddChild} />
        )}

        {tab === 'me' && (
          <Me
            user={user}
            children={children}
            activeId={activeId}
            onSelectChild={(id) => { setActiveId(id); setTab('home') }}
            onAddChild={openAddChild}
            onEditChild={openEditChild}
            onUserChange={setUser}
            onOpenAdmin={() => setAdminOpen(true)}
            onLogout={async () => {
              await api.logout().catch(() => {})
              setUser(null)
              setTab('home')
              setDate(todayStr())
            }}
          />
        )}
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-100 z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-[60px]">
          {TABS.map((t) => {
            const Icon = t.icon
            const on = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition ${on ? 'text-brand-500' : 'text-slate-400'}`}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={on ? 2.1 : 1.8} />
                <span className={`text-[10px] ${on ? 'font-medium' : ''}`}>{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {childForm && (
        <ChildForm
          child={childForm.mode === 'edit' ? childForm.child : null}
          onClose={() => setChildForm(null)}
          onSaved={(c) => {
            const isEdit = childForm.mode === 'edit'
            setChildren((p) => (isEdit ? p.map((x) => (x.id === c.id ? c : x)) : [...p, c]))
            if (!isEdit) setActiveId(c.id)
            setChildForm(null)
          }}
          onDeleted={(id) => {
            const rest = children.filter((x) => x.id !== id)
            setChildren(rest)
            setActiveId((prev) => (prev === id ? rest[0]?.id || '' : prev))
            setChildForm(null)
          }}
        />
      )}
    </div>
  )
}

function Empty({ onAddChild }: { onAddChild: () => void }) {
  return (
    <div className="py-24 text-center px-8">
      <p className="text-sm text-slate-400">还没有添加孩子</p>
      <button onClick={onAddChild} className="mt-4 px-6 py-2.5 rounded-xl bg-brand-500 text-white text-sm">添加孩子</button>
    </div>
  )
}
