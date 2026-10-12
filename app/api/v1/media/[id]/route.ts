import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 读取上传的图片（公开，无鉴权 —— 文章里的图片本来就要能匿名访问）。
// id 自增且内容不可变，因此可以放心长缓存。
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const media = await prisma.media.findUnique({ where: { id: BigInt(id) } });
  if (!media) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(media.byteSize),
      // id 唯一且内容不变 → 一年期强缓存
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
