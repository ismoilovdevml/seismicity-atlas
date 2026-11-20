// Module Web Worker for "Your catalogue": reads the CSV and runs the bootstrap off the main thread, so the page stays
// responsive for large files and 5000 replicates. Started by view.js with new URL('./worker.js', import.meta.url);
// view.js runs the same runJob() on the main thread when a worker cannot start.
// Messages in: {id, kind: 'read' | 'analyze', text, opts}. Out: {id, progress} while computing, then
// {id, ok: true, out} or {id, ok: false, error: {code, params, message}}.

import { runJob, errorInfo } from './core.js';

self.onmessage = ({ data }) => {
  const { id, kind, text, opts } = data;
  let last = -1;
  const onProgress = (p) => {
    const pct = Math.floor(p * 100);
    if (pct !== last) { last = pct; self.postMessage({ id, progress: p }); }
  };
  try {
    self.postMessage({ id, ok: true, out: runJob(kind, text, opts, onProgress) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: errorInfo(err) });
  }
};
