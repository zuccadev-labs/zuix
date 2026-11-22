// Onda de una nota de voz: muestras de audio (de un AudioBuffer o de un array) reducidas a N picos entre 0 y 1, el
// remuestreo de unos picos ya calculados al número de barras que caben, qué barras van «reproducidas» y la duración
// como reloj (`0:07`, `1:02:03`). Puro.

/** Alto mínimo de una barra: un silencio se sigue viendo como onda, no como hueco. */
export const PEAK_FLOOR = 0.08;

/** `n` picos normalizados (el mayor vale 1) a partir de muestras con signo. */
export function peaksFrom(samples: ArrayLike<number>, n: number, floor = PEAK_FLOOR): number[] {
  const count = Math.max(1, Math.floor(n));
  const len = samples.length;
  if (!len) return Array.from({ length: count }, () => floor);
  const raw: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * len) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * len) / count));
    let peak = 0;
    for (let j = from; j < to && j < len; j++) {
      const v = Math.abs(Number(samples[j]) || 0);
      if (v > peak) peak = v;
    }
    raw.push(peak);
  }
  const max = Math.max(...raw);
  return raw.map((v) => (max > 0 ? Math.max(floor, Math.min(1, v / max)) : floor));
}

/** Remuestrea picos (de cualquier escala) a `n` barras entre `floor` y 1. Sin picos, una onda plana. */
export function resamplePeaks(peaks: readonly number[] | undefined, n: number, floor = PEAK_FLOOR): number[] {
  const count = Math.max(1, Math.floor(n));
  const clean = (peaks ?? []).map((v) => (Number.isFinite(v) ? Math.abs(v) : 0));
  if (!clean.length) return Array.from({ length: count }, () => floor);
  const max = Math.max(...clean) || 1;
  return Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i * clean.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * clean.length) / count));
    let peak = 0;
    for (let j = from; j < to && j < clean.length; j++) peak = Math.max(peak, clean[j]!);
    return Math.max(floor, Math.min(1, peak / max));
  });
}

/** Barras ya reproducidas para un progreso 0–1. */
export const playedBars = (progress: number, n: number) =>
  Math.max(0, Math.min(n, Math.round((Number.isFinite(progress) ? progress : 0) * n)));

/** Duración como reloj: `0:07`, `12:30`, `1:02:03`. */
export function clockText(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Siguiente velocidad de la lista (1 → 1.5 → 2 → 1). */
export function nextRate(rates: readonly number[], current: number): number {
  const list = rates.length ? rates : [1];
  const i = list.indexOf(current);
  return list[(i + 1) % list.length] ?? 1;
}
