// Historias conectadas al documento (lo comparten React y el modo DOM; se llama al montar, nunca al importar). El
// marcado trae todos los grupos y sus historias; aquí se muestra el actual, se llenan las barras con el reloj
// (requestAnimationFrame), se pausa con la pulsación larga, la pestaña oculta y fuera de pantalla, y se anuncia la
// posición en la región viva central. Con movimiento reducido no avanza sola: empieza en pausa.

import { announce } from "./announcer";
import {
  barFill,
  durationOf,
  goToGroup,
  initialStories,
  jumpGroup,
  nextStory,
  prevStory,
  storyText,
  tickStories,
  type StoriesEvent,
  type StoriesShape,
  type StoriesState,
} from "./stories";

export interface StoriesBindOptions {
  /** Duración por defecto de cada historia (ms). */
  duration?: number;
  initialGroup?: number;
  /** «Story {index} of {count}, {author}». */
  storyLabel?: string;
  onChange?: (state: StoriesState, event: StoriesEvent | null) => void;
  onComplete?: () => void;
}

export interface StoriesHandle {
  next(): void;
  prev(): void;
  nextGroup(): void;
  prevGroup(): void;
  goToGroup(group: number): void;
  toggle(): void;
  readonly state: StoriesState;
  /** Vuelve a leer grupos e historias (marcado nuevo). */
  refresh(): void;
  dispose(): void;
}

const HOLD_MS = 250;

/** Conecta `root` (`.z-stories`). Los botones llevan `data-stories-action` (prev, next, pause, prev-group, next-group). */
export function bindStories(root: HTMLElement, o: StoriesBindOptions = {}): StoriesHandle {
  const win = root.ownerDocument.defaultView ?? window;
  const reduced = win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const groups = () => [...root.querySelectorAll<HTMLElement>(".z-stories__group")];
  const itemsOf = (g: HTMLElement | undefined) => (g ? [...g.querySelectorAll<HTMLElement>(".z-stories__item")] : []);
  const fallback = durationOf(o.duration);
  let shape: StoriesShape;
  const readShape = () => {
    const all = groups().map(itemsOf);
    shape = {
      sizes: all.map((items) => Math.max(1, items.length)),
      duration: (g, i) => durationOf(Number(all[g]?.[i]?.dataset.duration), fallback),
    };
  };
  readShape();
  let state: StoriesState = { ...initialStories(o.initialGroup ?? 0, shape!.sizes), paused: reduced };
  const holds = new Set<string>();
  let frame = 0;
  let last = 0;
  let disposed = false;

  const authorOf = (g: number) => groups()[g]?.dataset.author ?? "";
  const paint = () => {
    const all = groups();
    all.forEach((group, g) => {
      const active = g === state.group;
      group.toggleAttribute("data-active", active);
      itemsOf(group).forEach((item, i) => {
        item.toggleAttribute("data-active", active && i === state.item);
      });
      if (!active) return;
      group.querySelectorAll<HTMLElement>(".z-stories__fill").forEach((fill, i) => {
        fill.style.setProperty("--z-story-fill", barFill(shape, state, i).toFixed(4));
      });
    });
    root.dataset.state = state.paused || state.done ? "paused" : "playing";
    root.toggleAttribute("data-held", holds.size > 0);
    const pause = root.querySelector<HTMLElement>('[data-stories-action="pause"]');
    pause?.setAttribute("aria-pressed", String(state.paused));
    const prevGroup = root.querySelector<HTMLButtonElement>('[data-stories-action="prev-group"]');
    const nextGroup = root.querySelector<HTMLButtonElement>('[data-stories-action="next-group"]');
    if (prevGroup) prevGroup.disabled = state.group === 0;
    if (nextGroup) nextGroup.disabled = state.group >= shape.sizes.length - 1;
  };
  const say = () => {
    const count = shape.sizes[state.group] ?? 1;
    announce(storyText(o.storyLabel ?? "Story {index} of {count}, {author}", state.item, count, authorOf(state.group)), { source: root });
  };
  const commit = ([next, event]: [StoriesState, StoriesEvent | null], user: boolean) => {
    state = next;
    paint();
    if (event?.type === "complete") o.onComplete?.();
    if (event && event.type !== "complete" && user) say();
    o.onChange?.(state, event);
    schedule();
  };
  const loop = (now: number) => {
    frame = 0;
    if (disposed) return;
    const dt = last ? Math.min(100, now - last) : 0;
    last = now;
    const [next, event] = tickStories(shape, { ...state, held: holds.size > 0 }, dt);
    if (next !== state || event) {
      state = { ...next, held: false };
      paint();
      if (event?.type === "complete") o.onComplete?.();
      if (event) o.onChange?.(state, event);
    }
    if (!state.paused && !state.done && holds.size === 0) frame = win.requestAnimationFrame(loop);
  };
  function schedule() {
    const running = !state.paused && !state.done && holds.size === 0 && !disposed;
    if (running && !frame) {
      last = 0;
      frame = win.requestAnimationFrame(loop);
    } else if (!running && frame) {
      win.cancelAnimationFrame(frame);
      frame = 0;
    }
  }
  const hold = (reason: string, on: boolean) => {
    if (on) holds.add(reason);
    else holds.delete(reason);
    paint();
    schedule();
  };

  const api = {
    next: () => commit(nextStory(shape, state), true),
    prev: () => commit(prevStory(shape, state), true),
    nextGroup: () => commit(jumpGroup(shape, state, 1), true),
    prevGroup: () => commit(jumpGroup(shape, state, -1), true),
    goToGroup: (g: number) => commit([goToGroup(shape, state, g), { type: "group" }], true),
    toggle: () => {
      // Al reanudar tras terminar, vuelve a empezar la última historia.
      state = state.done ? { ...state, done: false, elapsed: 0, paused: false } : { ...state, paused: !state.paused };
      paint();
      o.onChange?.(state, null);
      schedule();
    },
  };

  // Pulsación larga = pausa; un toque corto en una zona de paso navega (el clic del botón).
  let press: { id: number; timer: ReturnType<typeof setTimeout>; held: boolean } | null = null;
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || !(event.target instanceof Element) || !event.target.closest(".z-stories__viewer")) return;
    if (event.target.closest('[data-stories-action]:not([data-stories-action="prev"], [data-stories-action="next"])')) return;
    const p = {
      id: event.pointerId,
      held: false,
      timer: setTimeout(() => {
        p.held = true;
        hold("press", true);
      }, HOLD_MS),
    };
    press = p;
  };
  const onUp = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    clearTimeout(press.timer);
    if (press.held) {
      hold("press", false);
      // El clic que sigue a una pulsación larga no navega.
      const swallow = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
      };
      root.addEventListener("click", swallow, { capture: true, once: true });
      win.setTimeout(() => root.removeEventListener("click", swallow, { capture: true }), 0);
    }
    press = null;
  };
  const onClick = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-stories-action]") : null;
    if (!button || !root.contains(button)) return;
    const action = button.dataset.storiesAction;
    if (action === "next") api.next();
    else if (action === "prev") api.prev();
    else if (action === "pause") api.toggle();
    else if (action === "next-group") api.nextGroup();
    else if (action === "prev-group") api.prevGroup();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = getComputedStyle(root).direction === "rtl";
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const forward = (event.key === "ArrowRight") !== rtl;
      if (forward) api.next();
      else api.prev();
    } else if (event.key === " " && !(event.target instanceof Element && event.target.closest("button, a, input, textarea, select"))) {
      event.preventDefault();
      api.toggle();
    }
  };
  const onVisibility = () => hold("hidden", root.ownerDocument.visibilityState === "hidden");
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKey);
  root.ownerDocument.addEventListener("visibilitychange", onVisibility);
  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) hold("offscreen", !entry.isIntersecting);
    });
    io.observe(root);
  }
  paint();
  schedule();
  return {
    ...api,
    get state() {
      return state;
    },
    refresh() {
      readShape();
      state = { ...state, group: Math.min(state.group, shape.sizes.length - 1), item: 0, elapsed: 0 };
      paint();
      schedule();
    },
    dispose() {
      disposed = true;
      if (frame) win.cancelAnimationFrame(frame);
      if (press) clearTimeout(press.timer);
      io?.disconnect();
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKey);
      root.ownerDocument.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
