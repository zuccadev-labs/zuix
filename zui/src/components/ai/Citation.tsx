import { AI_LABELS, citationNode, type AiLabels, type Source } from "../../core/ai-widgets";
import type { VEl } from "../../core/vnode";
import { staticNode } from "../chat/static";

export interface CitationProps {
  /** Número de la fuente (1…). */
  index: number;
  source: Source;
  labels?: Partial<Pick<AiLabels, "source">>;
  className?: string;
}

/** Cita en línea: enlace «Source 1: título» con una tarjeta de la fuente al pasar el puntero o enfocar. */
export function Citation({ index, source, labels, className }: CitationProps) {
  return staticNode(citationNode(index, source, { ...AI_LABELS, ...labels }) as VEl, { className });
}
