/**
 * Login com Google Identity Services (token client, 100% no navegador, sem backend).
 * Escopos mínimos: eventos da agenda e a pasta privada do app no Drive. O Google limita o token a ~1 h (sem backend não há como estender); o app renova sozinho em segundo plano e guarda o token neste aparelho.
 */

// calendar.events: hábitos <-> eventos. drive.appdata: pasta privada do app no Drive (sync entre aparelhos).
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.appdata';
const SESSION_KEY = 'ritmo:gtoken';

export const GOOGLE_CLIENT_ID: string = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
export const googleConfigured = GOOGLE_CLIENT_ID.length > 0;

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  callback: (r: TokenResponse) => void;
  error_callback?: (e: { type: string; message?: string }) => void;
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

interface GisApi {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string; message?: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
}

function gis(): GisApi | undefined {
  return (window as unknown as { google?: GisApi }).google;
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (gis()) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Não foi possível carregar o login do Google (sem internet?).'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface StoredToken {
  value: string;
  expiresAt: number;
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    return t.expiresAt - 60_000 > Date.now() ? t : null;
  } catch {
    return null;
  }
}

function saveToken(t: StoredToken | null) {
  try {
    if (t) localStorage.setItem(SESSION_KEY, JSON.stringify(t));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignora */
  }
}

let client: TokenClient | null = null;

/** Milissegundos até o token atual expirar (0 se não há token válido). */
export function tokenMsLeft(): number {
  const t = readToken();
  return t ? t.expiresAt - Date.now() : 0;
}

/**
 * Renovação silenciosa (prompt "none"): não abre popup. Funciona enquanto o usuário continua logado
 * no Google no navegador e já autorizou o app; se não der, falha em silêncio e o fluxo normal segue.
 */
export async function renewTokenSilently(): Promise<boolean> {
  if (!googleConfigured) return false;
  try {
    await loadScript();
    const api = gis();
    if (!api) return false;
    return await new Promise<boolean>((resolve) => {
      client ??= api.accounts.oauth2.initTokenClient({ client_id: GOOGLE_CLIENT_ID, scope: SCOPE, callback: () => undefined });
      const timer = setTimeout(() => resolve(false), 15_000);
      client.callback = (r) => {
        clearTimeout(timer);
        if (r.error || !r.access_token) return resolve(false);
        saveToken({ value: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 });
        resolve(true);
      };
      client.error_callback = () => { clearTimeout(timer); resolve(false); };
      client.requestAccessToken({ prompt: 'none' });
    });
  } catch {
    return false;
  }
}

/**
 * Devolve um token válido. `interactive` = true quando vem de um clique do usuário
 * (permite abrir o popup de login/consentimento). Sem clique, o popup pode ser bloqueado.
 */
export async function getAccessToken(interactive = false): Promise<string> {
  if (!googleConfigured) throw new Error('Defina VITE_GOOGLE_CLIENT_ID para usar o Google Agenda (veja o README).');
  const cached = readToken();
  if (cached) return cached.value;

  await loadScript();
  const api = gis();
  if (!api) throw new Error('Login do Google indisponível.');

  return new Promise<string>((resolve, reject) => {
    client ??= api.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: () => undefined,
    });
    client.callback = (r) => {
      if (r.error || !r.access_token) {
        reject(new Error(r.error_description ?? r.error ?? 'Falha no login do Google.'));
        return;
      }
      saveToken({ value: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 });
      resolve(r.access_token);
    };
    client.error_callback = (e) => {
      reject(new Error(e.type === 'popup_closed' ? 'Login cancelado.' : `Login do Google falhou (${e.type}).`));
    };
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

export function clearToken() {
  saveToken(null);
}

export async function disconnectGoogle(): Promise<void> {
  const t = readToken();
  saveToken(null);
  const api = gis();
  if (t && api) api.accounts.oauth2.revoke(t.value);
}
