// RelativeTime sin framework: `<time class="z-relative-time" datetime="…">` dentro de `[data-z-dom]`. Pinta el texto
// relativo y el `title` con la fecha completa, y lo vuelve a pintar con la cadencia de core/relative.
// Atributos: data-locale, data-format="long|short|narrow", data-numeric="auto|always", data-min-unit.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { pause } from "@zuccadev-labs/zuix-zicon/icons/pause";
import { play } from "@zuccadev-labs/zuix-zicon/icons/play";
import { safeLocale } from "../core/date";
import { formatRelative, nextUpdate, toInstant, type RelativeUnit } from "../core/relative";
import {
  elapsedOf,
  idleClock,
  isoDuration,
  milestone,
  nextTick,
  parseDuration,
  pauseClock,
  shownMs,
  spokenDuration,
  startClock,
  timerText,
  type TimerClock,
  type TimerMode,
  type TimerPrecision,
  type TimerState,
} from "../core/stopwatch";
import { emit } from "./forms-popup";
import { setMarkup, type Listen } from "./shared";

registerIcons([play, pause]);

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

export function setup(on: Listen): void {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>(".z-timer__toggle, .z-timer__reset");
    const el = button?.closest<HTMLElement>(".z-timer");
    if (!button || !el || button.disabled || !el.closest("[data-z-dom]")) return;
    if (button.matches(".z-timer__reset")) resetTimer(el);
    else if (timerEntry(el).state === "running") pauseTimer(el);
    else startTimer(el);
  });
}

export function hydrate(root: ParentNode): void {
  const scope = root instanceof Element && root.matches(".z-relative-time") ? [root as HTMLElement] : [];
  for (const el of [...scope, ...root.querySelectorAll<HTMLElement>(".z-relative-time[datetime]")])
    if (el.closest("[data-z-dom]")) paint(el);
  hydrateTimers(root);
}

/* ---------- Timer ---------- */
// `.z-timer` dentro de `[data-z-dom]`: data-mode="countdown|stopwatch", data-duration (segundos o PT…),
// data-precision="tenth", data-show-hours, data-announce-every, data-announce-final, data-autostart, data-locale y los
// textos (data-start-label, data-pause-label, data-resume-label, data-done-label, data-paused-label, data-left-label).
// Emite z:statechange { state } y z:complete. Mismo reloj que el binding de React (core/stopwatch).

interface TimerEntry {
  clock: TimerClock;
  state: TimerState;
  shown: number;
  tick?: ReturnType<typeof setTimeout>;
}
const timerEntries = new WeakMap<HTMLElement, TimerEntry>();

function timerConfig(el: HTMLElement) {
  const d = el.dataset;
  const mode: TimerMode = d.mode === "stopwatch" ? "stopwatch" : "countdown";
  const count = (raw: string | undefined, fallback: number) => (raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : fallback);
  return {
    mode,
    total: mode === "countdown" ? parseDuration(d.duration) : 0,
    precision: (d.precision === "tenth" ? "tenth" : "second") as TimerPrecision,
    hours: d.showHours !== undefined && d.showHours !== "false",
    every: count(d.announceEvery, 60),
    final: count(d.announceFinal, 0),
    locale: safeLocale(d.locale),
    labels: {
      start: d.startLabel ?? "Start",
      pause: d.pauseLabel ?? "Pause",
      resume: d.resumeLabel ?? "Resume",
      done: d.doneLabel ?? "Time's up",
      paused: d.pausedLabel ?? "Paused",
      left: d.leftLabel ?? "left",
    },
  };
}

function timerEntry(el: HTMLElement): TimerEntry {
  let entry = timerEntries.get(el);
  if (!entry) {
    const c = timerConfig(el);
    entry = { clock: idleClock(), state: "idle", shown: shownMs(c.mode, c.total, 0) };
    timerEntries.set(el, entry);
  }
  return entry;
}

function timerSpoken(c: ReturnType<typeof timerConfig>, ms: number): string {
  const text = spokenDuration(ms, c.locale, c.mode);
  return c.mode === "countdown" ? `${text} ${c.labels.left}` : text;
}

function timerAnnounce(el: HTMLElement, text: string): void {
  const status = el.querySelector<HTMLElement>(".z-timer__status");
  if (!status) return;
  // Vaciar antes de escribir: el mismo texto dos veces seguidas también se anuncia.
  status.textContent = "";
  requestAnimationFrame(() => (status.textContent = text));
}

function paintTimer(el: HTMLElement): void {
  const c = timerConfig(el);
  const entry = timerEntry(el);
  const elapsed = elapsedOf(entry.clock, Date.now());
  const shown = shownMs(c.mode, c.total, elapsed);
  el.dataset.state = entry.state;
  const display = el.querySelector<HTMLElement>(".z-timer__display");
  if (display) {
    display.setAttribute("datetime", isoDuration(shown));
    const face = display.querySelector<HTMLElement>('[role="timer"]') ?? display;
    face.textContent = timerText(shown, { mode: c.mode, precision: c.precision, hours: c.hours, locale: c.locale });
    face.setAttribute("aria-label", timerSpoken(c, shown));
  }
  const toggle = el.querySelector<HTMLButtonElement>(".z-timer__toggle");
  if (toggle) {
    const running = entry.state === "running";
    toggle.className = `z-btn ${running ? "z-btn--secondary" : "z-btn--primary"} z-timer__toggle`;
    toggle.disabled = c.mode === "countdown" && !c.total;
    const text = running ? c.labels.pause : entry.state === "paused" ? c.labels.resume : c.labels.start;
    setMarkup(toggle, iconSvg(running ? "pause" : "play", { size: 16 }));
    toggle.append(text);
  }
  const reset = el.querySelector<HTMLButtonElement>(".z-timer__reset");
  if (reset) reset.disabled = entry.state === "idle";
}

function setTimerState(el: HTMLElement, entry: TimerEntry, state: TimerState): void {
  entry.state = state;
  emit(el, "statechange", { state });
}

function scheduleTimer(el: HTMLElement): void {
  const entry = timerEntry(el);
  clearTimeout(entry.tick);
  if (entry.state !== "running" || !el.isConnected) return;
  const c = timerConfig(el);
  const elapsed = elapsedOf(entry.clock, Date.now());
  const shown = shownMs(c.mode, c.total, elapsed);
  const before = entry.shown;
  entry.shown = shown;
  if (c.mode === "countdown" && shown === 0) {
    entry.clock = { accumulated: c.total, startedAt: null };
    setTimerState(el, entry, "done");
    paintTimer(el);
    timerAnnounce(el, c.labels.done);
    emit(el, "complete");
    return;
  }
  if (milestone(c.mode, before, shown, c.every, c.final) !== null) timerAnnounce(el, timerSpoken(c, shown));
  paintTimer(el);
  entry.tick = setTimeout(() => scheduleTimer(el), Math.max(16, nextTick(c.mode, c.total, elapsed, c.precision)));
}

/** Inicia o reanuda un Timer. */
export function startTimer(el: HTMLElement): void {
  const c = timerConfig(el);
  const entry = timerEntry(el);
  if (entry.state === "running" || (c.mode === "countdown" && !c.total)) return;
  if (entry.state === "done") entry.clock = idleClock();
  entry.clock = startClock(entry.clock, Date.now());
  entry.shown = shownMs(c.mode, c.total, entry.clock.accumulated);
  setTimerState(el, entry, "running");
  timerAnnounce(el, timerSpoken(c, entry.shown));
  scheduleTimer(el);
}

/** Pausa un Timer. */
export function pauseTimer(el: HTMLElement): void {
  const entry = timerEntry(el);
  if (entry.state !== "running") return;
  clearTimeout(entry.tick);
  entry.clock = pauseClock(entry.clock, Date.now());
  setTimerState(el, entry, "paused");
  const c = timerConfig(el);
  timerAnnounce(el, `${c.labels.paused}, ${timerSpoken(c, shownMs(c.mode, c.total, entry.clock.accumulated))}`);
  paintTimer(el);
}

/** Vuelve a cero (cronómetro) o a la duración (cuenta atrás), parado. */
export function resetTimer(el: HTMLElement): void {
  const entry = timerEntry(el);
  clearTimeout(entry.tick);
  const c = timerConfig(el);
  entry.clock = idleClock();
  entry.shown = shownMs(c.mode, c.total, 0);
  setTimerState(el, entry, "idle");
  const status = el.querySelector<HTMLElement>(".z-timer__status");
  if (status) status.textContent = "";
  paintTimer(el);
}

function hydrateTimers(root: ParentNode): void {
  const scope = root instanceof Element && root.matches(".z-timer") ? [root as HTMLElement] : [];
  for (const el of [...scope, ...root.querySelectorAll<HTMLElement>(".z-timer")]) {
    if (!el.closest("[data-z-dom]")) continue;
    const fresh = !timerEntries.has(el);
    paintTimer(el);
    if (fresh && el.dataset.autostart !== undefined && el.dataset.autostart !== "false") startTimer(el);
  }
}
