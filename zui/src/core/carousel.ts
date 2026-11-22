// Lógica del Carousel ampliado (oleada 7) que comparten React y el modo DOM: reproducción automática con pausa
// (WCAG 2.2.2: botón visible, pausa al pasar el puntero, con el foco dentro, con la pestaña oculta o fuera de
// pantalla; sin arranque automático con movimiento reducido), posiciones del modo «snap» (varias por página y
// vertical, sobre el desplazamiento nativo con scroll-snap) e indicadores. Sin documento al importar.

/** Motivos de pausa que no decide la persona: se suman y la reproducción sigue cuando no queda ninguno. */
export type PauseReason = "hover" | "focus" | "hidden" | "offscreen" | "drag";

export interface AutoplayOptions {
  /** Milisegundos entre pasos (mínimo 1500). */
  interval: number;
  /** Avanza un paso. */
  onTick: () => void;
  /** Cambia el estado visible (botón de pausa, aria-live). */
  onChange?: (playing: boolean) => void;
  /** Empieza a contar un intervalo entero (el indicador `progress` vuelve a llenarse desde cero). */
  onSchedule?: () => void;
  /** Temporizadores inyectables (pruebas). */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export interface Autoplay {
  /** La persona pulsa reproducir. */
  play(): void;
  /** La persona pulsa pausa: manda sobre todo lo demás hasta que vuelva a pulsar reproducir. */
  pause(): void;
  toggle(): void;
  /** Pausa o reanuda por un motivo automático. */
  hold(reason: PauseReason, on: boolean): void;
  /** Vuelve a contar el intervalo (tras una navegación manual). */
  restart(): void;
  readonly playing: boolean;
  /** La persona la tiene activada (aunque esté retenida por un motivo). */
  readonly wanted: boolean;
  dispose(): void;
}

export const MIN_INTERVAL = 1500;
export const DEFAULT_INTERVAL = 5000;

/** Intervalo de `autoplay`: `true` da el de por defecto; un número se acota al mínimo; lo demás, sin reproducción. */
export function autoplayInterval(autoplay: boolean | number | undefined | null): number | null {
  if (autoplay === true) return DEFAULT_INTERVAL;
  if (typeof autoplay === "number" && Number.isFinite(autoplay) && autoplay > 0) return Math.max(MIN_INTERVAL, Math.round(autoplay));
  return null;
}

/**
 * Reproducción automática. `wanted` arranca en `start` (falso con movimiento reducido: la persona la enciende con el
 * botón). Mientras haya un motivo de pausa no corre el reloj; al quitarse el último, cuenta un intervalo entero.
 */
export function createAutoplay(options: AutoplayOptions, start = true): Autoplay {
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const interval = Math.max(MIN_INTERVAL, options.interval);
  const reasons = new Set<PauseReason>();
  let wanted = start;
  let timer: unknown = null;
  let last: boolean | null = null;
  let disposed = false;

  const playing = () => !disposed && wanted && reasons.size === 0;
  const stop = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const schedule = () => {
    stop();
    if (!playing()) return;
    timer = setTimer(() => {
      timer = null;
      if (!playing()) return;
      options.onTick();
      schedule();
    }, interval);
    options.onSchedule?.();
  };
  const sync = () => {
    const now = playing();
    if (now !== last) {
      last = now;
      options.onChange?.(now);
    }
    if (now && timer === null) schedule();
    if (!now) stop();
  };
  sync();
  return {
    play() {
      wanted = true;
      // Pulsar reproducir con el foco en el botón no debe quedar retenido por ese mismo foco.
      reasons.delete("focus");
      reasons.delete("hover");
      sync();
    },
    pause() {
      wanted = false;
      sync();
    },
    toggle() {
      if (wanted) this.pause();
      else this.play();
    },
    hold(reason, on) {
      if (on) reasons.add(reason);
      else reasons.delete(reason);
      sync();
    },
    restart() {
      if (playing()) schedule();
    },
    get playing() {
      return playing();
    },
    get wanted() {
      return wanted;
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}

/* ---------- Modo snap: varias por página y vertical ---------- */

/** Número de posiciones de un carrusel sin bucle con `perPage` visibles: la última muestra los últimos `perPage`. */
export const snapPositions = (count: number, perPage: number) => Math.max(1, Math.floor(count) - Math.max(1, Math.floor(perPage)) + 1);

/**
 * Slides por página que caben de verdad: los pedidos, o menos si la tira es más estrecha que esos slides a su ancho
 * mínimo (cada slide mide `slide`, separados por `gap`, en una vista de `view`). Nunca menos de uno.
 */
export function fitPerPage(requested: number, view: number, slide: number, gap: number): number {
  const wanted = perPageOf(requested);
  if (!(view > 0) || !(slide > 0)) return wanted;
  return Math.max(1, Math.min(wanted, Math.floor((view + gap + 0.5) / (slide + gap))));
}

/** Slides por página válidos (1–8). */
export const perPageOf = (value: number | undefined) => (Number.isFinite(value) && value! >= 1 ? Math.min(8, Math.floor(value!)) : 1);

/**
 * Posición activa según el desplazamiento: el slide cuyo inicio queda más cerca del inicio de la vista. `step` es el
 * tamaño de un slide más el hueco. En RTL el desplazamiento horizontal es negativo: se usa su valor absoluto.
 */
export function snapIndexAt(scroll: number, step: number, positions: number): number {
  if (!(step > 0) || positions <= 1) return 0;
  return Math.min(positions - 1, Math.max(0, Math.round(Math.abs(scroll) / step)));
}

/** Siguiente posición al avanzar `direction`, sin bucle o con él (`loop`: de la última a la primera). */
export function stepIndex(index: number, direction: 1 | -1, positions: number, loop: boolean): number {
  const next = index + direction;
  if (next < 0) return loop ? positions - 1 : 0;
  if (next >= positions) return loop ? 0 : positions - 1;
  return next;
}

/** Tipos de indicador. `counter` es el de siempre (01/05); `progress` son puntos cuyo actual se llena con el autoplay. */
export type CarouselIndicators = "counter" | "dots" | "bar" | "thumbnails" | "progress" | "none";
export const INDICATORS: readonly CarouselIndicators[] = ["counter", "dots", "bar", "thumbnails", "progress", "none"];
export const isIndicators = (v: unknown): v is CarouselIndicators => typeof v === "string" && (INDICATORS as readonly string[]).includes(v);

/** Progreso de la barra: fracción (0–1) del recorrido en la posición `index` de `positions`. */
export const barProgress = (index: number, positions: number) => (positions <= 1 ? 1 : Math.min(1, Math.max(0, (index + 1) / positions)));

/** «Slide {index} of {count}» con el índice desde 1. */
export const slideText = (template: string, index: number, count: number) =>
  template.replace("{index}", String(index + 1)).replace("{count}", String(count));
