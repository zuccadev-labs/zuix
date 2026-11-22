"use client";
import type { Ref } from "react";
import { voiceNoteWidget, type VoiceNoteProps as CoreProps } from "../../core/chat-widgets";
import { useWidget } from "../agenda/vtree";

export interface VoiceNoteProps extends CoreProps {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onRateChange?: (detail: { rate: number }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Nota de voz: reproducir, onda que hace de deslizador de posición, tiempo y velocidad, sobre un `<audio>`. */
export function VoiceNote({ onPlay, onPause, onEnded, onRateChange, id, className, ref, ...props }: VoiceNoteProps) {
  return useWidget(voiceNoteWidget, props, {
    id,
    className,
    ref,
    handlers: { play: onPlay, pause: onPause, ended: onEnded, "rate-change": onRateChange },
  });
}
