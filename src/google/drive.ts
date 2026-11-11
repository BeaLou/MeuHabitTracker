import { setGoogleState } from '../actions';
import { canonical, mergeStates, shareable } from '../core/merge';
import type { AppState } from '../core/types';
import { store } from '../store';
import { gfetch, gjson } from './http';

/**
 * Sincronização entre aparelhos: um único arquivo JSON na pasta privada do app no Drive
 * (escopo drive.appdata: o app só enxerga o que ele mesmo criou, nunca seus outros arquivos).
 */
const FILE_NAME = 'ritmo-data.json';
const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveReport {
  received: boolean;
  uploaded: boolean;
}

async function findFileId(): Promise<string | null> {
  const qs = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${FILE_NAME}' and trashed=false`,
    fields: 'files(id)',
    orderBy: 'createdTime',
    pageSize: '1',
  });
  const res = await gjson<{ files?: { id: string }[] }>(`${FILES}?${qs.toString()}`);
  return res.files?.[0]?.id ?? null;
}

async function download(id: string): Promise<Partial<AppState>> {
  const res = await gfetch(`${FILES}/${encodeURIComponent(id)}?alt=media`);
  const data = JSON.parse(await res.text()) as Partial<AppState>;
  if (!data || !Array.isArray(data.habits) || !Array.isArray(data.tasks)) {
    throw new Error('O arquivo de dados no Drive está em formato inesperado.');
  }
  return data;
}

async function create(json: string): Promise<void> {
  const boundary = `ritmo${Date.now().toString(36)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  await gfetch(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

async function update(id: string, json: string): Promise<void> {
  await gfetch(`${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: json,
  });
}

const normalize = (d: Partial<AppState>) =>
  canonical({
    version: 1,
    habits: d.habits ?? [],
    tasks: d.tasks ?? [],
    categories: d.categories ?? [],
    sessions: d.sessions ?? [],
    tombstones: d.tombstones ?? {},
  });

let running: Promise<DriveReport> | null = null;

/** Baixa o arquivo do Drive, junta com os dados locais e envia de volta se algo mudou. */
export function driveSyncNow(): Promise<DriveReport> {
  running ??= doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync(): Promise<DriveReport> {
  const id = await findFileId();
  const remote: Partial<AppState> = id ? await download(id) : {};

  const before = canonical(shareable(store.get()));
  store.update((s) => mergeStates(s, remote));
  const merged = shareable(store.get());
  const received = canonical(merged) !== before;

  let uploaded = false;
  if (!id) {
    await create(JSON.stringify(merged));
    uploaded = true;
  } else if (canonical(merged) !== normalize(remote)) {
    await update(id, JSON.stringify(merged));
    uploaded = true;
  }

  setGoogleState({
    lastDriveSyncAt: Date.now(),
    lastDriveMessage: received && uploaded ? 'Dados juntados e enviados'
      : received ? 'Recebidos dados de outro aparelho'
      : uploaded ? 'Dados deste aparelho enviados'
      : 'Tudo em dia',
  });
  return { received, uploaded };
}
