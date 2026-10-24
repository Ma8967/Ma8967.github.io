'use strict'

/**
 * 本地博客管理后台
 * 只监听 127.0.0.1，不对外网暴露；直接操作 source/_posts 和配置文件。
 * 启动：node admin/server.js   或   npm run admin
 */

const express = require('express')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const markedModule = require('marked')
const marked = markedModule.marked || markedModule
const { execFile } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const POSTS_DIR = path.join(ROOT, 'source', '_posts')
const IMAGES_DIR = path.join(ROOT, 'source', 'images')
const TRASH_DIR = path.join(ROOT, '.trash')
const SITE_CONFIG = path.join(ROOT, '_config.yml')
const THEME_CONFIG = path.join(ROOT, 'themes', 'Chic', '_config.yml')
const HEXO_BIN = path.join(ROOT, 'node_modules', 'hexo-cli', 'bin', 'hexo')
const PORT = Number(process.env.ADMIN_PORT || 5001)

let lastBuild = null
let building = false

const app = express()
app.use(express.json({ limit: '30mb' }))
app.use(express.static(path.join(__dirname, 'public')))

/* ------------------------------ 工具函数 ------------------------------ */

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function sanitizeName(name, ext) {
  const base = path.basename(String(name || '')).trim()
  if (!base || base === '.' || base === '..' || /[\\/:*?"<>|]/.test(base)) {
    throw new Error('文件名不合法')
  }
  return ext && !base.toLowerCase().endsWith(ext) ? base + ext : base
}

function postFile(name) {
  return path.join(POSTS_DIR, sanitizeName(name, '.md'))
}

/** 只解析标题、日期、分类、标签，其余原样保留，避免破坏用户手写的 front-matter */
function parseFrontMatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!m) return { data: {}, body: raw }
  let data = {}
  try {
    // JSON_SCHEMA 让 2026-10-24 10:00:00 这样的日期保持字符串，避免时区偏移
    data = yaml.load(m[1], { schema: yaml.JSON_SCHEMA }) || {}
  } catch (e) {
    data = {}
  }
  return { data, body: m[2] }
}

function composeMarkdown(data, body) {
  const fm = yaml
    .dump(data, { lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false })
    .trimEnd()
  const cleanBody = String(body || '').replace(/^\n+/, '')
  return `---\n${fm}\n---\n\n${cleanBody}`
}

function listPosts() {
  ensureDir(POSTS_DIR)
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.md') && !f.startsWith('.'))
    .map((f) => {
      const full = path.join(POSTS_DIR, f)
      const stat = fs.statSync(full)
      const raw = fs.readFileSync(full, 'utf8')
      const { data } = parseFrontMatter(raw)
      return {
        name: f,
        title: data.title ? String(data.title) : f.replace(/\.md$/i, ''),
        date: data.date ? String(data.date) : '',
        categories: toArray(data.categories),
        tags: toArray(data.tags),
        mtime: stat.mtimeMs,
        size: stat.size
      }
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.mtime - a.mtime)
}

function toArray(value) {
  if (value === undefined || value === null || value === '') return []
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

function nowStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return {
    display: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
    file: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  }
}

/* -------------------------------- 文章 -------------------------------- */

app.get('/api/posts', (req, res) => {
  try {
    res.json({ posts: listPosts() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/posts/:name', (req, res) => {
  try {
    const file = postFile(req.params.name)
    if (!fs.existsSync(file)) return res.status(404).json({ error: '文章不存在' })
    const raw = fs.readFileSync(file, 'utf8')
    const { data, body } = parseFrontMatter(raw)
    res.json({ name: path.basename(file), raw, data, body })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/posts', (req, res) => {
  try {
    ensureDir(POSTS_DIR)
    const title = String(req.body.title || '').trim() || '未命名文章'
    let base = sanitizeName(req.body.filename || title.replace(/[\\/:*?"<>|]/g, '-'), '')
    if (!base.toLowerCase().endsWith('.md')) base += '.md'
    let file = path.join(POSTS_DIR, base)
    let i = 1
    while (fs.existsSync(file)) {
      file = path.join(POSTS_DIR, base.replace(/\.md$/i, `-${i}.md`))
      i++
    }
    const stamp = nowStamp()
    const data = {
      title,
      date: stamp.display,
      categories: [],
      tags: []
    }
    fs.writeFileSync(file, composeMarkdown(data, ''), 'utf8')
    res.json({ ok: true, name: path.basename(file) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.put('/api/posts/:name', (req, res) => {
  try {
    const file = postFile(req.params.name)
    if (!fs.existsSync(file)) return res.status(404).json({ error: '文章不存在' })
    const data = req.body.data || {}
    if (!data.title) data.title = path.basename(file, '.md')
    fs.writeFileSync(file, composeMarkdown(data, req.body.body || ''), 'utf8')
    res.json({ ok: true, name: path.basename(file) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.delete('/api/posts/:name', (req, res) => {
  try {
    const file = postFile(req.params.name)
    if (!fs.existsSync(file)) return res.status(404).json({ error: '文章不存在' })
    // 不物理删除，移到 .trash 里，误删可找回
    ensureDir(TRASH_DIR)
    const target = path.join(TRASH_DIR, `${path.basename(file)}.${nowStamp().file}.bak`)
    fs.renameSync(file, target)
    res.json({ ok: true, trashed: path.basename(target) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/* -------------------------------- 图片 -------------------------------- */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i

app.get('/api/images', (req, res) => {
  ensureDir(IMAGES_DIR)
  const images = fs
    .readdirSync(IMAGES_DIR)
    .filter((f) => IMAGE_EXT.test(f))
    .map((f) => {
      const stat = fs.statSync(path.join(IMAGES_DIR, f))
      return { name: f, url: `/images/${encodeURIComponent(f)}`, size: stat.size }
    })
    .sort((a, b) => b.name.localeCompare(a.name))
  res.json({ images })
})

app.post('/api/upload', (req, res) => {
  try {
    ensureDir(IMAGES_DIR)
    const { name, data } = req.body
    if (!data) throw new Error('缺少文件内容')
    const base = sanitizeName(name || `image-${nowStamp().file}.png`, '')
    if (!IMAGE_EXT.test(base)) throw new Error('只支持图片格式')
    let filename = base
    let i = 1
    while (fs.existsSync(path.join(IMAGES_DIR, filename))) {
      const ext = path.extname(base)
      filename = `${path.basename(base, ext)}-${i}${ext}`
      i++
    }
    const buffer = Buffer.from(String(data).replace(/^data:[^;]+;base64,/, ''), 'base64')
    fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer)
    res.json({ ok: true, name: filename, url: `/images/${encodeURIComponent(filename)}` })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.delete('/api/images/:name', (req, res) => {
  try {
    const file = path.join(IMAGES_DIR, sanitizeName(req.params.name))
    if (!fs.existsSync(file)) return res.status(404).json({ error: '图片不存在' })
    ensureDir(TRASH_DIR)
    fs.renameSync(file, path.join(TRASH_DIR, `${path.basename(file)}.${nowStamp().file}.bak`))
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/* -------------------------------- 配置 -------------------------------- */

app.get('/api/settings', (req, res) => {
  res.json({
    site: fs.existsSync(SITE_CONFIG) ? fs.readFileSync(SITE_CONFIG, 'utf8') : '',
    theme: fs.existsSync(THEME_CONFIG) ? fs.readFileSync(THEME_CONFIG, 'utf8') : ''
  })
})

app.put('/api/settings', (req, res) => {
  try {
    const target = req.body.target === 'theme' ? 'theme' : 'site'
    const content = String(req.body.content || '')
    // 先校验 YAML，写坏配置文件会导致整个站点构建失败
    const parsed = yaml.load(content)
    if (!parsed || typeof parsed !== 'object') throw new Error('配置内容不是合法的 YAML 对象')
    fs.writeFileSync(target === 'theme' ? THEME_CONFIG : SITE_CONFIG, content, 'utf8')
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/* -------------------------------- 预览 / 构建 -------------------------------- */

app.post('/api/preview', (req, res) => {
  res.json({ html: marked.parse(String(req.body.body || ''), { gfm: true, breaks: false }) })
})

app.post('/api/build', (req, res) => {
  if (building) return res.status(409).json({ error: '正在构建中，请稍候' })
  building = true
  const started = Date.now()
  execFile(
    process.execPath,
    [HEXO_BIN, 'generate'],
    { cwd: ROOT, timeout: 180000, maxBuffer: 20 * 1024 * 1024 },
    (error, stdout, stderr) => {
      building = false
      const ms = Date.now() - started
      lastBuild = { at: new Date().toISOString(), ok: !error, ms }
      if (error) {
        return res.status(500).json({ ok: false, ms, output: String(stdout || '') + String(stderr || '') + '\n' + error.message })
      }
      res.json({ ok: true, ms, output: String(stdout || '') + String(stderr || '') })
    }
  )
})

app.get('/api/status', (req, res) => {
  let hexoVersion = 'unknown'
  try {
    hexoVersion = require(path.join(ROOT, 'node_modules', 'hexo', 'package.json')).version
  } catch (e) {
    /* ignore */
  }
  res.json({
    root: ROOT,
    hexo: hexoVersion,
    posts: fs.existsSync(POSTS_DIR) ? fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).length : 0,
    lastBuild,
    building
  })
})

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log('')
  console.log('  博客后台已启动: http://localhost:' + PORT)
  console.log('  工作目录: ' + ROOT)
  console.log('  按 Ctrl+C 停止')
  console.log('')
})
