import { apiGet, apiPost } from './apiClient';

export interface ZhihuUser {
  uid: number;
  fullname: string;
  avatar_path: string;
  headline?: string;
  gender?: string;
}

export async function fetchMe(): Promise<ZhihuUser | null> {
  const res = await apiGet<{ data: ZhihuUser | null }>('/auth/me');
  return res.data ?? null;
}

export async function loginWithZhihu() {
  // 开发环境直接 Mock 登录，跳过真实 OAuth
  if (import.meta.env.DEV) {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/auth/dev/login`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.data) {
      window.location.reload();
    }
    return;
  }
  // 生产环境走真实知乎 OAuth
  const redirect = encodeURIComponent(window.location.href);
  window.location.href = `${import.meta.env.VITE_API_BASE}/auth/zhihu/login?redirect=${redirect}`;
}

export async function logout(): Promise<void> {
  await apiPost('/auth/logout', {});
}
