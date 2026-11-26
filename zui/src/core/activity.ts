// ActivityFeed: agrupación por día civil en una zona IANA, etiqueta del día («Today», «Yesterday» o la fecha) y hora
// relativa de cada entrada (core/relative). Sin documento.

import { formatRelative, toInstant } from "./relative";
import { safeTimeZone } from "./zone";

const keyFormats = new Map<string, Intl.DateTimeFormat>();
/** Día civil `YYYY-MM-DD` de un instante en una zona. */
export function dayKey(at: number, timeZone?: string): string {
  const zone = safeTimeZone(timeZone);
  let f = keyFormats.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    keyFormats.set(zone, f);
  }
  return f.format(at);
}

/** Días entre dos claves civiles (b − a). */
export function dayDiff(a: string, b: string): number {
  const ms = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

export interface DayLabels {
  today: string;
  yesterday: string;
}

/** Etiqueta del día: hoy, ayer o la fecha larga en la zona. */
export function dayLabel(
  at: number,
  now: number,
  timeZone?: string,
  locale?: string,
  labels: DayLabels = { today: "Today", yesterday: "Yesterday" },
): string {
  const diff = dayDiff(dayKey(at, timeZone), dayKey(now, timeZone));
  if (diff === 0) return labels.today;
  if (diff === 1) return labels.yesterday;
  let f: Intl.DateTimeFormat;
  try {
    f = new Intl.DateTimeFormat(locale, { timeZone: safeTimeZone(timeZone), weekday: "long", day: "numeric", month: "long" });
  } catch {
    f = new Intl.DateTimeFormat(undefined, { timeZone: safeTimeZone(timeZone), weekday: "long", day: "numeric", month: "long" });
  }
  return f.format(at);
}

export interface Dated {
  at: number | string | Date;
}

export interface DayGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Entradas agrupadas por día, de la más reciente a la más antigua (y dentro de cada día igual). Las fechas inválidas
 * van al final, en su propio grupo con clave vacía.
 */
export function groupByDay<T extends Dated>(
  items: readonly T[],
  now: number,
  timeZone?: string,
  locale?: string,
  labels?: DayLabels,
): DayGroup<T>[] {
  const stamped = items.map((item) => ({ item, at: toInstant(item.at) }));
  stamped.sort((a, b) => (b.at ?? Number.NEGATIVE_INFINITY) - (a.at ?? Number.NEGATIVE_INFINITY));
  const groups: DayGroup<T>[] = [];
  for (const { item, at } of stamped) {
    const key = at === null ? "" : dayKey(at, timeZone);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: at === null ? "" : dayLabel(at, now, timeZone, locale, labels), items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }
  return groups;
}

/** Hora relativa corta («2 hours ago»), o cadena vacía si la fecha no vale. */
export function relativeText(at: number | string | Date, now: number, locale?: string): string {
  const t = toInstant(at);
  return t === null ? "" : formatRelative(t, now, locale, { minUnit: "minute" });
}

/** Instante ISO para `<time datetime>`. */
export function isoOf(at: number | string | Date): string | undefined {
  const t = toInstant(at);
  return t === null ? undefined : new Date(t).toISOString();
}

export interface ActivityFeedLabels {
  today: string;
  yesterday: string;
  loadMore: string;
  empty: string;
}

export const ACTIVITY_LABELS: ActivityFeedLabels = { today: "Today", yesterday: "Yesterday", loadMore: "Load more", empty: "No activity yet" };
