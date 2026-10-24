'use strict'

/**
 * hexo-generator-index 在没有任何文章时不会生成首页，导致站点根目录 404。
 * 这里补一个兜底：只有一篇文章都没有时才接管 index.html，
 * 渲染主题的 index 布局（侧栏头像 + 昵称 + 简介）。
 * 一旦有文章，hexo-generator-index 正常工作，本生成器不介入。
 */
hexo.extend.generator.register('empty-home', function (locals) {
  if (locals.posts.length > 0) return

  return {
    path: 'index.html',
    layout: 'index',
    data: {
      __index: true,
      title: '',
      posts: []
    }
  }
})
