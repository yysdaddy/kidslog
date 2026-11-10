import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { db, now, uid, MEDIA_DIR, attachmentToApi } from '../db.js'
import {
  processImage, processVideo, attachmentDir, removeAttachmentFiles,
  dirSize, IMAGE_MAX_BYTES, VIDEO_MAX_BYTES,
} from '../media.js'

const TMP_DIR = path.join(MEDIA_DIR, '_tmp')

function assertChild(fid, childId) {
  return db.prepare('SELECT id FROM children WHERE id = ? AND family_id = ?').get(childId, fid)
}

function attachmentRow(id) {
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id)
}

async function sendFile(req, reply, filePath, mime, cache = 'private, max-age=604800') {
  let stat
  try {
    stat = await fsp.stat(filePath)
  } catch {
    return reply.code(404).send({ error: '文件不存在' })
  }
  const range = req.headers.range
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    if (m) {
      const start = m[1] ? Number(m[1]) : 0
      const end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1
      if (start > end || start >= stat.size) {
        return reply.code(416).header('Content-Range', `bytes */${stat.size}`).send()
      }
      return reply
        .code(206)
        .headers({
          'Content-Type': mime,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': cache,
        })
        .send(fs.createReadStream(filePath, { start, end }))
    }
  }
  return reply
    .headers({
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cache,
    })
    .send(fs.createReadStream(filePath))
}

export default async function mediaRoutes(app) {
  await fsp.mkdir(TMP_DIR, { recursive: true })

  // 上传（单文件）
  app.post('/api/media', async (req, reply) => {
    const childId = req.query?.childId
    if (!childId) return reply.code(400).send({ error: 'childId 必填' })
    if (!assertChild(req.user.fid, childId)) return reply.code(403).send({ error: '无权访问' })

    const part = await req.file({ limits: { fileSize: VIDEO_MAX_BYTES } })
    if (!part) return reply.code(400).send({ error: '未收到文件' })

    const mime = part.mimetype || ''
    const ext = path.extname(part.filename || '').toLowerCase()
    const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.avif']
    const VID_EXT = ['.mp4', '.mov', '.m4v', '.webm', '.3gp', '.avi', '.mkv', '.mts']
    const isImage = mime.startsWith('image/') || IMG_EXT.includes(ext)
    const isVideo = mime.startsWith('video/') || VID_EXT.includes(ext)
    if (!isImage && !isVideo) {
      part.file.resume()
      return reply.code(415).send({ error: '只支持图片或视频' })
    }

    const id = uid('att_')
    const tmpFile = path.join(TMP_DIR, `${id}${path.extname(part.filename || '') || (isImage ? '.jpg' : '.mp4')}`)
    try {
      await pipeline(part.file, fs.createWriteStream(tmpFile))
      if (part.file.truncated) {
        return reply.code(413).send({ error: '视频不能超过 200MB' })
      }
      const size = (await fsp.stat(tmpFile)).size
      if (size === 0) return reply.code(400).send({ error: '文件为空' })
      if (isImage && size > IMAGE_MAX_BYTES) return reply.code(413).send({ error: '图片不能超过 30MB' })

      const outDir = attachmentDir(childId, id)
      const out = isImage ? await processImage(tmpFile, outDir) : await processVideo(tmpFile, outDir)
      const displaySize = (await fsp.stat(out.displayPath)).size

      const ts = now()
      db.prepare(`INSERT INTO attachments
        (id, record_id, child_id, kind, original_path, display_path, thumb_path, mime, size_bytes,
         width, height, duration_ms, status, created_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)`)
        .run(id, childId, isImage ? 'image' : 'video', part.filename || null,
          out.displayPath, out.thumbPath, out.mime, displaySize,
          out.width, out.height, out.durationMs, ts)

      return { attachment: attachmentToApi(attachmentRow(id)) }
    } catch (e) {
      await removeAttachmentFiles(childId, id)
      const code = e.statusCode || 500
      req.log.error({ err: e }, '媒体处理失败')
      return reply.code(code).send({ error: e.message || '处理失败' })
    } finally {
      await fsp.rm(tmpFile, { force: true }).catch(() => {})
    }
  })

  // 相册列表
  app.get('/api/media', async (req, reply) => {
    const { childId, from, to, kind, limit, before } = req.query || {}
    if (!childId) return reply.code(400).send({ error: 'childId 必填' })
    if (!assertChild(req.user.fid, childId)) return reply.code(403).send({ error: '无权访问' })

    let sql = `SELECT a.* FROM attachments a JOIN records r ON r.id = a.record_id
               WHERE a.child_id = ? AND a.status = 'ready' AND r.deleted_at IS NULL`
    const args = [childId]
    if (before) { sql += ' AND a.created_at < ?'; args.push(before) }
    if (from) { sql += ' AND a.created_at >= ?'; args.push(from) }
    if (to) { sql += ' AND a.created_at <= ?'; args.push(to) }
    if (kind) { sql += ' AND a.kind = ?'; args.push(kind) }
    sql += ' ORDER BY a.created_at DESC LIMIT ?'
    args.push(Math.min(Number(limit) || 200, 500))

    const rows = db.prepare(sql).all(...args)
    return { attachments: rows.map(attachmentToApi) }
  })

  app.get('/api/media/:id/thumb', async (req, reply) => {
    const row = attachmentRow(req.params.id)
    if (!row) return reply.code(404).send({ error: '未找到' })
    if (!assertChild(req.user.fid, row.child_id)) return reply.code(403).send({ error: '无权访问' })
    return sendFile(req, reply, row.thumb_path, 'image/jpeg')
  })

  app.get('/api/media/:id/file', async (req, reply) => {
    const row = attachmentRow(req.params.id)
    if (!row) return reply.code(404).send({ error: '未找到' })
    if (!assertChild(req.user.fid, row.child_id)) return reply.code(403).send({ error: '无权访问' })
    return sendFile(req, reply, row.display_path, row.mime)
  })

  // 删除附件（未绑定记录的孤儿文件或记录内删除）
  app.delete('/api/media/:id', async (req, reply) => {
    const row = attachmentRow(req.params.id)
    if (!row) return reply.code(404).send({ error: '未找到' })
    if (!assertChild(req.user.fid, row.child_id)) return reply.code(403).send({ error: '无权访问' })
    db.prepare('DELETE FROM attachments WHERE id = ?').run(row.id)
    await removeAttachmentFiles(row.child_id, row.id)
    return { ok: true }
  })

  // 存储占用
  app.get('/api/storage', async () => {
    const used = await dirSize(MEDIA_DIR)
    const quotaGb = Number(process.env.MEDIA_QUOTA_GB || 20)
    return { usedBytes: used, quotaBytes: quotaGb * 1024 ** 3 }
  })
}

