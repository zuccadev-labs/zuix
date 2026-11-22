import { cloneElement, type ReactElement } from "react";
import { gaugeTree, type GaugeProps as CoreProps } from "../../core/gauge";
import { cx } from "../../cx";
import { toReact } from "../vnode";

export type { GaugeArc, GaugeLabels, GaugeTone, GaugeZone } from "../../core/gauge";

export interface GaugeProps extends CoreProps {
  className?: string;
  id?: string;
}

/** Indicador de medio anillo, 240° o anillo completo con zonas y aguja opcional. Es un `role="meter"` con la zona en el texto del valor («72 %, Warning»); el color no es la única pista. */
export function Gauge({ className, id, ...props }: GaugeProps) {
  const el = toReact(gaugeTree(props)) as ReactElement<{ className?: string; id?: string }>;
  return cloneElement(el, { id, className: cx((el.props as { className?: string }).className, className) });
}
