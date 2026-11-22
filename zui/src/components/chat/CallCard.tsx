"use client";
import type { Ref } from "react";
import { callCardWidget, type CallCardLabels, type CallCardProps as CoreProps } from "../../core/chat-widgets";
import { useWidget } from "../agenda/vtree";

export type { CallCardLabels };

export interface CallCardProps extends CoreProps {
  onAccept?: (detail: { video: boolean }) => void;
  onDecline?: () => void;
  onHangUp?: () => void;
  onMute?: (detail: { muted: boolean }) => void;
  onCamera?: (detail: { camera: boolean }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Llamada entrante (aceptar, rechazar), saliente o en curso (duración, silenciar, cámara, colgar). No roba el foco. */
export function CallCard({ onAccept, onDecline, onHangUp, onMute, onCamera, id, className, ref, ...props }: CallCardProps) {
  return useWidget(callCardWidget, props, {
    id,
    className,
    ref,
    handlers: { accept: onAccept, decline: onDecline, "hang-up": onHangUp, mute: onMute, camera: onCamera },
  });
}
