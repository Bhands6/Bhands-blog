import Link from "next/link";
import { site } from "@/lib/site";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/posts";

export default function SiteFooter({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  return (
    <footer className="mt-24 border-t border-line-soft">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-faint">
        <div>
          © {new Date().getFullYear()} {site.author} · {t.footer.rights}
        </div>
        <div className="flex items-center gap-5">
          <a
            href={site.socials.github}
            target="_blank"
            rel="noreferrer"
            className="text-faint transition-colors hover:text-white"
          >
            GitHub
          </a>
          <a href={site.socials.email} className="text-faint transition-colors hover:text-white">
            Email
          </a>
          <Link href="/feed.xml" className="text-faint transition-colors hover:text-white">
            {t.footer.feed}
          </Link>
        </div>
      </div>
    </footer>
  );
}
