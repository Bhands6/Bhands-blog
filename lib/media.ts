import fs from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";

// 上传图片的回收：文章删除时，把它「独占」的图片一并删掉。
//
// 关键点是「独占」—— 同一张图可能被多篇文章（甚至仓库里的 MDX）引用，
// 只有确认没有任何其它地方引用时才能删，否则会把别人正在用的图删成裂图。

const CONTENT_DIR = path.join(process.cwd(), "content");

/** 匹配正文/摘要里的图片引用：/api/v1/media/<id> */
const MEDIA_URL_RE = /\/api\/v1\/media\/(\d+)/g;

/** 从一段文本里提取所有引用的 media id（去重） */
export function extractMediaIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(MEDIA_URL_RE)) ids.add(m[1]);
  return [...ids];
}

/** 仓库里 MDX 文章引用的 media id —— 这些被文件引用，永远不能删 */
function mdxReferencedIds(): Set<string> {
  const ids = new Set<string>();
  for (const lang of ["zh", "en"]) {
    const dir = path.join(CONTENT_DIR, lang);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue;
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      for (const id of extractMediaIds(raw)) ids.add(id);
    }
  }
  return ids;
}

/** 是否还有其它在线文章引用这张图 */
async function isReferencedByOtherPost(id: string): Promise<boolean> {
  const marker = `/api/v1/media/${id}`;
  const rows = await prisma.post.findMany({
    where: { OR: [{ content: { contains: marker } }, { summary: { contains: marker } }] },
    select: { content: true, summary: true },
  });
  // contains 只是子串匹配，"/media/1" 会误命中 "/media/12"，
  // 所以拿回来再用正则精确复核一遍（宁可多留一个孤儿，也不能误删在用的图）
  return rows.some((r) => extractMediaIds(`${r.summary}\n${r.content}`).includes(id));
}

/**
 * 回收一批图片：只删「没有任何在线文章、也没有任何 MDX 文件引用」的那些。
 * 返回值是实际删除的数量。
 */
export async function pruneMedia(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const mdxIds = mdxReferencedIds();
  let removed = 0;
  for (const id of ids) {
    if (mdxIds.has(id)) continue;
    if (await isReferencedByOtherPost(id)) continue;
    const res = await prisma.media.deleteMany({ where: { id: BigInt(id) } });
    removed += res.count;
  }
  return removed;
}

/**
 * 删除在线文章，并回收它独占的图片。
 *
 * 顺序是「先删文章、再判引用」—— 这样文章自身的引用不会干扰判断；
 * 而且万一步骤二失败，最坏也只是留下孤儿图片，不会把文章删一半。
 */
export async function deletePostCascade(postId: bigint): Promise<{ removedMedia: number }> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { content: true, summary: true },
  });
  const candidates = post ? extractMediaIds(`${post.summary}\n${post.content}`) : [];

  await prisma.post.delete({ where: { id: postId } });

  try {
    return { removedMedia: await pruneMedia(candidates) };
  } catch (err) {
    // 文章已经删掉了，图片回收失败不该让整个请求报错
    console.error("prune media failed:", err);
    return { removedMedia: 0 };
  }
}

/**
 * 编辑保存后，回收「这次编辑删掉、且别处也没引用」的图片。
 *
 * 只处理差集：旧版本引用过、新版本不再引用 —— 没动过的图片一律不碰，
 * 所以「把图从 A 段挪到 B 段」这种改动不会误删。
 */
export async function pruneAfterPostUpdate(
  before: { content: string; summary: string },
  after: { content: string; summary: string },
): Promise<number> {
  const oldIds = extractMediaIds(`${before.summary}\n${before.content}`);
  if (oldIds.length === 0) return 0;
  const keptIds = new Set(extractMediaIds(`${after.summary}\n${after.content}`));
  const dropped = oldIds.filter((id) => !keptIds.has(id));

  try {
    return await pruneMedia(dropped);
  } catch (err) {
    // 文章已经保存成功了，图片回收失败不该让整个请求报错
    console.error("prune media on update failed:", err);
    return 0;
  }
}
