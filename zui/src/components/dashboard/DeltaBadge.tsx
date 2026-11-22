import { cloneElement, type ReactElement } from "react";
import { deltaTree, type DeltaBadgeProps as CoreProps } from "../../core/dashboard-trees";
import type { DeltaLabels } from "../../core/metric";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export type { DeltaLabels };

export interface DeltaBadgeProps extends CoreProps {
  className?: string;
  id?: string;
}

/**
 * Variación frente al periodo anterior: flecha, magnitud y una frase para el lector que dice el sentido («up 12.4%,
 * better than last month»). `positive="down"` para lo que es bueno que baje (errores, latencia).
 */
export function DeltaBadge({ className, id, ...props }: DeltaBadgeProps) {
  const el = toReact(deltaTree(props)) as ReactElement<{ className?: string; id?: string }>;
  return cloneElement(el, { id, className: cx((el.props as { className?: string }).className, className) });
}
