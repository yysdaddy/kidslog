import sharp from 'sharp'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { MEDIA_DIR } from './db.js'

export const IMAGE_MAX_EDGE = 2048
export const THUMB_EDGE = 400
export const VIDEO_MAX_SECONDS = 300
export const VIDEO_MAX_BYTES = 200 * 1024 * 1024
export const IMAGE_MAX_BYTES = 30 * 1024 * 1024

function run(cmd, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('处理超时')) }, timeoutMs)
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d })
    p.on('error', reject)
    p.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(`${cmd} 失败(${code}): ${err.slice(-400)}`))
    })
  })
}

export async function probeVideo(file) {
  const out = await run('ffprobe', [
    '-v', 'error', '-print_format', 'json',
    '-show_format', '-show_streams', file,
  ], 30000)
  const info = JSON.parse(out || '{}')
  const v = (info.streams || []).find((s) => s.codec_type === 'video') || {}
  const a = (info.streams || []).find((s) => s.codec_type === 'audio') || {}
  const duration = Number(info.format?.duration || v.duration || 0)
  return {
    durationMs: Math.round(duration * 1000),
    width: Number(v.width) || null,
    height: Number(v.height) || null,
    hasAudio: !!a.codec_type,
    codec: v.codec_name || null,
  }
}

// 图片：纠正方向 -> 限制长边 -> JPEG（原图不保留，符合 PRD）
export async function processImage(srcPath, outDir) {
  const display = path.join(outDir, 'display.jpg')
  const thumb = path.join(outDir, 'thumb.jpg')
  const meta = await sharp(srcPath, { failOn: 'none' }).metadata()
  await sharp(srcPath, { failOn: 'none' })
    .rotate()
    .resize({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true })
    .toFile(display)
  await sharp(srcPath, { failOn: 'none' })
    .rotate()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'cover', position: 'centre' })
    .jpeg({ quality: 75 })
    .toFile(thumb)
  const dMeta = await sharp(display).metadata()
  return {
    displayPath: display,
    thumbPath: thumb,
    mime: 'image/jpeg',
    width: dMeta.width || meta.width || null,
    height: dMeta.height || meta.height || null,
    durationMs: null,
  }
}

// 视频：转 720p / 2Mbps H.264，生成封面
export async function processVideo(srcPath, outDir) {
  const info = await probeVideo(srcPath)
  if (info.durationMs > VIDEO_MAX_SECONDS * 1000) {
    throw Object.assign(new Error(`视频超过 ${VIDEO_MAX_SECONDS / 60} 分钟，请先裁剪`), { statusCode: 400 })
  }
  const display = path.join(outDir, 'display.mp4')
  const thumb = path.join(outDir, 'thumb.jpg')

  await run('ffmpeg', [
    '-y', '-i', srcPath,
    '-vf', "scale='min(1280,iw)':-2:flags=lanczos,fps='min(30,source_fps)'",
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-b:v', '2M', '-maxrate', '2.6M', '-bufsize', '4M',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
    '-movflags', '+faststart',
    display,
  ])

  await run('ffmpeg', [
    '-y', '-ss', '0.3', '-i', display, '-frames:v', '1',
    '-vf', "scale='min(720,iw)':-2", '-q:v', '3', thumb,
  ]).catch(async () => {
    await run('ffmpeg', ['-y', '-i', display, '-frames:v', '1',
      '-vf', "scale='min(720,iw)':-2", '-q:v', '3', thumb])
  })

  const outInfo = await probeVideo(display).catch(() => info)
  return {
    displayPath: display,
    thumbPath: thumb,
    mime: 'video/mp4',
    width: outInfo.width || info.width,
    height: outInfo.height || info.height,
    durationMs: outInfo.durationMs || info.durationMs,
  }
}

export function attachmentDir(childId, attachmentId) {
  const dir = path.join(MEDIA_DIR, childId, attachmentId)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export async function removeAttachmentFiles(childId, attachmentId) {
  const dir = path.join(MEDIA_DIR, childId, attachmentId)
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {})
}

export async function dirSize(dir) {
  let total = 0
  const walk = async (d) => {
    const entries = await fsp.readdir(d, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) await walk(p)
      else {
        const st = await fsp.stat(p).catch(() => null)
        if (st) total += st.size
      }
    }
  }
  await walk(dir)
  return total
}
