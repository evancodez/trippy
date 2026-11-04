// Your songs, kept in this browser (IndexedDB) so you can flip between them in any mode, even after a
// reload. Nothing is uploaded anywhere.
const DB = 'trippy', STORE = 'songs', LISTENED = 'listened', MAX = 30;

function openDB() {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'id' });
      if (!r.result.objectStoreNames.contains(LISTENED)) r.result.createObjectStore(LISTENED);
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}

// run fn(store) in a transaction; resolves with the request's result (if fn returned a request)
async function tx(mode, fn, store = STORE) {
  const db = await openDB();
  return new Promise((ok, fail) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => fail(t.error);
  });
}

// what was worked out about a song, kept so it only has to be listened to once
export const loadListened = id => tx('readonly', st => st.get(id), LISTENED).catch(() => null);
export const saveListened = (id, a) => tx('readwrite', st => st.put(a, id), LISTENED).catch(e => console.warn('could not keep the analysis', e));

export const isSong = f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i.test(f.name);

export class SongLibrary {
  constructor() {
    this.list = [];            // [{ id, name, added }], newest first
    this.onchange = () => {};
  }

  async load() {
    try {
      const all = await tx('readonly', st => st.getAll());
      this.list = all.map(({ id, name, added }) => ({ id, name, added })).sort((a, b) => b.added - a.added);
    } catch (e) { console.warn('song library unavailable', e); }
    this.onchange();
  }

  // keep a song (the same file twice is one entry); returns its id
  async add(file) {
    const id = `${file.name}|${file.size}`;
    const rec = { id, name: file.name.replace(/\.[^.]+$/, ''), added: Date.now(), file };
    this.list = [{ id, name: rec.name, added: rec.added }, ...this.list.filter(s => s.id !== id)];
    const extra = this.list.slice(MAX);
    this.list = this.list.slice(0, MAX);
    this.onchange();
    try {
      await tx('readwrite', st => { st.put(rec); extra.forEach(s => st.delete(s.id)); });
    } catch (e) { console.warn('could not keep the song', e); }
    return id;
  }

  async get(id) {
    const rec = await tx('readonly', st => st.get(id));
    return rec?.file || null;
  }

  async remove(id) {
    this.list = this.list.filter(s => s.id !== id);
    this.onchange();
    try { await tx('readwrite', st => st.delete(id)); await tx('readwrite', st => st.delete(id), LISTENED); } catch {}
  }
}
