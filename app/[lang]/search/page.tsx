import type { Metadata } from "next";
import SiteFooter from "@/components/site-footer";
import SearchClient from "@/components/search-client";
import { getDict } from "@/lib/i18n";
import { getSearchIndex, isLang } from "@/lib/posts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  return { title: t.nav.search, description: t.search.subtitle };
}

export default async function SearchPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const docs = getSearchIndex(lang);

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-36">
        <h1 className="giant-latin">SEARCH</h1>
        <p className="mt-4 text-sm tracking-[0.2em] text-faint uppercase">
          {getDict(lang).search.subtitle}
        </p>
        <div className="mt-16 pb-4">
          <SearchClient lang={lang} docs={docs} />
        </div>
      </div>
      <SiteFooter lang={lang} />
    </>
  );
}
