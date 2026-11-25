// Rango de fecha y hora (DateTimeRangePicker) sin documento: dos relojes de pared `YYYY-MM-DDTHH:mm[:ss]` y una zona
// IANA opcional. Con zona, el formulario recibe cada extremo con su desfase y su zona (`2026-03-03T09:00+01:00[Europe/
// Madrid]`, RFC 9557, lo que lee `Temporal.ZonedDateTime.from`): la hora queda atada al lugar y no deriva con el
// cambio de hora. Sin zona, el reloj civil tal cual, como `datetime-local`. Preajustes relativos a «ahora».
import { addDays, startOfWeek, valid } from "./date";
import { fullTime, validTime } from "./time";
import { fromWall, offsetAt, validTimeZone, wallStatus, type Wall } from "./zone";

export interface DateTimeRange {
  start: string | null;
  end: string | null;
  /** Zona IANA de los dos extremos; sin ella, reloj civil. */
  timeZone?: string | null;
}

export type DateTimeRangeError = "incomplete" | "order" | "gap";

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)$/;

/** `YYYY-MM-DDTHH:mm[:ss]` que existe en el calendario. */
export const validDateTime = (text: string | null | undefined): text is string => {
  const m = typeof text === "string" ? DATE_TIME.exec(text) : null;
  return Boolean(m && valid(m[1]) && validTime(m[2]));
};

/** Junta día y hora; sin hora, `fallback`. */
export const joinDateTime = (date: string | null, time: string | null, fallback = "00:00") =>
  date && valid(date) ? `${date}T${validTime(time) ? time : fallback}` : null;

/** Separa un reloj de pared en día y hora. */
export function splitDateTime(text: string | null | undefined): { date: string | null; time: string | null } {
  const m = typeof text === "string" ? DATE_TIME.exec(text) : null;
  return m && valid(m[1]) && validTime(m[2]) ? { date: m[1]!, time: m[2]! } : { date: null, time: null };
}

const wallOf = (text: string): Wall => {
  const [h, mi, s] = fullTime(text.slice(11)).split(":").map(Number);
  return { date: text.slice(0, 10), hour: h!, minute: mi!, second: s! };
};

/** Instante (ms) de un reloj de pared en la zona (o en UTC sin zona, solo para comparar). */
export function instantOf(text: string, timeZone?: string | null): number | null {
  if (!validDateTime(text)) return null;
  return fromWall(wallOf(text), validTimeZone(timeZone) ? timeZone : "UTC");
}

/** Comprueba el rango: los dos extremos, fin posterior al inicio (en el instante real si hay zona). */
export function dateTimeRangeError(range: DateTimeRange | null | undefined): DateTimeRangeError | null {
  const start = validDateTime(range?.start) ? range!.start! : null;
  const end = validDateTime(range?.end) ? range!.end! : null;
  if (!start && !end) return null;
  if (!start || !end) return "incomplete";
  // Con zona, una hora que el cambio de hora se salta (02:30 del último domingo de marzo en Madrid) no existe: se
  // avisa en lugar de moverla en silencio.
  const zone = validTimeZone(range?.timeZone) ? range!.timeZone! : null;
  if (zone && (wallStatus(wallOf(start), zone) === "gap" || wallStatus(wallOf(end), zone) === "gap")) return "gap";
  const a = instantOf(start, zone);
  const b = instantOf(end, zone);
  return a !== null && b !== null && b > a ? null : "order";
}

/** Desfase en minutos → `+01:00`, `-03:30`. */
export const isoOffset = (minutes: number) => {
  const abs = Math.abs(minutes);
  return `${minutes < 0 ? "-" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

/** Extremo para el formulario: reloj civil, o con desfase y zona (`…T09:00+01:00[Europe/Madrid]`). */
export function zonedText(text: string, timeZone?: string | null): string {
  if (!validTimeZone(timeZone)) return text;
  const ms = instantOf(text, timeZone);
  if (ms === null) return text;
  return `${text}${isoOffset(offsetAt(ms, timeZone))}[${timeZone}]`;
}

/** Valor del formulario: `inicio/fin` (con zona en cada extremo si la hay). Vacío si falta un extremo. */
export function dateTimeRangeText(range: DateTimeRange | null | undefined): string {
  if (!validDateTime(range?.start) || !validDateTime(range?.end)) return "";
  return `${zonedText(range.start, range.timeZone)}/${zonedText(range.end, range.timeZone)}`;
}

/** Lee lo que escribe `dateTimeRangeText` (también sin zona). */
export function parseDateTimeRange(text: string | null | undefined): DateTimeRange {
  // La zona (`[Europe/Madrid]`) también lleva barra: se parte por la que precede a la fecha del fin.
  const [a, b] = (text ?? "").split(/\/(?=\d{4}-)/);
  const read = (part: string | undefined) => {
    const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:Z|[+-]\d{2}:?\d{2})?(?:\[([^\]]+)\])?$/.exec(part ?? "");
    return m ? { wall: validDateTime(m[1]) ? m[1]! : null, zone: m[2] && validTimeZone(m[2]) ? m[2] : null } : { wall: null, zone: null };
  };
  const start = read(a);
  const end = read(b);
  return { start: start.wall, end: end.wall, timeZone: start.zone ?? end.zone ?? null };
}

export type DateTimePresetKey = "last-hour" | "last-24-hours" | "today" | "yesterday" | "last-7-days" | "next-7-days" | "this-week";

export interface DateTimePreset {
  label: string;
  /** Clave de un preajuste conocido o función de «ahora» (`YYYY-MM-DDTHH:mm`) al rango. */
  value: DateTimePresetKey | ((now: string) => { start: string; end: string });
}

const pad = (n: number) => String(n).padStart(2, "0");
const shiftMinutes = (text: string, minutes: number) => {
  const ms = Date.UTC(
    Number(text.slice(0, 4)),
    Number(text.slice(5, 7)) - 1,
    Number(text.slice(8, 10)),
    Number(text.slice(11, 13)),
    Number(text.slice(14, 16)) + minutes,
  );
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** Rango de un preajuste respecto a `now` (`YYYY-MM-DDTHH:mm`, reloj de la zona elegida). */
export function resolveDateTimePreset(preset: DateTimePreset["value"], now: string, weekStart = 1): { start: string; end: string } | null {
  if (!validDateTime(now)) return null;
  if (typeof preset === "function") return preset(now);
  const day = now.slice(0, 10);
  const time = now.slice(11, 16);
  switch (preset) {
    case "last-hour":
      return { start: shiftMinutes(now, -60), end: now.slice(0, 16) };
    case "last-24-hours":
      return { start: `${addDays(day, -1)}T${time}`, end: now.slice(0, 16) };
    case "today":
      return { start: `${day}T00:00`, end: `${day}T23:59` };
    case "yesterday":
      return { start: `${addDays(day, -1)}T00:00`, end: `${addDays(day, -1)}T23:59` };
    case "last-7-days":
      return { start: `${addDays(day, -6)}T00:00`, end: `${day}T23:59` };
    case "next-7-days":
      return { start: `${day}T00:00`, end: `${addDays(day, 6)}T23:59` };
    case "this-week": {
      const first = startOfWeek(day, weekStart);
      return { start: `${first}T00:00`, end: `${addDays(first, 6)}T23:59` };
    }
    default:
      return null;
  }
}

/** Reloj de pared de «ahora» en una zona (o en la del dispositivo). */
export function nowIn(timeZone?: string | null, now: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: validTimeZone(timeZone) ? timeZone : undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Texto del campo con `Intl.DateTimeFormat#formatRange`: «Nov 28, 22:00 – Nov 29, 02:00», sin repetir lo que comparten
 * los dos extremos. El año solo aparece si no es `currentYear` (el de hoy, si no se indica).
 */
export function formatDateTimeRange(
  range: DateTimeRange | null | undefined,
  locale?: string,
  hour12?: boolean,
  currentYear: number = new Date().getFullYear(),
): string {
  if (!validDateTime(range?.start) || !validDateTime(range?.end)) return "";
  const ms = (text: string) =>
    Date.UTC(
      Number(text.slice(0, 4)),
      Number(text.slice(5, 7)) - 1,
      Number(text.slice(8, 10)),
      Number(text.slice(11, 13)),
      Number(text.slice(14, 16)),
    );
  const year = Number(range.start.slice(0, 4)) === currentYear && Number(range.end.slice(0, 4)) === currentYear ? undefined : "numeric";
  const format = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year,
    hour: "2-digit",
    minute: "2-digit",
    hour12,
    timeZone: "UTC",
  });
  const a = ms(range.start);
  const b = ms(range.end);
  return b > a ? format.formatRange(a, b) : `${format.format(a)} – ${format.format(b)}`;
}

export interface DateTimeRangePickerLabels {
  placeholder: string;
  dialog: string;
  presets: string;
  start: string;
  end: string;
  timeZone: string;
  apply: string;
  cancel: string;
}

export const DATE_TIME_RANGE_LABELS: DateTimeRangePickerLabels = {
  placeholder: "Select date and time range",
  dialog: "Choose date and time range",
  presets: "Quick ranges",
  start: "Start",
  end: "End",
  timeZone: "Time zone",
  apply: "Apply",
  cancel: "Cancel",
};

export interface DateTimeRangeMessages {
  incomplete: string;
  order: string;
  gap: string;
}

export const DATE_TIME_RANGE_MESSAGES: DateTimeRangeMessages = {
  incomplete: "Choose a start and an end",
  order: "The end must be after the start",
  gap: "That time does not exist in this time zone",
};
