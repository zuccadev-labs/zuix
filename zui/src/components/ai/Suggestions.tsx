"use client";
import type { Ref } from "react";
import { suggestionsWidget, type Suggestion, type SuggestionsProps as CoreProps } from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { Suggestion };

export interface SuggestionsProps extends CoreProps {
  onSelect?: (detail: { id?: string; text: string }) => void;
  /** Esc dentro de la lista (`layout="list"`): cerrar el panel. */
  onDismiss?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Sugerencias de prompt: fila desplazable (con fundido si hay más) o rejilla de inicio. */
export const Suggestions = withRef(function Suggestions({ onSelect, onDismiss, id, className, ref, ...props }: SuggestionsProps) {
  return useWidget(suggestionsWidget, props, { id, className, ref, handlers: { select: onSelect, dismiss: onDismiss } });
});
