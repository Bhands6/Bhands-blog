import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// 写作时上传图片：二进制存 MySQL，通过 /api/v1/media/{id} 读回。
// 不走 public/ 的原因：本项目部署在 Vercel，serverless 文件系统只读，
// 且运行时新增的文件不会被当作静态资源提供。

/** Vercel 函数请求体上限约 4.5MB，留出余量 */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * 允许的类型 + 各自的魔数签名。
 * 只信浏览器给的 Content-Type 是不够的（可伪造），这里按文件头再校验一次 ——
 * 因为图片是从本站域名下直接输出的，不能成为托管任意内容的通道。
 */
const SIGNATURES: { mime: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/gif", ext: "gif", test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  {
    mime: "image/webp",
    ext: "webp",
    // RIFF....WEBP
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    mime: "image/avif",
    ext: "avif",
    // ....ftypavif
    test: (b) =>
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
      b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69 && b[11] === 0x66,
  },
];

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少上传文件", code: "INVALID_PARAMS" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "文件为空", code: "INVALID_PARAMS" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "图片不能超过 4MB", code: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sig = SIGNATURES.find((s) => s.test(bytes));
  if (!sig) {
    return NextResponse.json(
      { error: "仅支持 PNG / JPEG / GIF / WebP / AVIF", code: "UNSUPPORTED_TYPE" },
      { status: 415 },
    );
  }

  const media = await prisma.media.create({
    data: {
      filename: (file.name || `image.${sig.ext}`).slice(0, 200),
      mimeType: sig.mime,
      byteSize: file.size,
      data: Buffer.from(bytes),
      uploaderId: BigInt(admin.payload.uid),
    },
  });

  return NextResponse.json(
    { media: { id: media.id.toString(), url: `/api/v1/media/${media.id}`, mimeType: sig.mime } },
    { status: 201 },
  );
}
