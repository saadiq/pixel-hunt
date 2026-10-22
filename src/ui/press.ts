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

/** A click this soon after a pointer release is that press's own click, already handled. */
const CLICK_AFTER_UP_MS = 500;

/**
 * Turns raw pointer and click events into pressStep events: only the primary button, only the
 * pointer that started the press, and a hold timer that is trusted when it fires. `schedule`
 * runs a callback after HOLD_MS. Kept free of the DOM so these rules are testable.
 */
export class PressBinder {
  private s = IDLE;
  private id: number | null = null;
  private gen = 0;
  private lastUp = -Infinity;

  constructor(
    private onTap: (lane: number) => void,
    private onPreview: (lane: number | null) => void,
    private schedule: (fn: () => void) => void,
  ) {}

  private feed(e: PressEvent): void {
    const [n, o] = pressStep(this.s, e);
    this.s = n;
    if (o.preview !== undefined) this.onPreview(o.preview);
    if (o.send !== undefined) this.onTap(o.send);
  }

  /** Returns whether this pointer now owns the press (so the caller can capture it). */
  down(id: number, button: number, lane: number | null, at: number): boolean {
    if (button !== 0 || lane === null || this.id !== null) return false;
    this.id = id;
    const gen = ++this.gen, start = at;
    this.feed({ t: 'down', lane, at });
    this.schedule(() => { if (gen === this.gen && this.id === id) this.feed({ t: 'timer', at: start + HOLD_MS }); });
    return true;
  }

  move(id: number, lane: number | null): void {
    if (id === this.id) this.feed({ t: 'move', lane });
  }

  up(id: number, at: number): void {
    this.lastUp = at; // even for a press the board cancelled: its click must not tap
    if (id !== this.id) return;
    this.feed({ t: 'up', at });
    this.id = null;
  }

  /** Ends the press with no send: a pointer cancel (pass its id), or the board changing (no id). */
  cancel(id?: number): void {
    if (id !== undefined && id !== this.id) return;
    this.feed({ t: 'cancel' });
    this.id = null;
    this.gen++;
  }

  /** A click: from a keyboard or assistive tech it taps; right after a pointer press it is that press's echo. */
  click(lane: number | null, at: number): void {
    if (at - this.lastUp < CLICK_AFTER_UP_MS) { this.lastUp = -Infinity; return; }
    if (lane !== null) this.onTap(lane);
  }
}

/**
 * Wires taps and holds on the lane box. Listeners sit on the box, which survives renderLanes
 * rebuilding its buttons. Returns a cancel function for when the board changes under a press
 * (undo, restart, rewind).
 */
export function bindLanePress(box: HTMLElement, onTap: (lane: number) => void, onPreview: (lane: number | null) => void): () => void {
  let showing = false;
  const preview = (l: number | null) => {
    if (l !== null && !showing) navigator.vibrate?.(10);
    showing = l !== null;
    onPreview(l);
  };
  const b = new PressBinder(onTap, preview, (fn) => window.setTimeout(fn, HOLD_MS));
  box.addEventListener('pointerdown', (ev) => {
    if (b.down(ev.pointerId, ev.button, laneOf(box, ev.target as Element), performance.now())) box.setPointerCapture(ev.pointerId);
  });
  box.addEventListener('pointermove', (ev) => b.move(ev.pointerId, laneOf(box, document.elementFromPoint(ev.clientX, ev.clientY))));
  box.addEventListener('pointerup', (ev) => b.up(ev.pointerId, performance.now()));
  box.addEventListener('pointercancel', (ev) => b.cancel(ev.pointerId));
  box.addEventListener('click', (ev) => b.click(laneOf(box, ev.target as Element), performance.now()));
  box.addEventListener('contextmenu', (ev) => ev.preventDefault());
  return () => b.cancel();
}
