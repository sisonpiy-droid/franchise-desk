// Upload history, kept in this browser only (IndexedDB): nothing is sent to a server. Each upload is saved with its date and
// time and the workbook itself, so it can be reopened. Every application also gets a "first seen" date: the first time an
// application with that ID and name appeared in any upload on this browser. That date is the closest thing to a submission date.
import type { Dataset } from "./engine/types";

export interface UploadRecord {
  id: string;
  name: string;
  at: string; // ISO timestamp of the upload
  apps: number;
  territories: number;
  stores: number;
  size: number;
}
interface Stored extends UploadRecord {
  bytes: ArrayBuffer;
}

const DB = "franchise-desk";
const MAX_KEEP = 20;

function open(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      if (typeof indexedDB === "undefined") return res(null);
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => {
        rq.result.createObjectStore("uploads", { keyPath: "id" });
        rq.result.createObjectStore("seen", { keyPath: "key" });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}
const done = <T,>(rq: IDBRequest<T>) => new Promise<T | null>((res) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); });
const tx = (db: IDBDatabase, stores: string[], mode: IDBTransactionMode) => db.transaction(stores, mode);

/** The same person is the same application across uploads: ID and name together. */
export const seenKey = (appKey: string, name: string) => `${appKey}|${name.trim().toLowerCase()}`;

/** Save an upload and return the first-seen date of every application in it, keyed by application key. */
export async function recordUpload(name: string, bytes: ArrayBuffer, ds: Dataset, at = new Date()): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const iso = at.toISOString();
  const db = await open();
  if (!db) {
    for (const a of ds.applications) out[a.key] = iso;
    return out;
  }
  try {
    const seen = tx(db, ["seen"], "readwrite").objectStore("seen");
    for (const a of ds.applications) {
      const k = seenKey(a.key, a.name);
      const prev = (await done(seen.get(k))) as { key: string; first: string } | null;
      if (prev?.first) out[a.key] = prev.first;
      else {
        out[a.key] = iso;
        await done(seen.put({ key: k, first: iso }));
      }
    }
    const up = tx(db, ["uploads"], "readwrite").objectStore("uploads");
    await done(up.put({ id: `${iso}|${name}`, name, at: iso, apps: ds.applications.length, territories: ds.territories.length, stores: ds.stores.length, size: bytes.byteLength, bytes } satisfies Stored));
    const all = ((await done(up.getAll())) as Stored[] | null) ?? [];
    for (const old of all.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(MAX_KEEP)) await done(up.delete(old.id));
  } catch {
    for (const a of ds.applications) out[a.key] ??= iso;
  } finally {
    db.close();
  }
  return out;
}

/** First-seen dates for applications that have been uploaded before (used when reopening a saved file). */
export async function firstSeenFor(ds: Dataset, fallback: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const db = await open();
  for (const a of ds.applications) out[a.key] = fallback;
  if (!db) return out;
  try {
    const seen = tx(db, ["seen"], "readonly").objectStore("seen");
    for (const a of ds.applications) {
      const prev = (await done(seen.get(seenKey(a.key, a.name)))) as { first: string } | null;
      if (prev?.first) out[a.key] = prev.first;
    }
  } catch {
    /* keep the fallback */
  } finally {
    db.close();
  }
  return out;
}

export async function listUploads(): Promise<UploadRecord[]> {
  const db = await open();
  if (!db) return [];
  try {
    const all = ((await done(tx(db, ["uploads"], "readonly").objectStore("uploads").getAll())) as Stored[] | null) ?? [];
    return all.map(({ bytes: _b, ...rest }) => rest).sort((a, b) => (a.at < b.at ? 1 : -1));
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export async function getUploadBytes(id: string): Promise<ArrayBuffer | null> {
  const db = await open();
  if (!db) return null;
  try {
    const r = (await done(tx(db, ["uploads"], "readonly").objectStore("uploads").get(id))) as Stored | null;
    return r?.bytes ?? null;
  } finally {
    db.close();
  }
}

export async function deleteUpload(id: string): Promise<void> {
  const db = await open();
  if (!db) return;
  try {
    await done(tx(db, ["uploads"], "readwrite").objectStore("uploads").delete(id));
  } finally {
    db.close();
  }
}

/** Remove every saved upload and every first-seen date from this browser. */
export async function clearHistory(): Promise<void> {
  const db = await open();
  if (!db) return;
  try {
    const t = tx(db, ["uploads", "seen"], "readwrite");
    await done(t.objectStore("uploads").clear());
    await done(t.objectStore("seen").clear());
  } finally {
    db.close();
  }
}
