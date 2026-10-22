// Tap or hold on the lanes. A quick tap sends the lane's top squad; holding past HOLD_MS previews what
// that squad can reach, sliding compares lanes, and letting go from a preview never sends anything.

export const HOLD_MS = 300;

export type PressEvent =
  | { t: 'down'; lane: number; at: number }
  | { t: 'move'; lane: number | null }
  | { t: 'timer'; at: number }
  | { t: 'up'; at: number }
  | { t: 'cancel' };

/** `send`: tap this lane. `preview`: show this lane's reach, or null to clear it. */
export interface PressOut { send?: number; preview?: number | null }

export interface PressState { phase: 'idle' | 'down' | 'preview'; origin: number; lane: number | null; start: number }

export const IDLE: PressState = { phase: 'idle', origin: -1, lane: null, start: 0 };

/** The press state machine: pure, so every gesture rule is testable without a DOM. */
export function pressStep(s: PressState, e: PressEvent): [PressState, PressOut] {
  if (e.t === 'down') return [{ phase: 'down', origin: e.lane, lane: e.lane, start: e.at }, {}];
  if (s.phase === 'idle') return [s, {}];
  if (e.t === 'cancel') return [IDLE, s.phase === 'preview' ? { preview: null } : {}];
  if (e.t === 'move') {
    if (s.phase === 'preview' && e.lane !== s.lane) return [{ ...s, lane: e.lane }, { preview: e.lane }];
    return [{ ...s, lane: e.lane }, {}];
  }
  if (e.t === 'timer') {
    if (s.phase !== 'down' || e.at - s.start < HOLD_MS) return [s, {}];
    return [{ ...s, phase: 'preview' }, s.lane === null ? {} : { preview: s.lane }];
  }
  // up
  if (s.phase === 'preview') return [IDLE, { preview: null }];
  const tap = e.at - s.start < HOLD_MS && s.lane === s.origin;
  return [IDLE, tap ? { send: s.origin } : {}];
}

/** Index of the lane button under an element, or null. */
function laneOf(box: HTMLElement, target: Element | null): number | null {
  const b = target?.closest('.lane');
  if (!b || !box.contains(b) || (b as HTMLButtonElement).disabled) return null;
  const i = Array.prototype.indexOf.call(box.children, b);
  return i < 0 ? null : i;
}

/**
 * Wires taps and holds on the lane box. Listeners sit on the box, which survives renderLanes
 * rebuilding its buttons. Keyboard activation (a click with no pointer) still taps.
 * Returns a cancel function for when the board changes under a press (undo, restart, rewind).
 */
export function bindLanePress(box: HTMLElement, onTap: (lane: number) => void, onPreview: (lane: number | null) => void): () => void {
  let s = IDLE, timer = 0;
  const feed = (e: PressEvent) => {
    const [n, o] = pressStep(s, e);
    if (o.preview !== undefined && o.preview !== null && s.phase !== 'preview') navigator.vibrate?.(10);
    s = n;
    if (s.phase === 'idle') clearTimeout(timer);
    if (o.preview !== undefined) onPreview(o.preview);
    if (o.send !== undefined) onTap(o.send);
  };
  box.addEventListener('pointerdown', (ev) => {
    const lane = laneOf(box, ev.target as Element);
    if (lane === null || !ev.isPrimary) return;
    box.setPointerCapture(ev.pointerId);
    feed({ t: 'down', lane, at: performance.now() });
    clearTimeout(timer);
    timer = window.setTimeout(() => feed({ t: 'timer', at: performance.now() }), HOLD_MS);
  });
  box.addEventListener('pointermove', (ev) => {
    if (s.phase !== 'idle') feed({ t: 'move', lane: laneOf(box, document.elementFromPoint(ev.clientX, ev.clientY)) });
  });
  box.addEventListener('pointerup', () => feed({ t: 'up', at: performance.now() }));
  box.addEventListener('pointercancel', () => feed({ t: 'cancel' }));
  box.addEventListener('click', (ev) => {
    if (ev.detail !== 0) return; // pointer clicks are handled above
    const lane = laneOf(box, ev.target as Element);
    if (lane !== null) onTap(lane);
  });
  box.addEventListener('contextmenu', (ev) => ev.preventDefault());
  return () => feed({ t: 'cancel' });
}
