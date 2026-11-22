// Selector de emojis como pieza (core/widget): buscador que hace de combobox sobre una rejilla `listbox` por categorías
// (el foco se queda en el campo y la opción activa va por `aria-activedescendant`), pestañas de categoría, recientes,
// tono de piel y la vista de la opción activa con su nombre. ↑/↓ por filas, ←/→ por opciones con el campo vacío,
// Intro elige y Escape cierra. El conjunto es el propio de la suite (core/emoji-data) o el que pase la aplicación, ya
// cargado o como promesa que se resuelve al abrir. Lo usan EmojiPicker y la caja de texto del chat.

import { EMOJI_SET, pushRecent, searchEmoji, SKIN_TONES, withTone, type Emoji, type EmojiSet } from "./emoji-data";
import { isRtl, logicalKey } from "./dir";
import { h, icon, type VEl } from "./vnode";
import type { Widget, WidgetHost } from "./widget";

export interface EmojiPickerLabels {
  picker: string;
  search: string;
  emojis: string;
  recent: string;
  tone: string;
  /** Nombres de los tonos: sin tono, claro, medio claro, medio, medio oscuro, oscuro. */
  tones: readonly string[];
  empty: string;
  loading: string;
  /** Nombres de las categorías por id (por defecto, los del conjunto). */
  categories?: Readonly<Record<string, string>>;
}

export const EMOJI_PICKER_LABELS: EmojiPickerLabels = {
  picker: "Emoji picker",
  search: "Search emoji",
  emojis: "Emojis",
  recent: "Recently used",
  tone: "Skin tone",
  tones: ["Default", "Light", "Medium-light", "Medium", "Medium-dark", "Dark"],
  empty: "No emoji found",
  loading: "Loading emoji…",
};

export interface EmojiPickerProps {
  /** Conjunto propio, o una función que lo carga a demanda. Por defecto, el de la suite. */
  data?: EmojiSet | (() => Promise<EmojiSet>);
  /** Recientes iniciales (los elegidos se añaden delante). */
  recent?: readonly string[];
  /** Tono inicial (índice en SKIN_TONES, 0 = sin tono). */
  defaultTone?: number;
  /** Columnas de la rejilla (8). */
  columns?: number;
  labels?: Partial<EmojiPickerLabels>;
}

export interface EmojiPickerConfig {
  data?: EmojiPickerProps["data"];
  recent: readonly string[];
  tone: number;
  columns: number;
  labels: EmojiPickerLabels;
}

export interface EmojiPickerState {
  set: EmojiSet | null;
  query: string;
  active: number;
  tone: number;
  recent: readonly string[];
  loading: boolean;
}

export const emojiPickerConfig = (p: EmojiPickerProps): EmojiPickerConfig => ({
  data: p.data,
  recent: p.recent ?? [],
  tone: Math.max(0, Math.min(5, Math.floor(p.defaultTone ?? 0))),
  columns: Math.max(4, Math.min(12, Math.floor(p.columns ?? 8))),
  labels: { ...EMOJI_PICKER_LABELS, ...p.labels },
});

export const emojiPickerInitial = (c: EmojiPickerConfig): EmojiPickerState => ({
  set: typeof c.data === "function" ? null : (c.data ?? EMOJI_SET),
  query: "",
  active: 0,
  tone: c.tone,
  recent: c.recent,
  loading: false,
});

interface Section {
  id: string;
  label: string;
  icon: string;
  emojis: Emoji[];
}

/** Lo que se ve: el resultado de la búsqueda, o recientes y categorías. */
export function pickerSections(c: EmojiPickerConfig, s: EmojiPickerState): Section[] {
  const set = s.set ?? [];
  if (s.query.trim()) return [{ id: "results", label: c.labels.emojis, icon: "magnifying-glass", emojis: searchEmoji(set, s.query) }];
  const all = set.flatMap((cat) => cat.emojis);
  const recent = s.recent
    .map((char) => all.find((e) => e.char === char || withTone(e, SKIN_TONES[s.tone] ?? "") === char) ?? { char, name: char, keywords: [] })
    .slice(0, c.columns * 2);
  const sections = set.map((cat) => ({
    id: cat.id,
    label: c.labels.categories?.[cat.id] ?? cat.label,
    icon: cat.icon,
    emojis: [...cat.emojis],
  }));
  return recent.length ? [{ id: "recent", label: c.labels.recent, icon: "clock", emojis: recent }, ...sections] : sections;
}

const flat = (sections: readonly Section[]) => sections.flatMap((sec) => sec.emojis);
const optionId = (uid: string, i: number) => `${uid}-emoji-${i}`;

/** Árbol del selector (dentro de `div.z-emoji-picker`). */
export function emojiPickerTree(c: EmojiPickerConfig, s: EmojiPickerState, uid: string): VEl {
  const { labels } = c;
  const sections = pickerSections(c, s);
  const all = flat(sections);
  const active = all[Math.min(s.active, all.length - 1)];
  const tone = SKIN_TONES[s.tone] ?? "";
  let index = 0;
  return h(
    "div",
    {
      class: "z-emoji-picker",
      role: "group",
      "aria-label": labels.picker,
      "data-columns": c.columns,
      s: { "--z-emoji-columns": c.columns },
    },
    h(
      "div",
      { class: "z-emoji-picker__search" },
      h(
        "span",
        { class: "z-input z-input--search", "data-size": "sm" },
        h("span", { class: "z-input__icon" }, icon("magnifying-glass", 14)),
        h("input", {
          class: "z-input__control z-emoji-picker__field",
          type: "search",
          role: "combobox",
          "aria-label": labels.search,
          placeholder: labels.search,
          autocomplete: "off",
          "aria-expanded": "true",
          "aria-autocomplete": "list",
          "aria-controls": `${uid}-emoji-grid`,
          "aria-activedescendant": active ? optionId(uid, Math.min(s.active, all.length - 1)) : undefined,
        }),
      ),
    ),
    s.query.trim()
      ? null
      : h(
          "div",
          { class: "z-emoji-picker__tabs", role: "group", "aria-label": labels.emojis },
          ...sections.map((sec) =>
            h(
              "button",
              {
                type: "button",
                class: "z-emoji-picker__tab",
                key: sec.id,
                "data-section": sec.id,
                "aria-label": sec.label,
                title: sec.label,
                tabindex: -1,
              },
              icon(sec.icon, 16),
            ),
          ),
        ),
    h(
      "div",
      {
        class: "z-emoji-picker__grid",
        id: `${uid}-emoji-grid`,
        role: "listbox",
        "aria-label": labels.emojis,
        "aria-busy": s.loading ? "true" : undefined,
      },
      ...(s.set === null
        ? [h("p", { class: "z-emoji-picker__empty", key: "loading" }, labels.loading)]
        : all.length === 0
          ? [h("p", { class: "z-emoji-picker__empty", key: "empty", role: "status" }, labels.empty)]
          : sections.map((sec) =>
              h(
                "div",
                {
                  class: "z-emoji-picker__section",
                  key: sec.id,
                  role: "group",
                  "aria-labelledby": `${uid}-emoji-h-${sec.id}`,
                  "data-section": sec.id,
                },
                h("div", { class: "z-emoji-picker__heading", id: `${uid}-emoji-h-${sec.id}` }, sec.label),
                h(
                  "div",
                  { class: "z-emoji-picker__options" },
                  ...sec.emojis.map((e) => {
                    const i = index++;
                    const char = sec.id === "recent" ? e.char : withTone(e, tone);
                    return h(
                      "span",
                      {
                        class: "z-emoji-picker__option",
                        key: `${sec.id}-${e.char}`,
                        id: optionId(uid, i),
                        role: "option",
                        "aria-selected": i === s.active ? "true" : "false",
                        "aria-label": e.name,
                        "data-char": char,
                        "data-index": i,
                      },
                      char,
                    );
                  }),
                ),
              ),
            )),
    ),
    h(
      "div",
      { class: "z-emoji-picker__footer" },
      h(
        "span",
        { class: "z-emoji-picker__preview", "aria-hidden": "true" },
        active ? h("span", { class: "z-emoji-picker__preview-char" }, withTone(active, tone)) : null,
        active ? h("span", { class: "z-emoji-picker__preview-name" }, active.name) : null,
      ),
      h(
        "span",
        { class: "z-emoji-picker__tones", role: "radiogroup", "aria-label": labels.tone },
        ...SKIN_TONES.map((_tone, i) =>
          h("button", {
            type: "button",
            role: "radio",
            class: "z-emoji-picker__tone",
            key: String(i),
            "data-tone": i,
            "aria-checked": s.tone === i ? "true" : "false",
            "aria-label": labels.tones[i] ?? String(i),
            title: labels.tones[i] ?? String(i),
            tabindex: s.tone === i ? 0 : -1,
          }),
        ),
      ),
    ),
  );
}

export type PickerHost = WidgetHost<EmojiPickerConfig, EmojiPickerState>;

/** Carga el conjunto si llegó como función (una vez). */
export function ensureEmojiSet(c: EmojiPickerConfig, s: EmojiPickerState, update: (patch: Partial<EmojiPickerState>) => void): void {
  if (s.set || s.loading || typeof c.data !== "function") return;
  update({ loading: true });
  c.data()
    .then((set) => update({ set, loading: false }))
    .catch(() => update({ set: EMOJI_SET, loading: false }));
}

/**
 * Teclado del selector desde su campo. Devuelve el emoji elegido (Intro), `"close"` (Escape) o `null`. `get`/`set`
 * leen y cambian el estado del selector (que puede vivir dentro de otra pieza).
 */
export function emojiPickerKey(
  event: KeyboardEvent,
  c: EmojiPickerConfig,
  s: EmojiPickerState,
  set: (patch: Partial<EmojiPickerState>) => void,
): string | "close" | null {
  const all = flat(pickerSections(c, s));
  if (event.key === "Escape") {
    event.preventDefault();
    return "close";
  }
  if (!all.length) return null;
  const empty = !(event.target as HTMLInputElement).value;
  const rtl = isRtl(event.target as Element);
  const columns = measuredColumns((event.target as Element).closest?.(".z-emoji-picker"), c.columns);
  const step =
    event.key === "ArrowDown"
      ? columns
      : event.key === "ArrowUp"
        ? -columns
        : empty && event.key === (rtl ? "ArrowLeft" : "ArrowRight")
          ? 1
          : empty && event.key === (rtl ? "ArrowRight" : "ArrowLeft")
            ? -1
            : 0;
  if (step) {
    event.preventDefault();
    set({ active: Math.max(0, Math.min(all.length - 1, s.active + step)) });
    return null;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const e = all[Math.min(s.active, all.length - 1)];
    if (!e) return null;
    const char = s.query.trim() || !s.recent.includes(e.char) ? withTone(e, SKIN_TONES[s.tone] ?? "") : e.char;
    set({ recent: pushRecent(s.recent, char) });
    return char;
  }
  return null;
}

/** Clic en el selector: opción (devuelve su emoji), pestaña (desplaza a la categoría) o tono. */
export function emojiPickerClick(
  target: Element,
  picker: Element,
  s: EmojiPickerState,
  set: (patch: Partial<EmojiPickerState>) => void,
): string | null {
  const option = target.closest<HTMLElement>(".z-emoji-picker__option");
  if (option && picker.contains(option)) {
    const char = option.dataset.char ?? "";
    set({ active: Number(option.dataset.index ?? 0), recent: pushRecent(s.recent, char) });
    return char;
  }
  const tab = target.closest<HTMLElement>(".z-emoji-picker__tab");
  if (tab && picker.contains(tab)) {
    const section = picker.querySelector<HTMLElement>(`.z-emoji-picker__section[data-section="${tab.dataset.section}"]`);
    const grid = picker.querySelector<HTMLElement>(".z-emoji-picker__grid");
    if (section && grid) grid.scrollTop = section.offsetTop - grid.offsetTop;
    const first = section?.querySelector<HTMLElement>(".z-emoji-picker__option");
    if (first) set({ active: Number(first.dataset.index ?? 0) });
    picker.querySelector<HTMLInputElement>(".z-emoji-picker__field")?.focus();
    return null;
  }
  const tone = target.closest<HTMLElement>(".z-emoji-picker__tone");
  if (tone && picker.contains(tone)) set({ tone: Number(tone.dataset.tone ?? 0) });
  return null;
}

/** Columnas que pinta la rejilla (con puntero grueso dependen del ancho), o `fallback` sin documento. */
function measuredColumns(picker: Element | null | undefined, fallback: number): number {
  const options = picker?.querySelector(".z-emoji-picker__options")?.children;
  if (!options?.length) return fallback;
  const top = (options[0] as HTMLElement).offsetTop;
  let n = 0;
  for (const o of options) if ((o as HTMLElement).offsetTop === top) n++;
  return n > 0 ? n : fallback;
}

/** ←/→ entre los tonos (radios de una parada): elige y lleva el foco. Devuelve si atendió la tecla. */
export function emojiToneKey(event: KeyboardEvent, picker: Element, set: (patch: Partial<EmojiPickerState>) => void): boolean {
  const target = event.target as HTMLElement;
  if (!target.matches?.(".z-emoji-picker__tone")) return false;
  const tones = [...picker.querySelectorAll<HTMLElement>(".z-emoji-picker__tone")];
  const i = tones.indexOf(target);
  const key = logicalKey(event.key, target);
  const delta = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  if (!delta || i < 0) return false;
  event.preventDefault();
  const next = (i + delta + tones.length) % tones.length;
  set({ tone: next });
  requestAnimationFrame(() => picker.querySelectorAll<HTMLElement>(".z-emoji-picker__tone")[next]?.focus());
  return true;
}

/** Tras pintar: la opción activa a la vista dentro de la rejilla. */
export function emojiPickerAfter(picker: Element | null): void {
  const grid = picker?.querySelector<HTMLElement>(".z-emoji-picker__grid");
  const active = grid?.querySelector<HTMLElement>('.z-emoji-picker__option[aria-selected="true"]');
  if (!grid || !active) return;
  const top = active.offsetTop - grid.offsetTop;
  if (top < grid.scrollTop) grid.scrollTop = top - 28;
  else if (top + active.offsetHeight > grid.scrollTop + grid.clientHeight)
    grid.scrollTop = top + active.offsetHeight - grid.clientHeight + 4;
}

function attach(root: HTMLElement, host: PickerHost): () => void {
  const set = (patch: Partial<EmojiPickerState>) => host.update(patch);
  ensureEmojiSet(host.config(), host.state(), set);
  const onInput = (event: Event) => {
    const field = event.target as HTMLInputElement;
    if (!field.matches?.(".z-emoji-picker__field")) return;
    host.update({ query: field.value, active: 0 });
  };
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (emojiToneKey(event, root, set)) return;
    if (!target.matches?.(".z-emoji-picker__field")) return;
    const result = emojiPickerKey(event, host.config(), host.state(), set);
    if (result === "close") host.emit("close", {});
    else if (result) host.emit("select", { emoji: result });
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target) return;
    const result = emojiPickerClick(target, root, host.state(), set);
    if (result) host.emit("select", { emoji: result });
  };
  root.addEventListener("input", onInput);
  root.addEventListener("keydown", onKey);
  root.addEventListener("click", onClick);
  return () => {
    root.removeEventListener("input", onInput);
    root.removeEventListener("keydown", onKey);
    root.removeEventListener("click", onClick);
  };
}

export const emojiPickerWidget: Widget<EmojiPickerProps, EmojiPickerConfig, EmojiPickerState> = {
  root: "z-emoji-picker",
  configure: emojiPickerConfig,
  initial: emojiPickerInitial,
  tree: emojiPickerTree,
  attach,
  after: (root) => emojiPickerAfter(root),
  fromDom(el, json) {
    const d = el.dataset;
    return {
      data: json.data as EmojiSet | undefined,
      recent: json.recent as string[] | undefined,
      defaultTone: d.defaultTone ? Number(d.defaultTone) : undefined,
      columns: d.columns ? Number(d.columns) : undefined,
      labels: json.labels as Partial<EmojiPickerLabels> | undefined,
    };
  },
};
