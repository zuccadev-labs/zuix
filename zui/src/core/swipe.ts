// Deslizar para descartar (avisos), con ratón, lápiz o dedo. El CSS lee `data-swipe` (move | cancel | end) y las
// variables `--z-toast-swipe-move-x|y` y `--z-toast-swipe-end-x|y`.

export type SwipeDirection = "right" | "left" | "up" | "down";

export interface SwipeOptions {
  direction: SwipeDirection;
  /** Empieza el gesto (pausa el cierre automático). */
  onStart?(): void;
  /** El gesto no llegó al umbral. */
  onCancel?(): void;
  /** El gesto superó el umbral: descartar. */
  onDismiss(): void;
  /** Píxeles a partir de los cuales soltar descarta. */
  threshold?: number;
  /** Prefijo de las variables CSS. */
  prefix?: string;
}

/** Dirección de descarte de un aviso según la posición de su región: hacia el borde en las centradas, a la derecha en el resto. */
export const swipeDirection = (position: string): SwipeDirection =>
  position.endsWith("center") ? (position.startsWith("top") ? "up" : "down") : "right";

/** Conecta el gesto a `item`. Devuelve la función que lo desconecta. */
export function swipeToDismiss(
  item: HTMLElement,
  { direction, onStart, onCancel, onDismiss, threshold = 50, prefix = "--z-toast-swipe" }: SwipeOptions,
): () => void {
  const vertical = direction === "up" || direction === "down";
  const sign = direction === "up" || direction === "left" ? -1 : 1;
  const axis = vertical ? "y" : "x";
  const wiring = new AbortController();
  const { signal } = wiring;
  let swipe: { id: number; x: number; y: number; active: boolean } | undefined;
  // Solo cuenta el avance en la dirección de descarte.
  const delta = (event: PointerEvent, from: { x: number; y: number }) =>
    Math.max(0, (vertical ? event.clientY - from.y : event.clientX - from.x) * sign) * sign;
  item.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || item.dataset.state === "closed") return;
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
    },
    { signal },
  );
  item.addEventListener(
    "pointermove",
    (event) => {
      if (!swipe || event.pointerId !== swipe.id) return;
      const moved = delta(event, swipe);
      if (!swipe.active) {
        // Un dedo tiembla más que un ratón: margen mayor antes de dar el gesto por empezado.
        const buffer = event.pointerType === "touch" ? 10 : 2;
        const cross = Math.abs(vertical ? event.clientX - swipe.x : event.clientY - swipe.y);
        if (Math.abs(moved) > buffer) {
          swipe.active = true;
          onStart?.();
          item.dataset.swipe = "move";
          try {
            item.setPointerCapture(event.pointerId);
          } catch {
            // Puntero sintético o ya liberado.
          }
        } else if (cross > buffer) {
          swipe = undefined;
          return;
        } else return;
      }
      item.style.setProperty(`${prefix}-move-${axis}`, `${moved}px`);
    },
    { signal },
  );
  const end = (event: PointerEvent, cancelled: boolean) => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const { active } = swipe;
    const moved = delta(event, swipe);
    swipe = undefined;
    if (!active) return;
    item.style.removeProperty(`${prefix}-move-${axis}`);
    // El clic que sigue al gesto no debe activar la acción ni el cierre que quedaran bajo el dedo.
    const swallow = (click: Event) => {
      click.preventDefault();
      click.stopPropagation();
    };
    item.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => item.removeEventListener("click", swallow, { capture: true }));
    if (!cancelled && Math.abs(moved) > threshold) {
      item.style.setProperty(`${prefix}-end-${axis}`, `${moved}px`);
      item.dataset.swipe = "end";
      onDismiss();
    } else {
      item.dataset.swipe = "cancel";
      onCancel?.();
    }
  };
  item.addEventListener("pointerup", (event) => end(event, false), { signal });
  item.addEventListener("pointercancel", (event) => end(event, true), { signal });
  return () => wiring.abort();
}
