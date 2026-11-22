// Posición de una lista de chat: seguir el final mientras la persona está abajo, conservar lo que ve cuando se
// antepone historial (la diferencia de posición del mensaje que tenía delante) y cuántos mensajes nuevos quedan por
// debajo. Puro: quien pinta mide y aplica.

/** Margen (px) dentro del que se considera que la persona está al final. */
export const NEAR_END = 96;

export interface ScrollBox {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

/** La persona está al final (o a menos de `threshold` px). */
export const nearEnd = (box: ScrollBox, threshold = NEAR_END) => box.scrollHeight - box.clientHeight - box.scrollTop <= threshold;

/** La persona está arriba del todo (o a menos de `threshold` px): toca pedir historial. */
export const nearStart = (box: ScrollBox, threshold = NEAR_END) => box.scrollTop <= threshold;

/** Lo que tenía delante: la fila que corta el borde superior y su distancia a él. */
export interface ScrollAnchor {
  key: string;
  offset: number;
}

/**
 * Fila que hace de ancla: la primera cuyo final queda por debajo del borde superior. `rows` son las filas pintadas
 * con su posición (`top`, relativa al contenido) y su alto.
 */
export function pickAnchor(rows: readonly { key: string; top: number; height: number }[], scrollTop: number): ScrollAnchor | null {
  for (const row of rows) if (row.top + row.height > scrollTop) return { key: row.key, offset: row.top - scrollTop };
  return null;
}

/** Desplazamiento que devuelve el ancla a la misma distancia del borde tras volver a pintar (historial antepuesto). */
export const restoreAnchor = (anchor: ScrollAnchor, newTop: number) => Math.max(0, newTop - anchor.offset);

export type FollowAction = "end" | "keep";

/**
 * Qué hacer cuando cambia la lista: ir al final si la persona estaba abajo o si el mensaje es suyo (acaba de
 * enviarlo); si no, quedarse donde está y contar los nuevos.
 */
export function followAction(o: { wasNearEnd: boolean; ownMessage: boolean; prepended: boolean }): FollowAction {
  if (o.prepended) return "keep";
  return o.wasNearEnd || o.ownMessage ? "end" : "keep";
}

/** Nuevos por debajo: los que llegan mientras la persona lee arriba; vuelve a 0 al llegar al final. */
export function pendingBelow(previous: number, arrived: number, atEnd: boolean): number {
  if (atEnd) return 0;
  return Math.max(0, previous + Math.max(0, arrived));
}
