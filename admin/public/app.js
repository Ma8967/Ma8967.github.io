'use strict'

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

let kind = 'post'
let items = []
let current = null
let currentData = {}
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

/* ------------------------------ 富文本编辑器 ------------------------------ */

const COLORS = ['#161209', '#c94a4a', '#e07b39', '#c9a227', '#1a9f7a', '#2d96bd', '#5b6ec9', '#9b51e0', '#ef3982', '#6b7280', '#9b968e', '#ffffff']

function createRichEditor(host) {
  host.innerHTML = `
    <div class="format-toolbar">
      <select class="tb-select tb-block" title="段落样式">
        <option value="p">正文</option>
        <option value="h1">标题 1</option>
        <option value="h2">标题 2</option>
        <option value="h3">标题 3</option>
        <option value="blockquote">引用</option>
      </select>
      <select class="tb-select tb-size" title="字号">
        <option value="">字号</option>
        <option value="12">12 px</option>
        <option value="14">14 px</option>
        <option value="16">16 px</option>
        <option value="18">18 px</option>
        <option value="20">20 px</option>
        <option value="24">24 px</option>
        <option value="28">28 px</option>
        <option value="32">32 px</option>
      </select>
      <div class="color-wrap">
        <button type="button" class="tb-btn tb-color" title="字体颜色"><span></span></button>
        <div class="color-menu">
          ${COLORS.map((c) => `<button type="button" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
        </div>
      </div>
      <span class="tb-sep"></span>
      <button type="button" class="tb-btn" data-cmd="bold" title="粗体"><b>B</b></button>
      <button type="button" class="tb-btn" data-cmd="italic" title="斜体"><i>I</i></button>
      <button type="button" class="tb-btn" data-cmd="underline" title="下划线"><u>U</u></button>
      <button type="button" class="tb-btn" data-cmd="strikeThrough" title="中划线"><s>S</s></button>
      <button type="button" class="tb-btn tb-emdot" title="着重号">着重</button>
      <span class="tb-sep"></span>
      <button type="button" class="tb-btn" data-cmd="insertUnorderedList" title="项目符号">• 列表</button>
      <button type="button" class="tb-btn" data-cmd="insertOrderedList" title="编号列表">1. 列表</button>
      <button type="button" class="tb-btn tb-quote" title="引用">引用</button>
      <button type="button" class="tb-btn tb-code" title="代码块">代码块</button>
      <button type="button" class="tb-btn tb-link" title="插入链接">链接</button>
      <button type="button" class="tb-btn tb-clear" title="清除格式">清除格式</button>
      <span class="tb-sep"></span>
      <button type="button" class="tb-btn" data-cmd="undo" title="撤销">撤销</button>
      <button type="button" class="tb-btn" data-cmd="redo" title="重做">重做</button>
      <span class="spacer"></span>
      <div class="mode-switch">
        <button type="button" data-mode="rich" class="active">富文本</button>
        <button type="button" data-mode="md">Markdown</button>
      </div>
    </div>
    <div class="rich-editor" contenteditable="true" spellcheck="false" data-placeholder="在这里写作，像 Word 一样直接排版…"></div>
    <textarea class="body-input hidden" spellcheck="false" placeholder="Markdown 源码"></textarea>
  `

  const editor = host.querySelector('.rich-editor')
  const textarea = host.querySelector('.body-input')
  const toolbar = host.querySelector('.format-toolbar')
  const blockSelect = host.querySelector('.tb-block')
  const sizeSelect = host.querySelector('.tb-size')
  const colorWrap = host.querySelector('.color-wrap')
  const colorMenu = host.querySelector('.color-menu')
  const modeBtns = Array.from(host.querySelectorAll('.mode-switch button'))

  let mode = 'rich'
  let savedRange = null

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange()
  }

  function restoreSelection() {
    editor.focus()
    if (!savedRange) return
    try {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedRange)
    } catch (e) { /* ignore */ }
  }

  function exec(cmd, value) {
    restoreSelection()
    document.execCommand(cmd, false, value)
    saveSelection()
    editor.focus()
  }

  function wrapStyle(apply) {
    restoreSelection()
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (range.collapsed) return

    const span = document.createElement('span')
    apply(span)
    try {
      range.surroundContents(span)
    } catch (e) {
      span.appendChild(range.extractContents())
      range.insertNode(span)
    }
    const r = document.createRange()
    r.selectNodeContents(span)
    sel.removeAllRanges()
    sel.addRange(r)
    savedRange = r.cloneRange()
    editor.focus()
  }

  function insertHtml(html) {
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    saveSelection()
    editor.focus()
  }

  function clearFormat() {
    restoreSelection()
    document.execCommand('removeFormat')
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const root = range.commonAncestorContainer.nodeType === 1
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement
    if (!root) return
    const spans = Array.from(root.querySelectorAll('span'))
    if (root.tagName === 'SPAN') spans.unshift(root)
    spans.forEach((span) => {
      try {
        if (range.intersectsNode(span)) span.replaceWith(...Array.from(span.childNodes))
      } catch (e) { /* ignore */ }
    })
    editor.focus()
  }

  /* 工具栏按钮：阻止 mousedown 抢走选区 */
  toolbar.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault())
  })

  toolbar.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => exec(btn.dataset.cmd))
  })

  blockSelect.addEventListener('change', () => {
    exec('formatBlock', blockSelect.value)
    blockSelect.value = 'p'
  })

  sizeSelect.addEventListener('change', () => {
    const px = sizeSelect.value
    sizeSelect.value = ''
    if (!px) return
    wrapStyle((span) => { span.style.fontSize = px + 'px' })
  })

  host.querySelector('.tb-color').addEventListener('click', (e) => {
    e.stopPropagation()
    colorMenu.classList.toggle('show')
  })

  colorMenu.querySelectorAll('[data-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      wrapStyle((span) => { span.style.color = btn.dataset.color })
      colorMenu.classList.remove('show')
    })
  })

  host.querySelector('.tb-emdot').addEventListener('click', () => {
    wrapStyle((span) => { span.className = 'em-dot' })
  })

  host.querySelector('.tb-quote').addEventListener('click', () => exec('formatBlock', 'blockquote'))

  host.querySelector('.tb-link').addEventListener('click', () => {
    const url = prompt('链接地址：', 'https://')
    if (!url) return
    restoreSelection()
    const sel = window.getSelection()
    if (sel && sel.isCollapsed) {
      insertHtml(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`)
    } else {
      exec('createLink', url)
    }
  })

  host.querySelector('.tb-code').addEventListener('click', () => {
    restoreSelection()
    const sel = window.getSelection()
    const text = sel && !sel.isCollapsed ? sel.toString() : '代码'
    insertHtml(`<pre><code>${escapeHtml(text)}</code></pre><p><br></p>`)
  })

  host.querySelector('.tb-clear').addEventListener('click', clearFormat)

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode).catch((e) => toast(e.message, true)))
  })

  async function setMode(next) {
    if (next === mode) return
    if (next === 'md') {
      const res = await api('/api/markdown', {
        method: 'POST',
        body: JSON.stringify({ html: editor.innerHTML })
      })
      textarea.value = res.markdown
      editor.classList.add('hidden')
      textarea.classList.remove('hidden')
    } else {
      const res = await api('/api/render', {
        method: 'POST',
        body: JSON.stringify({ markdown: textarea.value })
      })
      editor.innerHTML = res.html
      editor.classList.remove('hidden')
      textarea.classList.add('hidden')
    }
    mode = next
    toolbar.classList.toggle('md-mode', mode === 'md')
    modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode))
  }

  editor.addEventListener('keyup', saveSelection)
  editor.addEventListener('mouseup', saveSelection)
  editor.addEventListener('input', saveSelection)

  document.addEventListener('selectionchange', () => {
    if (document.activeElement !== editor) return
    saveSelection()
    toolbar.querySelectorAll('[data-cmd]').forEach((btn) => {
      if (!['bold', 'italic', 'underline', 'strikeThrough'].includes(btn.dataset.cmd)) return
      let active = false
      try { active = document.queryCommandState(btn.dataset.cmd) } catch (e) { /* ignore */ }
      btn.classList.toggle('active', active)
    })
  })

  document.addEventListener('click', (e) => {
    if (!colorWrap.contains(e.target)) colorMenu.classList.remove('show')
  })

  return {
    host,
    editor,
    textarea,
    getMode: () => mode,
    focus: () => editor.focus(),
    setContent(html, markdown) {
      editor.innerHTML = html || ''
      textarea.value = markdown || ''
    },
    getPayload() {
      return mode === 'rich' ? { html: editor.innerHTML } : { body: textarea.value }
    },
    setMarkdown(md) {
      textarea.value = md || ''
    },
    insertImage(html, md) {
      if (mode === 'rich') {
        insertHtml(html)
      } else {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        textarea.value = textarea.value.slice(0, start) + md + textarea.value.slice(end)
        textarea.selectionStart = textarea.selectionEnd = start + md.length
        textarea.focus()
      }
    }
  }
}

const postEditor = createRichEditor($('#editor-body-post'))
const pageEditor = createRichEditor($('#editor-body-page'))

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

function itemUrl(name) {
  return '/api/posts/' + encodeURIComponent(name) + '?kind=' + kind
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

  $('#editor-empty').classList.add('hidden')
  $('#editor').classList.remove('hidden')
  $('#current-file').textContent = current.name + (kind === 'draft' ? '（草稿）' : '')
  $('#f-title').value = currentData.title || ''
  $('#f-date').value = toInputValue(currentData.date)
  $('#f-categories').value = (Array.isArray(currentData.categories) ? currentData.categories : []).join(', ')
  $('#f-tags').value = (Array.isArray(currentData.tags) ? currentData.tags : []).join(', ')
  $('#f-mathjax').checked = currentData.mathjax === true
  $('#btn-publish').classList.toggle('hidden', kind !== 'draft')
  updateScheduleHint()
  postEditor.setContent(data.html, data.body)
  renderList()
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
      body: JSON.stringify(Object.assign({ data }, postEditor.getPayload()))
    })
    currentData = data
    if (res.markdown !== undefined) {
      current.body = res.markdown
      postEditor.setMarkdown(res.markdown)
    }
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
    await api(itemUrl(current.name), {
      method: 'PUT',
      body: JSON.stringify(Object.assign({ data: collectData() }, postEditor.getPayload()))
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
  pageEditor.setContent(data.html, data.body)
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
      body: JSON.stringify(Object.assign({ data }, pageEditor.getPayload()))
    })
    currentPage.data = data
    toast('页面已保存')
    await loadPages()
  } catch (e) {
    toast(e.message, true)
  } finally {
    btn.disabled = false
  }
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

function insertImage(file, editor) {
  return uploadFile(file).then((res) => {
    const alt = escapeHtml(file.name)
    editor.insertImage(
      `<img src="${res.url}" alt="${alt}">`,
      `![${file.name}](${res.url})`
    )
    toast('图片已上传')
  })
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
$('#btn-upload').addEventListener('click', () => $('#file-input').click())
$('#btn-save-settings').addEventListener('click', saveSettings)
$('#btn-build').addEventListener('click', buildSite)
$('#btn-page-save').addEventListener('click', savePage)
$('#btn-upload-media').addEventListener('click', () => $('#file-input-media').click())
$('#f-date').addEventListener('input', updateScheduleHint)

$('#settings-target').addEventListener('change', () => {
  $('#settings-text').value = settingsCache[$('#settings-target').value] || ''
})

$('#file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    await insertImage(file, postEditor)
  } catch (err) {
    toast(err.message, true)
  }
})

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
