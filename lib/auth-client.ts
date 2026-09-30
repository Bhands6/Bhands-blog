// 浏览器端鉴权工具：token 在 httpOnly Cookie 中（前端不可读，防 XSS 窃取），
// 前端只缓存「用户资料」用于渲染；跨标签页用 storage 事件同步。

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
}

const PROFILE_KEY = "nexus_auth";
const AUTH_EVENT = "nexus-auth";

// 模块级缓存：保证 getSnapshot 引用稳定（useSyncExternalStore 要求）
let cached: AuthUser | null | undefined;

function rawRead(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user: AuthUser };
    return parsed.user ?? null;
  } catch {
    return null;
  }
}

export function getAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  if (cached === undefined) cached = rawRead();
  return cached;
}

export function setAuthUser(user: AuthUser) {
  cached = user;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ user }));
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearAuth() {
  cached = null;
  window.localStorage.removeItem(PROFILE_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/** useSyncExternalStore 的订阅器；同时监听跨标签页 storage 事件 */
export function subscribeAuth(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key !== PROFILE_KEY) return;
    cached = undefined; // 其他标签页改动了 localStorage，失效缓存重读
    cb();
  };
  window.addEventListener(AUTH_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(AUTH_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function getServerAuth(): AuthUser | null {
  return null;
}

async function refreshSession(): Promise<boolean> {
  const res = await fetch("/api/v1/auth/refresh", { method: "POST" }).catch(() => null);
  if (!res?.ok) return false;
  const data = (await res.json().catch(() => null)) as { user?: AuthUser } | null;
  if (data?.user) setAuthUser(data.user);
  return true;
}

/** 同源 fetch（自动携带 Cookie）；401 时刷新会话重试一次，失败返回 null */
export async function authFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const doFetch = () => fetch(path, { ...init, headers: init?.headers });
  let res = await doFetch();
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      clearAuth();
      return null;
    }
    res = await doFetch();
  }
  return res;
}

export async function logout() {
  await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {
    // 服务端不可达也照样清本地登录态
  });
  clearAuth();
}
