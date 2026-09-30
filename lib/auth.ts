import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { User } from "@prisma/client";
import { redis } from "./redis";

const ACCESS_TTL = "15m";
export const REFRESH_TTL_SECONDS = 7 * 24 * 3600;

const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me");

export interface AccessPayload extends JWTPayload {
  uid: string;
  username: string;
  role: string;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: AccessPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string") return null;
    return payload as unknown as AccessPayload;
  } catch {
    return null;
  }
}

/** 从请求头解析 Bearer JWT；未登录返回 null */
export async function getAuthPayload(req: Request): Promise<AccessPayload | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  return verifyAccessToken(token);
}

/** 管理员守卫；非 ADMIN 返回 null */
export async function getAdminPayload(req: Request): Promise<AccessPayload | null> {
  const payload = await getAuthPayload(req);
  if (!payload || payload.role !== "ADMIN") return null;
  return payload;
}

export function generateRefreshToken() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

// 单设备会话：每个 uid 只保留最新一个 refresh token，Redis 白名单可随时撤销
const refreshKey = (uid: string) => `blog:rt:${uid}`;

export async function storeRefreshToken(uid: string, token: string) {
  await redis.set(refreshKey(uid), token, "EX", REFRESH_TTL_SECONDS);
}

export async function getRefreshToken(uid: string) {
  return redis.get(refreshKey(uid));
}

export async function clearRefreshToken(uid: string) {
  await redis.del(refreshKey(uid));
}

/** 签发一整套会话：access JWT + Redis 白名单 refresh token（{uid}.{secret} 格式） */
export async function issueSession(user: User) {
  const uid = user.id.toString();
  const accessToken = await signAccessToken({ uid, username: user.username, role: user.role });
  const refreshToken = `${uid}.${generateRefreshToken()}`;
  await storeRefreshToken(uid, refreshToken);
  return { accessToken, refreshToken };
}

export function publicUser(u: User) {
  return {
    id: u.id.toString(),
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    avatarUrl: u.avatarUrl,
  };
}
