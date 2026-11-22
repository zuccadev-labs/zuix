// LogConsole como pieza (core/widget): logs con hora, nivel, origen y mensaje; filtros por nivel con contadores,
// búsqueda con las coincidencias marcadas, «seguir el final», copiar y descargar lo filtrado. Las filas se pintan por
// ventana (core/virtual): con miles de entradas solo existen las que se ven. Es una rejilla (`role="grid"`) con
// `aria-rowcount` y `aria-rowindex`, una sola parada de Tab y flechas entre celdas; las entradas nuevas no se
// anuncian (solo el número de coincidencias al buscar). El texto de la aplicación entra siempre como texto.

import { download } from "./download";
import { filterLogs, levelOf, LOG_LEVELS, logLine, markParts, type LogEntry, type LogLevel } from "./log-filter";
import { toInstant } from "./relative";
import { copyControl, copyFromButton, type CopyLabels, type CopyState } from "./terminal-shared";
import { virtualWindow } from "./virtual";
import { fill, fmt, h, icon, on, type VNode } from "./vnode";
import { announceIn, list, yes, type Widget, type WidgetHost } from "./widget";
import { safeTimeZone } from "./zone";

export type { LogEntry, LogLevel };

export interface LogConsoleLabels extends CopyLabels {
  console: string;
  levels: string;
  debug: string;
  info: string;
  warn: string;
  error: string;
  search: string;
  follow: string;
  download: string;
  clear: string;
  empty: string;
  /** «{n} matches». */
  matches: string;
  time: string;
  level: string;
  source: string;
  message: string;
}

export const LOG_CONSOLE_LABELS: LogConsoleLabels = {
  console: "Logs",
  levels: "Levels",
  debug: "Debug",
  info: "Info",
  warn: "Warning",
  error: "Error",
  search: "Search logs",
  follow: "Follow",
  download: "Download",
  clear: "Clear",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed",
  empty: "No entries",
  matches: "{n} matches",
  time: "Time",
  level: "Level",
  source: "Source",
  message: "Message",
};

export interface LogConsoleProps {
  entries?: readonly LogEntry[];
  /** Niveles que se ofrecen como filtro. */
  levels?: readonly LogLevel[];
  /** Niveles activos al empezar (por defecto, todos). */
  defaultLevels?: readonly LogLevel[];
  /** Sigue el final al llegar entradas (por defecto, sí). */
  follow?: boolean;
  /** Ajusta las líneas largas (sin virtualizar por encima de `virtualizeAt` filas). */
  wrap?: boolean;
  /** Filas a partir de las que se pinta por ventana (por defecto 200). */
  virtualizeAt?: number;
  timeZone?: string;
  /** Opciones de `Intl.DateTimeFormat` para la hora (por defecto, HH:mm:ss.SSS). */
  timeFormat?: Intl.DateTimeFormatOptions;
  /** Nombre del archivo que se descarga (sin él, no hay botón de descargar). */
  downloadName?: string;
  /** Botón de limpiar (avisa con `clear`; los datos los vacía la aplicación). */
  clearable?: boolean;
  title?: string;
  locale?: string;
  labels?: Partial<LogConsoleLabels>;
}

interface Config {
  entries: readonly LogEntry[];
  levels: LogLevel[];
  defaultLevels: LogLevel[];
  follow: boolean;
  wrap: boolean;
  virtualizeAt: number;
  timeZone: string;
  timeFormat: Intl.DateTimeFormatOptions;
  downloadName: string;
  clearable: boolean;
  title: string;
  locale?: string;
  labels: LogConsoleLabels;
}

interface State {
  query: string;
  active: LogLevel[];
  follow: boolean;
  /** Entradas añadidas con `appendLogs` (modo imperativo). */
  appended: LogEntry[];
  scroll: number;
  viewport: number;
  rowHeight: number;
  /** Celda activa: fila (posición en lo filtrado) y columna. */
  row: number;
  col: number;
  copied: CopyState;
}

type Host = WidgetHost<Config, State>;

const COLUMNS = ["time", "level", "source", "message"] as const;
const DEFAULT_ROW = 28;

const levelsOf = (v: readonly string[] | undefined, fallback: readonly LogLevel[]) => {
  const out = LOG_LEVELS.filter((l) => v?.includes(l));
  return out.length ? out : [...fallback];
};

function allEntries(c: Config, s: State): readonly LogEntry[] {
  return s.appended.length ? [...c.entries, ...s.appended] : c.entries;
}

function view(c: Config, s: State) {
  const entries = allEntries(c, s);
  const filtered = filterLogs(entries, { levels: s.active, query: s.query });
  return { entries, filtered };
}

function timeText(c: Config, value: LogEntry["time"]): { text: string; iso?: string } {
  if (value === undefined || value === null || value === "") return { text: "" };
  const ms = toInstant(value as string);
  if (ms === null) return { text: String(value) };
  const f = fmt(c.locale, c.timeFormat, c.timeZone);
  let text = f.format(ms);
  if (!("fractionalSecondDigits" in c.timeFormat) && c.timeFormat === DEFAULT_TIME)
    text += `.${String(((ms % 1000) + 1000) % 1000).padStart(3, "0")}`;
  return { text, iso: new Date(ms).toISOString() };
}

const DEFAULT_TIME: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" };

/** API imperativa del modo DOM: añadir entradas sin volver a pasar la lista. */
const appenders = new WeakMap<HTMLElement, (entries: readonly LogEntry[]) => void>();
export function appendLogEntries(el: HTMLElement, entries: readonly LogEntry[]): void {
  appenders.get(el)?.(entries);
}

const live = new WeakMap<HTMLElement, { follow: boolean; frame: number; focusCell: boolean }>();

function attach(root: HTMLElement, host: Host): () => void {
  const state = { follow: host.state().follow, frame: 0, focusCell: false };
  live.set(root, state);
  const viewport = () => root.querySelector<HTMLElement>(".z-log-console__viewport");
  appenders.set(root, (entries) => host.update({ appended: [...host.state().appended, ...entries] }));

  const measure = () => {
    const vp = viewport();
    if (!vp) return;
    // El alto de fila sale del CSS (la cabecera lo comparte; con puntero grueso, el objetivo táctil).
    const row = root.querySelector<HTMLElement>(".z-log-console__head");
    const rowHeight = row?.offsetHeight || host.state().rowHeight;
    const s = host.state();
    if (vp.clientHeight !== s.viewport || rowHeight !== s.rowHeight) host.update({ viewport: vp.clientHeight, rowHeight });
  };
  const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const ro = RO ? new RO(() => measure()) : null;
  const vp0 = viewport();
  if (vp0 && ro) ro.observe(vp0);
  requestAnimationFrame(measure);

  const scroll = (event: Event) => {
    const vp = event.target as HTMLElement;
    if (!vp.matches?.(".z-log-console__viewport")) return;
    const atEnd = vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 4;
    // Subir a leer deja de seguir el final; volver abajo del todo no lo reactiva (es un botón).
    if (!atEnd && host.state().follow && state.follow && vp.dataset.programmatic !== "1") {
      state.follow = false;
      host.update({ follow: false });
    }
    vp.dataset.programmatic = "";
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      if (Math.abs(vp.scrollTop - host.state().scroll) >= 1) host.update({ scroll: vp.scrollTop });
    });
  };

  const input = (event: Event) => {
    const field = event.target as HTMLInputElement;
    if (!field.matches?.(".z-log-console__search")) return;
    host.update({ query: field.value, row: 0 });
    const c = host.config();
    const n = view(c, host.state()).filtered.matches;
    announceIn(root, field.value.trim() ? fill(c.labels.matches, { n }) : "", ".z-log-console__live");
  };

  const click = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const pick = <T extends HTMLElement>(sel: string) => {
      const el = target?.closest?.<T>(sel);
      return el && root.contains(el) ? el : null;
    };
    const level = pick<HTMLButtonElement>(".z-log-console__level");
    if (level) {
      const value = level.dataset.level as LogLevel;
      const active = host.state().active;
      const next = active.includes(value) ? active.filter((l) => l !== value) : LOG_LEVELS.filter((l) => l === value || active.includes(l));
      host.update({ active: next, row: 0 });
      host.emit("levels-change", { levels: next });
      return;
    }
    if (pick(".z-log-console__follow")) {
      const follow = !host.state().follow;
      state.follow = follow;
      host.update({ follow });
      return;
    }
    const copy = pick<HTMLButtonElement>(".z-log-console__copy");
    if (copy) {
      const c = host.config();
      const { entries, filtered } = view(c, host.state());
      const text = filtered.rows.map((i) => logLine(entries[i]!, timeText(c, entries[i]!.time).text)).join("\n");
      void copyFromButton(copy, text, c.labels, (copied) => host.update({ copied }));
      return;
    }
    if (pick(".z-log-console__download")) {
      const c = host.config();
      const { entries, filtered } = view(c, host.state());
      const text = filtered.rows.map((i) => logLine(entries[i]!, timeText(c, entries[i]!.time).text)).join("\n");
      void download(text, c.downloadName, "text/plain", root.ownerDocument);
      return;
    }
    if (pick(".z-log-console__clear")) {
      host.update({ appended: [], row: 0 });
      host.emit("clear", {});
      return;
    }
    const cell = pick<HTMLElement>(".z-log-console__cell[data-row]");
    if (cell) host.update({ row: Number(cell.dataset.row), col: Number(cell.dataset.col) });
  };

  const keydown = (event: KeyboardEvent) => {
    const cell = (event.target as Element | null)?.closest?.<HTMLElement>(".z-log-console__cell[data-row]");
    if (!cell || !root.contains(cell)) return;
    const s = host.state();
    const total = view(host.config(), s).filtered.rows.length;
    const page = Math.max(1, Math.floor(s.viewport / s.rowHeight) - 1);
    let { row, col } = s;
    const key = event.key;
    if (key === "ArrowDown") row++;
    else if (key === "ArrowUp") row--;
    else if (key === "ArrowRight") col++;
    else if (key === "ArrowLeft") col--;
    else if (key === "PageDown") row += page;
    else if (key === "PageUp") row -= page;
    else if (key === "Home" && event.ctrlKey) row = 0;
    else if (key === "Home") col = 0;
    else if (key === "End" && event.ctrlKey) row = total - 1;
    else if (key === "End") col = COLUMNS.length - 1;
    else return;
    event.preventDefault();
    row = Math.max(0, Math.min(total - 1, row));
    col = Math.max(0, Math.min(COLUMNS.length - 1, col));
    // La fila activa se trae a la vista antes de pintar (puede no existir todavía en la ventana).
    const vp = viewport();
    if (vp) {
      const top = row * s.rowHeight;
      if (top < vp.scrollTop) vp.scrollTop = top;
      else if (top + s.rowHeight > vp.scrollTop + vp.clientHeight) vp.scrollTop = top + s.rowHeight - vp.clientHeight + s.rowHeight;
    }
    state.focusCell = true;
    host.update({ row, col, scroll: vp?.scrollTop ?? s.scroll }, true);
  };

  root.addEventListener("scroll", scroll, true);
  root.addEventListener("input", input);
  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  return () => {
    root.removeEventListener("scroll", scroll, true);
    root.removeEventListener("input", input);
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", keydown);
    ro?.disconnect();
    cancelAnimationFrame(state.frame);
    appenders.delete(root);
    live.delete(root);
  };
}

export const logConsoleWidget: Widget<LogConsoleProps, Config, State> = {
  root: "z-log-console",
  configure: (p) => {
    const levels = levelsOf(p.levels, LOG_LEVELS);
    return {
      entries: p.entries ?? [],
      levels,
      defaultLevels: levelsOf(p.defaultLevels, levels),
      follow: p.follow !== false,
      wrap: Boolean(p.wrap),
      virtualizeAt: Math.max(0, Math.floor(Number(p.virtualizeAt ?? 200))),
      timeZone: safeTimeZone(p.timeZone),
      timeFormat: p.timeFormat ?? DEFAULT_TIME,
      downloadName: p.downloadName ?? "",
      clearable: Boolean(p.clearable),
      title: p.title ?? "",
      locale: p.locale,
      labels: { ...LOG_CONSOLE_LABELS, ...p.labels },
    };
  },
  initial: (c) => ({
    query: "",
    active: c.defaultLevels,
    follow: c.follow,
    appended: [],
    scroll: 0,
    viewport: 320,
    rowHeight: DEFAULT_ROW,
    row: 0,
    col: 3,
    copied: "idle",
  }),
  tree(c, s, uid) {
    const { labels } = c;
    const { entries, filtered } = view(c, s);
    const total = filtered.rows.length;
    const virtual = !c.wrap || total > c.virtualizeAt;
    const win = virtual
      ? virtualWindow({ count: total, size: s.rowHeight, scroll: s.scroll, viewport: s.viewport, overscan: 8 })
      : { start: 0, end: total, before: 0, after: 0, total: total * s.rowHeight };
    const active = Math.min(s.row, Math.max(0, total - 1));
    // La fila activa siempre existe en el documento (aunque quede fuera de la ventana): la parada de Tab no se pierde.
    const indexes: number[] = [];
    for (let i = win.start; i < win.end; i++) indexes.push(i);
    if (total && (active < win.start || active >= win.end)) indexes.push(active);
    indexes.sort((a, b) => a - b);
    const rows = indexes.map((pos) => {
      const entry = entries[filtered.rows[pos]!]!;
      const level = levelOf(entry);
      const time = timeText(c, entry.time);
      const cell = (col: number, ...content: VNode[]) =>
        h(
          "div",
          {
            class: "z-log-console__cell",
            role: "gridcell",
            "data-col": col,
            "data-row": pos,
            "data-column": COLUMNS[col],
            tabindex: pos === active && col === s.col ? 0 : -1,
          },
          ...content,
        );
      const message = markParts(entry.message, s.query).map((part) =>
        part.match ? h("mark", { class: "z-log-console__match" }, part.text) : part.text,
      );
      return h(
        "div",
        {
          class: "z-log-console__row",
          role: "row",
          key: String(entry.id ?? filtered.rows[pos]),
          "aria-rowindex": pos + 2,
          "data-level": level,
          "data-detached": on(virtual && (pos < win.start || pos >= win.end)),
          s: virtual ? { "--z-log-row": pos } : undefined,
        },
        cell(0, time.iso ? h("time", { datetime: time.iso }, time.text) : time.text),
        cell(1, h("span", { class: "z-log-console__badge", "data-level": level }, labels[level])),
        cell(2, entry.source ?? ""),
        cell(3, ...message),
      );
    });
    const levelButtons = c.levels.map((level) =>
      h(
        "button",
        {
          type: "button",
          class: "z-btn z-btn--ghost z-log-console__level",
          "data-size": "sm",
          "data-level": level,
          key: level,
          "aria-pressed": s.active.includes(level) ? "true" : "false",
        },
        h("span", { class: "z-log-console__dot", "data-level": level, "aria-hidden": "true" }),
        labels[level],
        h("span", { class: "z-log-console__count" }, String(filtered.counts[level])),
      ),
    );
    return h(
      "div",
      { class: "z-log-console", role: "region", "aria-label": c.title || labels.console, "data-wrapped": on(c.wrap && !virtual) },
      h(
        "div",
        { class: "z-log-console__bar" },
        h("div", { class: "z-log-console__levels", role: "group", "aria-label": labels.levels }, ...levelButtons),
        h(
          "span",
          { class: "z-input z-input--search z-log-console__find", "data-size": "md" },
          h("span", { class: "z-input__icon" }, icon("magnifying-glass", 16)),
          h("input", {
            class: "z-input__control z-log-console__search",
            type: "search",
            "aria-label": labels.search,
            placeholder: labels.search,
            "aria-controls": `${uid}-grid`,
            value: s.query,
          }),
        ),
        h(
          "span",
          { class: "z-log-console__actions" },
          h(
            "button",
            {
              type: "button",
              class: "z-btn z-btn--ghost z-log-console__follow",
              "data-size": "sm",
              "aria-pressed": s.follow ? "true" : "false",
            },
            icon("arrow-down", 14),
            labels.follow,
          ),
          ...copyControl("z-log-console__copy", labels, s.copied),
          c.downloadName
            ? h(
                "button",
                {
                  type: "button",
                  class: "z-btn z-btn--ghost z-btn--icon z-log-console__download",
                  "data-size": "sm",
                  "aria-label": labels.download,
                  title: labels.download,
                },
                icon("arrow-down-tray", 14),
              )
            : null,
          c.clearable
            ? h(
                "button",
                {
                  type: "button",
                  class: "z-btn z-btn--ghost z-btn--icon z-log-console__clear",
                  "data-size": "sm",
                  "aria-label": labels.clear,
                  title: labels.clear,
                },
                icon("trash", 14),
              )
            : null,
        ),
      ),
      h(
        "div",
        {
          class: "z-log-console__grid",
          id: `${uid}-grid`,
          role: "grid",
          "aria-label": c.title || labels.console,
          "aria-rowcount": total + 1,
          "aria-colcount": COLUMNS.length,
          "aria-readonly": "true",
        },
        // La cabecera queda fuera de lo que se desplaza: no tapa ninguna fila.
        h(
          "div",
          { class: "z-log-console__headgroup", role: "rowgroup" },
          h(
            "div",
            { class: "z-log-console__row z-log-console__head", role: "row", "aria-rowindex": 1 },
            ...COLUMNS.map((col) => h("div", { class: "z-log-console__cell", role: "columnheader", "data-column": col }, labels[col])),
          ),
        ),
        h(
          "div",
          { class: "z-log-console__viewport", "data-virtual": on(virtual) },
          h("div", { class: "z-log-console__body", role: "rowgroup", s: { "--z-log-total": total } }, ...rows),
        ),
      ),
      total ? null : h("p", { class: "z-log-console__empty" }, labels.empty),
      h("span", { class: "z-sr-only z-log-console__live", role: "status", "data-live": "" }),
    );
  },
  attach,
  after(root, host, focus) {
    const state = live.get(root);
    const vp = root.querySelector<HTMLElement>(".z-log-console__viewport");
    if (vp && host.state().follow) {
      const end = vp.scrollHeight - vp.clientHeight;
      if (Math.abs(vp.scrollTop - end) > 1) {
        vp.dataset.programmatic = "1";
        vp.scrollTop = end;
      }
    }
    if (focus && state?.focusCell) {
      state.focusCell = false;
      const cell = root.querySelector<HTMLElement>('.z-log-console__cell[tabindex="0"]');
      cell?.focus({ preventScroll: true });
    }
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      entries: (json.entries as LogEntry[] | undefined) ?? [],
      levels: d.levels ? (list(d.levels) as LogLevel[]) : undefined,
      defaultLevels: d.defaultLevels ? (list(d.defaultLevels) as LogLevel[]) : undefined,
      follow: d.follow === undefined ? undefined : yes(d.follow),
      wrap: yes(d.wrap),
      timeZone: d.timeZone,
      downloadName: d.downloadName,
      clearable: yes(d.clearable),
      title: d.title,
      locale: d.locale,
      labels: json.labels as Partial<LogConsoleLabels> | undefined,
    };
  },
};
