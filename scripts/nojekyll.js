'use strict'

/**
 * GitHub Pages 默认会用 Jekyll 处理仓库内容，Jekyll 会忽略以下划线开头的目录/文件，
 * 并且可能篡改 Markdown。生成完成后在 public/ 里放一个空 .nojekyll 即可关闭。
 */
const fs = require('fs')
const path = require('path')

hexo.extend.filter.register('after_generate', () => {
  try {
    fs.mkdirSync(hexo.public_dir, { recursive: true })
    fs.writeFileSync(path.join(hexo.public_dir, '.nojekyll'), '')
  } catch (e) {
    hexo.log.warn('写入 .nojekyll 失败：' + e.message)
  }
})
