import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, issueSession, publicUser } from "@/lib/auth";

const schema = z.object({
  username: z.string().min(2).max(20),
  email: z.string().email().max(120),
  password: z.string().min(6).max(72),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数不合法：用户名 2-20 字符、邮箱有效、密码至少 6 位", code: "INVALID_PARAMS" },
      { status: 400 },
    );
  }
  const { username, email, password } = parsed.data;

  const exists = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (exists) {
    return NextResponse.json({ error: "用户名或邮箱已被占用", code: "NAME_TAKEN" }, { status: 409 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: await hashPassword(password),
        displayName: username,
      },
    });
    const tokens = await issueSession(user);
    return NextResponse.json({ ...tokens, user: publicUser(user) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "注册失败，请稍后再试", code: "SERVER_ERROR" }, { status: 500 });
  }
}
