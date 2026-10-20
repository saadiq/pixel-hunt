// Small DOM helpers and shared icons for the app UI.

export const ANT_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><ellipse cx="6" cy="12" rx="4.2" ry="3.4"/><ellipse cx="12.2" cy="12" rx="2.4" ry="2"/><circle cx="17.4" cy="12" r="2.6"/></g><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"><path d="M10 10.5 8 6M12 10.3l.5-4.5M14 10.5l2.5-4M10 13.5 8 18M12 13.7l.5 4.5M14 13.5l2.5 4M19 10l2-3.5M19.4 14l2 3.5"/></g></svg>';

export const LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing #${id}`);
  return e as T;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Readable ink for text on a block color. */
export function textOn(hex: string): string {
  return lum(hex) > 0.62 ? '#1a140f' : '#ffffff';
}
