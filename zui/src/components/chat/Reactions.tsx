"use client";
import type { Ref } from "react";
import { reactionsWidget, type ReactionsProps as CoreProps } from "../../core/chat-widgets";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export interface ReactionsProps extends CoreProps {
  /** Reacción propia puesta o quitada. */
  onToggle?: (detail: { emoji: string; active: boolean }) => void;
  /** «Más reacciones»: la aplicación abre su selector. */
  onMore?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Reacciones con contador: botones conmutables con el nombre del emoji, y añadir con las seis rápidas. */
export const Reactions = withRef(function Reactions({ onToggle, onMore, id, className, ref, ...props }: ReactionsProps) {
  return useWidget(reactionsWidget, props, { id, className, ref, handlers: { toggle: onToggle, more: onMore } });
});
