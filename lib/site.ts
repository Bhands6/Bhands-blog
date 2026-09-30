// 站点身份配置：改这里即可完成个人化，无需动组件
export const site = {
  name: "Bhands",
  // 部署时通过 NEXT_PUBLIC_SITE_URL 环境变量覆盖
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://blog.example.com",
  description:
    "Bhands 的个人博客——游戏开发、生活与随笔。",
  author: "Bhands",
  socials: {
    github: "https://github.com/your-name", // TODO: 换成你的 GitHub
    email: "mailto:you@example.com", // TODO: 换成你的邮箱
  },
} as const;
