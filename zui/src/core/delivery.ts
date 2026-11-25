// Estado de entrega de un mensaje propio: enviando (reloj), enviado (una marca), entregado (dos), leído (dos y otro
// texto, no solo el acento) y fallido (aviso y reintentar). Los avisos del servidor llegan desordenados: un estado no
// retrocede (un «entregado» tardío no tapa un «leído»), salvo reintentar un fallido. Puro.

import type { DeliveryState } from "./chat-group";

export type { DeliveryState };

const RANK: Record<DeliveryState, number> = { failed: -1, sending: 0, sent: 1, delivered: 2, read: 3 };

/** Fusiona el estado que llega con el que hay: nunca retrocede; `failed` solo desde `sending`; `sending` reintenta. */
export function mergeDelivery(current: DeliveryState | undefined, next: DeliveryState): DeliveryState {
  if (!current) return next;
  if (next === "failed") return current === "sending" ? "failed" : current;
  if (current === "failed") return next;
  return RANK[next] >= RANK[current] ? next : current;
}

export interface DeliveryLabels {
  sending: string;
  sent: string;
  delivered: string;
  read: string;
  failed: string;
}

export const DELIVERY_LABELS: DeliveryLabels = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Not sent",
};

/** Icono (o iconos) de cada estado: dos marcas para entregado y leído. */
export function deliveryIcons(state: DeliveryState): string[] {
  if (state === "sending") return ["clock"];
  if (state === "sent") return ["check"];
  if (state === "failed") return ["exclamation-circle"];
  return ["check", "check"];
}

export const isDelivery = (v: unknown): v is DeliveryState => typeof v === "string" && v in RANK;
