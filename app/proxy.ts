import { NextResponse, type NextRequest } from "next/server";

const LANGS = ["zh", "en"];

function detectLocale(req: NextRequest): string {
  const cookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && LANGS.includes(cookie)) return cookie;
  const al = (req.headers.get("accept-language") ?? "").toLowerCase();
  if (/^en\b/.test(al.trim())) return "en";
  return "zh";
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const seg = pathname.split("/")[1];

  if (LANGS.includes(seg)) {
    const res = NextResponse.next();
    res.cookies.set("NEXT_LOCALE", seg, { path: "/", maxAge: 31536000, sameSite: "lax" });
    return res;
  }

  const lang = detectLocale(req);
  const url = req.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|feed.xml|.*\\..*).*)"],
};
