// Mensajes de chat como filas: agrupación por autor con una ventana de tiempo, corte por día civil en una zona IANA,
// posición de cada burbuja en su grupo (de ella depende la cola), separadores de fecha, marca de no leídos y los
// textos que se anuncian cuando llegan mensajes de otros. Puro: sin documento ni temporizadores.

import { toInstant } from "./relative";
import { safeTimeZone, toWall } from "./zone";

export type DeliveryState = "sending" | "sent" | "delivered" | "read" | "failed";

export interface ChatPerson {
  name: string;
  avatar?: string;
}

/** Contenido adjunto de un mensaje. La imagen estática de una ubicación la pone la aplicación (sin mapas de terceros). */
export type ChatAttachment =
  | { kind: "image"; src: string; alt?: string; width?: number; height?: number }
  | { kind: "file"; name: string; size?: number; href?: string; type?: string; progress?: number }
  | { kind: "voice"; src: string; duration: number; peaks?: readonly number[]; played?: boolean }
  | { kind: "location"; title?: string; address?: string; href?: string; image?: string; latitude?: number; longitude?: number }
  | { kind: "link"; href: string; title?: string; description?: string; image?: string; site?: string };

export interface ChatReaction {
  /** El emoji como texto. */
  emoji: string;
  count: number;
  /** La persona actual reaccionó con él. */
  mine?: boolean;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  author?: ChatPerson;
  /** Instante: ISO con zona o milisegundos. */
  createdAt: number | string;
  text?: string;
  attachments?: readonly ChatAttachment[];
  /** Respuesta a otro mensaje: lo que se cita. */
  replyTo?: { id: string; author?: string; text?: string };
  forwarded?: boolean;
  editedAt?: number | string;
  deletedAt?: number | string;
  status?: DeliveryState;
  reactions?: readonly ChatReaction[];
  thread?: { count: number; lastAt?: number | string; participants?: readonly ChatPerson[] };
  pinned?: boolean;
  /** `system`: aviso centrado («Ana se unió»), sin autor ni burbuja. */
  kind?: "message" | "system";
}

export type BubblePosition = "single" | "first" | "middle" | "last";

export type ChatRow =
  | { kind: "date"; key: string; day: string; at: number }
  | { kind: "unread"; key: string; count: number }
  | { kind: "system"; key: string; message: ChatMessage; at: number }
  | {
      kind: "message";
      key: string;
      message: ChatMessage;
      at: number;
      mine: boolean;
      position: BubblePosition;
      /** Primera de su grupo en una conversación de grupo: lleva el nombre del autor. */
      showAuthor: boolean;
      /** Última de su grupo (de otro): lleva el avatar al lado. */
      showAvatar: boolean;
    };

export interface ChatRowsOptions {
  currentUserId?: string;
  /** Ventana para seguir en el mismo grupo (ms). 5 minutos por defecto. */
  groupWithin?: number;
  timeZone?: string;
  /** Id del primer mensaje sin leer: la marca va justo antes. */
  unreadFrom?: string;
  /** Conversación de grupo: nombres y avatares de los demás. */
  group?: boolean;
}

export const GROUP_WITHIN = 5 * 60 * 1000;

/** Día civil `YYYY-MM-DD` de un instante en una zona. */
export function dayKey(ms: number, timeZone: string): string {
  return toWall(ms, safeTimeZone(timeZone)).date;
}

/** Hora de pared `HH:mm` de un instante, formateada según el locale (12 o 24 h). */
export function timeLabel(ms: number, timeZone?: string, locale?: string, hourCycle?: "h12" | "h23"): string {
  const options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", timeZone: safeTimeZone(timeZone) };
  if (hourCycle) options.hourCycle = hourCycle;
  try {
    return new Intl.DateTimeFormat(locale, options).format(ms);
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(ms);
  }
}

const instant = (v: number | string | undefined) => toInstant(v) ?? 0;

/** Filas de la lista: separadores de día, marca de no leídos, mensajes con su posición y avisos del sistema. */
export function chatRows(messages: readonly ChatMessage[], o: ChatRowsOptions = {}): ChatRow[] {
  const within = Math.max(0, o.groupWithin ?? GROUP_WITHIN);
  const tz = safeTimeZone(o.timeZone);
  // Orden por instante, estable: dos mensajes del mismo milisegundo conservan el orden de llegada.
  const sorted = messages.map((m, i) => ({ m, i, at: instant(m.createdAt) })).sort((a, b) => a.at - b.at || a.i - b.i);
  const rows: ChatRow[] = [];
  let lastDay = "";
  const unreadIndex = o.unreadFrom ? sorted.findIndex((x) => x.m.id === o.unreadFrom) : -1;
  const unreadCount =
    unreadIndex < 0 ? 0 : sorted.slice(unreadIndex).filter((x) => x.m.kind !== "system" && x.m.authorId !== o.currentUserId).length;
  let open: Extract<ChatRow, { kind: "message" }> | null = null;
  sorted.forEach(({ m, at }, i) => {
    const day = dayKey(at, tz);
    let broke = false;
    if (day !== lastDay) {
      rows.push({ kind: "date", key: `date-${day}`, day, at });
      lastDay = day;
      broke = true;
    }
    if (i === unreadIndex && unreadCount > 0) {
      rows.push({ kind: "unread", key: "unread", count: unreadCount });
      broke = true;
    }
    if (m.kind === "system") {
      rows.push({ kind: "system", key: m.id, message: m, at });
      open = null;
      return;
    }
    const mine = o.currentUserId !== undefined && m.authorId === o.currentUserId;
    const prev: Extract<ChatRow, { kind: "message" }> | null = open;
    const joins = !broke && prev !== null && prev.message.authorId === m.authorId && at - prev.at <= within;
    const row: Extract<ChatRow, { kind: "message" }> = {
      kind: "message",
      key: m.id,
      message: m,
      at,
      mine,
      position: "single",
      showAuthor: Boolean(o.group) && !mine,
      showAvatar: Boolean(o.group) && !mine,
    };
    if (joins && prev) {
      prev.position = prev.position === "single" ? "first" : "middle";
      prev.showAvatar = false;
      row.position = "last";
      row.showAuthor = false;
    }
    rows.push(row);
    open = row;
  });
  return rows;
}

export interface DayLabels {
  today: string;
  yesterday: string;
}

/** «Today», «Yesterday», el día de la semana dentro de la última semana, y la fecha (con año si no es el actual). */
export function dayLabel(day: string, today: string, labels: DayLabels, locale?: string): string {
  if (day === today) return labels.today;
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const diff = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000);
  if (diff === 1) return labels.yesterday;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const fmt = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(date);
    } catch {
      return new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(date);
    }
  };
  if (diff > 1 && diff < 7) return fmt({ weekday: "long" });
  return y === ty ? fmt({ day: "numeric", month: "long" }) : fmt({ day: "numeric", month: "long", year: "numeric" });
}

export interface TypingLabels {
  /** «{name} is typing…». */
  one: string;
  /** «{a} and {b} are typing…». */
  two: string;
  /** «{name} and {n} others are typing…». */
  many: string;
}

export const TYPING_LABELS: TypingLabels = {
  one: "{name} is typing…",
  two: "{a} and {b} are typing…",
  many: "{name} and {n} others are typing…",
};

const put = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

/** Texto de quién escribe, sin repetir nombres. Vacío si nadie. */
export function typingText(names: readonly string[], labels: TypingLabels = TYPING_LABELS): string {
  const list = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!list.length) return "";
  if (list.length === 1) return put(labels.one, { name: list[0]! });
  if (list.length === 2) return put(labels.two, { a: list[0]!, b: list[1]! });
  return put(labels.many, { name: list[0]!, n: list.length - 1 });
}

export interface ArrivalLabels {
  /** «{name}: {text}». */
  one: string;
  /** «{n} new messages from {name}». */
  fromOne: string;
  /** «{n} new messages». */
  many: string;
  photo: string;
  file: string;
  voice: string;
  location: string;
  link: string;
}

export const ARRIVAL_LABELS: ArrivalLabels = {
  one: "{name}: {text}",
  fromOne: "{n} new messages from {name}",
  many: "{n} new messages",
  photo: "Photo",
  file: "File",
  voice: "Voice message",
  location: "Location",
  link: "Link",
};

/** Texto corto de un mensaje para un anuncio o una vista previa: el texto (recortado) o el tipo de adjunto. */
export function messagePreview(
  m: ChatMessage,
  labels: Pick<ArrivalLabels, "photo" | "file" | "voice" | "location" | "link">,
  max = 80,
): string {
  const text = (m.text ?? "")
    .replace(/<@[^>]+>/g, "@")
    .replace(/\s+/g, " ")
    .trim();
  if (text) return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  const first = m.attachments?.[0];
  if (!first) return "";
  return first.kind === "image" ? labels.photo : labels[first.kind];
}

/** Mensajes de otros que no estaban antes (los propios, las ediciones y las reacciones no cuentan). */
export function newArrivals(known: ReadonlySet<string>, messages: readonly ChatMessage[], currentUserId?: string): ChatMessage[] {
  return messages.filter((m) => !known.has(m.id) && m.kind !== "system" && m.authorId !== currentUserId && !m.deletedAt);
}

/** Un anuncio para una tanda de llegadas: el mensaje si es uno, «3 new messages from Ana» si son de una persona. */
export function arrivalText(arrivals: readonly ChatMessage[], labels: ArrivalLabels = ARRIVAL_LABELS): string {
  if (!arrivals.length) return "";
  const name = (m: ChatMessage) => m.author?.name ?? m.authorId;
  if (arrivals.length === 1) {
    const m = arrivals[0]!;
    return put(labels.one, { name: name(m), text: messagePreview(m, labels) });
  }
  const authors = new Set(arrivals.map((m) => m.authorId));
  if (authors.size === 1) return put(labels.fromOne, { n: arrivals.length, name: name(arrivals[0]!) });
  return put(labels.many, { n: arrivals.length });
}
