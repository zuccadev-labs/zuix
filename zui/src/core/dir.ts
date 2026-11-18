// Dirección de lectura. Se lee del DOM (CSS `direction`), no de una prop: vale para React y para el modo DOM.

/** Verdadero si el elemento se lee de derecha a izquierda. */
export const isRtl = (el: Element) => getComputedStyle(el).direction === "rtl";

/** Intercambia ArrowLeft y ArrowRight en RTL: la flecha que apunta hacia el final de la línea avanza. */
export function logicalKey(key: string, el: Element): string {
  if ((key !== "ArrowLeft" && key !== "ArrowRight") || !isRtl(el)) return key;
  return key === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";
}
