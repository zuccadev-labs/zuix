// Cajón que se arrastra (Drawer): arrastrar el asa para cerrarlo y, con puntos de anclaje, para cambiar su alto
// entre esos puntos. `sheetRelease` y `snapKey` son aritmética pura; `attachSheet` conecta el puntero y el teclado
// del asa a un cajón ya montado. La comparten el binding de React y el modo DOM. Sin efectos al importar.

export type SheetSide = "top" | "right" | "bottom" | "left";

export interface SheetReleaseInput {
  /** Píxeles arrastrados hacia el cierre (negativo: hacia fuera, para crecer). */
  offset: number;
  /** Velocidad al soltar en px/ms, positiva hacia el cierre. */
  velocity: number;
  /** Tamaños de los puntos de anclaje en px, de menor a mayor (uno solo si no hay anclajes). */
  sizes: number[];
  /** Índice del anclaje en el que empezó el arrastre. */
  current: number;
}

/** Cuánto empuja la inercia al soltar: la velocidad por este tiempo (ms) se suma al desplazamiento. */
const MOMENTUM_MS = 160;
/** Velocidad máxima que se tiene en cuenta (px/ms). */
const MAX_VELOCITY = 2;

/**
 * Qué pasa al soltar: cerrar, o quedarse en el anclaje más cercano a donde iría el cajón con su inercia. Se cierra si
 * el tamaño proyectado baja de la mitad del anclaje menor (o de un tercio del único tamaño, sin anclajes).
 */
export function sheetRelease({ offset, velocity, sizes, current }: SheetReleaseInput): { close: true } | { close: false; index: number } {
  const from = sizes[current] ?? sizes[sizes.length - 1] ?? 0;
  const projected = from - offset - velocity * MOMENTUM_MS;
  const smallest = sizes[0] ?? 0;
  const limit = sizes.length > 1 ? smallest / 2 : (smallest * 2) / 3;
  if (projected < limit) return { close: true };
  let index = 0;
  for (let i = 1; i < sizes.length; i += 1) if (Math.abs(sizes[i]! - projected) < Math.abs(sizes[index]! - projected)) index = i;
  return { close: false, index };
}

/**
 * Anclaje al que lleva una tecla en el asa (patrón slider: el asa es role=slider). Las flechas que alejan el borde
 * libre del lado agrandan (en un cajón inferior, arriba; en uno superior, abajo); Inicio y Fin van al menor y al mayor.
 * `undefined` si la tecla no cambia el anclaje.
 */
export function snapKey(key: string, side: SheetSide, current: number, count: number): number | undefined {
  if (count <= 0) return undefined;
  const grow =
    side === "bottom"
      ? ["ArrowUp", "PageUp"]
      : side === "top"
        ? ["ArrowDown", "PageDown"]
        : side === "left"
          ? ["ArrowRight"]
          : ["ArrowLeft"];
  const shrink =
    side === "bottom"
      ? ["ArrowDown", "PageDown"]
      : side === "top"
        ? ["ArrowUp", "PageUp"]
        : side === "left"
          ? ["ArrowLeft"]
          : ["ArrowRight"];
  if (grow.includes(key)) return Math.min(count - 1, current + 1);
  if (shrink.includes(key)) return Math.max(0, current - 1);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return undefined;
}

export interface SheetOptions {
  side: SheetSide;
  /** Puntos de anclaje en fracción del alto (o ancho) disponible, de menor a mayor. Vacío: solo arrastrar para cerrar. */
  snaps: () => number[];
  /** Índice del anclaje actual. */
  current: () => number;
  onSnap: (index: number) => void;
  onClose: () => void;
}

const VERTICAL = (side: SheetSide) => side === "top" || side === "bottom";

/**
 * Conecta el asa (`handle`) de un cajón (`sheet`): con el puntero, el cajón sigue al dedo (variable
 * `--z-drawer-drag`, `data-dragging`) y al soltar se cierra o va al anclaje más cercano; con el teclado, el asa es un
 * slider entre anclajes (sin anclajes, Intro o Espacio cierran). Devuelve la desconexión.
 */
export function attachSheet(sheet: HTMLElement, handle: HTMLElement, options: SheetOptions): () => void {
  const wiring = new AbortController();
  const { signal } = wiring;
  let drag: { id: number; start: number; last: number; time: number; velocity: number } | undefined;
  const axis = (event: PointerEvent) => (VERTICAL(options.side) ? event.clientY : event.clientX);
  // Hacia el cierre es hacia el borde de la pantalla del lado del cajón.
  const toward = options.side === "bottom" || options.side === "right" ? 1 : -1;
  const sizes = () => {
    const room = VERTICAL(options.side) ? window.innerHeight : window.innerWidth;
    const snaps = options.snaps();
    if (snaps.length) return snaps.map((f) => f * room);
    const box = sheet.getBoundingClientRect();
    return [VERTICAL(options.side) ? box.height : box.width];
  };

  handle.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      const at = axis(event);
      drag = { id: event.pointerId, start: at, last: at, time: event.timeStamp, velocity: 0 };
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // Puntero sintético.
      }
    },
    { signal },
  );
  handle.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const at = axis(event);
      // Velocidad suavizada y acotada: un motor que entrega los movimientos en ráfaga no la dispara.
      const dt = Math.max(16, event.timeStamp - drag.time);
      const instant = ((at - drag.last) * toward) / dt;
      drag.velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, drag.velocity * 0.6 + instant * 0.4));
      drag.last = at;
      drag.time = event.timeStamp;
      const offset = (at - drag.start) * toward;
      // Un margen antes de dar el arrastre por empezado: un clic en el asa no mueve el cajón.
      if (!sheet.hasAttribute("data-dragging") && Math.abs(offset) < 4) return;
      sheet.setAttribute("data-dragging", "");
      // Sin anclajes no crece: solo se aleja hacia el cierre.
      const clamped = options.snaps().length ? offset : Math.max(0, offset);
      sheet.style.setProperty("--z-drawer-drag", `${clamped}px`);
    },
    { signal },
  );
  const end = (event: PointerEvent, cancelled: boolean) => {
    if (!drag || event.pointerId !== drag.id) return;
    const offset = (drag.last - drag.start) * toward;
    // Si el dedo se detuvo antes de soltar, no hay inercia.
    const velocity = event.timeStamp - drag.time > 80 ? 0 : drag.velocity;
    drag = undefined;
    const dragging = sheet.hasAttribute("data-dragging");
    sheet.removeAttribute("data-dragging");
    sheet.style.removeProperty("--z-drawer-drag");
    if (!dragging || cancelled) return;
    // El clic que sigue a un arrastre no activa el asa (si no llega, se retira para el siguiente clic real).
    const swallow = (click: Event) => {
      click.preventDefault();
      click.stopPropagation();
    };
    handle.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => handle.removeEventListener("click", swallow, { capture: true }));
    const result = sheetRelease({ offset, velocity, sizes: sizes(), current: options.current() });
    if (result.close) options.onClose();
    else if (result.index !== options.current()) options.onSnap(result.index);
  };
  handle.addEventListener("pointerup", (event) => end(event, false), { signal });
  handle.addEventListener("pointercancel", (event) => end(event, true), { signal });
  handle.addEventListener(
    "keydown",
    (event) => {
      const count = options.snaps().length;
      if (!count) return;
      const next = snapKey(event.key, options.side, options.current(), count);
      if (next === undefined) return;
      event.preventDefault();
      if (next !== options.current()) options.onSnap(next);
    },
    { signal },
  );
  return () => wiring.abort();
}
