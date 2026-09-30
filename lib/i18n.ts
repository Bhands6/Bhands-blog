import type { Lang } from "./posts";

export const dictionaries = {
  zh: {
    nav: { blog: "博客", archives: "归档", search: "搜索", about: "关于" },
    landing: {
      tagline: "游戏开发 · 生活 · 随笔",
      intro: "在这里记录我做的游戏、走过的路，和一些没用的思考。",
      categoriesLabel: "栏目",
      nextLabel: "NEXT",
      latestPost: "最新文章",
      enter: "进入",
      facts: [
        { k: "坐标", v: "中国" },
        { k: "职业", v: "游戏开发" },
        { k: "正在做", v: "几个 UE 项目和独立游戏" },
        { k: "最近在玩", v: "待补充" },
      ],
    },
    category: {
      tech: "技术",
      life: "生活",
      essay: "随笔",
    } as Record<string, string>,
    blog: {
      subtitle: "文章与笔记",
      categories: "分类",
      tags: "标签",
      all: "全部",
      empty: "没有找到匹配的文章。",
      count: (n: number) => `${n} 篇`,
    },
    post: {
      date: "日期",
      category: "分类",
      read: "阅读",
      minutes: (n: number) => `${n} 分钟`,
      tags: "标签",
      toc: "目录",
      prev: "上一篇",
      next: "下一篇",
      back: "返回列表",
      fallbackNotice: "本文暂无英文版，以下是中文原文。",
      comments: "评论",
    },
    archives: {
      title: "归档",
      subtitle: "按时间排列的一切",
      empty: "还没有文章。",
    },
    about: {
      title: "关于",
      subtitle: "关于我 / About",
      paragraphs: [
        "你好，我是 Bhands，一名游戏开发者。",
        "这个博客记录我做技术、过生活、发呆时想到的东西。大部分文章和 UE、游戏开发有关，偶尔也写点别的。",
        "联系我：",
      ],
      stackLabel: "本站",
      stack: "Next.js 构建，部署在自有服务器上，完全静态渲染。",
    },
    search: {
      title: "搜索",
      subtitle: "全文检索所有文章",
      placeholder: "输入关键词…",
      empty: "输入关键词开始搜索。",
      none: "没有找到相关文章。",
      results: (n: number) => `${n} 条结果`,
    },
    footer: { rights: "保留所有权利", feed: "RSS 订阅" },
    notFound: { title: "迷航", text: "页面飞出了太阳系。", back: "返回首页" },
  },
  en: {
    nav: { blog: "Blog", archives: "Archives", search: "Search", about: "About" },
    landing: {
      tagline: "Game Dev · Life · Essays",
      intro: "Notes on the games I build, the road I walk, and some useless thoughts.",
      categoriesLabel: "Categories",
      nextLabel: "NEXT",
      latestPost: "Latest post",
      enter: "Enter",
      facts: [
        { k: "Base", v: "China" },
        { k: "Role", v: "Game Developer" },
        { k: "Now", v: "Several UE projects & indie games" },
        { k: "Playing", v: "TBD" },
      ],
    },
    category: {
      tech: "Tech",
      life: "Life",
      essay: "Essays",
    } as Record<string, string>,
    blog: {
      subtitle: "Posts & Notes",
      categories: "Categories",
      tags: "Tags",
      all: "All",
      empty: "No posts match your filters.",
      count: (n: number) => `${n} posts`,
    },
    post: {
      date: "Date",
      category: "Category",
      read: "Read",
      minutes: (n: number) => `${n} min`,
      tags: "Tags",
      toc: "Contents",
      prev: "Previous",
      next: "Next",
      back: "Back to list",
      fallbackNotice: "No English version yet — showing the Chinese original.",
      comments: "Comments",
    },
    archives: {
      title: "Archives",
      subtitle: "Everything, by time",
      empty: "No posts yet.",
    },
    about: {
      title: "About",
      subtitle: "关于我 / About",
      paragraphs: [
        "Hi, I'm Bhands, a game developer.",
        "This blog is where I write about game development with Unreal Engine, life, and whatever crosses my mind.",
        "Reach me at:",
      ],
      stackLabel: "This site",
      stack: "Built with Next.js, self-hosted, fully static rendering.",
    },
    search: {
      title: "Search",
      subtitle: "Full-text search across all posts",
      placeholder: "Type keywords…",
      empty: "Type something to start searching.",
      none: "Nothing found.",
      results: (n: number) => `${n} results`,
    },
    footer: { rights: "All rights reserved", feed: "RSS" },
    notFound: { title: "Lost in Space", text: "This page drifted out of the solar system.", back: "Back home" },
  },
} as const;

export type Dict = (typeof dictionaries)["zh"];

export function getDict(lang: Lang): Dict {
  return dictionaries[lang] as Dict;
}
