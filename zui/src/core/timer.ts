/**
 * Temporizador con pausas, para el cierre automático de un aviso (WCAG 2.2.1): mientras haya algún motivo de
 * pausa (puntero, foco, gesto, ventana sin foco) el tiempo no corre; al quitar el último continúa con lo que quedaba.
 */
export interface PausableTimer {
  start(): void;
  hold(reason: string): void;
  release(reason: string): void;
  stop(): void;
}

export function createTimer(duration: number, done: () => void): PausableTimer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let remaining = duration;
  let startedAt = 0;
  let stopped = false;
  const holds = new Set<string>();
  const run = () => {
    clearTimeout(timer);
    timer = undefined;
    if (stopped || !(duration > 0) || !Number.isFinite(duration) || holds.size) return;
    startedAt = Date.now();
    timer = setTimeout(() => {
      timer = undefined;
      done();
    }, remaining);
  };
  return {
    start: run,
    hold(reason) {
      if (!holds.size && timer !== undefined) remaining = Math.max(0, remaining - (Date.now() - startedAt));
      holds.add(reason);
      clearTimeout(timer);
      timer = undefined;
    },
    release(reason) {
      if (holds.delete(reason)) run();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
