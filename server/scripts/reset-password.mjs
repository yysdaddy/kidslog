#!/usr/bin/env node
/**
 * 命令行重置密码（服务端 / 容器内使用）
 *
 * 用法：
 *   node --experimental-sqlite scripts/reset-password.mjs                  # 交互式：选账号 + 输入新密码
 *   node --experimental-sqlite scripts/reset-password.mjs yysdaddy           # 指定账号，随后交互输入新密码
 *   node --experimental-sqlite scripts/reset-password.mjs yysdaddy 新密码     # 指定账号与新密码（注意 shell 历史留痕）
 *   node --experimental-sqlite scripts/reset-password.mjs --list            # 只列出账号
 *
 * 选项：
 *   --no-force-change   不强制该账号下次登录时修改密码（默认强制）
 *   --yes               跳过确认提示（用于脚本化调用）
 *
 * 说明：
 *   - 未在命令行给出密码、且当前不是交互终端（如 CI / docker exec 不带 -it）时，
 *     会自动生成 12 位随机密码并打印一次。
 *   - 重置会把 token_version 加一，该账号所有已登录设备立即失效。
 *   - 数据目录由 DATA_DIR 环境变量决定（容器内默认 /data）。
 */
import crypto from 'node:crypto'
import readline from 'node:readline'
import { db } from '../src/db.js'
import { hashPassword } from '../src/auth.js'

const MIN_LEN = 6
const MAX_LEN = 64

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const positional = argv.filter((a) => !a.startsWith('--'))

const forceChange = !flags.has('--no-force-change')
const skipConfirm = flags.has('--yes')
const listOnly = flags.has('--list')

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}

function users() {
  return db.prepare(`SELECT u.id, u.username, u.display_name AS displayName, u.role, u.is_admin AS isAdmin,
                            u.status, u.must_change_pw AS mustChangePw, u.token_version AS tokenVersion,
                            f.name AS familyName
                     FROM users u LEFT JOIN families f ON f.id = u.family_id
                     ORDER BY u.created_at ASC`).all()
}

function printUsers() {
  const rows = users()
  if (!rows.length) {
    console.log(c.yellow('当前没有任何账号。首次注册者会自动成为管理员。'))
    return
  }
  const head = ['用户名', '昵称', '角色', '管理员', '状态']
  const body = rows.map((u) => [
    u.username,
    u.displayName || '',
    u.role === 'owner' ? '家长' : '成员',
    u.isAdmin ? '是' : '',
    u.status === 'active' ? '正常' : '已停用',
  ])
  const width = head.map((h, i) => Math.max(strw(h), ...body.map((r) => strw(r[i]))))
  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - strw(s)))
  console.log(head.map((h, i) => pad(h, width[i])).join('  '))
  console.log(width.map((w) => '-'.repeat(w)).join('  '))
  for (const r of body) console.log(r.map((s, i) => pad(s, width[i])).join('  '))
}

// 中文字符按 2 列宽对齐
function strw(s) {
  let n = 0
  for (const ch of String(s)) n += ch.charCodeAt(0) > 0x2e80 ? 2 : 1
  return n
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (ans) => {
      rl.close()
      resolve(ans.trim())
    })
  })
}

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    const chars = []
    stdin.resume()
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
    }
    const onData = (s) => {
      for (const ch of s) {
        if (ch === '\r' || ch === '\n') {
          cleanup()
          process.stdout.write('\n')
          resolve(chars.join(''))
          return
        }
        if (ch === '\u0003') {
          cleanup()
          process.stdout.write('\n')
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') {
          if (chars.length) {
            chars.pop()
            process.stdout.write('\b \b')
          }
          continue
        }
        chars.push(ch)
        process.stdout.write('*')
      }
    }
    stdin.on('data', onData)
  })
}

function randomPassword(len = 12) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

function validate(pw) {
  if (!pw || pw.length < MIN_LEN) return `新密码至少 ${MIN_LEN} 位`
  if (pw.length > MAX_LEN) return `新密码不能超过 ${MAX_LEN} 位`
  return ''
}

async function main() {
  if (listOnly) {
    printUsers()
    return
  }

  const all = users()
  if (!all.length) {
    console.error(c.red('当前没有任何账号，无法重置。请先在网页端完成首次注册。'))
    process.exit(1)
  }

  const tty = Boolean(process.stdin.isTTY)

  // 选择账号：命令行参数 > 交互选择
  let username = positional[0]
  if (!username) {
    printUsers()
    if (!tty) {
      console.error(c.red('未指定用户名。用法：reset-password.mjs <用户名> [新密码]'))
      process.exit(1)
    }
    username = await prompt('\n请输入要重置的用户名：')
  }

  const target = all.find((u) => u.username === username)
  if (!target) {
    console.error(c.red(`未找到用户名为 ${username} 的账号。可用账号：${all.map((u) => u.username).join(', ')}`))
    process.exit(1)
  }
  if (target.status !== 'active') {
    console.log(c.yellow(`注意：该账号当前状态为「已停用」，重置密码不会自动启用它。`))
  }

  // 取新密码：命令行参数 > 交互输入 > 自动生成
  let newPassword = positional[1]
  let generated = false
  let check = ''
  if (newPassword) {
    check = validate(newPassword)
  } else if (tty && !positional[1]) {
    newPassword = await promptHidden('请输入新密码（输入不回显）：')
    const again = await promptHidden('请再次输入以确认：')
    if (newPassword !== again) {
      console.error(c.red('两次输入不一致，已取消。'))
      process.exit(1)
    }
    check = validate(newPassword)
  } else {
    newPassword = randomPassword(12)
    generated = true
    check = validate(newPassword)
  }
  if (check) {
    console.error(c.red(check))
    process.exit(1)
  }

  if (tty && !skipConfirm) {
    const ans = await prompt(
      `确认重置 ${c.bold(target.username)}（${target.displayName || '-'}）的密码？` +
        `\n  强制下次登录修改：${forceChange ? '是' : '否'}` +
        `\n  该账号已登录设备将全部失效\n输入 yes 继续：`,
    )
    if (ans.toLowerCase() !== 'yes' && ans.toLowerCase() !== 'y') {
      console.log('已取消。')
      return
    }
  }

  const hash = await hashPassword(newPassword)
  db.prepare(`UPDATE users SET password_hash = ?, must_change_pw = ?, token_version = token_version + 1
              WHERE id = ?`).run(hash, forceChange ? 1 : 0, target.id)

  const after = db.prepare('SELECT token_version FROM users WHERE id = ?').get(target.id)
  console.log(c.green(`\n✔ 已重置 ${target.username}（${target.displayName || '-'}）的密码`))
  console.log(`  强制下次登录修改：${forceChange ? '是' : '否'}`)
  console.log(`  登录态版本：${target.tokenVersion} → ${after.token_version}（旧登录全部失效）`)
  if (generated) {
    console.log(c.yellow(`  临时密码：${newPassword}`))
    console.log(c.dim('  该密码只显示这一次，请立即登录并在「我的 → 修改密码」中改掉。'))
  } else if (positional[1]) {
    console.log(c.yellow('  提示：密码来自命令行参数，可能留在 shell 历史中，建议改用交互输入。'))
  }
}

main().catch((e) => {
  console.error(c.red(`执行失败：${e?.message || e}`))
  process.exit(1)
})
