export type Exercise = 'value' | 'hue' | 'chroma' | 'family' | 'full' | 'compare';
export type SourceMode = 'swatch' | 'image';

export type Attempt = {
  id?: number;
  createdAt: number;
  source: SourceMode;
  exercise: Exercise;
  targetH: string;
  targetV: number;
  targetC: number;
  answerH: string;
  answerV: number;
  answerC: number;
  hueError: number;
  valueError: number;
  chromaError: number;
  exact: boolean;
  responseMs: number;
};

const DB_NAME = 'munsell-eye';
const STORE = 'attempts';

function openProgressDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readAttempts(limit = 600): Promise<Attempt[]> {
  if (typeof indexedDB === 'undefined') return [];
  const db = await openProgressDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).index('createdAt').openCursor(null, 'prev');
    const attempts: Attempt[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && attempts.length < limit) {
        attempts.push(cursor.value as Attempt);
        cursor.continue();
      } else {
        db.close();
        resolve(attempts.reverse());
      }
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function saveAttempt(attempt: Attempt): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openProgressDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).add(attempt);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function clearAttempts(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openProgressDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
