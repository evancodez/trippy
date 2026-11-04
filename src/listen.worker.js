// Listening happens off the main thread, so nothing stutters while a song is being worked out.
import { listen } from './listen.js';

self.onmessage = async e => {
  try {
    const A = await listen(e.data, p => self.postMessage({ progress: p }));
    const buffers = Object.values(A).filter(x => ArrayBuffer.isView(x)).map(x => x.buffer);
    self.postMessage({ result: A }, buffers);
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
};
