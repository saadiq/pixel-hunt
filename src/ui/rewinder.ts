// Runs the rewind search in a worker so the page keeps drawing. One search at a time; cancelling resolves it null.
import type { Rewind, RewindInput } from '../state/rewind';

let pending: { w: Worker; done: (r: Rewind | null) => void } | null = null;

export function cancelRewind(): void {
  if (!pending) return;
  pending.w.terminate();
  pending.done(null);
  pending = null;
}

export function runRewind(inp: RewindInput): Promise<Rewind | null> {
  cancelRewind();
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../state/rewind.worker.ts', import.meta.url), { type: 'module' });
    const p = { w, done: resolve };
    pending = p;
    const end = (): void => { w.terminate(); if (pending === p) pending = null; };
    w.onmessage = (e: MessageEvent<Rewind>) => { end(); resolve(e.data); };
    w.onerror = (e) => { end(); reject(new Error(e.message)); };
    w.postMessage(inp);
  });
}
