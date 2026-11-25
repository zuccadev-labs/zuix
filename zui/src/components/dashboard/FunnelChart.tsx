import { cloneElement, type ReactElement } from "react";
import { funnelTree, type FunnelChartProps as CoreProps } from "../../core/dashboard-trees";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export type { FunnelLabels } from "../../core/dashboard-trees";
export type { FunnelStageInput as FunnelStage } from "../../core/funnel";

export interface FunnelChartProps extends CoreProps {
  className?: string;
  id?: string;
}

/** Embudo: etapas con su valor, la conversión frente a la anterior y la total. Una lista ordenada que se lee sin el dibujo. */
export function FunnelChart({ className, id, ...props }: FunnelChartProps) {
  const el = toReact(funnelTree(props)) as ReactElement<{ className?: string; id?: string }>;
  return cloneElement(el, { id, className: cx((el.props as { className?: string }).className, className) });
}
