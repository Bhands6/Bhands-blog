import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueSession, publicUser, verifyPassword } from "@/lib/auth";

const schema = z.object({
  account: z.string().min(1).max(120), // 用户名或邮箱
  password: z.string().min(1).max(72),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "请输入身份编号和加密密钥", code: "INVALID_PARAMS" }, { status: 400 });
  }
  const { account, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: account }, { email: account }] },
  });
  if (!user || user.status !== 1) {
    return NextResponse.json({ error: "身份编号或密钥错误", code: "BAD_CREDENTIALS" }, { status: 401 });
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "身份编号或密钥错误", code: "BAD_CREDENTIALS" }, { status: 401 });
  }

  const tokens = await issueSession(user);
  return NextResponse.json({ ...tokens, user: publicUser(user) });
}
