import type { Session } from './types';

/**
 * Cliente da API.
 *  - O access token (JWT curto) fica SÓ em memória (variável do módulo): não está em localStorage,
 *    então um XSS não consegue "roubar" uma sessão persistente.
 *  - O refresh token está num cookie httpOnly que o JavaScript nem enxerga; o navegador o envia
 *    sozinho para /api/auth/*.
 *  - Todo request leva X-Requested-With (exigido pelo backend como proteção CSRF).
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const setAuthLostHandler = (fn: (() => void) | null) => {
  onAuthLost = fn;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

interface Opts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

function send(path: string, { method = 'GET', body, auth = true }: Opts): Promise<Response> {
  const headers: Record<string, string> = { 'X-Requested-With': 'nutrisafe' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Renova a sessão usando o cookie de refresh. "Single-flight": chamadas simultâneas
 * (ex.: React StrictMode, vários requests expirando juntos) compartilham UMA requisição.
 * Isso é importante porque o backend rotaciona o refresh token a cada uso.
 */
let refreshing: Promise<Session | null> | null = null;
export function refreshSession(): Promise<Session | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await send('/api/auth/refresh', { method: 'POST', auth: false });
        if (!res.ok) {
          accessToken = null;
          return null;
        }
        const session = (await res.json()) as Session;
        accessToken = session.accessToken;
        return session;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  let res = await send(path, opts);

  // Access token expirado: tenta renovar uma vez e repete o pedido.
  if (res.status === 401 && opts.auth !== false) {
    const session = await refreshSession();
    if (session) res = await send(path, opts);
    else onAuthLost?.();
  }

  if (!res.ok) {
    let message = 'Algo deu errado. Tente novamente.';
    let code: string | undefined;
    let details: ApiError['details'];
    try {
      const json = (await res.json()) as { error?: { message?: string; code?: string; details?: ApiError['details'] } };
      message = json.error?.message ?? message;
      code = json.error?.code;
      details = json.error?.details;
    } catch {
      /* resposta sem JSON */
    }
    throw new ApiError(res.status, message, code, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Texto amigável de erro (inclui os campos inválidos, nunca os valores enviados). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const fields = e.details?.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join(' · ');
    return fields ? `${e.message} — ${fields}` : e.message;
  }
  return 'Não foi possível conectar ao servidor.';
}
