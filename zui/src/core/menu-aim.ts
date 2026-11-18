// Zona de gracia del puntero entre una entrada de menú y su submenú: mientras el puntero viaja en diagonal hacia
// el submenú, pasar por encima de otras entradas no lo cierra. La zona es el polígono entre el punto por el que el
// puntero salió de la entrada y el borde cercano del submenú, y caduca a los `timeout` ms.
// Técnica de «pointer grace area» de Radix UI Primitives (MIT) y prueba de punto en polígono al modo de PNPOLY
// (W. R. Franklin); código propio. Avisos en zui/THIRD_PARTY_NOTICES.md.
import type { Box } from "./place";

export interface Point {
  x: number;
  y: number;
}

/** Punto dentro de un polígono (regla par-impar, trazando un rayo horizontal). */
export function inPolygon(point: Point, polygon: ReadonlyArray<Point>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Polígono de gracia: el punto de salida (retrasado `bleed` px) y las cuatro esquinas del submenú. */
export function graceArea(exit: Point, sub: Box, side: "left" | "right", bleed = 5): Point[] {
  const near = side === "right" ? sub.left : sub.left + sub.width;
  const far = side === "right" ? sub.left + sub.width : sub.left;
  const from = { x: exit.x + (side === "right" ? -bleed : bleed), y: exit.y };
  return [from, { x: near, y: sub.top }, { x: far, y: sub.top }, { x: far, y: sub.top + sub.height }, { x: near, y: sub.top + sub.height }];
}

export interface MenuAim {
  /** El puntero sale de la entrada con el submenú `sub` abierto hacia `side`. */
  start(exit: Point, sub: Box, side: "left" | "right"): void;
  /** Verdadero si el puntero, en `point`, sigue camino del submenú: no se toca lo que hay debajo. */
  blocks(point: Point): boolean;
  clear(): void;
}

export function createMenuAim(timeout = 300, now: () => number = Date.now): MenuAim {
  let area: Point[] | undefined;
  let side: "left" | "right" = "right";
  let since = 0;
  let last = 0;
  return {
    start(exit, sub, toward) {
      area = graceArea(exit, sub, toward);
      side = toward;
      since = now();
      last = exit.x;
    },
    blocks(point) {
      if (!area) return false;
      // Caducada, fuera del polígono o alejándose del submenú: deja de proteger.
      const away = side === "right" ? point.x < last : point.x > last;
      if (now() - since > timeout || away || !inPolygon(point, area)) {
        area = undefined;
        return false;
      }
      last = point.x;
      return true;
    },
    clear() {
      area = undefined;
    },
  };
}
