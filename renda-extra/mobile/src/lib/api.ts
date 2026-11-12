import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { storage } from './storage';
import { demoApi, DemoError } from './demo/server';

/** Em dev, sem EXPO_PUBLIC_API_URL, usa o IP da máquina que roda o Metro — funciona no celular físico. */
function resolveBaseUrl() {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return `http://${host}:3333`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3333';
  return 'http://localhost:3333';
}

export const API_URL = resolveBaseUrl();

const ACCESS = 'rm.access';
const REFRESH = 'rm.refresh';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
  get isPremium() {
    return this.code === 'PREMIUM_REQUIRED';
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export const session = {
  async load() {
    accessToken = await storage.get(ACCESS);
    return Boolean(accessToken || (await storage.get(REFRESH)));
  },
  async save(tokens: { accessToken: string; refreshToken: string }) {
    accessToken = tokens.accessToken;
    await Promise.all([storage.set(ACCESS, tokens.accessToken), storage.set(REFRESH, tokens.refreshToken)]);
  },
  async clear() {
    accessToken = null;
    await Promise.all([storage.remove(ACCESS), storage.remove(REFRESH)]);
  },
  refreshToken: () => storage.get(REFRESH),
  onExpired(cb: () => void) {
    onSessionExpired = cb;
  },
};

async function refresh(): Promise<boolean> {
  const rt = await storage.get(REFRESH);
  if (!rt) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    await session.save(await res.json());
    return true;
  } catch {
    return false;
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean };

/** Modo demonstração: sem servidor, dados salvos no próprio aparelho (link público de testes). */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

async function viaDemo<T>(path: string, opts: Options): Promise<T> {
  try {
    return (await demoApi(path, opts, accessToken)) as T;
  } catch (e) {
    if (e instanceof DemoError) {
      if (e.status === 401 && !path.startsWith('/auth/')) {
        await session.clear();
        onSessionExpired?.();
      }
      throw new ApiError(e.status, e.code, e.message);
    }
    throw e;
  }
}

export async function api<T = unknown>(path: string, opts: Options = {}, retried = false): Promise<T> {
  if (DEMO) return viaDemo<T>(path, opts);
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Sem conexão com o servidor. Verifique sua internet.');
  }

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    refreshing ??= refresh().finally(() => (refreshing = null));
    if (await refreshing) return api<T>(path, opts, true);
    await session.clear();
    onSessionExpired?.();
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'ERROR', data.message ?? 'Algo deu errado');
  return data as T;
}

/** Para downloads (CSV): devolve o corpo como texto. */
export async function apiText(path: string): Promise<string> {
  if (DEMO) return viaDemo<string>(path, {});
  const res = await fetch(`${API_URL}${path}`, { headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} });
  if (res.status === 401 && (await refresh())) return apiText(path);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error ?? 'ERROR', data.message ?? 'Algo deu errado');
  }
  return res.text();
}
