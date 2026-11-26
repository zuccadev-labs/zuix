"use client";
import type { Ref } from "react";
import { tableOfContentsWidget, type TableOfContentsLabels, type TableOfContentsProps as CoreProps, type TocItem } from "../../core/toc-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { TableOfContentsLabels, TocItem };

export interface TableOfContentsProps extends CoreProps {
  /** La sección que se lee cambió (desplazamiento o clic). */
  onActiveChange?: (id: string) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Índice de la página con la sección que se lee marcada (`aria-current`). Scrollspy con IntersectionObserver, niveles
 * con sangría, desplazamiento suave que respeta el movimiento reducido y modo compacto (desplegable).
 */
export const TableOfContents = withRef(function TableOfContents({ onActiveChange, id, className, ref, ...props }: TableOfContentsProps) {
  return useWidget(tableOfContentsWidget, props, {
    id,
    className,
    ref,
    handlers: { "active-change": onActiveChange ? (detail: { id: string }) => onActiveChange(detail.id) : undefined },
  });
});
