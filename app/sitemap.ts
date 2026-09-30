import type { MetadataRoute } from "next";
import { getPostsForLang, langs } from "@/lib/posts";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of langs) {
    const base = `${site.url}/${lang}`;
    entries.push({ url: base, lastModified: now, changeFrequency: "weekly", priority: 1 });
    for (const path of ["/blog", "/archives", "/about", "/search"]) {
      entries.push({
        url: `${base}${path}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
    for (const p of getPostsForLang(lang)) {
      entries.push({
        url: `${base}/blog/${p.slug}`,
        lastModified: new Date(p.date),
        changeFrequency: "yearly",
        priority: 0.8,
      });
    }
  }
  return entries;
}
