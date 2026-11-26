// ChatSearch (core/widget): buscar en una conversación. Barra con el campo, el contador («2 of 7»), anterior y
// siguiente (Intro y Mayús + Intro desde el campo) y cerrar (Escape). Busca en el texto de los mensajes de `target`
// (`.z-message__text` por defecto) y resalta con la CSS Custom Highlight API: sin tocar el marcado de la lista, que
// sigue siendo de quien la pinta (React o el modo DOM). Sin la API, marca el mensaje con `data-search-hit` y el actual
// con `data-search-current`. Si la lista cambia (mensajes nuevos), vuelve a buscar.
import { findMatches, countText, nearestMatch, stepMatch, type TextMatch } from "./chat-search";
import { reducedMotion } from "./presence";
import { h, icon } from "./vnode";
import { announceIn, yes, type Widget, type WidgetHost } from "./widget";

export interface ChatSearchLabels {
  search: string;
  placeholder: string;
  /** «{current} of {total}». */
  count: string;
  none: string;
  previous: string;
  next: string;
  close: string;
}

export const CHAT_SEARCH_LABELS: ChatSearchLabels = {
  search: "Search in conversation",
  placeholder: "Search messages",
  count: "{current} of {total}",
  none: "No results",
  previous: "Previous result",
  next: "Next result",
  close: "Close search",
};

export interface ChatSearchProps {
  /** Id del contenedor de los mensajes (una MessageList). */
  target?: string;
  /** Elementos con el texto de cada mensaje dentro de `target`. */
  selector?: string;
  defaultQuery?: string;
  /** Distingue mayúsculas. */
  matchCase?: boolean;
  /** Botón de cerrar (true). */
  closable?: boolean;
  labels?: Partial<ChatSearchLabels>;
}

interface Config {
  target?: string;
  selector: string;
  defaultQuery: string;
  matchCase: boolean;
  closable: boolean;
  labels: ChatSearchLabels;
}

interface State {
  query: string;
  current: number;
  total: number;
}

const HL = "z-search";
const HL_CURRENT = "z-search-current";

interface HighlightRegistry {
  set(name: string, value: unknown): void;
  delete(name: string): void;
}
type HighlightCtor = new (...ranges: Range[]) => unknown;

function highlightApi(view: Window | null): { registry: HighlightRegistry; Highlight: HighlightCtor } | null {
  const css = (view as (Window & { CSS?: { highlights?: HighlightRegistry } }) | null)?.CSS;
  const Highlight = (view as (Window & { Highlight?: HighlightCtor }) | null)?.Highlight;
  return css?.highlights && Highlight ? { registry: css.highlights, Highlight } : null;
}

/** Rango de un trozo de texto (`start`–`end` sobre `textContent`) dentro de `el`. */
function rangeIn(el: Element, start: number, end: number): Range | null {
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  const range = doc.createRange();
  let at = 0;
  let started = false;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const len = node.data.length;
    if (!started && start <= at + len) {
      range.setStart(node, Math.max(0, start - at));
      started = true;
    }
    if (started && end <= at + len) {
      range.setEnd(node, Math.max(0, end - at));
      return range;
    }
    at += len;
  }
  return null;
}

interface Run {
  matches: TextMatch[];
  elements: HTMLElement[];
}
const runs = new WeakMap<HTMLElement, Run>();

function clearMarks(doc: Document, run: Run | undefined): void {
  const api = highlightApi(doc.defaultView);
  api?.registry.delete(HL);
  api?.registry.delete(HL_CURRENT);
  for (const el of run?.elements ?? []) {
    el.removeAttribute("data-search-hit");
    el.removeAttribute("data-search-current");
  }
}

/** Busca, resalta y lleva a la vista la coincidencia actual. Devuelve la búsqueda hecha. */
function paint(root: HTMLElement, host: WidgetHost<Config, State>, scroll: boolean): void {
  const doc = root.ownerDocument;
  const c = host.config();
  const s = host.state();
  const container = c.target ? doc.getElementById(c.target) : null;
  const elements = container ? [...container.querySelectorAll<HTMLElement>(c.selector)] : [];
  const previous = runs.get(root);
  clearMarks(doc, previous);
  const matches = findMatches(
    elements.map((el) => el.textContent ?? ""),
    s.query,
    { matchCase: c.matchCase },
  );
  runs.set(root, { matches, elements });
  const current = matches.length ? Math.min(Math.max(0, s.current), matches.length - 1) : -1;
  const api = highlightApi(doc.defaultView);
  const ranges = matches.map((m) => rangeIn(elements[m.index]!, m.start, m.end));
  if (api) {
    const rest = ranges.filter((r, i): r is Range => r !== null && i !== current);
    if (rest.length) api.registry.set(HL, new api.Highlight(...rest));
    const now = current >= 0 ? ranges[current] : null;
    if (now) api.registry.set(HL_CURRENT, new api.Highlight(now));
  } else {
    for (const m of matches) elements[m.index]?.setAttribute("data-search-hit", "");
  }
  const hit = current >= 0 ? elements[matches[current]!.index] : null;
  if (hit && !api) hit.setAttribute("data-search-current", "");
  if (current !== s.current || matches.length !== s.total) host.update({ current, total: matches.length });
  if (scroll && hit) {
    (hit.closest(".z-message") ?? hit).scrollIntoView?.({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    host.emit("match-change", { index: current, total: matches.length, message: matches[current]!.index });
  }
}

export const chatSearchWidget: Widget<ChatSearchProps, Config, State> = {
  root: "z-chat-search",
  configure: (p) => ({
    target: p.target,
    selector: p.selector || ".z-message__text",
    defaultQuery: p.defaultQuery ?? "",
    matchCase: Boolean(p.matchCase),
    closable: p.closable !== false,
    labels: { ...CHAT_SEARCH_LABELS, ...p.labels },
  }),
  initial: (c) => ({ query: c.defaultQuery, current: 0, total: 0 }),
  tree(c, s, uid) {
    const has = s.total > 0;
    const count = s.query.trim() ? countText(s.current, s.total, c.labels.count, c.labels.none) : "";
    return h(
      "div",
      { class: "z-chat-search", role: "search", "aria-label": c.labels.search, "data-empty": s.query.trim() && !has ? "" : undefined },
      h(
        "span",
        { class: "z-input z-input--search z-chat-search__field", "data-size": "sm", key: "field" },
        h("span", { class: "z-input__icon" }, icon("magnifying-glass", 14)),
        h("input", {
          class: "z-input__control z-chat-search__input",
          type: "search",
          "aria-label": c.labels.search,
          placeholder: c.labels.placeholder,
          autocomplete: "off",
          enterkeyhint: "search",
          value: s.query,
          "aria-describedby": `${uid}-count`,
        }),
      ),
      h("span", { class: "z-chat-search__count", id: `${uid}-count`, key: "count" }, count),
      h(
        "button",
        {
          type: "button",
          class: "z-btn z-btn--ghost z-btn--icon z-chat-search__prev",
          "data-size": "sm",
          "aria-label": c.labels.previous,
          title: c.labels.previous,
          disabled: !has || undefined,
          key: "prev",
        },
        icon("chevron-up", 16),
      ),
      h(
        "button",
        {
          type: "button",
          class: "z-btn z-btn--ghost z-btn--icon z-chat-search__next",
          "data-size": "sm",
          "aria-label": c.labels.next,
          title: c.labels.next,
          disabled: !has || undefined,
          key: "next",
        },
        icon("chevron-down", 16),
      ),
      c.closable
        ? h(
            "button",
            {
              type: "button",
              class: "z-btn z-btn--ghost z-btn--icon z-chat-search__close",
              "data-size": "sm",
              "aria-label": c.labels.close,
              title: c.labels.close,
              key: "close",
            },
            icon("x-mark", 16),
          )
        : null,
      h("span", { class: "z-sr-only", "data-live": "", "aria-live": "polite", key: "live" }),
    );
  },
  attach(root, host) {
    const doc = root.ownerDocument;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const say = () => {
      const s = host.state();
      if (s.query.trim()) announceIn(root, countText(s.current, s.total, host.config().labels.count, host.config().labels.none));
    };
    const go = (delta: 1 | -1) => {
      const s = host.state();
      const next = stepMatch(s.current, s.total, delta);
      if (next < 0) return;
      host.update({ current: next });
      paint(root, host, true);
      say();
    };
    const onInput = (event: Event) => {
      const input = event.target as HTMLInputElement;
      if (!input.classList?.contains("z-chat-search__input")) return;
      const query = input.value;
      const run = runs.get(root);
      // La que se veía sigue siendo la referencia: se busca a partir de su mensaje.
      const from = run?.matches[host.state().current]?.index ?? 0;
      host.update({ query, current: 0 });
      clearTimeout(timer);
      timer = setTimeout(() => {
        const matches = findMatches(
          (run?.elements ?? []).map((el) => el.textContent ?? ""),
          query,
          { matchCase: host.config().matchCase },
        );
        host.update({ current: Math.max(0, nearestMatch(matches, from)) });
        paint(root, host, true);
        say();
        host.emit("query-change", { query });
      }, 120);
    };
    const onKey = (event: KeyboardEvent) => {
      if (!(event.target as Element).classList?.contains("z-chat-search__input")) return;
      if (event.key === "Enter") {
        event.preventDefault();
        go(event.shiftKey ? -1 : 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (host.config().closable) host.emit("close", {});
      }
    };
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element).closest?.("button");
      if (!button || !root.contains(button)) return;
      if (button.classList.contains("z-chat-search__prev")) go(-1);
      else if (button.classList.contains("z-chat-search__next")) go(1);
      else if (button.classList.contains("z-chat-search__close")) host.emit("close", {});
    };
    root.addEventListener("input", onInput);
    root.addEventListener("keydown", onKey);
    root.addEventListener("click", onClick);
    // Mensajes nuevos o editados: se vuelve a buscar sin mover la vista.
    let observed: Element | null = null;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const Observer = doc.defaultView?.MutationObserver;
    const mutations = Observer
      ? new Observer((records) => {
          if (records.every((r) => root.contains(r.target))) return;
          clearTimeout(pending);
          pending = setTimeout(() => paint(root, host, false), 150);
        })
      : null;
    const watch = () => {
      const target = host.config().target ? doc.getElementById(host.config().target!) : null;
      if (target === observed) return;
      mutations?.disconnect();
      observed = target;
      if (target) mutations?.observe(target, { childList: true, subtree: true, characterData: true });
    };
    watchers.set(root, watch);
    queueMicrotask(() => {
      watch();
      paint(root, host, Boolean(host.state().query.trim()));
    });
    return () => {
      clearTimeout(timer);
      clearTimeout(pending);
      mutations?.disconnect();
      watchers.delete(root);
      clearMarks(doc, runs.get(root));
      runs.delete(root);
      root.removeEventListener("input", onInput);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("click", onClick);
    };
  },
  after(root) {
    watchers.get(root)?.();
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      target: d.target,
      selector: d.selector,
      defaultQuery: d.query,
      matchCase: yes(d.matchCase),
      closable: d.closable === "false" ? false : undefined,
      labels: json.labels as Partial<ChatSearchLabels> | undefined,
    };
  },
};

const watchers = new WeakMap<HTMLElement, () => void>();

/** Lleva el foco al campo de búsqueda (al abrir la barra). */
export function focusChatSearch(root: HTMLElement): void {
  root.querySelector<HTMLInputElement>(".z-chat-search__input")?.focus();
}
