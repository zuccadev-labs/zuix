// Recurrencia: el subconjunto de RRULE (RFC 5545) que generan los diálogos de «Repetir» de cualquier calendario.
//   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL, COUNT, UNTIL, WKST, BYDAY (con ordinal en mensual y anual),
//   BYMONTHDAY (también negativo), BYMONTH; EXDATE y excepciones por `recurrenceId` las aplica core/agenda.
// No en v1: FREQ=HOURLY|MINUTELY|SECONDLY, BYSETPOS, BYWEEKNO, BYYEARDAY, BYHOUR, BYMINUTE, BYSECOND, RDATE: la regla
// se marca como no admitida (`unsupported`) y la serie se queda en su primera ocurrencia.
// La serie se expande en fechas civiles del reloj de su zona (la reunión de las 09:00 sigue a las 09:00 tras el
// cambio de hora); quien la usa le pone la hora y la zona. El día 31 mensual en un mes de 30 se salta (RFC 5545),
// al contrario que `addMonths`: «el último día del mes» es BYMONTHDAY=-1.

import { addDays, daysInMonth, pad, valid, weekdayOf } from "./date";

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface ByDay {
  /** 0 domingo … 6 sábado. */
  day: number;
  /** Ordinal en el mes o el año: 2 = el segundo, -1 = el último. Sin él, todos. */
  n?: number;
}

export interface RRule {
  freq: Frequency;
  interval: number;
  count?: number;
  /** Fecha civil (`YYYY-MM-DD`) o fecha y hora (`YYYY-MM-DDTHH:mm:ss`, con `Z` si estaba en UTC). */
  until?: string;
  byDay?: ByDay[];
  byMonthDay?: number[];
  byMonth?: number[];
  /** Primer día de la semana para INTERVAL semanal: 1 lunes (por defecto). */
  wkst: number;
  /** Partes de la regla que v1 no admite (la serie no se expande). */
  unsupported?: string[];
}

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const NOT_IN_V1 = ["BYSETPOS", "BYWEEKNO", "BYYEARDAY", "BYHOUR", "BYMINUTE", "BYSECOND", "RDATE"];

/** Lee una RRULE (con o sin el prefijo `RRULE:`). `null` si no tiene FREQ válida. */
export function parseRRule(text: string | null | undefined): RRule | null {
  if (typeof text !== "string") return null;
  const body = text.trim().replace(/^RRULE:/i, "");
  const map = new Map<string, string>();
  for (const part of body.split(";")) {
    const [k, v] = part.split("=");
    if (k && v !== undefined) map.set(k.trim().toUpperCase(), v.trim().toUpperCase());
  }
  const freq = map.get("FREQ");
  const unsupported = NOT_IN_V1.filter((k) => map.has(k));
  if (freq === "HOURLY" || freq === "MINUTELY" || freq === "SECONDLY") unsupported.push(`FREQ=${freq}`);
  else if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;
  const ints = (raw: string | undefined, lo: number, hi: number) =>
    raw
      ?.split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n !== 0 && Math.abs(n) >= lo && Math.abs(n) <= hi);
  const rule: RRule = {
    freq: (unsupported.some((u) => u.startsWith("FREQ")) ? "DAILY" : freq) as Frequency,
    interval: Math.max(1, Math.floor(Number(map.get("INTERVAL") ?? 1)) || 1),
    wkst: Math.max(0, DAYS.indexOf(map.get("WKST") ?? "MO")),
  };
  const count = Number(map.get("COUNT"));
  if (Number.isInteger(count) && count > 0) rule.count = count;
  const until = map.get("UNTIL");
  if (until) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(until);
    if (m) rule.until = m[4] ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ?? ""}` : `${m[1]}-${m[2]}-${m[3]}`;
  }
  const byDay = map
    .get("BYDAY")
    ?.split(",")
    .map((token) => {
      const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token);
      if (!m) return null;
      const n = m[1] ? Number(m[1]) : undefined;
      return n ? { day: DAYS.indexOf(m[2]!), n } : { day: DAYS.indexOf(m[2]!) };
    })
    .filter((d): d is ByDay => d !== null);
  if (byDay?.length) rule.byDay = byDay;
  const byMonthDay = ints(map.get("BYMONTHDAY"), 1, 31);
  if (byMonthDay?.length) rule.byMonthDay = byMonthDay;
  const byMonth = ints(map.get("BYMONTH"), 1, 12)?.filter((n) => n > 0);
  if (byMonth?.length) rule.byMonth = byMonth;
  if (unsupported.length) rule.unsupported = unsupported;
  return rule;
}

/** Días del mes `year-month` (mes 1–12) que cumplen BYDAY con ordinal dentro del mes. */
function monthWeekdays(year: number, month: number, by: ByDay): number[] {
  const n = daysInMonth(year, month - 1);
  const all: number[] = [];
  for (let d = 1; d <= n; d++) if (weekdayOf(`${pad(year, 4)}-${pad(month)}-${pad(d)}`) === by.day) all.push(d);
  if (!by.n) return all;
  const pick = by.n > 0 ? all[by.n - 1] : all[all.length + by.n];
  return pick ? [pick] : [];
}

/** Fechas del año que cumplen BYDAY con ordinal dentro del año (anual sin BYMONTH). */
function yearWeekdays(year: number, by: ByDay): string[] {
  const all: string[] = [];
  for (let d = `${pad(year, 4)}-01-01`; d.startsWith(pad(year, 4)); d = addDays(d, 1)) if (weekdayOf(d) === by.day) all.push(d);
  if (!by.n) return all;
  const pick = by.n > 0 ? all[by.n - 1] : all[all.length + by.n];
  return pick ? [pick] : [];
}

const resolveMonthDay = (year: number, month: number, md: number) => {
  const n = daysInMonth(year, month - 1);
  const d = md > 0 ? md : n + md + 1;
  return d >= 1 && d <= n ? d : null;
};
const iso = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

/** Candidatos (ordenados) del periodo que empieza en `periodStart`. */
function periodDates(rule: RRule, start: string, periodStart: string): string[] {
  const year = Number(periodStart.slice(0, 4));
  const month = Number(periodStart.slice(5, 7));
  const startDay = Number(start.slice(8, 10));
  const startMonth = Number(start.slice(5, 7));
  let out: string[] = [];
  if (rule.freq === "DAILY") out = [periodStart];
  else if (rule.freq === "WEEKLY") {
    const days = rule.byDay?.length ? rule.byDay.map((b) => b.day) : [weekdayOf(start)];
    out = Array.from({ length: 7 }, (_, i) => addDays(periodStart, i)).filter((d) => days.includes(weekdayOf(d)));
  } else if (rule.freq === "MONTHLY") {
    out = monthCandidates(rule, year, month, startDay);
  } else {
    // Sin BYMONTH, BYMONTHDAY recorre todos los meses del año; sin nada, el mes del inicio.
    const months = rule.byMonth?.length ? rule.byMonth : rule.byMonthDay?.length ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [startMonth];
    if (!rule.byMonth?.length && !rule.byMonthDay?.length && rule.byDay?.length) {
      // BYDAY anual sin BYMONTH: ordinal dentro del año.
      out = rule.byDay.flatMap((b) => yearWeekdays(year, b));
    } else for (const m of months) out.push(...monthCandidates(rule, year, m, startDay));
  }
  // BYMONTH filtra en diario, semanal y mensual; BYMONTHDAY y BYDAY filtran en diario.
  if (rule.freq !== "YEARLY" && rule.byMonth?.length) out = out.filter((d) => rule.byMonth!.includes(Number(d.slice(5, 7))));
  if (rule.freq === "DAILY") {
    if (rule.byMonthDay?.length)
      out = out.filter((d) => {
        const y = Number(d.slice(0, 4));
        const m = Number(d.slice(5, 7));
        return rule.byMonthDay!.some((md) => resolveMonthDay(y, m, md) === Number(d.slice(8, 10)));
      });
    if (rule.byDay?.length) out = out.filter((d) => rule.byDay!.some((b) => b.day === weekdayOf(d)));
  }
  return [...new Set(out)].sort();
}

function monthCandidates(rule: RRule, year: number, month: number, startDay: number): string[] {
  const byMonthDay = rule.byMonthDay?.map((md) => resolveMonthDay(year, month, md)).filter((d): d is number => d !== null);
  const byDay = rule.byDay?.flatMap((b) => monthWeekdays(year, month, b));
  let days: number[];
  if (byMonthDay && byDay) days = byMonthDay.filter((d) => byDay.includes(d));
  else if (byMonthDay) days = byMonthDay;
  else if (byDay) days = byDay;
  else days = startDay <= daysInMonth(year, month - 1) ? [startDay] : [];
  return days.map((d) => iso(year, month, d));
}

/** Inicio del periodo `k` (0 = el de la fecha de inicio). */
function periodStartAt(rule: RRule, start: string, k: number): string {
  const step = k * rule.interval;
  if (rule.freq === "DAILY") return addDays(start, step);
  if (rule.freq === "WEEKLY") {
    const weekStart = addDays(start, -((weekdayOf(start) - rule.wkst + 7) % 7));
    return addDays(weekStart, step * 7);
  }
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7)) - 1;
  if (rule.freq === "MONTHLY") {
    const total = y * 12 + m + step;
    return iso(Math.floor(total / 12), (total % 12) + 1, 1);
  }
  return iso(y + step, 1, 1);
}

export interface ExpandOptions {
  /** Hora de inicio de la serie en su reloj (`HH:mm[:ss]`), para comparar con un UNTIL con hora. */
  time?: string;
  /** Convierte un UNTIL en UTC (`…Z`) al reloj de la serie, `YYYY-MM-DDTHH:mm:ss`. Sin él, se compara la fecha. */
  untilToWall?: (until: string) => string;
  /** Tope de ocurrencias devueltas (protección). Por defecto 5000. */
  limit?: number;
}

/**
 * Fechas civiles de las ocurrencias de la serie que empieza en `start` y caen en `[from, to]` (incluidos). La primera
 * ocurrencia es siempre `start` (RFC 5545: DTSTART cuenta aunque no cumpla la regla). COUNT cuenta desde `start`.
 */
export function expandDates(rule: RRule, start: string, from: string, to: string, options: ExpandOptions = {}): string[] {
  if (!valid(start) || !valid(from) || !valid(to)) return [];
  const limit = options.limit ?? 5000;
  const out: string[] = [];
  const time = options.time ? (options.time.length === 5 ? `${options.time}:00` : options.time) : "00:00:00";
  let untilWall: string | null = null;
  if (rule.until)
    untilWall =
      rule.until.length === 10
        ? `${rule.until}T23:59:59`
        : rule.until.endsWith("Z") && options.untilToWall
          ? options.untilToWall(rule.until)
          : rule.until.replace("Z", "");
  const beyond = (date: string) => untilWall !== null && `${date}T${time}` > untilWall;
  const take = (date: string) => {
    if (date >= from && date <= to) out.push(date);
  };
  if (rule.unsupported?.length) {
    take(start);
    return out;
  }
  let count = 1;
  take(start);
  if (rule.count === 1) return out;
  // Periodos vacíos seguidos (p. ej. el 31 en meses de 30) no paran la búsqueda; un tope de periodos la acota.
  const maxPeriods = rule.freq === "DAILY" ? 400_000 : rule.freq === "WEEKLY" ? 60_000 : rule.freq === "MONTHLY" ? 15_000 : 2_000;
  for (let k = 0; k < maxPeriods; k++) {
    const periodStart = periodStartAt(rule, start, k);
    if (periodStart > to) break;
    for (const date of periodDates(rule, start, periodStart)) {
      if (date <= start) continue;
      if (beyond(date)) return out;
      count++;
      if (rule.count && count > rule.count) return out;
      // Las fechas crecen: pasado el rango no queda nada que devolver (COUNT ya se contó desde el inicio).
      if (date > to) return out;
      take(date);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Texto de RRULE a partir de la regla (para guardar lo que produce la interfaz). */
export function formatRRule(rule: Omit<RRule, "wkst"> & { wkst?: number }): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  if (rule.until) {
    const u = rule.until.replace(/[-:]/g, "");
    parts.push(`UNTIL=${u}`);
  }
  if (rule.byDay?.length) parts.push(`BYDAY=${rule.byDay.map((b) => `${b.n ?? ""}${DAYS[b.day]}`).join(",")}`);
  if (rule.byMonthDay?.length) parts.push(`BYMONTHDAY=${rule.byMonthDay.join(",")}`);
  if (rule.byMonth?.length) parts.push(`BYMONTH=${rule.byMonth.join(",")}`);
  if (rule.wkst !== undefined && rule.wkst !== 1) parts.push(`WKST=${DAYS[rule.wkst]}`);
  return parts.join(";");
}
