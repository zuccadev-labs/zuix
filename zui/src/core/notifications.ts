// Avisos de la aplicación (NotificationCenter y NotificationBadge): texto del contador con tope («99+»), recuento de
// no leídos con los cambios hechos en la vista y agrupación por día en la zona horaria de quien mira («Today»,
// «Yesterday», fecha). Lógica pura con reloj inyectable, sin documento.

import { safeLocale } from "./date";
import { toInstant } from "./relative";

export interface NotificationAction {
  id: string;
  label: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  /** Instante del aviso (ISO, milisegundos o Date). */
  time: number | string | Date;
  read?: boolean;
  /** Icono del aviso (nombre de zicon). */
  icon?: string;
  /** Tono del icono. */
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  /** Enlace del título. */
  href?: string;
  /** Acciones propias (aceptar, ver, responder): botones que avisan con `action`. */
  actions?: readonly NotificationAction[];
}

/** Texto del contador: vacío sin avisos y `max+` por encima del tope. */
export function badgeText(count: number, max = 99, locale?: string): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  const top = Math.max(1, Math.floor(max));
  const f = new Intl.NumberFormat(safeLocale(locale));
  return count > top ? `${f.format(top)}+` : f.format(Math.floor(count));
}

/** Leído según la aplicación o, si la persona lo cambió en la vista, según ese cambio. */
export const isRead = (item: NotificationItem, overrides: Readonly<Record<string, boolean>> = {}) =>
  overrides[item.id] ?? Boolean(item.read);

export function unreadCount(items: readonly NotificationItem[], overrides: Readonly<Record<string, boolean>> = {}): number {
  let n = 0;
  for (const item of items) if (!isRead(item, overrides)) n += 1;
  return n;
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();
function dayFormat(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? "";
  let f = dayFormats.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      f = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
    }
    dayFormats.set(key, f);
  }
  return f;
}

/** Día civil (`YYYY-MM-DD`) de un instante en una zona horaria (por defecto, la de quien mira). */
export function dayKey(instant: number, timeZone?: string): string {
  const parts = dayFormat(timeZone).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export interface DayGroup<T> {
  /** Día civil, `YYYY-MM-DD`. */
  key: string;
  label: string;
  items: T[];
}

export interface GroupOptions {
  now: number;
  timeZone?: string;
  locale?: string;
  today?: string;
  yesterday?: string;
}

/**
 * Avisos del más reciente al más antiguo, agrupados por día civil en `timeZone`. Hoy y ayer se nombran; el resto
 * lleva la fecha (con el año solo si no es el actual). Un aviso con fecha no válida va al final, en su propio grupo.
 */
export function groupByDay<T extends Pick<NotificationItem, "time">>(items: readonly T[], o: GroupOptions): DayGroup<T>[] {
  const locale = safeLocale(o.locale);
  const at = (item: T) => toInstant(item.time) ?? Number.NEGATIVE_INFINITY;
  const sorted = items
    .map((item, index) => ({ item, index, t: at(item) }))
    .sort((a, b) => b.t - a.t || a.index - b.index)
    .map((x) => x.item);
  const today = dayKey(o.now, o.timeZone);
  // Ayer: el día civil anterior, no «ahora menos 24 h» (un cambio de hora haría que se saltara o repitiera un día).
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  const thisYear = today.slice(0, 4);
  const groups: DayGroup<T>[] = [];
  for (const item of sorted) {
    const t = at(item);
    const key = Number.isFinite(t) ? dayKey(t, o.timeZone) : "";
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      let label: string;
      if (!key) label = "";
      else if (key === today) label = o.today ?? "Today";
      else if (key === yesterday) label = o.yesterday ?? "Yesterday";
      else {
        const [ky, km, kd] = key.split("-").map(Number) as [number, number, number];
        const options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" };
        if (key.slice(0, 4) !== thisYear) options.year = "numeric";
        label = new Intl.DateTimeFormat(locale, options).format(new Date(Date.UTC(ky, km - 1, kd, 12)));
      }
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** Hora del aviso para su fila («14:05», «2:05 PM»): el grupo ya dice el día. */
export function notificationTime(instant: number, o: { locale?: string; timeZone?: string }): string {
  if (!Number.isFinite(instant)) return "";
  try {
    return new Intl.DateTimeFormat(safeLocale(o.locale), { hour: "numeric", minute: "2-digit", timeZone: o.timeZone }).format(instant);
  } catch {
    return new Intl.DateTimeFormat(safeLocale(o.locale), { hour: "numeric", minute: "2-digit" }).format(instant);
  }
}

/** Avisos nuevos sin leer respecto a los ya vistos (para anunciarlos una vez). */
export function arrivals(items: readonly NotificationItem[], seen: ReadonlySet<string>, overrides: Readonly<Record<string, boolean>> = {}) {
  return items.filter((item) => !seen.has(item.id) && !isRead(item, overrides));
}
