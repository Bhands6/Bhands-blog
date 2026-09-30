import type { Metadata } from "next";
import SiteFooter from "@/components/site-footer";
import AdminDashboard from "@/components/admin-dashboard";
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
  return { title: t.admin.title };
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 pt-36 pb-4">
        <AdminDashboard lang={lang} />
      </div>
      <SiteFooter lang={lang} />
    </>
  );
}
