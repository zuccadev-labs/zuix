// Pulsación larga con dedo o lápiz (abre el menú contextual donde el navegador no emite `contextmenu`).
import type { Point } from "./menu-aim";

export const LONG_PRESS_MS = 600;
const SLOP = 10;

export interface LongPress {
  /** `pointerdown` sobre la zona. El ratón no cuenta: tiene botón derecho. */
  down(event: PointerEvent): void;
  move(event: PointerEvent): void;
  cancel(): void;
  /** Hay una pulsación en curso que aún no ha vencido. */
  pending(): boolean;
  /** Milisegundos desde la última pulsación larga cumplida (Infinity si no hubo). */
  sinceFired(): number;
}

export function createLongPress(fire: (point: Point, event: PointerEvent) => void, ms = LONG_PRESS_MS): LongPress {
  let press: { id: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | undefined;
  let firedAt = Number.NEGATIVE_INFINITY;
  const cancel = () => {
    if (press) clearTimeout(press.timer);
    press = undefined;
  };
  return {
    down(event) {
      cancel();
      if (event.pointerType === "mouse") return;
      const point = { x: event.clientX, y: event.clientY };
      const timer = setTimeout(() => {
        press = undefined;
        firedAt = Date.now();
        fire(point, event);
      }, ms);
      press = { id: event.pointerId, ...point, timer };
    },
    move(event) {
      if (press && event.pointerId === press.id && Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP) cancel();
    },
    cancel,
    pending: () => press !== undefined,
    sinceFired: () => Date.now() - firedAt,
  };
}
