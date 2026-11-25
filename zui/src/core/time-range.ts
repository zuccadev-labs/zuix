// Rango de horas de reloj (TimeRangePicker) sin documento: inicio y fin `HH:mm[:ss]`, si el fin cae al día siguiente
// (cruza la medianoche), la duración y por qué no vale. Texto de formulario `inicio/fin`, como el rango de fechas.
import { fullTime, validTime } from "./time";

export interface TimeRange {
  start: string | null;
  end: string | null;
}

export type TimeRangeError = "incomplete" | "order" | "short" | "long";

export interface TimeRangeRules {
  /** El fin puede ser anterior (o igual) al inicio: cae al día siguiente. */
  allowOvernight?: boolean;
  /** Duración mínima y máxima, en minutos. */
  minDuration?: number;
  maxDuration?: number;
}

export interface TimeRangeInfo {
  /** Minutos entre inicio y fin (con el salto de día si cruza), o null si falta alguno. */
  duration: number | null;
  overnight: boolean;
  error: TimeRangeError | null;
}

const seconds = (time: string) => {
  const [h, m, s] = fullTime(time).split(":").map(Number);
  return h! * 3600 + m! * 60 + s!;
};

/** Estado del rango con sus reglas. Un rango vacío del todo no es un error (lo decide `required`). */
export function timeRangeInfo(range: TimeRange | null | undefined, rules: TimeRangeRules = {}): TimeRangeInfo {
  const start = validTime(range?.start) ? range!.start! : null;
  const end = validTime(range?.end) ? range!.end! : null;
  if (!start || !end) return { duration: null, overnight: false, error: start || end ? "incomplete" : null };
  const a = seconds(start);
  const b = seconds(end);
  const overnight = b <= a;
  if (overnight && !rules.allowOvernight) return { duration: null, overnight: false, error: "order" };
  const duration = ((overnight ? b + 86_400 : b) - a) / 60;
  if (rules.minDuration !== undefined && duration < rules.minDuration) return { duration, overnight, error: "short" };
  if (rules.maxDuration !== undefined && duration > rules.maxDuration) return { duration, overnight, error: "long" };
  return { duration, overnight, error: null };
}

/** Rango → `inicio/fin` (vacío sin inicio). */
export const timeRangeText = (range: TimeRange | null | undefined) =>
  range?.start || range?.end ? `${range.start ?? ""}/${range.end ?? ""}` : "";

/** `inicio/fin` → rango (lo que no sea una hora válida queda en null). */
export function parseTimeRange(text: string | null | undefined): TimeRange {
  const [start, end] = (text ?? "").split("/");
  return { start: validTime(start) ? start : null, end: validTime(end) ? end : null };
}

/** El mismo rango (para no avisar de un cambio que no lo es). */
export const sameTimeRange = (a: TimeRange | null | undefined, b: TimeRange | null | undefined) =>
  (a?.start ?? null) === (b?.start ?? null) && (a?.end ?? null) === (b?.end ?? null);

export interface TimeRangeMessages {
  incomplete: string;
  order: string;
  short: string;
  long: string;
}

export const TIME_RANGE_MESSAGES: TimeRangeMessages = {
  incomplete: "Enter both times",
  order: "The end time must be after the start time",
  short: "The range is too short",
  long: "The range is too long",
};

export interface TimeRangePickerLabels {
  start: string;
  end: string;
  /** Indicador de que el fin cae al día siguiente. */
  overnight: string;
  /** Lo que se anuncia del indicador. */
  overnightDescription: string;
  /** Texto de la duración; `{duration}` se sustituye. */
  duration: string;
}

export const TIME_RANGE_LABELS: TimeRangePickerLabels = {
  start: "Start time",
  end: "End time",
  overnight: "+1 day",
  overnightDescription: "Ends the next day",
  duration: "{duration}",
};
