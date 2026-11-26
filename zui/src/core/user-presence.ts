// Presencia de una persona: estados (los de Fluent más «fuera de la oficina»), su orden de prioridad para ordenar
// listas, el texto que lo dice (la presencia nunca va solo por color) y «visto hace…» con core/relative. Sin documento.
// (core/presence es otra cosa: la animación de salida de las capas.)
import { localize } from "./locale";

import { formatRelative, toInstant } from "./relative";

export type PresenceStatus = "online" | "away" | "busy" | "dnd" | "offline" | "oof";

export const PRESENCE_STATUSES: readonly PresenceStatus[] = ["online", "busy", "dnd", "away", "oof", "offline"];

export interface PresenceLabels {
  online: string;
  away: string;
  busy: string;
  dnd: string;
  offline: string;
  oof: string;
  /** «Last seen {time}» */
  lastSeen: string;
}

export const PRESENCE_LABELS: PresenceLabels = {
  online: "Available",
  away: "Away",
  busy: "Busy",
  dnd: "Do not disturb",
  offline: "Offline",
  oof: "Out of office",
  lastSeen: "Last seen {time}",
};

/** Estado válido (lo desconocido cuenta como desconectado). */
export const presenceOf = (v: unknown): PresenceStatus =>
  PRESENCE_STATUSES.includes(v as PresenceStatus) ? (v as PresenceStatus) : "offline";

/** Prioridad para ordenar (0 la más alta: disponible primero, desconectado al final). */
export const presenceRank = (status: unknown) => PRESENCE_STATUSES.indexOf(presenceOf(status));

/** Si la persona puede contestar ahora (disponible o ausente un momento). */
export const isReachable = (status: unknown) => {
  const s = presenceOf(status);
  return s === "online" || s === "away";
};

/** Texto del estado y, si está desconectada y se sabe, «visto hace…». */
export function presenceText(
  status: unknown,
  options: { lastSeen?: number | string | Date; now?: number; locale?: string; labels?: Partial<PresenceLabels> } = {},
): string {
  const labels = { ...localize("presence", PRESENCE_LABELS), ...options.labels };
  const s = presenceOf(status);
  const base = labels[s];
  const seen = toInstant(options.lastSeen ?? null);
  if ((s === "offline" || s === "away") && seen !== null) {
    const time = formatRelative(seen, options.now ?? Date.now(), options.locale, { minUnit: "minute" });
    return `${base}, ${labels.lastSeen.replace("{time}", time)}`;
  }
  return base;
}

/** Icono de la forma de cada estado (se pinta dentro del punto). */
export const PRESENCE_ICON: Record<PresenceStatus, string | null> = {
  online: "check",
  away: "clock",
  busy: null,
  dnd: "minus",
  offline: "x-mark",
  oof: "arrow-left",
};
