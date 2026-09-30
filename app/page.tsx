import { redirect } from "next/navigation";

// 实际入口由 proxy.ts 按语言重定向；此文件仅作为兜底。
export default function RootPage() {
  redirect("/zh");
}
