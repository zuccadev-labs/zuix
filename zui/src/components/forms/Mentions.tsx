"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { attachMentions, MENTIONS_LABELS, type ChosenMention, type MentionSource, type MentionsLabels } from "../../core/mentions-widget";
import type { MentionItem } from "../../core/mentions";
import { cx } from "../../cx";

export type { ChosenMention, MentionItem, MentionSource, MentionsLabels };

export interface MentionsProps {
  /** Disparadores y de dónde salen sus candidatos: `{ trigger: "@", items }` o `{ trigger: "#", load }`. */
  sources: readonly MentionSource[];
  /** Mención elegida (guárdala para codificar el texto con `encodeMentions` al enviar). */
  onSelect?: (item: ChosenMention) => void;
  labels?: Partial<MentionsLabels>;
  className?: string;
  id?: string;
  /** El campo: un Textarea, un Input o un `<textarea>` cualquiera. */
  children: ReactNode;
}

/**
 * Menciones con `@` y `#` sobre el campo que envuelve (patrón APG «combobox»): la lista se ancla al cursor, ↑/↓
 * eligen, Intro o Tab insertan y Escape cierra. Candidatos fijos o con carga asíncrona (antirrebote y cancelación,
 * los de Combobox). Funciona con campos controlados.
 */
export function Mentions({ sources, onSelect, labels, className, id, children }: MentionsProps) {
  const auto = `z-mentions-${useId().replace(/:/g, "")}`;
  const root = useRef<HTMLDivElement | null>(null);
  const live = useRef({ sources, onSelect, labels });
  live.current = { sources, onSelect, labels };
  useEffect(
    () =>
      root.current
        ? attachMentions(root.current, {
            sources: () => live.current.sources,
            labels: () => ({ ...MENTIONS_LABELS, ...live.current.labels }),
            select: (item) => live.current.onSelect?.(item),
          })
        : undefined,
    [],
  );
  return (
    <div ref={root} id={id ?? auto} className={cx("z-mentions", className)}>
      {children}
    </div>
  );
}
