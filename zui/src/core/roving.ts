// Foco itinerante: a qué elemento de una lista lleva una tecla. Sin DOM: recibe la lista ya filtrada
// (sin deshabilitados) y la tecla ya reflejada con `logicalKey` si el eje es horizontal.

/** Flechas del eje (con vuelta al otro extremo), Home y End. `undefined` si la tecla no navega. */
export function move<T>(list: ReadonlyArray<T>, current: T | null | undefined, key: string, vertical: boolean, loop = true): T | undefined {
  if (!list.length) return undefined;
  const i = list.indexOf(current as T);
  const last = list.length - 1;
  if (key === (vertical ? "ArrowDown" : "ArrowRight")) return i >= last ? (loop ? list[0] : list[last]) : list[i + 1];
  if (key === (vertical ? "ArrowUp" : "ArrowLeft")) return i <= 0 ? (loop || i < 0 ? list[last] : list[0]) : list[i - 1];
  if (key === "Home") return list[0];
  if (key === "End") return list[last];
  return undefined;
}

/** Como `move` en vertical, para listas de opciones: sin vuelta al otro extremo salvo `wrap`. */
export function step<T>(list: ReadonlyArray<T>, current: T | null | undefined, key: string, wrap: boolean): T | undefined {
  return move(list, current, key, true, wrap);
}

/** Flechas de los dos ejes a la vez (radios, segmentos): abajo y derecha avanzan. */
export function moveBoth<T>(list: ReadonlyArray<T>, current: T | null | undefined, key: string, loop = true): T | undefined {
  return move(list, current, key, true, loop) ?? move(list, current, key, false, loop);
}
