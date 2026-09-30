"use client";

import Link from "next/link";
import Fuse from "fuse.js";
import { useMemo, useState } from "react";
import { getDict } from "@/lib/i18n";
import type { SearchDoc } from "@/lib/posts";

export default function SearchClient({
  docs,
  lang,
}: {
  docs: SearchDoc[];
  lang: "zh" | "en";
}) {
  const t = getDict(lang);
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () =>
      new Fuse(docs, {
        keys: [
          { name: "title", weight: 3 },
          { name: "summary", weight: 2 },
          { name: "tags", weight: 2 },
          { name: "text", weight: 1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [docs]
  );

  const results = query.trim() ? fuse.search(query.trim()).map((r) => r.item) : [];

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.search.placeholder}
        className="w-full border-b border-line bg-transparent pb-4 text-2xl font-bold text-white outline-none placeholder:text-faint focus:border-white"
      />
      <div className="mt-4 text-xs text-faint">
        {query.trim() ? t.search.results(results.length) : t.search.empty}
      </div>

      <dl className="mt-10">
        {results.map((r) => (
          <Link key={r.slug} href={`/${lang}/blog/${r.slug}`} className="group block">
            <div className="fact-row py-5 transition-colors group-hover:bg-white/[0.03]">
              <dt className="pt-1.5 text-sm font-normal text-dim tabular-nums">
                {t.category[r.category]}
              </dt>
              <dd>
                <h2 className="text-lg font-bold text-white group-hover:underline underline-offset-4">
                  {r.title}
                </h2>
                <p className="mt-1.5 text-sm leading-7 text-dim">{r.summary}</p>
              </dd>
            </div>
          </Link>
        ))}
        {query.trim() && results.length === 0 && (
          <p className="py-16 text-center text-dim">{t.search.none}</p>
        )}
      </dl>
    </div>
  );
}
