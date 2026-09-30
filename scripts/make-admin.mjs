// 晋升管理员：node scripts/make-admin.mjs <用户名>
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const username = process.argv[2];

if (!username) {
  console.error("用法: node scripts/make-admin.mjs <用户名>");
  process.exit(1);
}

try {
  const user = await prisma.user.update({
    where: { username },
    data: { role: "ADMIN" },
  });
  console.log(`[ok] ${user.username} 已晋升为 ADMIN`);
} catch {
  console.error(`[fail] 找不到用户 ${username}`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
