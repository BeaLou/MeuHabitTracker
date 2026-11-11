import { clearToken, getAccessToken } from './auth';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** fetch autenticado para as APIs do Google; renova o token uma vez se vier 401. */
export async function gfetch(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await getAccessToken(false);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (res.status === 401 && retry) {
    clearToken();
    return gfetch(url, init, false);
  }
  if (!res.ok) {
    let msg = `Google respondeu ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) msg += `: ${body.error.message}`;
    } catch {
      /* corpo vazio */
    }
    throw new ApiError(res.status, msg);
  }
  return res;
}

export async function gjson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await gfetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
