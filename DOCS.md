# 博客完整使用文档

> Hexo 8.1.2 + Chic 主题 + 两套管理后台，部署目标：GitHub Pages（`用户名.github.io`）。
> 本文档覆盖：文件构成、依赖清单、日常写作、两套后台、部署上线、配置修改、故障排查。

---

## 目录

1. [项目概览](#1-项目概览)
2. [环境要求](#2-环境要求)
3. [文件构成](#3-文件构成)
4. [依赖清单](#4-依赖清单)
5. [快速开始](#5-快速开始)
6. [写文章](#6-写文章)
7. [本地管理后台](#7-本地管理后台)
8. [在线管理后台](#8-在线管理后台)
9. [部署到 GitHub Pages](#9-部署到-github-pages)
10. [配置说明](#10-配置说明)
11. [备份与迁移](#11-备份与迁移)
12. [常见问题](#12-常见问题)
13. [命令速查](#13-命令速查)

---

## 1. 项目概览

| 项目 | 说明 |
| --- | --- |
| 站点根目录 | `Y:\my-blog` |
| 生成框架 | Hexo 8.1.2 |
| 主题 | Chic 1.0.5（EJS 模板 + Stylus 样式） |
| 文章格式 | Markdown + YAML front-matter |
| 前台预览 | http://localhost:4000 |
| 本地后台 | http://localhost:5001 |
| 构建产物 | `public/` |
| 部署目标 | GitHub Pages 用户主页 `https://用户名.github.io` |

**设计原则：后台与前台解耦。** 两套后台都放在 `source/` 之外，Hexo 构建时不会把它们打进 `public/`，前台始终是纯静态页面。

---

## 2. 环境要求

| 项目 | 要求 | 当前机器 |
| --- | --- | --- |
| 操作系统 | Windows 10 / 11 | Windows 10 Pro 19045 |
| Node.js | >= 20.19（Hexo 8 的要求） | v24.21.0 |
| npm | 随 Node 安装 | 已安装 |
| 浏览器 | Chrome / Edge / Firefox 现代版本 | — |
| 磁盘 | 约 100 MB（含依赖） | — |
| 端口 | 4000（前台）、5001（后台） | — |

依赖已经安装在本目录的 `node_modules/`（约 47 MB），日常使用不需要再联网安装。

---

## 3. 文件构成

### 3.1 完整目录树

```
Y:\my-blog
│
├─ _config.yml                  站点总配置（标题、作者、URL、主题名）
├─ package.json                 依赖清单 + 命令脚本
├─ package-lock.json            依赖锁定文件（保证换机器后版本一致）
├─ .gitignore                   Git 忽略规则
├─ README.md                    快速开始（简版）
├─ DOCS.md                      本文档（完整版）
├─ start-admin.bat              双击启动本地后台
├─ start-preview.bat            双击启动前台预览
├─ build-site.bat               双击生成静态网站
│
├─ source/                      站点内容源（前台数据的唯一来源）
│  ├─ _posts/                   文章目录
│  │  └─ hello-world.md         示例文章
│  ├─ images/                   图片素材（正文引用 /images/xxx.png）
│  ├─ about/index.md            关于页
│  ├─ tag/index.md              标签总览页（layout: tag）
│  └─ category/index.md         分类总览页（layout: category）
│
├─ themes/
│  └─ Chic/                     主题本体
│     ├─ _config.yml            主题配置（个人信息、导航、社交图标）
│     ├─ layout/                EJS 模板
│     │  ├─ layout.ejs          总布局
│     │  ├─ index.ejs           首页
│     │  ├─ post.ejs            文章页
│     │  ├─ page.ejs            独立页面
│     │  ├─ archive.ejs         归档页
│     │  ├─ tag.ejs             标签页
│     │  ├─ category.ejs        分类页
│     │  ├─ _partial/           头部、底部、分页、目录等片段
│     │  ├─ _page/              各类页面的内部模板
│     │  └─ _plugins/           MathJax 引入片段
│     ├─ source/
│     │  ├─ css/                Stylus 样式源码
│     │  │  ├─ style.styl       总入口
│     │  │  ├─ variable.styl    颜色、字体等变量
│     │  │  ├─ custom.styl      自定义样式（推荐写这里）
│     │  │  ├─ _highlight/      代码高亮配色方案
│     │  │  ├─ _lib/ _page/ _partial/   分模块样式
│     │  ├─ js/                 script.js、tocbot、mathjax
│     │  ├─ fonts/              图标字体、Lanting 字体
│     │  └─ image/avatar.jpeg   默认头像（换成自己的）
│     ├─ languages/             多语言文案（zh-CN.yml 等）
│     └─ scripts/               主题自带的 Hexo 脚本
│
├─ admin/                       本地管理后台（Node 服务，不进入 public）
│  ├─ server.js                 Express 服务，提供 API
│  └─ public/
│     ├─ index.html             后台界面
│     ├─ app.js                 前端逻辑
│     └─ style.css              后台样式
│
├─ admin-online/
│  └─ index.html                在线管理后台（单文件，通过 GitHub API 工作）
│
├─ deploy-optional/
│  └─ deploy.yml                GitHub Actions 模板（默认不生效）
│
├─ scripts/
│  └─ nojekyll.js               构建后自动写入 .nojekyll
│
├─ scaffolds/                   新建内容时的模板
│  ├─ post.md  page.md  draft.md
│
├─ node_modules/                已安装的依赖（47 MB，不要上传 GitHub）
├─ public/                      构建产物（上传 GitHub 的就是这里面的内容）
├─ db.json                      Hexo 缓存（可删除，会自动重建）
└─ .trash/                      后台删除文章的回收站
```

### 3.2 各类文件是否要上传 GitHub

| 路径 | 作用 | 上传 GitHub？ |
| --- | --- | --- |
| `public/` 内容 | 最终静态网站 | ✅ 手动部署时必须上传 |
| `source/` | 文章和页面源文件 | ⭕ 只在上线后台 / 用 Actions 时需要 |
| `themes/Chic/` | 主题 | ⭕ 同上 |
| `_config.yml` | 站点配置 | ⭕ 同上 |
| `package.json` / `package-lock.json` | 依赖声明 | ⭕ 用 Actions 时需要 |
| `admin/`、`admin-online/` | 两套后台 | ❌ 不需要（本地使用） |
| `node_modules/` | 依赖本体 | ❌ 绝对不要上传 |
| `public/` 文件夹本身 | 构建产物 | ❌ 只传内容，不传文件夹 |
| `db.json`、`.trash/` | 缓存和回收站 | ❌ 不需要 |

> 原来的下载目录 `Y:\hexo-theme-Chic-1.0.5` 已不再需要，主题已完整复制到 `Y:\my-blog\themes\Chic`，可以删除或留作备份。

### 3.3 哪些文件可以放心改

| 想改什么 | 改哪里 |
| --- | --- |
| 站点标题、作者、域名 | `_config.yml` |
| 侧栏昵称、简介、头像 | `themes/Chic/_config.yml` |
| 导航菜单、社交图标 | `themes/Chic/_config.yml` 的 `nav` / `links` |
| 文章 | `source/_posts/*.md` 或后台 |
| 图片 | `source/images/` |
| 自定义 CSS | `themes/Chic/source/css/custom.styl` |
| 主题配色变量 | `themes/Chic/source/css/variable.styl` |
| 代码高亮配色 | `themes/Chic/source/css/style.styl` |
| 独立页面 | `source/<页面名>/index.md` |

---

## 4. 依赖清单

### 4.1 已安装的核心依赖

| 包 | 版本 | 用途 |
| --- | --- | --- |
| `hexo` | 8.1.2 | 静态站点生成框架 |
| `hexo-renderer-ejs` | 2.0.0 | 渲染主题的 EJS 模板 |
| `hexo-renderer-stylus` | 3.0.1 | 编译 Stylus 样式 |
| `hexo-renderer-marked` | 7.0.1 | 把 Markdown 渲染成 HTML |
| `hexo-generator-index` | 4.0.0 | 生成首页 |
| `hexo-generator-archive` | 2.0.0 | 生成归档页 `/archives/` |
| `hexo-generator-category` | 2.0.0 | 生成分类页 `/categories/xxx/` |
| `hexo-generator-tag` | 2.0.0 | 生成标签页 `/tags/xxx/` |
| `hexo-server` | 3.0.0 | 本地预览服务器 |
| `express` | 5.3.0 | 本地管理后台的 Web 服务 |
| `js-yaml` | 4.3.2 | 解析 / 生成 front-matter 和配置 |
| `marked` | 18.1.1 | 本地后台的 Markdown 实时预览 |

### 4.2 依赖的安装与恢复

```powershell
cd Y:\my-blog

# 已安装过，正常不需要执行
npm install

# 换机器 / 删了 node_modules 后，按锁定版本精确恢复
npm ci
```

`npm ci` 会严格按 `package-lock.json` 安装，最适合迁移。

### 4.3 安装新依赖

```powershell
cd Y:\my-blog
npm install 包名
```

新增的包会自动写进 `package.json` 和 `package-lock.json`，下次 `npm ci` 能还原。

### 4.4 依赖与主题的对应关系

- **必须保留**：`hexo-renderer-ejs`（没有它主题模板报错）、`hexo-renderer-stylus`（没有它 `style.css` 不会生成，页面全裸）
- **必须保留**：四个 generator（没有它们首页 / 归档 / 分类 / 标签页不会生成）
- **只影响后台**：`express`、`js-yaml`、`marked`，删掉后前台仍正常，但 `npm run admin` 会失败

---

## 5. 快速开始

### 5.1 双击运行（推荐）

| 文件 | 作用 | 地址 |
| --- | --- | --- |
| `start-admin.bat` | 启动本地管理后台 | http://localhost:5001 |
| `start-preview.bat` | 启动前台预览 | http://localhost:4000 |
| `build-site.bat` | 清理并生成静态网站 | 输出到 `public/` |

两个服务可以同时开，端口不冲突。关闭黑窗口即停止服务。

### 5.2 命令行运行

```powershell
cd Y:\my-blog

npm run admin       # 本地后台 → 5001
npx hexo server     # 前台预览 → 4000
npx hexo generate   # 生成 public/
npx hexo clean      # 清理缓存
```

### 5.3 第一次使用建议顺序

1. 改 `_config.yml` 的 `title`、`author`、`url`
2. 改 `themes/Chic/_config.yml` 的 `navname`、`nickname`、`description`
3. 换头像 `themes/Chic/source/image/avatar.jpeg`
4. 打开后台写第一篇文章
5. 生成并上传

---

## 6. 写文章

### 6.1 通过后台写（推荐）

打开 http://localhost:5001 → 「文章」→「新建」→ 填标题和正文 → 「保存」。

### 6.2 通过命令行写

```powershell
cd Y:\my-blog
npx hexo new post "文章标题"
```

生成 `source/_posts/文章标题.md`，用任意编辑器打开填写。

### 6.3 front-matter 字段

```yaml
---
title: 文章标题              # 必填
date: 2026-10-24 10:00:00    # 建议填，不填会用当前时间
categories:                  # 分类，可多个
  - 随笔
tags:                        # 标签，可多个
  - Hexo
  - 教程
mathjax: true                # 可选：本文需要数学公式时加上
---
```

- 日期写成 `YYYY-MM-DD HH:mm:ss`，**不要带时区**，否则显示会偏移
- 分类和标签可以写成行内数组：`categories: [随笔, 教程]`
- 同一篇文章可以属于多个分类，但一般建议只用一个主分类

### 6.4 数学公式

主题默认按需加载 MathJax：

1. 在文章 front-matter 加 `mathjax: true`
2. 行内公式用 `$...$`，块公式用 `$$...$$`

### 6.5 插入图片

1. 把图片放进 `source/images/`
2. 正文引用：

```markdown
![图片说明](/images/photo.png)
```

后台里可以直接点「插入图片」，自动上传并插入正确的路径。

**路径必须以 `/` 开头**，不要用 `images/photo.png` 这种相对路径，否则子目录部署会 404。

### 6.6 图片标题（可选）

Chic 主题支持 Hexo 的图片标签，会在图片下方显示标题：

```markdown
{% img /images/photo.png 400 300 '"加载失败提示" "图片下方标题"' %}
```

---

## 7. 本地管理后台

### 7.1 启动

双击 `start-admin.bat`，或：

```powershell
cd Y:\my-blog
npm run admin
```

打开 http://localhost:5001

### 7.2 功能说明

**文章**

- 左侧列表按日期倒序，支持搜索标题 / 文件名 / 分类
- 编辑标题、日期、分类、标签、MathJax 开关、正文
- 「预览」分屏实时渲染 Markdown
- 「保存」写回 `source/_posts/文章标题.md`
- 「删除」把文件移到 `.trash/`，不会真正删除
- `Ctrl + S` 快捷保存
- 保留你在 front-matter 里手写的其他字段（如 `comments: false`）

**图片**

- 上传到 `source/images/`
- 点击图片复制 `![名称](/images/xxx.png)`
- 删除同样移到 `.trash/`
- 支持多选上传

**设置**

- 直接编辑 `_config.yml`（站点）和 `themes/Chic/_config.yml`（主题）
- 保存前校验 YAML，写错会拒绝保存，不会把站点弄坏
- 保留注释，不会把配置重排成机器格式

**构建**

- 一键执行 `hexo generate`
- 显示完整日志和耗时

### 7.3 安全说明

- 服务只监听 `127.0.0.1`，同一局域网的其它设备也访问不到
- 不需要密码，因为它只操作本机文件
- 不要把 `admin/` 部署到公网服务器

### 7.4 后台用到的接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/posts` | 文章列表 |
| GET | `/api/posts/:name` | 读取单篇 |
| POST | `/api/posts` | 新建 |
| PUT | `/api/posts/:name` | 保存 |
| DELETE | `/api/posts/:name` | 删除（进回收站） |
| GET | `/api/images` | 图片列表 |
| POST | `/api/upload` | 上传图片 |
| DELETE | `/api/images/:name` | 删除图片 |
| GET / PUT | `/api/settings` | 读取 / 保存配置 |
| POST | `/api/preview` | Markdown 预览 |
| POST | `/api/build` | 构建站点 |
| GET | `/api/status` | 运行状态 |

### 7.5 修改后台端口

```powershell
$env:ADMIN_PORT = "5002"
npm run admin
```

---

## 8. 在线管理后台

### 8.1 原理

`admin-online/index.html` 是一个纯静态单文件，不依赖服务器。它在浏览器里用 GitHub API 直接读写仓库中的 Markdown 文件，改动以 commit 形式提交。

适合：手机、平板、别人的电脑上临时改文章。
不适合：日常写作（本地后台更快、更安全）。

### 8.2 创建 GitHub Token

1. 登录 GitHub → 右上角头像 → **Settings**
2. 左侧最下方 → **Developer settings**
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
4. 填写：
   - Token name：`blog-admin`
   - Expiration：按需选择（建议 90 天）
   - Repository access：**Only select repositories** → 选中你的博客仓库
   - Permissions → Repository permissions → **Contents** → 选 **Read and write**
5. 生成后复制 Token（只显示一次）

### 8.3 使用

1. 双击 `admin-online/index.html`
2. 填写：
   - GitHub 用户名
   - 仓库名（默认 `用户名.github.io`）
   - 分支（默认 `main`）
   - Token
3. 点「连接」
4. 左侧选文章或点「新建」，右侧编辑，点「保存到仓库」
5. 「插入图片」会上传到仓库的 `source/images/`

Token 保存在浏览器 localStorage，公用电脑使用后点「清除」。

### 8.4 两个必须知道的限制

**限制一：仓库里必须有 `source/_posts` 目录**

在线后台编辑的是 Markdown 源文件。如果你只上传了 `public/` 里的 HTML，仓库里没有源文件，后台会提示目录不存在。这种情况请用本地后台。

**限制二：提交后不会自动生成网页**

它只提交源文件，GitHub Pages 上显示的仍是上次生成的 HTML。要让改动上线，二选一：

- 本地拉取源文件 → `npx hexo generate` → 重新上传 `public/`
- 启用 GitHub Actions 自动构建（见 9.7）

### 8.5 托管在线后台（可选）

单文件可以放在任何静态位置：

- 直接双击本地打开（最简单）
- 放到独立的 GitHub 仓库并开启 Pages（`https://用户名.github.io/blog-admin/`）
- 上传到 Netlify / Vercel / Cloudflare Pages

**不要**放进博客仓库的 `public/`，那会把后台暴露在公开站点上（虽然没 Token 也操作不了，但没有必要）。

---

## 9. 部署到 GitHub Pages

### 9.1 部署前必改

打开 `Y:\my-blog\_config.yml`：

```yaml
url: https://你的用户名.github.io
root: /
```

- `用户名.github.io` 这种**根仓库**：`root: /`
- `用户名.github.io/仓库名/` 这种**项目仓库**：`root: /仓库名/`

`root` 填错会导致 CSS、头像、图片全部 404。

### 9.2 生成静态文件

双击 `build-site.bat`，或：

```powershell
cd Y:\my-blog
npx hexo clean
npx hexo generate
```

成功的标志是最后一行类似：

```
INFO  39 files generated in 120 ms
```

产物在 `public/`，根目录应包含：

```
index.html   archives/   categories/   tags/   about/
css/   js/   fonts/   image/   favicon.ico   .nojekyll
```

### 9.3 创建仓库

1. GitHub 右上角 **+** → **New repository**
2. Repository name 填 `你的用户名.github.io`
   - 例如用户名是 `zhangsan`，仓库名就必须是 `zhangsan.github.io`
3. 选择 **Public**
4. 不要勾选初始化 README / .gitignore
5. 创建

### 9.4 上传静态文件（网页方式）

1. 打开仓库首页 → **Add file** → **Upload files**
2. 打开 `Y:\my-blog\public` 文件夹，`Ctrl+A` 全选**里面的内容**（不是 public 文件夹本身）
3. 拖进上传框
4. Commit changes

**注意**：

- 如果拖入后显示的是一个 `public` 子文件夹，说明你拖错层级了，删掉重来
- 仓库根目录应该是 `index.html`，而不是 `public/index.html`
- `.nojekyll` 是隐藏文件，Windows 资源管理器默认不显示。如果漏了，在仓库根目录 **Add file → Create new file**，文件名填 `.nojekyll`，内容留空即可

### 9.5 开启 Pages

1. 仓库 **Settings** → 左侧 **Pages**
2. **Source** 选 `Deploy from a branch`
3. Branch 选 `main`，目录选 `/ (root)`
4. **Save**
5. 等 1～2 分钟，页面顶部会显示站点地址

访问 `https://你的用户名.github.io`。

### 9.6 更新文章

每次更新重复：

```powershell
cd Y:\my-blog
npx hexo clean
npx hexo generate
```

然后把 `public/` 里的内容重新上传，覆盖旧文件。

GitHub 网页上传同名文件会自动覆盖。

### 9.7 可选的自动构建（GitHub Actions）

如果嫌手动上传麻烦，或者想让**在线后台提交即上线**：

1. 工作流已启用：`Y:\my-blog\.github\workflows\deploy.yml`
2. 仓库 Settings → Pages → Source 改选 **GitHub Actions**
3. 把整个项目源码推到仓库（`public/` 和 `node_modules/` 已被 `.gitignore` 排除，不会上传）
4. 之后每次 push 自动构建并发布

```powershell
cd Y:\my-blog
git init
git add .
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/你的用户名/你的用户名.github.io.git
git push -u origin main
```

**不要混用两种方式**：

- 启用 Actions 后不要再手动上传 `public/`，两边会互相覆盖
- 如果仓库里之前用网页上传过 `public` 的 HTML，先把仓库清空再推源码，否则 HTML 和源码混在根目录
- 仓库里应当只有源码：`source/`、`themes/`、`_config.yml`、`package.json` 等，不应该有 `index.html`

### 9.8 三种部署方式对比

| 方式 | 仓库内容 | 在线后台 | 更新方式 | 适合 |
| --- | --- | --- | --- | --- |
| A. 网页上传 `public` | 纯静态页面 | ❌ 无源文件 | 重新上传 | 最简单，偶尔更新 |
| B. Git 推送 `public` | 纯静态页面 | ❌ | 命令行 push | 熟悉 Git，频繁更新 |
| C. GitHub Actions | 源码 | ✅ | 提交即上线 | 想用在线后台 |

> 方式 B：在 `public/` 目录里单独 `git init` 并强制推送。注意这会覆盖仓库原有内容。

### 9.9 绑定自定义域名（可选）

1. 域名 DNS 添加 CNAME 记录指向 `你的用户名.github.io`
2. 仓库 Settings → Pages → Custom domain 填写域名
3. 修改 `_config.yml`：

```yaml
url: https://你的域名.com
root: /
```

4. 重新生成并上传；或把域名写进 `source/CNAME`（内容只有一行域名），Hexo 会把它生成到 `public/CNAME`

---

## 10. 配置说明

### 10.1 站点配置 `_config.yml`

```yaml
title: 我的博客             # 浏览器标签页 / 页面标题
subtitle: ''
description: ''             # SEO 描述
author: 你的名字            # 页脚版权显示
language: zh-CN             # 语言
timezone: 'Asia/Shanghai'   # 时区，影响日期显示

url: https://用户名.github.io   # 部署地址
root: /                     # 根目录，项目仓库要改成 /仓库名/
permalink: :year/:month/:day/:title/   # 文章 URL 结构
theme: Chic                 # 主题名，不要改

deploy:
  type: ''                  # 手动上传时保持为空
```

### 10.2 主题配置 `themes/Chic/_config.yml`

```yaml
navname: 我的博客           # 左上角站点名

nav:                        # 顶部导航
  Posts: /archives
  Categories: /category
  Tags: /tag
  About: /about

nickname: 你的名字          # 侧栏名字

description: "这里是 **我的个人博客**。"   # 侧栏简介，支持 Markdown

avatar: /image/avatar.jpeg  # 侧栏头像

links:                      # 侧栏社交图标（键名是图标名，不要自造）
  Blog: /archives
  # Github: https://github.com/yourname
  # Weibo: https://weibo.com/yourname
  # ZhiHu: https://www.zhihu.com/people/yourname

post_toc_enable: true       # 文章目录
post_copyright_enable: true # 文章版权声明
mathjax:
  enable: true
  import: demand            # demand=按需加载，推荐
```

可用的 `links` 键名（不完整列表）：`Blog`、`Category`、`Tags`、`Link`、`Resume`、`Publish`、`Trophy`、`Gallery`、`RSS`、`AliPay`、`ZhiHu`、`LinkedIn`、`FaceBook`、`Twitter`、`Skype`、`CodeSandBox`、`CodePen`、`Sketch`、`Gitlab`、`Dribbble`、`Instagram`、`Reddit`、`YouTube`、`QQ`、`Weibo`、`WeChat`、`Github`。

### 10.3 换头像

把图片放到 `themes/Chic/source/image/`，例如 `me.jpg`，然后改：

```yaml
avatar: /image/me.jpg
```

建议正方形，200×200 以上。

### 10.4 改主题色 / 字体

`themes/Chic/source/css/variable.styl` 里集中定义了颜色和字体变量，改完重新生成即可。

### 10.5 添加自定义页面

```powershell
npx hexo new page "links"
```

在 `source/links/index.md` 的 front-matter 写：

```yaml
---
title: 友情链接
date: 2026-10-24 10:00:00
---
```

再在主题配置的 `nav` 里加一行 `Links: /links`。

### 10.6 修改主题后清缓存

改 `_config.yml`、主题配置或样式后：

```powershell
npx hexo clean
npx hexo generate
```

---

## 11. 备份与迁移

### 11.1 备份什么

必须备份：

```
_config.yml
package.json
package-lock.json
source/
themes/
admin/
admin-online/
scripts/
scaffolds/
```

可以不备份（能重新生成）：

```
node_modules/     npm ci 可恢复
public/           hexo generate 可恢复
db.json           缓存
.trash/           回收站
```

### 11.2 迁移到另一台电脑

1. 复制整个 `my-blog` 文件夹（可以排除 `node_modules`、`public`、`db.json`）
2. 安装 Node.js 20.19+
3. 进入目录执行：

```powershell
npm ci
npx hexo generate
```

4. 双击 `start-admin.bat` 继续写文章

### 11.3 完整打包（含依赖）

如果目标机器不能联网，把 `node_modules` 一起复制即可，Node 版本保持一致。

---

## 12. 常见问题

**Q1：页面能打开，但样式全丢、头像 404**

`_config.yml` 的 `root` 不对。

- `用户名.github.io` → `root: /`
- `用户名.github.io/仓库名/` → `root: /仓库名/`

改完执行 `npx hexo clean && npx hexo generate`，重新上传。

**Q2：上传后首页 404**

仓库根目录里应该直接是 `index.html`。如果你看到的是一个 `public` 文件夹，说明整层拖进去了，需要把里面的内容移到根目录。

**Q3：改了配置不生效**

```powershell
npx hexo clean
npx hexo generate
```

**Q4：文章日期显示差 8 小时**

front-matter 里的日期不要带 `Z` 或时区：

```yaml
date: 2026-10-24 10:00:00     # ✅
date: 2026-10-24T10:00:00Z   # ❌ 会按 UTC 处理
```

**Q5：`npx hexo` 只显示 help、init、version 三个命令**

说明 Hexo 没认出这是站点目录。检查 `package.json` 里是否有：

```json
"hexo": { "version": "8.1.2" }
```

**Q6：`hexo generate` 报 Cannot find module**

依赖缺失，执行：

```powershell
npm ci
```

**Q7：4000 或 5001 端口被占用**

```powershell
npx hexo server -p 4001        # 前台换端口
$env:ADMIN_PORT="5002"; npm run admin   # 后台换端口
```

**Q8：误删了文章**

去 `Y:\my-blog\.trash\` 找对应 `.bak` 文件，重命名回 `.md` 放回 `source/_posts/`。

**Q9：在线后台提示 `source/_posts` 不存在**

仓库里只有 `public` 的静态文件。在线后台需要 Markdown 源文件，请改用本地后台；或按 9.7 把源码推到仓库。

**Q10：上传后中文标签页 404**

GitHub Pages 支持中文路径，但需要 URL 编码。确认上传时目录名没有被改动，且 `root` 配置正确。浏览器地址栏里中文会显示为 `%E4%B8%AD%E6%96%87` 属于正常现象。

**Q11：想升级 Hexo**

先备份 `themes/Chic` 和你的配置，再执行：

```powershell
npm install hexo@latest
npx hexo clean
npx hexo generate
```

主题较老（2019 年），大版本升级后请检查所有页面是否正常。

**Q12：后台保存配置报错**

YAML 语法错误，比如用了 Tab 缩进、冒号后缺空格。YAML 只能用空格缩进，冒号后必须有一个空格。

---

## 13. 命令速查

```powershell
cd Y:\my-blog

# 启动
npm run admin                 # 后台 http://localhost:5001
npx hexo server               # 前台 http://localhost:4000

# 写作
npx hexo new post "标题"       # 新文章
npx hexo new page "页面名"     # 新页面

# 构建
npx hexo clean                # 清缓存
npx hexo generate             # 生成 public/

# 依赖
npm ci                        # 按 lock 恢复依赖
npm install                   # 安装 package.json 里的依赖
npm ls --depth=0              # 查看已安装依赖
```

| 地址 | 用途 |
| --- | --- |
| http://localhost:4000 | 前台预览 |
| http://localhost:5001 | 本地管理后台 |
| https://用户名.github.io | 线上站点 |

---

*文档基于 2026-10-24 的项目状态编写。*
