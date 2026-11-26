// Grabación de voz (VoiceInput): qué falta para grabar (MediaRecorder, micrófono), el tipo de audio que admite el
// navegador, el tiempo grabado descontando las pausas y la historia corta del nivel de la señal que dibuja las barras.
// Puro: la grabación vive en ./voice-input-widget.

export type RecorderProblem = "unsupported" | "denied" | "failed";

/** Qué falta para grabar en esta ventana; `null` si se puede intentar. */
export function recorderSupport(view: unknown): RecorderProblem | null {
  const w = view as { MediaRecorder?: unknown; navigator?: { mediaDevices?: { getUserMedia?: unknown } }; isSecureContext?: boolean } | null;
  if (!w || typeof w.MediaRecorder !== "function") return "unsupported";
  if (typeof w.navigator?.mediaDevices?.getUserMedia !== "function") return "unsupported";
  if (w.isSecureContext === false) return "unsupported";
  return null;
}

/** El error de `getUserMedia` o del grabador, a un problema: permiso negado o fallo. */
export function problemOf(error: unknown): RecorderProblem {
  const name = (error as { name?: string } | null)?.name ?? "";
  return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError" ? "denied" : "failed";
}

/** Primer tipo de la lista que admite el grabador, o "" (que elija él). */
export function pickMimeType(isSupported: ((type: string) => boolean) | undefined, preferred: readonly string[] = MIME_TYPES): string {
  if (!isSupported) return "";
  for (const type of preferred) {
    try {
      if (isSupported(type)) return type;
    } catch {
      // Un tipo mal formado no corta la búsqueda.
    }
  }
  return "";
}

export const MIME_TYPES: readonly string[] = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export interface RecordingClock {
  startedAt: number;
  /** Tiempo acumulado en pausa (ms). */
  pausedMs: number;
  /** Desde cuándo está en pausa, o `null`. */
  pausedAt: number | null;
}

/** Milisegundos grabados en `now`, sin contar las pausas. */
export function recordedMs(clock: RecordingClock, now: number): number {
  const end = clock.pausedAt ?? now;
  return Math.max(0, end - clock.startedAt - clock.pausedMs);
}

export const pauseClock = (clock: RecordingClock, now: number): RecordingClock => (clock.pausedAt === null ? { ...clock, pausedAt: now } : clock);

export const resumeClock = (clock: RecordingClock, now: number): RecordingClock =>
  clock.pausedAt === null ? clock : { ...clock, pausedMs: clock.pausedMs + Math.max(0, now - clock.pausedAt), pausedAt: null };

/** Añade una lectura de nivel (0–1) y se queda con las últimas `max`. */
export function pushLevel(levels: readonly number[], level: number, max: number): number[] {
  const v = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  const keep = Math.max(1, Math.floor(max));
  const next = [...levels, v];
  return next.length > keep ? next.slice(next.length - keep) : next;
}

/** Nivel de un bloque de muestras con signo: el pico, con una curva que hace visible la voz baja. */
export function levelOf(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(Number(samples[i]) || 0));
  return Math.min(1, Math.sqrt(peak));
}

/** Barras para pintar: las últimas lecturas, alineadas al final, con un mínimo visible. */
export function levelBars(levels: readonly number[], count: number, floor = 0.08): number[] {
  const n = Math.max(1, Math.floor(count));
  const tail = levels.slice(-n);
  const pad = Array.from({ length: n - tail.length }, () => floor);
  return [...pad, ...tail.map((v) => Math.max(floor, Math.min(1, Number.isFinite(v) ? v : 0)))];
}
