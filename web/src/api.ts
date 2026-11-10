export type User = {
  id: string
  username: string
  displayName: string
  familyId: string
  role: string
  familyName?: string
  inviteCode?: string
  createdAt?: string
  memberCount?: number
  isAdmin?: boolean
  status?: string
  mustChangePw?: boolean
}

export type AdminUser = {
  id: string
  username: string
  displayName: string
  familyId: string
  familyName?: string
  role: string
  isAdmin: boolean
  status: string
  mustChangePw: boolean
  createdAt: string
  familyChildCount: number
  familyRecordCount: number
  ownRecordCount: number
  isMe: boolean
}

export type AdminFamily = {
  id: string
  name: string
  inviteCode: string
  createdAt: string
  memberCount: number
  childCount: number
  recordCount: number
  ownerName?: string | null
}

export type FamilyMember = {
  id: string
  username: string
  displayName: string
  role: string
  createdAt: string
  isMe: boolean
  isAdmin?: boolean
  status?: string
  recordCount: number
}

export type Child = {
  id: string
  name: string
  nickname?: string | null
  gender?: string | null
  birthDate?: string | null
  allergies?: string | null
  medicalHistory?: string | null
  note?: string | null
}

export type Attachment = {
  id: string
  recordId?: string | null
  childId: string
  kind: 'image' | 'video'
  mime: string
  sizeBytes: number
  width?: number | null
  height?: number | null
  durationMs?: number | null
  createdAt: string
  url: string
  thumbUrl: string
}

export type RecordItem = {
  id: string
  childId: string
  type: string
  occurredAt: string
  endedAt?: string | null
  payload: Record<string, any>
  note?: string | null
  createdBy: string
  creatorName?: string | null
  createdAt: string
  updatedAt: string
  attachments?: Attachment[]
}

export type VaccineStatus = 'done' | 'overdue' | 'dueSoon' | 'pending'

export type Vaccine = {
  id: string
  childId: string
  code?: string | null
  name: string
  doseNo: number
  dueDate?: string | null
  doneDate?: string | null
  place?: string | null
  batchNo?: string | null
  reaction?: string | null
  note?: string | null
  source: 'plan' | 'custom'
  status: VaccineStatus
  daysLeft?: number | null
}

export type HealthOverview = {
  nextVaccine: Vaccine | null
  overdueCount: number
  doneCount: number
  pendingCount: number
  totalCount: number
  lastVisit: {
    id: string
    occurredAt: string
    hospital?: string
    department?: string
    diagnosis?: string
    followupAt?: string
    prescription?: string
    feeYuan?: number
  } | null
  nextFollowup: { id: string; occurredAt: string; followupAt: string; daysLeft: number; hospital?: string } | null
}

export type StatsBucket = {
  total: number
  activeDays: number
  byType: { type: string; count: number }[]
  sleepMinutes: number
  feedingCount: number
  maxTemp: number | null
  visitCount: number
  growthCount: number
}

export type StatsRange = StatsBucket & {
  from: string
  to: string
  prev: StatsBucket & { from: string; to: string }
}

export type StatsDay = {
  date: string
  total: number
  feedingCount: number
  milkMl: number
  solidCount: number
  poopCount: number
  peeCount: number
  diaperCount: number
  sleepMinutes: number
  maxTemp: number | null
  medicineCount: number
  outingCount: number
  visitCount: number
  growthCount: number
  byType: Record<string, number>
}

export type StatsDaily = {
  from: string
  to: string
  days: StatsDay[]
  totals: Omit<StatsDay, 'date' | 'byType'>
  dayCount: number
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // 仅在有 body 时声明 JSON，避免 Fastify 对空 body 的 DELETE/POST 返回 400
  const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) }
  if (options.body != null && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(path, { credentials: 'include', ...options, headers })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!res.ok) {
    throw new Error(data?.error || `请求失败（${res.status}）`)
  }
  return data as T
}

// 上传：带进度
export function uploadMedia(
  childId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/media?childId=${encodeURIComponent(childId)}`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let data: any = null
      try { data = JSON.parse(xhr.responseText || 'null') } catch { data = null }
      if (xhr.status >= 200 && xhr.status < 300 && data?.attachment) resolve(data.attachment)
      else reject(new Error(data?.error || `上传失败（${xhr.status}）`))
    }
    xhr.onerror = () => reject(new Error('网络异常，上传失败'))
    xhr.ontimeout = () => reject(new Error('上传超时'))
    xhr.send(form)
  })
}

export const api = {
  me: () => request<{ user: User }>('/api/me'),
  setup: () => request<{ needsSetup: boolean; userCount: number }>('/api/auth/setup'),
  login: (username: string, password: string) =>
    request<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (body: { username: string; password: string; displayName?: string; familyName?: string }) =>
    request<{ user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  join: (body: { username: string; password: string; displayName?: string; inviteCode: string }) =>
    request<{ user: User }>('/api/auth/join', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

  children: () => request<{ children: Child[] }>('/api/children'),
  createChild: (body: Partial<Child>) =>
    request<{ child: Child }>('/api/children', { method: 'POST', body: JSON.stringify(body) }),
  updateChild: (id: string, body: Partial<Child>) =>
    request<{ child: Child }>(`/api/children/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteChild: (id: string) =>
    request<{ ok: true }>(`/api/children/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  records: (params: { childId: string; date?: string; from?: string; to?: string; type?: string; limit?: number }) => {
    const q = new URLSearchParams({ childId: params.childId })
    if (params.date) q.set('date', params.date)
    if (params.from) q.set('from', params.from)
    if (params.to) q.set('to', params.to)
    if (params.type) q.set('type', params.type)
    if (params.limit) q.set('limit', String(params.limit))
    return request<{ records: RecordItem[] }>(`/api/records?${q.toString()}`)
  },
  calendar: (childId: string, month: string) =>
    request<{ days: { d: string; c: number; t: number }[] }>(
      `/api/calendar?childId=${encodeURIComponent(childId)}&month=${encodeURIComponent(month)}`,
    ),
  createRecord: (body: {
    childId: string
    type: string
    occurredAt?: string
    endedAt?: string | null
    payload?: Record<string, any>
    note?: string
    attachmentIds?: string[]
  }) => request<{ record: RecordItem }>('/api/records', { method: 'POST', body: JSON.stringify(body) }),
  updateRecord: (id: string, body: any) =>
    request<{ record: RecordItem }>(`/api/records/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRecord: (id: string) =>
    request<{ ok: true }>(`/api/records/${id}`, { method: 'DELETE' }),

  media: (params: { childId: string; from?: string; to?: string; kind?: string; limit?: number; before?: string }) => {
    const q = new URLSearchParams({ childId: params.childId })
    if (params.before) q.set('before', params.before)
    if (params.from) q.set('from', params.from)
    if (params.to) q.set('to', params.to)
    if (params.kind) q.set('kind', params.kind)
    if (params.limit) q.set('limit', String(params.limit))
    return request<{ attachments: Attachment[] }>(`/api/media?${q.toString()}`)
  },
  deleteMedia: (id: string) => request<{ ok: true }>(`/api/media/${id}`, { method: 'DELETE' }),
  storage: () => request<{ usedBytes: number; quotaBytes: number }>('/api/storage'),

  vaccines: (childId: string, status?: 'all' | 'pending' | 'done') => {
    const q = new URLSearchParams({ childId })
    if (status && status !== 'all') q.set('status', status)
    return request<{ vaccines: Vaccine[] }>(`/api/vaccines?${q.toString()}`)
  },
  createVaccine: (body: {
    childId: string
    name: string
    doseNo?: number
    dueDate?: string
    doneDate?: string
    place?: string
    batchNo?: string
    reaction?: string
    note?: string
  }) => request<{ vaccine: Vaccine }>('/api/vaccines', { method: 'POST', body: JSON.stringify(body) }),
  updateVaccine: (id: string, body: Partial<Vaccine> & { doneDate?: string | null }) =>
    request<{ vaccine: Vaccine }>(`/api/vaccines/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteVaccine: (id: string) => request<{ ok: true }>(`/api/vaccines/${id}`, { method: 'DELETE' }),
  buildVaccinePlan: (childId: string) =>
    request<{ added: number }>('/api/vaccines/plan', { method: 'POST', body: JSON.stringify({ childId }) }),
  healthOverview: (childId: string) =>
    request<HealthOverview>(`/api/health/overview?childId=${encodeURIComponent(childId)}`),
  statsRange: (childId: string, from: string, to: string) =>
    request<StatsRange>(`/api/stats/range?childId=${encodeURIComponent(childId)}&from=${from}&to=${to}`),
  statsDaily: (childId: string, from: string, to: string) =>
    request<StatsDaily>(`/api/stats/daily?childId=${encodeURIComponent(childId)}&from=${from}&to=${to}`),

  account: () => request<{ user: User }>('/api/me/account'),
  updateProfile: (displayName: string) =>
    request<{ ok: true; user: User }>('/api/me', { method: 'PATCH', body: JSON.stringify({ displayName }) }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ ok: true; user: User }>('/api/me/password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
  members: () => request<{ members: FamilyMember[]; canManage: boolean }>('/api/family/members'),
  updateFamilyName: (name: string) =>
    request<{ ok: true; familyName: string }>('/api/family', { method: 'PATCH', body: JSON.stringify({ name }) }),
  rotateInvite: () =>
    request<{ ok: true; inviteCode: string }>('/api/family/invite/rotate', { method: 'POST', body: '{}' }),
  removeMember: (id: string) =>
    request<{ ok: true }>(`/api/family/members/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // 系统管理（仅管理员）
  adminUsers: (q = '') =>
    request<{ users: AdminUser[] }>(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  adminUpdateUser: (id: string, body: { displayName?: string; familyId?: string; status?: string; isAdmin?: boolean }) =>
    request<{ ok: true }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminResetPassword: (id: string, newPassword: string) =>
    request<{ ok: true }>(`/api/admin/users/${encodeURIComponent(id)}/password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword, forceChange: true }),
    }),
  adminFamilies: () => request<{ families: AdminFamily[] }>('/api/admin/families'),
  adminCreateFamily: (name: string) =>
    request<{ ok: true; family: { id: string; name: string } }>('/api/admin/families', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  adminRenameFamily: (id: string, name: string) =>
    request<{ ok: true; family: { id: string; name: string } }>(
      `/api/admin/families/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ name }) },
    ),
  adminDeleteFamily: (id: string) =>
    request<{ ok: true }>(`/api/admin/families/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminLogs: (limit = 50) =>
    request<{ logs: { id: string; actorName?: string; action: string; targetName?: string; createdAt: string }[] }>(
      `/api/admin/logs?limit=${limit}`,
    ),
}
