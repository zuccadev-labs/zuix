"use client";
import type { Ref } from "react";
import { audioPlayerWidget, type AudioPlayerLabels, type AudioPlayerProps as CoreProps } from "../../core/audio-player-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { AudioPlayerLabels };

export interface AudioPlayerProps extends CoreProps {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onSeek?: (position: number) => void;
  onRateChange?: (rate: number) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Reproductor de audio: reproducir, onda que hace de deslizador de posición, saltos, velocidad y teclado (K o Espacio,
 * J, L y las flechas sobre la onda). La onda es precalculada o se calcula con Web Audio (`analyze`).
 */
export const AudioPlayer = withRef(function AudioPlayer({ onPlay, onPause, onEnded, onSeek, onRateChange, id, className, ref, ...props }: AudioPlayerProps) {
  return useWidget(audioPlayerWidget, props, {
    id,
    className,
    ref,
    handlers: {
      play: onPlay,
      pause: onPause,
      ended: onEnded,
      seek: onSeek ? (detail: { position: number }) => onSeek(detail.position) : undefined,
      "rate-change": onRateChange ? (detail: { rate: number }) => onRateChange(detail.rate) : undefined,
    },
  });
});
