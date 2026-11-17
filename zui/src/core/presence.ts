// Presencia: esperar la animación de salida (`data-state="closed"`) antes de retirar o desmontar un elemento.

export const EXIT_MS = 220;

export function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Llama a `done` cuando termina la animación de salida de `el`, o tras `timeout` ms si no hay animación (o no
 * avisa). Con movimiento reducido, de inmediato. Devuelve una función que cancela la espera.
 */
export function afterExit(el: HTMLElement, done: () => void, timeout = EXIT_MS): () => void {
  if (reducedMotion()) {
    done();
    return () => {};
  }
  // Sin animación de salida declarada no hay nada que esperar.
  const style = getComputedStyle(el);
  if (style.animationName === "none" || (style.animationName !== "" && !(parseFloat(style.animationDuration) > 0))) {
    done();
    return () => {};
  }
  let finished = false;
  const stop = () => {
    finished = true;
    el.removeEventListener("animationend", onEnd);
    el.removeEventListener("animationcancel", onEnd);
    clearTimeout(timer);
  };
  const finish = () => {
    if (finished) return;
    stop();
    done();
  };
  const onEnd = (event: AnimationEvent) => {
    if (event.target === el) finish();
  };
  el.addEventListener("animationend", onEnd);
  el.addEventListener("animationcancel", onEnd);
  const timer = setTimeout(finish, timeout);
  return stop;
}
