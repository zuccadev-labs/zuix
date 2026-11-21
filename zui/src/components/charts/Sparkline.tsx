import { cloneElement, type ReactElement } from "react";
import { sparklineTree, type SparklineLabels, type SparklineProps as CoreProps } from "../../core/sparkline";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export type { SparklineLabels };

export interface SparklineProps extends CoreProps {
  className?: string;
  id?: string;
}

/** Minigráfico en línea, área o barras: imagen con nombre (primero, último, mínimo y máximo), sin estado. */
export function Sparkline({ className, id, ...props }: SparklineProps) {
  const el = toReact(sparklineTree(props)) as ReactElement<{ className?: string; id?: string }>;
  return cloneElement(el, { id, className: cx("z-sparkline", className) });
}
