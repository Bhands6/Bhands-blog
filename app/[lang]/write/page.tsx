import type { Metadata } from "next";
import SiteFooter from "@/components/site-footer";
import PostEditor from "@/components/post-editor";
import { getDict } from "@/lib/i18n";
import { isLang } from "@/lib/posts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  return { title: t.write.title, description: t.write.subtitle };
}

export default async function WritePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const sp = await searchParams;
  const editId = sp.id && /^\d+$/.test(sp.id) ? sp.id : undefined;
  const t = getDict(lang);

  return (
    <>
      <div className="write-page">
        <div className="section-label">{t.write.subtitle}</div>
        <h1 className="section-title">{editId ? t.write.editTitle : t.write.title}</h1>
        <div className="mt-12">
          <PostEditor
            lang={lang}
            editId={editId}
            categoryNames={t.category}
          />
        </div>
      </div>
      <SiteFooter lang={lang} />
    </>
  );
}
