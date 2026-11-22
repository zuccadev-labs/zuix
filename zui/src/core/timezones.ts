// Zonas IANA para un selector: la lista del entorno (`Intl.supportedValuesOf("timeZone")`, con un respaldo corto si
// falta), la región y la ciudad de cada una, su desfase en un instante («GMT+5:30») y la hora que marca. Se agrupan
// por región o por desfase. Puro y sin documento.

import { safeLocale } from "./date";
import { fmt } from "./vnode";
import { offsetAt, validTimeZone, zoneCity } from "./zone";

/** Respaldo si el entorno no lista sus zonas: una por desfase habitual. */
const FALLBACK = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Caracas",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "Atlantic/Azores",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Cairo",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** Zonas del entorno (con `UTC`), o el respaldo. */
export function listTimeZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  let zones: string[] = [];
  try {
    zones = supported ? supported("timeZone") : [];
  } catch {
    zones = [];
  }
  if (!zones.length) zones = FALLBACK.filter((z) => validTimeZone(z));
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

/** Región de una zona: «America», «Europe»… `UTC` y `Etc/*` van en «UTC». */
export const zoneRegion = (tz: string) => (tz === "UTC" || tz.startsWith("Etc/") || !tz.includes("/") ? "UTC" : tz.split("/")[0]!);

/** Desfase en minutos → «GMT», «GMT+1», «GMT−3», «GMT+5:30». */
export function offsetText(minutes: number, prefix = "GMT"): string {
  if (minutes === 0) return prefix;
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const m = abs % 60;
  return `${prefix}${sign}${Math.floor(abs / 60)}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

export interface ZoneOption {
  value: string;
  city: string;
  region: string;
  /** Desfase en minutos en el instante pedido. */
  offset: number;
  offsetLabel: string;
  /** Hora que marca («10:42»). */
  time: string;
  /** Texto de la opción: «Madrid · GMT+1 · 10:42». */
  label: string;
}

export interface ZoneOptionsInput {
  zones?: readonly string[];
  at?: number;
  locale?: string;
  showOffset?: boolean;
  showTime?: boolean;
  /** Nombre visible de cada zona (por defecto la ciudad). */
  names?: Readonly<Record<string, string>>;
}

/** Opciones de zona con desfase y hora en `at`, ordenadas por desfase y ciudad. Las zonas no válidas se omiten. */
export function zoneOptions({
  zones,
  at = Date.now(),
  locale,
  showOffset = true,
  showTime = true,
  names,
}: ZoneOptionsInput = {}): ZoneOption[] {
  const list = (zones?.length ? zones : listTimeZones()).filter((z) => validTimeZone(z));
  const loc = safeLocale(locale);
  const out = [...new Set(list)].map((value) => {
    const offset = offsetAt(at, value);
    const city = names?.[value] ?? (value === "UTC" ? "UTC" : zoneCity(value));
    const time = fmt(loc, { hour: "2-digit", minute: "2-digit" }, value).format(at);
    const offsetLabel = offsetText(offset);
    const label = [city, showOffset && value !== "UTC" ? offsetLabel : "", showTime ? time : ""].filter(Boolean).join(" · ");
    return { value, city, region: zoneRegion(value), offset, offsetLabel, time, label };
  });
  return out.sort((a, b) => a.offset - b.offset || a.city.localeCompare(b.city));
}

export interface ZoneGroup {
  label: string;
  options: ZoneOption[];
}

/** Grupos por región (alfabéticos) o por desfase (de menor a mayor). */
export function groupZones(options: readonly ZoneOption[], by: "region" | "offset" = "region"): ZoneGroup[] {
  const groups = new Map<string, ZoneOption[]>();
  for (const o of options) {
    const key = by === "region" ? o.region : o.offsetLabel;
    const list = groups.get(key) ?? [];
    list.push(o);
    groups.set(key, list);
  }
  const entries = [...groups.entries()].map(([label, list]) => ({ label, options: list }));
  if (by === "region") entries.sort((a, b) => (a.label === "UTC" ? -1 : b.label === "UTC" ? 1 : a.label.localeCompare(b.label)));
  else entries.sort((a, b) => a.options[0]!.offset - b.options[0]!.offset);
  return entries;
}

/** ¿Coincide la consulta con la zona? Ciudad, identificador IANA, región o desfase («+5:30», «gmt-3»). */
export function zoneMatches(option: Pick<ZoneOption, "value" | "label" | "offsetLabel">, query: string): boolean {
  const q = query
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
  if (!q) return true;
  const hay = `${option.label} ${option.value.replace(/[_/]/g, " ")} ${option.offsetLabel.replace("−", "-")}`.toLowerCase();
  return q
    .replace("−", "-")
    .split(" ")
    .every((word) => hay.includes(word));
}
