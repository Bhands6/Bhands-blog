import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { isLang, langs } from "@/lib/posts";
import { getDict } from "@/lib/i18n";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return langs.map((lang) => ({ lang }));
}

export const dynamicParams = false;

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
      <SiteHeader lang={lang} />
      {children}
    </>
  );
}
