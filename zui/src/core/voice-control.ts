// Control de una nota de voz sobre un <audio>: una sola sonando a la vez en el documento, la posición al fotograma
// mientras suena, buscar con el puntero (respetando la dirección de escritura) o con el teclado sobre la onda
// (`role="slider"`). Lo comparten la nota suelta (VoiceNote) y la lista de mensajes. Solo toca el documento al llamarse.

import { isRtl } from "./dir";

export interface VoiceUpdate {
  playing: boolean;
  position: number;
  ended?: boolean;
}

let current: HTMLAudioElement | null = null;

/** Reproduce o pausa `audio`; al empezar pausa la que sonara. `rate` se aplica antes de sonar. */
export function toggleAudio(audio: HTMLAudioElement, rate = 1): boolean {
  if (!audio.paused) {
    audio.pause();
    return false;
  }
  if (current && current !== audio && !current.paused) current.pause();
  current = audio;
  audio.playbackRate = rate;
  void audio.play()?.catch?.(() => {});
  return true;
}

/** Sigue un <audio>: avisa al empezar, al pausar, al terminar y (como mucho una vez por fotograma) al avanzar. */
export function watchAudio(audio: HTMLAudioElement, update: (u: VoiceUpdate) => void): () => void {
  let frame = 0;
  const tick = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update({ playing: !audio.paused, position: audio.currentTime || 0 });
    });
  };
  const play = () => update({ playing: true, position: audio.currentTime || 0 });
  const pause = () => update({ playing: false, position: audio.currentTime || 0 });
  const ended = () => update({ playing: false, position: 0, ended: true });
  audio.addEventListener("play", play);
  audio.addEventListener("pause", pause);
  audio.addEventListener("ended", ended);
  audio.addEventListener("timeupdate", tick);
  return () => {
    cancelAnimationFrame(frame);
    audio.removeEventListener("play", play);
    audio.removeEventListener("pause", pause);
    audio.removeEventListener("ended", ended);
    audio.removeEventListener("timeupdate", tick);
  };
}

/** Fracción (0–1) de la onda bajo el puntero, de inicio a fin en la dirección de escritura. */
export function fractionAt(wave: Element, clientX: number): number {
  const box = wave.getBoundingClientRect();
  if (!box.width) return 0;
  const f = (clientX - box.left) / box.width;
  const clamped = Math.max(0, Math.min(1, f));
  return isRtl(wave) ? 1 - clamped : clamped;
}

/** Nueva posición (s) para una tecla sobre la onda, o `null` si la tecla no busca. ←/→ cinco segundos, RePág/AvPág quince. */
export function seekKey(key: string, position: number, duration: number, rtl = false): number | null {
  const back = rtl ? "ArrowRight" : "ArrowLeft";
  const fwd = rtl ? "ArrowLeft" : "ArrowRight";
  let next: number;
  if (key === back || key === "ArrowDown") next = position - 5;
  else if (key === fwd || key === "ArrowUp") next = position + 5;
  else if (key === "PageDown") next = position - 15;
  else if (key === "PageUp") next = position + 15;
  else if (key === "Home") next = 0;
  else if (key === "End") next = duration;
  else return null;
  return Math.max(0, Math.min(duration, next));
}

/** Lleva el <audio> a una posición (s) aunque aún no haya cargado nada. */
export function seekAudio(audio: HTMLAudioElement | null, seconds: number): void {
  if (!audio) return;
  try {
    audio.currentTime = seconds;
  } catch {
    // Sin datos cargados algunos motores no admiten el salto: se aplica al empezar a sonar.
    audio.addEventListener(
      "loadedmetadata",
      () => {
        audio.currentTime = seconds;
      },
      { once: true },
    );
  }
}
