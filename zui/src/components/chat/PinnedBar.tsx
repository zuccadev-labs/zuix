"use client";
import type { Ref } from "react";
import { pinnedBarWidget, type PinnedBarLabels, type PinnedBarProps as CoreProps, type PinnedItem } from "../../core/chat-widgets";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { PinnedBarLabels, PinnedItem };

export interface PinnedBarProps extends CoreProps {
  /** Ir al mensaje fijado que se muestra (y pasar al anterior). */
  onJump?: (detail: { id: string }) => void;
  onUnpin?: (detail: { id: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Barra de mensajes fijados: el último y, con varios, «2 de 3»; pulsar salta al mensaje y pasa al anterior. */
export const PinnedBar = withRef(function PinnedBar({ onJump, onUnpin, id, className, ref, ...props }: PinnedBarProps) {
  return useWidget(pinnedBarWidget, props, { id, className, ref, handlers: { jump: onJump, unpin: onUnpin } });
});
