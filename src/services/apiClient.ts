/**
 * 最小化 HTTP 客户端。统一基础路径前缀，并把非 2xx 解析成错误结构。
 */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  status: number;

  constructor(opts: {
    code: string;
    message: string;
    status: number;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
    this.details = opts.details;
  }
}

async function parseErr(resp: Response): Promise<never> {
  let payload: { error?: { code?: string; message?: string; retryable?: boolean } } | undefined;
  try {
    payload = await resp.json();
  } catch {
    /* ignore */
  }
  throw new ApiError({
    code: payload?.error?.code ?? 'HTTP_ERROR',
    message: payload?.error?.message ?? `HTTP ${resp.status}`,
    status: resp.status,
    retryable: payload?.error?.retryable ?? false,
  });
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!resp.ok) await parseErr(resp);
  return resp.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!resp.ok) await parseErr(resp);
  return resp.json() as Promise<T>;
}

export const apiBase = BASE;
