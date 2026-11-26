import { localize } from "../../core/locale";
import { deliveryNode } from "../../core/chat-tree";
import { DELIVERY_LABELS, type DeliveryLabels, type DeliveryState } from "../../core/delivery";
import { staticNode } from "./static";

export type { DeliveryLabels, DeliveryState };

export interface DeliveryStatusProps {
  status: DeliveryState;
  labels?: Partial<DeliveryLabels>;
  className?: string;
}

/** Estado de entrega: enviando (reloj), enviado, entregado (dos marcas), leído (dos marcas y otro texto) o fallido. */
export function DeliveryStatus({ status, labels, className }: DeliveryStatusProps) {
  return staticNode(deliveryNode(status, { ...localize("delivery", DELIVERY_LABELS), ...labels }), { className });
}
