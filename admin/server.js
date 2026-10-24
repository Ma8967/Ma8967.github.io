'use strict'

/**
 * 本地博客管理后台
 * 只监听 127.0.0.1，不对外网暴露；直接操作 source/ 下的源文件。
 * 启动：node admin/server.js   或   npm run admin
 */

const express = require('express')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const markedModule = require('marked')
const marked = markedModule.marked || markedModule
const TurndownService = require('turndown')
const { gfm } = require('turndown-plugin-gfm')
const { execFile } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const SOURCE_DIR = path.join(ROOT, 'source')
const POSTS_DIR = path.join(SOURCE_DIR, '_posts')
const DRAFTS_DIR = path.join(SOURCE_DIR, '_drafts')
const IMAGES_DIR = path.join(SOURCE_DIR, 'images')
const TRASH_DIR = path.join(ROOT, '.trash')
const SITE_CONFIG = path.join(ROOT, '_config.yml')
const THEME_CONFIG = path.join(ROOT, 'themes', 'Chic', '_config.yml')
const HEXO_BIN = path.join(ROOT, 'node_modules', 'hexo-cli', 'bin', 'hexo')
const PORT = Number(process.env.ADMIN_PORT || 5001)

let lastBuild = null
let building = false

const app = express()
app.use(express.json({ limit: '30mb' }))
// 复用主题自带的兰亭字体，让后台和博客保持同一套字型
app.use('/assets/fonts', express.static(path.join(ROOT, 'themes', 'Chic', 'source', 'fonts')))
app.use(express.static(path.join(__dirname, 'public')))

/* ------------------------------ 工具函数 ------------------------------ */

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function kindDir(kind) {
  return kind === 'draft' ? DRAFTS_DIR : POSTS_DIR
}

function normalizeKind(value) {
  return value === 'draft' ? 'draft' : 'post'
}

function sanitizeName(name, ext) {
  const base = path.basename(String(name || '')).trim()
  if (!base || base === '.' || base === '..' || /[\\/:*?"<>|]/.test(base)) {
    throw new Error('文件名不合法')
  }
  return ext && !base.toLowerCase().endsWith(ext) ? base + ext : base
}

function itemFile(name, kind) {
  return path.join(kindDir(kind), sanitizeName(name, '.md'))
}

function uniqueFile(dir, filename) {
  const ext = path.extname(filename)
  const stem = path.basename(filename, ext)
  let candidate = path.join(dir, filename)
  let i = 1
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem}-${i}${ext}`)
    i++
  }
  return candidate
}

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

/* ---------------------- 富文本 ↔ Markdown ---------------------- */

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined'
})
turndown.use(gfm)
// 插件默认输出单波浪线，GFM 需要双波浪线
turndown.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => '~~' + content + '~~'
})
// 保留字号、颜色、下划线、着重号等 Markdown 表达不了的行内 HTML
turndown.keep(['span', 'u', 'mark'])

function markdownToHtml(body) {
  return marked.parse(String(body || ''), { gfm: true, breaks: false })
}

function htmlToMarkdown(html) {
  const md = turndown.turndown(String(html || ''))
  return md.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function nowStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return {
    display: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`,
    file: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  }
}

/** 日期是否在未来（用于「定时上传」标记） */
function isScheduled(dateValue) {
  if (!dateValue) return false
  const t = new Date(String(dateValue).replace(' ', 'T')).getTime()
  return Number.isFinite(t) && t > Date.now()
}

function toArray(value) {
  if (value === undefined || value === null || value === '') return []
  return Array.isArray(value) ? value.map(String) : [String(value)]
}

function listItems(kind) {
  const dir = kindDir(kind)
  ensureDir(dir)
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.md') && !f.startsWith('.'))
    .map((f) => {
      const full = path.join(dir, f)
      const stat = fs.statSync(full)
      const raw = fs.readFileSync(full, 'utf8')
      const { data } = parseFrontMatter(raw)
      return {
        name: f,
        kind,
        title: data.title ? String(data.title) : f.replace(/\.md$/i, ''),
        date: data.date ? String(data.date) : '',
        categories: toArray(data.categories),
        tags: toArray(data.tags),
        scheduled: kind === 'post' && isScheduled(data.date),
        mtime: stat.mtimeMs,
        size: stat.size
      }
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.mtime - a.mtime)
}

function moveToTrash(file) {
  ensureDir(TRASH_DIR)
  const target = path.join(TRASH_DIR, `${path.basename(file)}.${nowStamp().file}.bak`)
  fs.renameSync(file, target)
  return path.basename(target)
}

/* -------------------------------- 文章 / 草稿 -------------------------------- */

app.get('/api/posts', (req, res) => {
  try {
    const kind = normalizeKind(req.query.kind)
    res.json({ kind, posts: listItems(kind) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/posts/:name', (req, res) => {
  try {
    const kind = normalizeKind(req.query.kind)
    const file = itemFile(req.params.name, kind)
    if (!fs.existsSync(file)) return res.status(404).json({ error: '文件不存在' })
    const raw = fs.readFileSync(file, 'utf8')
    const { data, body } = parseFrontMatter(raw)
    res.json({ name: path.basename(file), kind, raw, data, body, html: markdownToHtml(body) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/posts', (req, res) => {
  try {
    const kind = normalizeKind(req.body.kind)
    const dir = kindDir(kind)
    ensureDir(dir)

    const title = String(req.body.title || '').trim() || (kind === 'draft' ? '未命名草稿' : '未命名文章')
    let base = sanitizeName(req.body.filename || title.replace(/[\\/:*?"<>|]/g, '-'), '')
    if (!base.toLowerCase().endsWith('.md')) base += '.md'

    const file = uniqueFile(dir, base)
    const data = { title }
    // 草稿不写日期，发布时再定；文章写当前时间
    if (kind === 'post') {
      data.date = nowStamp().display
      data.categories = []
      data.tags = []
    }
    fs.writeFileSync(file, composeMarkdown(data, ''), 'utf8')
    res.json({ ok: true, kind, name: path.basename(file) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.put('/api/posts/:name', (req, res) => {
  try {
    const kind = normalizeKind(req.query.kind)
    const file = itemFile(req.params.name, kind)
    if (!fs.existsSync(file)) return res.status(404).json({ error: '文件不存在' })
    const data = req.body.data || {}
    if (!data.title) data.title = path.basename(file, '.md')
    const body = req.body.html !== undefined
      ? htmlToMarkdown(req.body.html)
      : String(req.body.body || '')
    fs.writeFileSync(file, composeMarkdown(data, body), 'utf8')
    res.json({
      ok: true,
      kind,
      name: path.basename(file),
      markdown: body,
      scheduled: kind === 'post' && isScheduled(data.date)
    })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.delete('/api/posts/:name', (req, res) => {
  try {
    const kind = normalizeKind(req.query.kind)
    const file = itemFile(req.params.name, kind)
    if (!fs.existsSync(file)) return res.status(404).json({ error: '文件不存在' })
    const trashed = moveToTrash(file)
    res.json({ ok: true, kind, trashed })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/** 把草稿发布成文章：日期为空时填当前时间；日期在未来则保持定时 */
app.post('/api/publish', (req, res) => {
  try {
    const name = sanitizeName(req.body.name, '.md')
    const draftFile = path.join(DRAFTS_DIR, name)
    if (!fs.existsSync(draftFile)) return res.status(404).json({ error: '草稿不存在' })

    ensureDir(POSTS_DIR)
    const raw = fs.readFileSync(draftFile, 'utf8')
    const { data, body } = parseFrontMatter(raw)
    if (!data.date) data.date = nowStamp().display
    if (!Array.isArray(data.categories)) delete data.categories
    if (!Array.isArray(data.tags)) delete data.tags

    const target = uniqueFile(POSTS_DIR, name)
    fs.writeFileSync(target, composeMarkdown(data, body), 'utf8')
    moveToTrash(draftFile)

    res.json({
      ok: true,
      name: path.basename(target),
      scheduled: isScheduled(data.date),
      date: String(data.date)
    })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/** 导入本地 Markdown 文件（内容由前端读取后传入） */
app.post('/api/import', (req, res) => {
  try {
    const kind = normalizeKind(req.body.kind)
    const dir = kindDir(kind)
    ensureDir(dir)

    const name = sanitizeName(req.body.name || 'imported.md', '.md')
    const content = String(req.body.content || '')
    const parsed = parseFrontMatter(content)

    const data = Object.assign({}, parsed.data)
    if (!data.title) data.title = path.basename(name, '.md')
    if (!data.date && kind === 'post') data.date = nowStamp().display

    const target = uniqueFile(dir, name)
    fs.writeFileSync(target, composeMarkdown(data, parsed.body), 'utf8')
    res.json({ ok: true, kind, name: path.basename(target) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/* -------------------------------- 独立页面 -------------------------------- */

const RESERVED_DIRS = new Set(['_posts', '_drafts', 'images'])

function pageDir(name) {
  const base = String(name || '').trim()
  if (!base || /[\\/:*?"<>|]/.test(base) || base.startsWith('_') || base.startsWith('.')) {
    throw new Error('页面名不合法')
  }
  const dir = path.join(SOURCE_DIR, base)
  if (!fs.existsSync(path.join(dir, 'index.md'))) throw new Error('页面不存在')
  return dir
}

app.get('/api/pages', (req, res) => {
  const pages = []
  if (fs.existsSync(SOURCE_DIR)) {
    fs.readdirSync(SOURCE_DIR, { withFileTypes: true }).forEach((entry) => {
      if (!entry.isDirectory() || RESERVED_DIRS.has(entry.name)) return
      const file = path.join(SOURCE_DIR, entry.name, 'index.md')
      if (!fs.existsSync(file)) return
      const { data } = parseFrontMatter(fs.readFileSync(file, 'utf8'))
      pages.push({
        name: entry.name,
        title: data.title ? String(data.title) : entry.name,
        layout: data.layout ? String(data.layout) : 'page'
      })
    })
  }
  res.json({ pages })
})

app.get('/api/pages/:name', (req, res) => {
  try {
    const dir = pageDir(req.params.name)
    const file = path.join(dir, 'index.md')
    const raw = fs.readFileSync(file, 'utf8')
    const { data, body } = parseFrontMatter(raw)
    res.json({ name: req.params.name, raw, data, body, html: markdownToHtml(body) })
  } catch (e) {
    res.status(404).json({ error: e.message })
  }
})

app.put('/api/pages/:name', (req, res) => {
  try {
    const dir = pageDir(req.params.name)
    const data = req.body.data || {}
    if (!data.title) data.title = req.params.name
    const body = req.body.html !== undefined
      ? htmlToMarkdown(req.body.html)
      : String(req.body.body || '')
    fs.writeFileSync(path.join(dir, 'index.md'), composeMarkdown(data, body), 'utf8')
    res.json({ ok: true, name: req.params.name })
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
    const target = uniqueFile(IMAGES_DIR, base)
    const buffer = Buffer.from(String(data).replace(/^data:[^;]+;base64,/, ''), 'base64')
    fs.writeFileSync(target, buffer)
    const filename = path.basename(target)
    res.json({ ok: true, name: filename, url: `/images/${encodeURIComponent(filename)}` })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.delete('/api/images/:name', (req, res) => {
  try {
    const file = path.join(IMAGES_DIR, sanitizeName(req.params.name))
    if (!fs.existsSync(file)) return res.status(404).json({ error: '图片不存在' })
    moveToTrash(file)
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
  res.json({ html: markdownToHtml(req.body.body) })
})

/** Markdown → 富文本 HTML */
app.post('/api/render', (req, res) => {
  try {
    res.json({ html: markdownToHtml(req.body.markdown) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

/** 富文本 HTML → Markdown */
app.post('/api/markdown', (req, res) => {
  try {
    res.json({ markdown: htmlToMarkdown(req.body.html) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
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
  const count = (dir) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length : 0
  res.json({
    root: ROOT,
    hexo: hexoVersion,
    posts: count(POSTS_DIR),
    drafts: count(DRAFTS_DIR),
    pages: fs.existsSync(SOURCE_DIR)
      ? fs.readdirSync(SOURCE_DIR).filter((d) => {
          try { return !!pageDir(d) } catch (e) { return false }
        }).length
      : 0,
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
