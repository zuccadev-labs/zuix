// Reproductor de audio (AudioPlayer) y forma de onda (Waveform): saltos acotados, las teclas del reproductor (K o
// Espacio, J, L, como los reproductores de vídeo) y la onda calculada con Web Audio cuando no viene precalculada.
// La onda, el reloj, las velocidades y el control del <audio> son los de la nota de voz (./waveform, ./voice-control):
// aquí no se repiten.
import { peaksFrom } from "./waveform";

/** Posición tras saltar `delta` segundos, dentro de [0, duración]. */
export function skipBy(position: number, delta: number, duration: number): number {
  const p = Number.isFinite(position) ? position : 0;
  const d = Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(d, p + (Number.isFinite(delta) ? delta : 0)));
}

export type PlayerAction = "toggle" | "back" | "forward";

/**
 * Acción de una tecla en el reproductor: K reproduce o pausa, J y L saltan atrás y adelante. Espacio también
 * reproduce, salvo en un botón (donde ya lo pulsa). Con modificadores, nada (no se pisan atajos del navegador).
 */
export function playerKey(key: string, o: { onButton?: boolean; modifier?: boolean } = {}): PlayerAction | null {
  if (o.modifier) return null;
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k === "k" || ((k === " " || k === "Spacebar") && !o.onButton)) return "toggle";
  if (k === "j") return "back";
  if (k === "l") return "forward";
  return null;
}

/** Texto de un salto: «Back 10 seconds» con la plantilla `{seconds}`. */
export const skipLabel = (template: string, seconds: number) => template.replace("{seconds}", String(Math.abs(Math.round(seconds))));

/** Velocidad como texto corto: `1×`, `1.5×`, `0.75×`. */
export const rateText = (rate: number) => `${Number.isFinite(rate) ? Number(rate.toFixed(2)) : 1}×`;

interface AudioDecoder {
  decodeAudioData(data: ArrayBuffer): Promise<{ duration: number; numberOfChannels: number; getChannelData(i: number): Float32Array }>;
  close?(): Promise<void>;
}

/**
 * Onda de un audio con Web Audio: descarga, decodifica y reduce el primer canal a `bars` picos. Necesita CORS si el
 * audio es de otro origen. `null` si el navegador no tiene Web Audio, la descarga falla o se cancela.
 */
export async function decodePeaks(view: Window | null, src: string, bars: number, signal?: AbortSignal): Promise<{ peaks: number[]; duration: number } | null> {
  const w = view as (Window & { OfflineAudioContext?: new (c: number, l: number, r: number) => AudioDecoder; AudioContext?: new () => AudioDecoder }) | null;
  if (!w?.fetch || !src) return null;
  try {
    const response = await w.fetch(src, { signal });
    if (!response.ok) return null;
    const data = await response.arrayBuffer();
    const ctx: AudioDecoder | null = w.OfflineAudioContext ? new w.OfflineAudioContext(1, 1, 44100) : w.AudioContext ? new w.AudioContext() : null;
    if (!ctx) return null;
    const buffer = await ctx.decodeAudioData(data);
    void ctx.close?.().catch(() => {});
    if (signal?.aborted) return null;
    return { peaks: peaksFrom(buffer.getChannelData(0), bars), duration: buffer.duration };
  } catch {
    return null;
  }
}
