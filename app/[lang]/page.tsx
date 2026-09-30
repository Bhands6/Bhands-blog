import PortalExperience from "@/components/portal-experience";
import { isLang, getCategories, getLatestPost } from "@/lib/posts";
import { getDict } from "@/lib/i18n";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  const latest = getLatestPost(lang);
  const categories = getCategories(lang).map((c) => ({
    key: c.key,
    label: t.category[c.key],
    href: `/${lang}/blog?category=${c.key}`,
  }));

  return (
    <PortalExperience
      lang={lang}
      latest={latest ? { slug: latest.slug, title: latest.title } : null}
      categories={categories}
      aboutHref={`/${lang}/about`}
      labels={{
        tagline: t.landing.tagline,
        intro: t.landing.intro,
        categoriesLabel: t.landing.categoriesLabel,
        nextLabel: t.landing.nextLabel,
        latestPost: t.landing.latestPost,
        enter: t.landing.enter,
        facts: t.landing.facts.map((f) => ({ k: f.k, v: f.v })),
      }}
    />
  );
}
