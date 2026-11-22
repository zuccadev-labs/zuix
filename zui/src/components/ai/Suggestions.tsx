"use client";
import type { Ref } from "react";
import { suggestionsWidget, type Suggestion, type SuggestionsProps as CoreProps } from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";

export type { Suggestion };

export interface SuggestionsProps extends CoreProps {
  onSelect?: (detail: { id?: string; text: string }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Sugerencias de prompt: fila desplazable (con fundido si hay más) o rejilla de inicio. */
export function Suggestions({ onSelect, id, className, ref, ...props }: SuggestionsProps) {
  return useWidget(suggestionsWidget, props, { id, className, ref, handlers: { select: onSelect } });
}
