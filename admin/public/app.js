'use strict'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

let kind = 'post'              // post | draft
let items = []
let current = null             // {name, kind, data, body}
let currentData = {}
let previewOn = false
let settingsCache = { site: '', theme: '' }
let building = false
let pages = []
let currentPage = null

/* ------------------------------ 基础工具 ------------------------------ */

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const type = res.headers.get('content-type') || ''
  const body = type.includes('application/json') ? await res.json() : await res.text()
  if (!res.ok) throw new Error((body && body.error) || res.statusText)
  return body
}

let toastTimer
function toast(message, isError) {
  const el = $('#toast')
  el.textContent = message
  el.className = 'toast show' + (isError ? ' error' : '')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.className = 'toast' }, 2600)
}

function splitList(value) {
  return String(value || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function toInputValue(value) {
  const s = String(value || '')
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s)
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : ''
}

function fromInputValue(value) {
  return value ? value.replace('T', ' ') + ':00' : ''
}

function isFuture(value) {
  if (!value) return false
  const t = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isFinite(t) && t > Date.now()
}

/* -------------------------------- 标签页 -------------------------------- */

$$('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.tab').forEach((b) => b.classList.toggle('active', b === btn))
    $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + btn.dataset.tab))
    if (btn.dataset.tab === 'media') loadImages()
    if (btn.dataset.tab === 'settings') loadSettings()
    if (btn.dataset.tab === 'pages') loadPages()
  })
})

/* ------------------------------ 文章 / 草稿 ------------------------------ */

function itemUrl(name, extra) {
  return '/api/posts/' + encodeURIComponent(name) + '?kind=' + kind + (extra || '')
}

async function loadItems() {
  const data = await api('/api/posts?kind=' + kind)
  items = data.posts
  renderList()
  updateStatus()
}

async function switchKind(next) {
  kind = next
  current = null
  currentData = {}
  $('#kind-post').classList.toggle('active', kind === 'post')
  $('#kind-draft').classList.toggle('active', kind === 'draft')
  $('#editor').classList.add('hidden')
  $('#editor-empty').classList.remove('hidden')
  $('#editor-empty').textContent = kind === 'post'
    ? '从左侧选择一篇文章，或点击「新建」开始写作'
    : '草稿不会出现在网站上，点击「新建」写一篇草稿'
  await loadItems()
}

function renderList() {
  const keyword = $('#search').value.trim().toLowerCase()
  const list = $('#post-list')
  list.innerHTML = ''

  const filtered = items.filter((p) =>
    !keyword ||
    p.title.toLowerCase().includes(keyword) ||
    p.name.toLowerCase().includes(keyword) ||
    p.categories.join(',').toLowerCase().includes(keyword)
  )

  if (!filtered.length) {
    const li = document.createElement('li')
    li.className = 'empty'
    li.textContent = keyword
      ? '没有匹配的内容'
      : (kind === 'draft' ? '还没有草稿' : '还没有文章')
    li.style.padding = '24px 10px'
    list.appendChild(li)
    return
  }

  filtered.forEach((p) => {
    const li = document.createElement('li')
    li.className = 'post-item' + (current && current.name === p.name ? ' active' : '')
    li.dataset.name = p.name

    const title = document.createElement('div')
    title.className = 'p-title'
    title.textContent = p.title

    const meta = document.createElement('div')
    meta.className = 'p-meta'

    const date = document.createElement('span')
    date.textContent = (p.date || '').slice(0, 10) || '无日期'
    meta.appendChild(date)

    if (kind === 'draft') {
      const badge = document.createElement('span')
      badge.className = 'badge draft'
      badge.textContent = '草稿'
      meta.appendChild(badge)
    } else if (p.scheduled) {
      const badge = document.createElement('span')
      badge.className = 'badge schedule'
      badge.textContent = '定时'
      meta.appendChild(badge)
    } else if (p.categories.length) {
      const cat = document.createElement('span')
      cat.textContent = p.categories.join(' / ')
      meta.appendChild(cat)
    }

    li.appendChild(title)
    li.appendChild(meta)
    li.addEventListener('click', () => selectItem(p.name).catch((e) => toast(e.message, true)))
    list.appendChild(li)
  })
}

async function selectItem(name) {
  const data = await api(itemUrl(name))
  current = { name: data.name, kind: data.kind, data: data.data, body: data.body }
  currentData = Object.assign({}, data.data)
  fillEditor()
  renderList()
}

function fillEditor() {
  $('#editor-empty').classList.add('hidden')
  $('#editor').classList.remove('hidden')
  $('#current-file').textContent = current.name + (kind === 'draft' ? '（草稿）' : '')
  $('#f-title').value = currentData.title || ''
  $('#f-date').value = toInputValue(currentData.date)
  $('#f-categories').value = (Array.isArray(currentData.categories) ? currentData.categories : []).join(', ')
  $('#f-tags').value = (Array.isArray(currentData.tags) ? currentData.tags : []).join(', ')
  $('#f-mathjax').checked = currentData.mathjax === true
  $('#f-body').value = current.body || ''
  $('#btn-publish').classList.toggle('hidden', kind !== 'draft')
  updateScheduleHint()
  if (previewOn) refreshPreview()
}

function collectData() {
  const data = Object.assign({}, currentData)
  data.title = $('#f-title').value.trim() || current.name.replace(/\.md$/i, '')

  const date = $('#f-date').value
  if (date) data.date = fromInputValue(date)
  else delete data.date

  const categories = splitList($('#f-categories').value)
  if (categories.length) data.categories = categories
  else delete data.categories

  const tags = splitList($('#f-tags').value)
  if (tags.length) data.tags = tags
  else delete data.tags

  if ($('#f-mathjax').checked) data.mathjax = true
  else delete data.mathjax

  return data
}

function updateScheduleHint() {
  const hint = $('#schedule-hint')
  const value = $('#f-date').value
  if (!value || !isFuture(value)) {
    hint.classList.add('hidden')
    return
  }
  hint.classList.remove('hidden')
  hint.textContent = '定时发布 · ' + new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function saveItem() {
  if (!current) return
  const btn = $('#btn-save')
  btn.disabled = true
  try {
    const data = collectData()
    const res = await api(itemUrl(current.name), {
      method: 'PUT',
      body: JSON.stringify({ data, body: $('#f-body').value })
    })
    currentData = data
    current.body = $('#f-body').value
    toast(res.scheduled ? '已保存，到设定时间自动发布' : '已保存')
    await loadItems()
  } catch (e) {
    toast(e.message, true)
  } finally {
    btn.disabled = false
  }
}

async function newItem() {
  const title = prompt(kind === 'draft' ? '新草稿标题：' : '新文章标题：', kind === 'draft' ? '未命名草稿' : '未命名文章')
  if (title === null) return
  try {
    const data = await api('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ title: title.trim() || '未命名', kind })
    })
    await loadItems()
    await selectItem(data.name)
    $('#f-title').focus()
    $('#f-title').select()
  } catch (e) {
    toast(e.message, true)
  }
}

async function deleteItem() {
  if (!current) return
  const label = kind === 'draft' ? '草稿' : '文章'
  if (!confirm(`确定删除${label}「${currentData.title || current.name}」？\n文件会移到 .trash 目录，可以手动找回。`)) return
  try {
    await api(itemUrl(current.name), { method: 'DELETE' })
    current = null
    currentData = {}
    $('#editor').classList.add('hidden')
    $('#editor-empty').classList.remove('hidden')
    toast('已移到回收站')
    await loadItems()
  } catch (e) {
    toast(e.message, true)
  }
}

async function publishDraft() {
  if (!current || kind !== 'draft') return
  if (!confirm(`把草稿「${currentData.title || current.name}」发布为文章？\n日期为空会用当前时间。`)) return
  try {
    // 先保存当前编辑内容，再发布
    await api(itemUrl(current.name), {
      method: 'PUT',
      body: JSON.stringify({ data: collectData(), body: $('#f-body').value })
    })
    const res = await api('/api/publish', {
      method: 'POST',
      body: JSON.stringify({ name: current.name })
    })
    current = null
    currentData = {}
    $('#editor').classList.add('hidden')
    $('#editor-empty').classList.remove('hidden')
    toast(res.scheduled ? '已转为定时文章：' + res.date : '已发布为文章')
    await loadItems()
  } catch (e) {
    toast(e.message, true)
  }
}

function importMarkdown() {
  $('#md-input').click()
}

$('#md-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const content = await file.text()
    const res = await api('/api/import', {
      method: 'POST',
      body: JSON.stringify({ name: file.name, content, kind })
    })
    toast('已导入：' + res.name)
    await loadItems()
    await selectItem(res.name)
  } catch (err) {
    toast(err.message, true)
  }
})

/* -------------------------------- 独立页面 -------------------------------- */

async function loadPages() {
  try {
    pages = (await api('/api/pages')).pages
    const list = $('#page-list')
    list.innerHTML = ''
    if (!pages.length) {
      list.innerHTML = '<li class="empty" style="padding:24px 10px">还没有独立页面</li>'
      return
    }
    pages.forEach((p) => {
      const li = document.createElement('li')
      li.className = 'post-item' + (currentPage && currentPage.name === p.name ? ' active' : '')
      const title = document.createElement('div')
      title.className = 'p-title'
      title.textContent = p.title
      const meta = document.createElement('div')
      meta.className = 'p-meta'
      meta.textContent = '/' + p.name + '/'
      li.appendChild(title)
      li.appendChild(meta)
      li.addEventListener('click', () => selectPage(p.name).catch((e) => toast(e.message, true)))
      list.appendChild(li)
    })
  } catch (e) {
    toast(e.message, true)
  }
}

async function selectPage(name) {
  const data = await api('/api/pages/' + encodeURIComponent(name))
  currentPage = { name, data: data.data, body: data.body }
  $('#page-empty').classList.add('hidden')
  $('#page-editor').classList.remove('hidden')
  $('#pg-title').value = data.data.title || name
  $('#pg-name').value = '/' + name + '/'
  $('#pg-file').textContent = `source/${name}/index.md`
  $('#pg-body').value = data.body || ''
  await loadPages()
}

async function savePage() {
  if (!currentPage) return
  const btn = $('#btn-page-save')
  btn.disabled = true
  try {
    const data = Object.assign({}, currentPage.data, { title: $('#pg-title').value.trim() || currentPage.name })
    await api('/api/pages/' + encodeURIComponent(currentPage.name), {
      method: 'PUT',
      body: JSON.stringify({ data, body: $('#pg-body').value })
    })
    currentPage.data = data
    currentPage.body = $('#pg-body').value
    toast('页面已保存')
    await loadPages()
  } catch (e) {
    toast(e.message, true)
  } finally {
    btn.disabled = false
  }
}

/* -------------------------------- 预览 -------------------------------- */

async function refreshPreview() {
  const html = (await api('/api/preview', {
    method: 'POST',
    body: JSON.stringify({ body: $('#f-body').value })
  })).html
  $('#preview').innerHTML = html
}

function togglePreview() {
  previewOn = !previewOn
  $('#split').classList.toggle('previewing', previewOn)
  $('#preview').classList.toggle('hidden', !previewOn)
  $('#btn-preview').textContent = previewOn ? '关闭预览' : '预览'
  if (previewOn) refreshPreview().catch((e) => toast(e.message, true))
}

/* -------------------------------- 图片 -------------------------------- */

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function uploadFile(file) {
  const dataUrl = await readFile(file)
  return api('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ name: file.name, data: dataUrl })
  })
}

async function insertImage() {
  if (!current) return toast('先选择一篇文章', true)
  $('#file-input').click()
}

async function loadImages() {
  try {
    const data = await api('/api/images')
    const grid = $('#image-grid')
    grid.innerHTML = ''
    if (!data.images.length) {
      grid.innerHTML = '<div class="empty">还没有图片，点击右上角上传</div>'
      return
    }
    data.images.forEach((img) => {
      const card = document.createElement('div')
      card.className = 'image-card'

      const el = document.createElement('img')
      el.src = img.url
      el.alt = img.name
      el.title = '点击复制 Markdown 引用'
      el.addEventListener('click', async () => {
        const md = `![${img.name}](${img.url})`
        try {
          await navigator.clipboard.writeText(md)
          toast('已复制：' + md)
        } catch (e) {
          prompt('复制下面的 Markdown：', md)
        }
      })

      const meta = document.createElement('div')
      meta.className = 'i-meta'
      const name = document.createElement('span')
      name.className = 'i-name'
      name.textContent = img.name
      const size = document.createElement('span')
      size.textContent = Math.max(1, Math.round(img.size / 1024)) + ' KB'
      const del = document.createElement('button')
      del.className = 'icon-btn'
      del.textContent = '删除'
      del.addEventListener('click', async () => {
        if (!confirm('删除图片 ' + img.name + '？')) return
        try {
          await api('/api/images/' + encodeURIComponent(img.name), { method: 'DELETE' })
          toast('已删除')
          loadImages()
        } catch (e) {
          toast(e.message, true)
        }
      })

      meta.appendChild(name)
      meta.appendChild(size)
      meta.appendChild(del)
      card.appendChild(el)
      card.appendChild(meta)
      grid.appendChild(card)
    })
  } catch (e) {
    toast(e.message, true)
  }
}

/* -------------------------------- 设置 -------------------------------- */

async function loadSettings() {
  try {
    settingsCache = await api('/api/settings')
    $('#settings-text').value = settingsCache[$('#settings-target').value] || ''
  } catch (e) {
    toast(e.message, true)
  }
}

async function saveSettings() {
  const target = $('#settings-target').value
  const content = $('#settings-text').value
  try {
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ target, content })
    })
    settingsCache[target] = content
    toast('配置已保存，记得重新生成')
  } catch (e) {
    toast(e.message, true)
  }
}

/* -------------------------------- 构建 -------------------------------- */

async function buildSite() {
  if (building) return
  building = true
  const btn = $('#btn-build')
  const log = $('#build-log')
  btn.disabled = true
  btn.textContent = '生成中…'
  log.textContent = '正在生成，请稍候…\n'

  try {
    const data = await api('/api/build', { method: 'POST' })
    log.textContent = data.output + `\n✓ 完成，用时 ${(data.ms / 1000).toFixed(1)} 秒`
    toast('生成完成')
  } catch (e) {
    log.textContent = (e.message || '构建失败')
    toast('构建失败', true)
  } finally {
    building = false
    btn.disabled = false
    btn.textContent = '开始生成'
    updateStatus()
  }
}

/* -------------------------------- 状态 -------------------------------- */

async function updateStatus() {
  try {
    const data = await api('/api/status')
    const built = data.lastBuild
      ? `上次构建 ${data.lastBuild.ok ? '成功' : '失败'}`
      : '尚未构建'
    $('#status').textContent = `Hexo ${data.hexo} · ${data.posts} 篇 · ${data.drafts} 篇草稿 · ${built}`
  } catch (e) {
    $('#status').textContent = '无法连接后台服务'
    $('#status').style.color = '#d93a3a'
  }
}

/* -------------------------------- 明暗主题 -------------------------------- */

function syncThemeButton() {
  const dark = document.documentElement.classList.contains('dark')
  const btn = $('#theme-toggle')
  btn.textContent = dark ? '☀' : '☾'
  btn.title = dark ? '切换到亮色' : '切换到暗色'
}

$('#theme-toggle').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark')
  const dark = document.documentElement.classList.contains('dark')
  try { localStorage.setItem('admin-theme', dark ? 'dark' : 'light') } catch (e) {}
  syncThemeButton()
})

syncThemeButton()

/* -------------------------------- 事件绑定 -------------------------------- */

$('#search').addEventListener('input', renderList)
$('#kind-post').addEventListener('click', () => switchKind('post'))
$('#kind-draft').addEventListener('click', () => switchKind('draft'))
$('#btn-new').addEventListener('click', newItem)
$('#btn-import').addEventListener('click', importMarkdown)
$('#btn-save').addEventListener('click', saveItem)
$('#btn-delete').addEventListener('click', deleteItem)
$('#btn-publish').addEventListener('click', publishDraft)
$('#btn-preview').addEventListener('click', togglePreview)
$('#btn-upload').addEventListener('click', insertImage)
$('#btn-save-settings').addEventListener('click', saveSettings)
$('#btn-build').addEventListener('click', buildSite)
$('#btn-page-save').addEventListener('click', savePage)
$('#f-date').addEventListener('input', updateScheduleHint)

$('#settings-target').addEventListener('change', () => {
  $('#settings-text').value = settingsCache[$('#settings-target').value] || ''
})

$('#file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const res = await uploadFile(file)
    const textarea = $('#f-body')
    const snippet = `![${file.name}](${res.url})`
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    textarea.value = textarea.value.slice(0, start) + snippet + textarea.value.slice(end)
    textarea.focus()
    textarea.selectionStart = textarea.selectionEnd = start + snippet.length
    toast('图片已上传')
  } catch (err) {
    toast(err.message, true)
  }
})

$('#btn-upload-media').addEventListener('click', () => $('#file-input-media').click())

$('#file-input-media').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files)
  e.target.value = ''
  if (!files.length) return
  for (const file of files) {
    try {
      await uploadFile(file)
    } catch (err) {
      toast(err.message, true)
    }
  }
  toast('上传完成')
  loadImages()
})

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    if ($('#tab-posts').classList.contains('active')) saveItem()
    else if ($('#tab-pages').classList.contains('active')) savePage()
    else if ($('#tab-settings').classList.contains('active')) saveSettings()
  }
})

/* -------------------------------- 启动 -------------------------------- */

loadItems().catch((e) => toast(e.message, true))
updateStatus()
setInterval(updateStatus, 30000)
