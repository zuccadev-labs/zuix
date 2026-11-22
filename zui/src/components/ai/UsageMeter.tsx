import { usageMeterNode, type UsageMeterLabels, type UsageMeterProps as CoreProps } from "../../core/ai-widgets";
import { staticNode } from "../chat/static";

export type { UsageMeterLabels };

export interface UsageMeterProps extends CoreProps {
  className?: string;
}

/** Uso de la ventana de contexto: `<meter>` con aviso al 80 % y al 95 %, desglose y coste. */
export function UsageMeter({ className, ...props }: UsageMeterProps) {
  return staticNode(usageMeterNode(props), { className });
}
