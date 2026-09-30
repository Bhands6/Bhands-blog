import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource/orbitron/400.css";
import "@fontsource/orbitron/700.css";
import "@fontsource/orbitron/900.css";
import "@fontsource/rajdhani/300.css";
import "@fontsource/rajdhani/400.css";
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/share-tech-mono/400.css";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} 的博客`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.name,
    description: site.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL;
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        {umamiUrl && (
          <Script
            defer
            src={umamiUrl}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_SITE_ID ?? ""}
          />
        )}
      </body>
    </html>
  );
}
