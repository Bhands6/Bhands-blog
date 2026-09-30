// 浏览器端鉴权工具：token 存 localStorage，跨组件/跨标签页用 useSyncExternalStore 消费

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
}

export interface AuthState {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const KEY = "nexus_auth";
const AUTH_EVENT = "nexus-auth";

// 模块级缓存：保证 getSnapshot 引用稳定（useSyncExternalStore 要求）
let cached: AuthState | null | undefined;

function rawRead(): AuthState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    return parsed.accessToken && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  if (cached === undefined) cached = rawRead();
  return cached;
}

export function setAuth(state: AuthState) {
  cached = state;
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearAuth() {
  cached = null;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/** useSyncExternalStore 的订阅器；同时监听跨标签页 storage 事件 */
export function subscribeAuth(cb: () => void) {
  const onStorage = () => {
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

export function getServerAuth(): AuthState | null {
  return null;
}

async function refreshTokens(refreshToken: string): Promise<AuthState | null> {
  const res = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as AuthState;
  setAuth(data);
  return data;
}

/** 带 Bearer 与 401 自动刷新的 fetch；失败返回 null */
export async function authFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const auth = getAuth();
  if (!auth) return null;
  const doFetch = (token: string) =>
    fetch(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
  let res = await doFetch(auth.accessToken);
  if (res.status === 401) {
    const refreshed = await refreshTokens(auth.refreshToken);
    if (!refreshed) {
      clearAuth();
      return null;
    }
    res = await doFetch(refreshed.accessToken);
  }
  return res;
}

export async function logout() {
  const auth = getAuth();
  if (auth) {
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
    } catch {
      // 服务端不可达也照样清本地登录态
    }
  }
  clearAuth();
}
