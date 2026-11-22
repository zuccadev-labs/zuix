import { cloneElement, type ReactElement } from "react";
import { barListTree, type BarListProps as CoreProps } from "../../core/dashboard-trees";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export type { BarListItem } from "../../core/dashboard-trees";

export interface BarListProps extends CoreProps {
  className?: string;
  id?: string;
}

/** Lista de barras horizontales con etiqueta y valor (los N primeros de algo). Cada fila se lee como texto; la barra es decorativa. */
export function BarList({ className, id, ...props }: BarListProps) {
  const el = toReact(barListTree(props)) as ReactElement<{ className?: string; id?: string }>;
  return cloneElement(el, { id, className: cx((el.props as { className?: string }).className, className) });
}
