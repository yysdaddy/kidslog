import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

export const DATA_DIR = process.env.DATA_DIR || '/data'
export const MEDIA_DIR = path.join(DATA_DIR, 'media')
export const BACKUP_DIR = path.join(DATA_DIR, 'backups')

fs.mkdirSync(MEDIA_DIR, { recursive: true })
fs.mkdirSync(BACKUP_DIR, { recursive: true })

export const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'))

db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec('PRAGMA busy_timeout = 5000')

db.exec(`
CREATE TABLE IF NOT EXISTS families (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  family_id      TEXT NOT NULL REFERENCES families(id),
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member',
  is_admin       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  must_change_pw INTEGER NOT NULL DEFAULT 0,
  token_version  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT NOT NULL,
  actor_name  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  target_name TEXT,
  detail      TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS children (
  id              TEXT PRIMARY KEY,
  family_id       TEXT NOT NULL REFERENCES families(id),
  name            TEXT NOT NULL,
  nickname        TEXT,
  gender          TEXT,
  birth_date      TEXT,
  avatar_path     TEXT,
  allergies       TEXT,
  medical_history TEXT,
  note            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  archived        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  id          TEXT PRIMARY KEY,
  child_id    TEXT NOT NULL REFERENCES children(id),
  type        TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  ended_at    TEXT,
  payload     TEXT NOT NULL DEFAULT '{}',
  note        TEXT,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,
  record_id     TEXT REFERENCES records(id),
  child_id      TEXT NOT NULL,
  kind          TEXT NOT NULL,
  original_path TEXT,
  display_path  TEXT NOT NULL,
  thumb_path    TEXT,
  mime          TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  width         INTEGER,
  height        INTEGER,
  duration_ms   INTEGER,
  status        TEXT NOT NULL DEFAULT 'ready',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vaccinations (
  id         TEXT PRIMARY KEY,
  child_id   TEXT NOT NULL REFERENCES children(id),
  code       TEXT,
  name       TEXT NOT NULL,
  dose_no    INTEGER NOT NULL DEFAULT 1,
  due_date   TEXT,
  done_date  TEXT,
  place      TEXT,
  batch_no   TEXT,
  reaction   TEXT,
  note       TEXT,
  source     TEXT NOT NULL DEFAULT 'plan',
  auto_done  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vacc_plan ON vaccinations(child_id, code, dose_no) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vacc_child ON vaccinations(child_id, due_date);

CREATE INDEX IF NOT EXISTS idx_records_child_time ON records(child_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_type ON records(child_id, type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_id);
CREATE INDEX IF NOT EXISTS idx_attachments_child ON attachments(child_id, created_at DESC);
`)

// 轻量迁移：老库缺列时补齐（SQLite 不支持 ADD COLUMN IF NOT EXISTS）
function hasColumn(table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)
}
function ensureColumn(table, col, ddl) {
  if (!hasColumn(table, col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
}
ensureColumn('users', 'is_admin', 'is_admin INTEGER NOT NULL DEFAULT 0')
ensureColumn('users', 'status', "status TEXT NOT NULL DEFAULT 'active'")
ensureColumn('users', 'must_change_pw', 'must_change_pw INTEGER NOT NULL DEFAULT 0')
ensureColumn('users', 'token_version', 'token_version INTEGER NOT NULL DEFAULT 0')
ensureColumn('vaccinations', 'auto_done', 'auto_done INTEGER NOT NULL DEFAULT 0')

export const now = () => new Date().toISOString()

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// 行对象转 API 输出（payload 从 JSON 字符串还原）
export function rowToRecord(row) {
  let payload = {}
  try { payload = JSON.parse(row.payload || '{}') } catch { payload = {} }
  return {
    id: row.id, childId: row.child_id, type: row.type,
    occurredAt: row.occurred_at, endedAt: row.ended_at,
    payload, note: row.note, createdBy: row.created_by,
    creatorName: row.creator_name || null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export function attachmentToApi(row) {
  return {
    id: row.id,
    recordId: row.record_id,
    childId: row.child_id,
    kind: row.kind,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    status: row.status,
    originalName: row.original_path,
    createdAt: row.created_at,
    url: `/api/media/${row.id}/file`,
    thumbUrl: `/api/media/${row.id}/thumb`,
  }
}

export function rowToChild(row) {
  return {
    id: row.id, name: row.name, nickname: row.nickname, gender: row.gender,
    birthDate: row.birth_date, avatarPath: row.avatar_path,
    allergies: row.allergies, medicalHistory: row.medical_history,
    note: row.note, archived: !!row.archived, createdAt: row.created_at,
  }
}
