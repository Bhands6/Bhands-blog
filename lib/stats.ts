import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { redis } from "./redis";

// 浏览量：Redis INCR 实时累计，每 5 分钟惰性回写 MySQL post_stats
// 热榜：ZSet blog:hot:{lang}，score = 浏览量

const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
const FLUSH_LOCK = "blog:lastflush";

export function hashIp(ip: string) {
  return createHash("sha256")
    .update(`${ip}:${process.env.JWT_SECRET ?? "dev"}`)
    .digest("hex")
    .slice(0, 16);
}

/** 记录一次浏览（同 IP 同文章一天只算一次）；返回是否为新浏览 */
export async function recordView(lang: string, slug: string, ipHash: string) {
  const day = new Date().toISOString().slice(0, 10);
  const viewedKey = `blog:viewed:${lang}:${slug}:${day}:${ipHash}`;
  const fresh = await redis.set(viewedKey, "1", "EX", 86400, "NX");
  if (!fresh) return false;

  await redis.incr(`blog:views:${lang}:${slug}`);
  await redis.zincrby(`blog:hot:${lang}`, 1, slug);
  await maybeFlushViews();
  return true;
}

async function maybeFlushViews() {
  const now = Date.now();
  const last = await redis.get(FLUSH_LOCK);
  if (last && now - Number(last) < FLUSH_INTERVAL_MS) return;
  // 抢锁：10 分钟自动过期兜底
  const locked = await redis.set(FLUSH_LOCK, String(now), "EX", 600, "NX");
  if (!locked) return;
  try {
    await flushViews();
  } catch (err) {
    console.error("flush views failed:", err);
  }
}

/** SCAN 全部浏览量键，覆盖写入 post_stats */
export async function flushViews() {
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "blog:views:*", "COUNT", 100);
    cursor = next;
    for (const key of keys) {
      // 键格式 blog:views:{lang}:{slug}
      const rest = key.slice("blog:views:".length);
      const lang = rest.slice(0, 2);
      const slug = rest.slice(3);
      const views = await redis.get(key);
      if (!views) continue;
      await prisma.postStat.upsert({
        where: { postLang_postSlug: { postLang: lang, postSlug: slug } },
        create: { postLang: lang, postSlug: slug, views: Number(views) },
        update: { views: Number(views) },
      });
    }
  } while (cursor !== "0");
}

/** 单篇文章的浏览量（Redis 优先，回退 MySQL） */
export async function getViews(lang: string, slug: string): Promise<number> {
  const cached = await redis.get(`blog:views:${lang}:${slug}`);
  if (cached) return Number(cached);
  const stat = await prisma.postStat.findUnique({
    where: { postLang_postSlug: { postLang: lang, postSlug: slug } },
  });
  return stat ? Number(stat.views) : 0;
}
