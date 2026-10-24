# my-blog

Hexo 8 + Chic 主题的个人博客，带本地 / 在线两套管理后台，部署到 GitHub Pages。

**完整文档见 [DOCS.md](DOCS.md)**（文件构成、依赖说明、后台使用、部署步骤、故障排查）。

## 三个双击即可用的文件

| 文件 | 作用 |
| --- | --- |
| `start-admin.bat` | 启动本地管理后台 → http://localhost:5001 |
| `start-preview.bat` | 启动前台预览 → http://localhost:4000 |
| `build-site.bat` | 生成静态网站到 `public/` |

## 常用命令

```powershell
cd Y:\my-blog

npm run admin                 # 本地后台
npx hexo server               # 前台预览
npx hexo new post "标题"       # 新建文章
npx hexo clean                # 清缓存
npx hexo generate             # 生成 public/
```

## 目录速览

```
_config.yml        站点配置
source/            文章与页面源文件
themes/Chic/       主题（主题配置在这个目录的 _config.yml）
admin/             本地管理后台
admin-online/      在线管理后台（单 HTML）
public/            生成的静态网站，部署时上传这里面的内容
DOCS.md            完整使用文档
```

## 部署（GitHub Actions 自动构建，已启用）

1. 把源码推送/上传到仓库 `Ma8967/Ma8967.github.io`（**不要**上传 `public/` 和 `node_modules/`）
2. 仓库 Settings → Pages → Source 选 **GitHub Actions**
3. 之后每次 push 自动构建发布，访问 https://ma8967.github.io

`_config.yml` 里的 `url` 已设为 `https://Ma8967.github.io`，`root` 为 `/`。

详细步骤、后台 Token 配置、故障排查，见 [DOCS.md](DOCS.md)。
