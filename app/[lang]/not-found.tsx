import Link from "next/link";

// [lang] 边界内无法读取 params，使用双语静态文案
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-6 text-center">
      <h1 className="giant-latin">404</h1>
      <p className="text-dim">页面飞出了太阳系 / This page drifted out of the solar system.</p>
      <Link
        href="/zh"
        className="rounded-full border border-line px-6 py-3 text-sm text-dim transition-colors hover:border-white hover:text-white"
      >
        返回首页 / Back home
      </Link>
    </main>
  );
}
