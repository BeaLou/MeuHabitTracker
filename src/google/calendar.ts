import { gjson } from './http';

export { ApiError as CalendarError } from './http';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface GEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  recurringEventId?: string;
  updated?: string;
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
  extendedProperties?: { private?: Record<string, string> };
}

export const getEvent = (id: string) => gjson<GEvent>(`${BASE}/${encodeURIComponent(id)}`);

export const insertEvent = (body: Partial<GEvent>) =>
  gjson<GEvent>(BASE, { method: 'POST', body: JSON.stringify(body) });

export const patchEvent = (id: string, body: Partial<GEvent>) =>
  gjson<GEvent>(`${BASE}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteEvent = (id: string) =>
  gjson<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });

interface ListResponse {
  items?: GEvent[];
  nextPageToken?: string;
}

/** Lista eventos de uma janela, paginando (limite de segurança de 5 páginas). */
export async function listEvents(params: Record<string, string>): Promise<GEvent[]> {
  const out: GEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const qs = new URLSearchParams({ maxResults: '250', ...params, ...(pageToken ? { pageToken } : {}) });
    const res = await gjson<ListResponse>(`${BASE}?${qs.toString()}`);
    out.push(...(res.items ?? []));
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
