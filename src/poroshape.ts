import type { PoRecord } from './core/poroshape';

const DB = 'por-o-shape';
const STORE = 'docs';

/**
 * Lê o banco local do Por o Shape. Só funciona quando os dois apps estão no mesmo endereço e navegador.
 * Devolve null se o banco não existir. Nunca cria nem altera nada nele.
 */
export function readPorOShape(): Promise<PoRecord[] | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB);
    } catch {
      return resolve(null);
    }
    // só dispara se o banco não existia: cancela para não deixar um banco vazio no lugar do Por o Shape
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = (event) => {
      event.preventDefault();
      resolve(null);
    };
    request.onsuccess = () => {
      const db = request.result;
      const done = (value: PoRecord[] | null) => {
        db.close();
        resolve(value);
      };
      if (!db.objectStoreNames.contains(STORE)) return done(null);
      const records: PoRecord[] = [];
      const tx = db.transaction(STORE, 'readonly');
      const cursor = tx.objectStore(STORE).openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        const { col, id, data } = c.value as PoRecord;
        // das fotos, só a data: a imagem não é necessária e ocupa muita memória
        records.push({ col, id, data: col === 'photos' ? { date: data.date } : data });
        c.continue();
      };
      tx.oncomplete = () => done(records);
      tx.onerror = () => done(null);
      tx.onabort = () => done(null);
    };
  });
}
