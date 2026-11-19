// RelativeTime sin framework: `<time class="z-relative-time" datetime="…">` dentro de `[data-z-dom]`. Pinta el texto
// relativo y el `title` con la fecha completa, y lo vuelve a pintar con la cadencia de core/relative.
// Atributos: data-locale, data-format="long|short|narrow", data-numeric="auto|always", data-min-unit.
import { formatRelative, nextUpdate, toInstant, type RelativeUnit } from "../core/relative";
import { safeLocale } from "../core/date";
import type { Listen } from "./shared";

const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const UNITS = ["second", "minute", "hour", "day", "week", "month", "year"];

function paint(el: HTMLElement): void {
  clearTimeout(timers.get(el));
  const then = toInstant(el.getAttribute("datetime"));
  if (then === null || !el.isConnected) return;
  const data = el.dataset;
  const locale = safeLocale(data.locale);
  const now = Date.now();
  const style = data.format === "short" || data.format === "narrow" ? data.format : "long";
  const minUnit = UNITS.includes(data.minUnit ?? "") ? (data.minUnit as RelativeUnit) : undefined;
  el.textContent = formatRelative(then, now, locale, { style, numeric: data.numeric === "always" ? "always" : "auto", minUnit });
  if (!el.title) el.title = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(then);
  timers.set(
    el,
    setTimeout(() => paint(el), nextUpdate(then, now)),
  );
}

/** Vuelve a pintar un RelativeTime (p. ej. tras cambiar su `datetime`). */
export function updateRelativeTime(el: HTMLElement): void {
  paint(el);
}

export function setup(_on: Listen): void {}

export function hydrate(root: ParentNode): void {
  const scope = root instanceof Element && root.matches(".z-relative-time") ? [root as HTMLElement] : [];
  for (const el of [...scope, ...root.querySelectorAll<HTMLElement>(".z-relative-time[datetime]")])
    if (el.closest("[data-z-dom]")) paint(el);
}
