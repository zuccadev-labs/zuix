// Un solo temporizador para todos los relojes de la página (Clock, AnalogClock, WorldClock, Countdown): se programa
// al siguiente borde de segundo o de minuto que alguien necesite, no con `setInterval`, así que no deriva. Se para
// con la pestaña oculta y para cada pieza que queda fuera de pantalla (IntersectionObserver con margen); al volver,
// la pieza se pone al día en el acto. Sin efectos al importar: el temporizador, el observador y el listener de
// visibilidad aparecen con la primera suscripción y se van con la última.

export type TickUnit = "second" | "minute";

interface Subscriber {
  el: Element | null;
  size: number;
  run: (now: number) => void;
  visible: boolean;
  /** Último borde (`floor(now / size)`) que recibió. */
  last: number;
}

type Observer = Pick<IntersectionObserver, "observe" | "unobserve" | "disconnect">;

const subscribers = new Set<Subscriber>();
let timer: ReturnType<typeof setTimeout> | undefined;
let observer: Observer | null = null;
let listening = false;

/** Margen alrededor del viewport: el reloj se pone al día un poco antes de entrar a la vista. */
export const TICK_MARGIN = "200px";

const sizeOf = (unit: TickUnit) => (unit === "minute" ? 60_000 : 1000);
const doc = () => (typeof document === "undefined" ? null : document);
const hidden = () => doc()?.visibilityState === "hidden";

function deliver(sub: Subscriber, now: number, force = false): void {
  const edge = Math.floor(now / sub.size);
  if (!force && edge === sub.last) return;
  sub.last = edge;
  sub.run(now);
}

function schedule(): void {
  clearTimeout(timer);
  timer = undefined;
  if (hidden()) return;
  const now = Date.now();
  let wait = Number.POSITIVE_INFINITY;
  for (const sub of subscribers) if (sub.visible) wait = Math.min(wait, sub.size - (now % sub.size));
  if (!Number.isFinite(wait)) return;
  // Unos milisegundos tras el borde: el reloj ya marca el segundo nuevo al despertar.
  timer = setTimeout(fire, wait + 4);
}

function fire(): void {
  timer = undefined;
  const now = Date.now();
  for (const sub of [...subscribers]) {
    if (sub.el && !sub.el.isConnected) continue;
    if (sub.visible) deliver(sub, now);
  }
  schedule();
}

function onVisibility(): void {
  if (hidden()) {
    clearTimeout(timer);
    timer = undefined;
    return;
  }
  const now = Date.now();
  for (const sub of subscribers) if (sub.visible) deliver(sub, now);
  schedule();
}

function watchVisibility(): void {
  const d = doc();
  if (listening || !d) return;
  listening = true;
  d.addEventListener("visibilitychange", onVisibility);
}

function intersection(): Observer | null {
  if (observer) return observer;
  const IO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
  if (!IO) return null;
  observer = new IO(
    (entries) => {
      const now = Date.now();
      for (const entry of entries)
        for (const sub of subscribers) {
          if (sub.el !== entry.target) continue;
          const was = sub.visible;
          sub.visible = entry.isIntersecting;
          if (!was && sub.visible) deliver(sub, now);
        }
      schedule();
    },
    { rootMargin: TICK_MARGIN },
  );
  return observer;
}

/**
 * Llama a `run(now)` en cada borde de `unit` (segundo o minuto) mientras `el` está cerca de la pantalla y la pestaña
 * se ve. Con `el` nulo (o sin IntersectionObserver) solo cuenta la pestaña. Devuelve la baja.
 */
export function subscribeTick(el: Element | null, unit: TickUnit, run: (now: number) => void): () => void {
  const sub: Subscriber = { el, size: sizeOf(unit), run, visible: true, last: Math.floor(Date.now() / sizeOf(unit)) };
  subscribers.add(sub);
  watchVisibility();
  const io = el ? intersection() : null;
  if (io && el) io.observe(el);
  schedule();
  return () => {
    if (!subscribers.delete(sub)) return;
    if (io && el && ![...subscribers].some((s) => s.el === el)) io.unobserve(el);
    if (!subscribers.size) stopAll();
    else schedule();
  };
}

function stopAll(): void {
  clearTimeout(timer);
  timer = undefined;
  observer?.disconnect();
  observer = null;
  if (listening) doc()?.removeEventListener("visibilitychange", onVisibility);
  listening = false;
}

/** Suscripciones vivas y si hay un temporizador programado (para las pruebas). */
export const tickerState = () => ({ subscribers: subscribers.size, scheduled: timer !== undefined });

/** Olvida todas las suscripciones (para las pruebas). */
export function resetTicker(): void {
  subscribers.clear();
  stopAll();
}
