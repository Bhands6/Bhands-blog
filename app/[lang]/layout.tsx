import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import Starfield from "@/components/starfield";
import ParticleTrail from "@/components/particle-trail";
import BackToTop from "@/components/back-to-top";
import { isLang, langs } from "@/lib/posts";
import { getDict } from "@/lib/i18n";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return langs.map((lang) => ({ lang }));
}

// 允许子段（如 blog/[slug] 的在线文章）按需渲染；非法 lang 由下方运行时守卫 notFound()
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getDict(lang);
  const title = lang === "zh" ? `${site.name} 的博客` : `${site.name}'s Blog`;
  return {
    title: { default: title, template: `%s · ${site.name}` },
    description: t.landing.intro,
    alternates: {
      canonical: `/${lang}`,
      languages: { zh: "/zh", en: "/en" },
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <>
      {/* 全站共用的深空氛围层：星空背景 + 鼠标粒子拖尾（原先只在首页） */}
      <Starfield />
      <ParticleTrail />
      <SiteHeader lang={lang} />
      {/* 右下角「回到顶部」：固定定位，渲染在 .page-content 之外，
          让它保持在根层叠上下文里（内容 z-1 之上、导航 z-1000 之下） */}
      <BackToTop lang={lang} />
      {/* 内容层：position+z-index 抬到 canvas 之上（首页 .hero/.nx-sec 也是这套约定） */}
      <div className="page-content">{children}</div>
    </>
  );
}
