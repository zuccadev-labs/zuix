"use client";
import type { Ref } from "react";
import { waveformWidget, type WaveformProps as CoreProps } from "../../core/audio-player-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export interface WaveformProps extends CoreProps {
  /** Posición elegida con el puntero o el teclado (segundos). */
  onSeek?: (position: number) => void;
  /** Onda calculada con Web Audio (para guardarla y no volver a calcularla). */
  onPeaks?: (detail: { peaks: number[]; duration: number }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Forma de onda que hace de deslizador de posición: precalculada (`peaks`) o calculada de `src` con Web Audio. */
export const Waveform = withRef(function Waveform({ onSeek, onPeaks, id, className, ref, ...props }: WaveformProps) {
  return useWidget(waveformWidget, props, {
    id,
    className,
    ref,
    handlers: { seek: onSeek ? (detail: { position: number }) => onSeek(detail.position) : undefined, peaks: onPeaks },
  });
});
