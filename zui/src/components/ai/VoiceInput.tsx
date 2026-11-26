"use client";
import type { Ref } from "react";
import { voiceInputWidget, type VoiceInputLabels, type VoiceInputProps as CoreProps, type VoiceSend } from "../../core/voice-input-widget";
import type { RecorderProblem } from "../../core/voice-input";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { RecorderProblem, VoiceInputLabels, VoiceSend };

export interface VoiceInputProps extends CoreProps {
  /** La grabación terminada: audio, duración, onda (40 picos) y tipo. */
  onSend?: (recording: VoiceSend) => void;
  onCancel?: () => void;
  onStart?: () => void;
  /** Sin permiso del micrófono o fallo al empezar. */
  onError?: (detail: { problem: RecorderProblem }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Grabar una nota de voz con MediaRecorder: nivel de la señal, tiempo, pausar, cancelar (o Escape) y enviar. Sin
 * MediaRecorder o sin permiso, lo dice y no se rompe.
 */
export const VoiceInput = withRef(function VoiceInput({ onSend, onCancel, onStart, onError, id, className, ref, ...props }: VoiceInputProps) {
  return useWidget(voiceInputWidget, props, {
    id,
    className,
    ref,
    handlers: { send: onSend, cancel: onCancel, start: onStart, error: onError },
  });
});
