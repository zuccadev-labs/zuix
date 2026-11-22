// Trabajo que no es urgente, fuera del camino de una interacción, para no alargar las tareas largas: avisar del rango visible, cargar sus eventos o medir tras pintar va después del
// siguiente fotograma, con `scheduler.postTask` donde exista y `setTimeout` donde no. Sin efectos al importar.

type Priority = "user-blocking" | "user-visible" | "background";
interface Scheduler {
  postTask?: (fn: () => void, options?: { priority?: Priority; signal?: AbortSignal }) => Promise<unknown>;
}
const scheduler = (): Scheduler | undefined => (globalThis as { scheduler?: Scheduler }).scheduler;

/** Encola `fn` como tarea propia (con la prioridad pedida si hay `scheduler.postTask`); no corre si `signal` se aborta. */
export function postTask(fn: () => void, { priority = "user-visible", signal }: { priority?: Priority; signal?: AbortSignal } = {}): void {
  if (signal?.aborted) return;
  const run = () => {
    if (!signal?.aborted) fn();
  };
  const post = scheduler()?.postTask;
  if (post) {
    post.call(scheduler(), run, { priority, signal }).catch(() => {});
    return;
  }
  setTimeout(run, 0);
}

/**
 * Corre `fn` después del próximo pintado: un fotograma (`requestAnimationFrame`) y luego una tarea. Lo que pinta la
 * interacción llega a la pantalla primero; lo demás, justo después. Sin `requestAnimationFrame` (servidor,
 * pestaña oculta que no pinta), solo la tarea.
 */
export function afterPaint(fn: () => void, options: { priority?: Priority; signal?: AbortSignal } = {}): void {
  if (options.signal?.aborted) return;
  const raf = (globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame;
  const hidden = (globalThis as { document?: Document }).document?.visibilityState === "hidden";
  if (!raf || hidden) postTask(fn, options);
  else raf(() => postTask(fn, options));
}
