// Lista de conversaciones como pieza (core/widget): avatar con presencia, nombre, último mensaje (o quién escribe, o el
// borrador), hora corta, no leídos (y si te mencionan), silenciado, fijado y la entrega de tu último mensaje. Búsqueda
// sin acentos ni mayúsculas, filtros (todas, no leídas, grupos), fijadas arriba y el resto por actividad. Una parada de
// Tab: ↑/↓, Inicio/Fin; Intro o pulsar abre la conversación (`select`).

import { announce } from "./announcer";
import { logicalKey } from "./dir";
import { dayKey, dayLabel, timeLabel, type DeliveryState } from "./chat-group";
import { avatarNode, deliveryNode } from "./chat-tree";
import { DELIVERY_LABELS, type DeliveryLabels } from "./delivery";
import { toInstant } from "./relative";
import { fold } from "./search";
import { virtualizeAttr, wantsVirtual } from "./virtual";
import {
  followVirtual,
  measureInto,
  scrollToRow,
  spacerNode,
  unfollowVirtual,
  widgetList,
  windowChanges,
  type ViewportState,
  type WidgetListInput,
} from "./virtual-widget";
import { fill, h, icon, on } from "./vnode";
import type { Widget, WidgetHost } from "./widget";

export interface ConversationItem {
  id: string;
  title: string;
  avatar?: string;
  presence?: "online" | "away" | "busy" | "offline";
  /** Último mensaje como texto plano. */
  lastMessage?: string;
  /** Quién lo escribió en un grupo («Ana»); el tuyo lleva «You». */
  lastAuthor?: string;
  /** El último mensaje es tuyo: muestra su entrega. */
  lastMine?: boolean;
  lastAt?: number | string;
  status?: DeliveryState;
  unread?: number;
  /** Te mencionan entre los no leídos. */
  mention?: boolean;
  muted?: boolean;
  pinned?: boolean;
  /** Borrador sin enviar. */
  draft?: string;
  /** Quién escribe ahora (nombres). Con uno en un chat individual: «typing…». */
  typing?: readonly string[];
  group?: boolean;
}

export interface ConversationListLabels extends DeliveryLabels {
  list: string;
  search: string;
  all: string;
  unreadFilter: string;
  groups: string;
  filters: string;
  /** «{n} unread messages». */
  unread: string;
  mentioned: string;
  muted: string;
  pinned: string;
  draft: string;
  you: string;
  typing: string;
  /** «{name} is typing…» en un grupo. */
  typingName: string;
  empty: string;
  /** «{n} chats» (al buscar). */
  results: string;
  today: string;
  yesterday: string;
  /** Presencia en el nombre del avatar. */
  online: string;
  away: string;
  busy: string;
  offline: string;
}

export const CONVERSATION_LIST_LABELS: ConversationListLabels = {
  ...DELIVERY_LABELS,
  list: "Chats",
  search: "Search chats",
  all: "All",
  unreadFilter: "Unread",
  groups: "Groups",
  filters: "Filter chats",
  unread: "{n} unread messages",
  mentioned: "You were mentioned",
  muted: "Muted",
  pinned: "Pinned",
  draft: "Draft",
  you: "You",
  typing: "typing…",
  typingName: "{name} is typing…",
  empty: "No chats found",
  results: "{n} chats",
  today: "Today",
  yesterday: "Yesterday",
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};

export type ConversationFilter = "all" | "unread" | "groups";

export interface ConversationListProps {
  items?: readonly ConversationItem[];
  /** Conversación abierta (controlada). */
  selectedId?: string;
  defaultSelectedId?: string;
  /** Campo de búsqueda (por defecto sí). */
  search?: boolean;
  /** Filtros que se ofrecen; `false` sin filtros. */
  filters?: readonly ConversationFilter[] | false;
  /** Fijadas arriba y el resto por actividad (por defecto sí); `false` respeta el orden dado. */
  sort?: boolean;
  locale?: string;
  timeZone?: string;
  hourCycle?: "h12" | "h23";
  now?: number;
  labels?: Partial<ConversationListLabels>;
  /**
   * Ventana virtual: solo se pintan las conversaciones que se ven. `true` siempre, `false` nunca, un número es el umbral.
   * Por defecto, a partir de 150. Con ella, Ctrl+F del navegador solo encuentra lo pintado: usa la búsqueda de la lista.
   */
  virtualize?: boolean | number;
}

interface Config {
  items: readonly ConversationItem[];
  selected?: string;
  defaultSelected?: string;
  search: boolean;
  filters: readonly ConversationFilter[];
  sort: boolean;
  locale?: string;
  timeZone?: string;
  hourCycle?: "h12" | "h23";
  now?: number;
  labels: ConversationListLabels;
  virtualize?: boolean | number;
}

interface State {
  selected: string | null;
  active: string | null;
  query: string;
  filter: ConversationFilter;
  /** Ventana virtual: desplazamiento y alto de la lista, y los altos medidos. */
  view: ViewportState | null;
  heights: Map<string, number>;
}

const ROW_ESTIMATE = 68;
const VIRTUAL_FROM = 150;

/** Entrada de la ventana virtual con lo visible y la parada de Tab fijada. */
function listInput(c: Config, s: State, list: readonly ConversationItem[]): WidgetListInput {
  const stop = list.findIndex((it) => it.id === s.active);
  return {
    virtual: wantsVirtual(c.virtualize, list.length, VIRTUAL_FROM),
    count: list.length,
    keyOf: (i) => list[i]!.id,
    estimate: ROW_ESTIMATE,
    heights: s.heights,
    view: s.view,
    keep: stop >= 0 ? [stop] : [],
  };
}

type Host = WidgetHost<Config, State>;

/** Hora corta de la lista: la hora hoy, «Yesterday», el día de la semana esta semana y la fecha corta antes. */
export function listTime(
  at: number,
  now: number,
  labels: { today: string; yesterday: string },
  o: { timeZone?: string; locale?: string; hourCycle?: "h12" | "h23" } = {},
): string {
  const tz = o.timeZone ?? "";
  const day = dayKey(at, tz);
  const today = dayKey(now, tz);
  if (day === today) return timeLabel(at, o.timeZone, o.locale, o.hourCycle);
  const label = dayLabel(day, today, labels, o.locale);
  if (label === labels.yesterday) return label;
  const diff = (now - at) / 86400000;
  try {
    if (diff < 7) return new Intl.DateTimeFormat(o.locale, { weekday: "short", timeZone: o.timeZone }).format(at);
    return new Intl.DateTimeFormat(o.locale, { day: "numeric", month: "short", timeZone: o.timeZone }).format(at);
  } catch {
    return label;
  }
}

/** Conversaciones visibles: filtro, búsqueda (título, último mensaje) y orden (fijadas, luego por actividad). */
export function visibleConversations(
  items: readonly ConversationItem[],
  query: string,
  filter: ConversationFilter,
  sort = true,
): ConversationItem[] {
  const q = fold(query.trim());
  let list = items.filter((it) => (filter === "unread" ? (it.unread ?? 0) > 0 : filter === "groups" ? Boolean(it.group) : true));
  if (q) list = list.filter((it) => fold(it.title).includes(q) || fold(it.lastMessage ?? "").includes(q));
  if (!sort) return list;
  return list
    .map((it, i) => ({ it, i, at: toInstant(it.lastAt ?? null) ?? 0 }))
    .sort((a, b) => Number(Boolean(b.it.pinned)) - Number(Boolean(a.it.pinned)) || b.at - a.at || a.i - b.i)
    .map((x) => x.it);
}

function attach(root: HTMLElement, host: Host): () => void {
  const items = () => [...root.querySelectorAll<HTMLElement>(".z-conversation")];
  const select = (id: string) => {
    if (host.config().selected === undefined) host.update({ selected: id, active: id });
    else host.update({ active: id });
    host.emit("select", { id });
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const filter = target?.closest<HTMLElement>(".z-conversation-list__filter");
    if (filter && root.contains(filter)) {
      host.update({ filter: (filter.dataset.filter as ConversationFilter) ?? "all" });
      host.emit("filter-change", { filter: filter.dataset.filter });
      return;
    }
    const row = target?.closest<HTMLElement>(".z-conversation");
    if (row && root.contains(row) && row.dataset.id) select(row.dataset.id);
  };
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.matches?.(".z-conversation-list__filter")) {
      const filters = [...root.querySelectorAll<HTMLElement>(".z-conversation-list__filter")];
      const key = logicalKey(event.key, target);
      const i = filters.indexOf(target);
      const to =
        key === "ArrowRight" || key === "ArrowDown"
          ? filters[(i + 1) % filters.length]
          : key === "ArrowLeft" || key === "ArrowUp"
            ? filters[(i - 1 + filters.length) % filters.length]
            : undefined;
      if (to) {
        event.preventDefault();
        host.update({ filter: (to.dataset.filter as ConversationFilter) ?? "all" });
        host.emit("filter-change", { filter: to.dataset.filter });
        requestAnimationFrame(() =>
          root.querySelector<HTMLElement>(`.z-conversation-list__filter[data-filter="${to.dataset.filter}"]`)?.focus(),
        );
      }
      return;
    }
    if (target.matches?.(".z-conversation-list__search input")) {
      if (event.key === "ArrowDown") {
        const first = items()[0];
        if (first) {
          event.preventDefault();
          host.update({ active: first.dataset.id! }, true);
        }
      }
      return;
    }
    const row = target.closest?.<HTMLElement>(".z-conversation");
    if (!row || !root.contains(row)) return;
    // Por índice sobre lo visible, no sobre lo pintado: con ventana virtual el destino puede no estar aún en el documento.
    const c = host.config();
    const s = host.state();
    const list = visibleConversations(c.items, s.query, s.filter, c.sort);
    const i = list.findIndex((it) => it.id === row.dataset.id);
    const page = Math.max(1, Math.floor((row.closest(".z-conversation-list__items")?.clientHeight ?? 400) / ROW_ESTIMATE));
    const at =
      event.key === "ArrowDown"
        ? i + 1
        : event.key === "ArrowUp"
          ? i - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? list.length - 1
              : event.key === "PageDown"
                ? Math.min(list.length - 1, i + page)
                : event.key === "PageUp"
                  ? Math.max(0, i - page)
                  : -2;
    if (event.key === "ArrowUp" && i === 0 && c.search) {
      event.preventDefault();
      root.querySelector<HTMLInputElement>(".z-conversation-list__search input")?.focus();
      return;
    }
    const to = at >= 0 ? list[at] : undefined;
    if (to) {
      event.preventDefault();
      scrollToRow(root.querySelector<HTMLElement>(".z-conversation-list__items"), listInput(c, s, list), at);
      host.update({ active: to.id }, true);
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.matches?.(".z-conversation-list__search input")) return;
    host.update({ query: input.value });
    host.emit("search", { query: input.value });
    clearTimeout(timer);
    timer = setTimeout(() => {
      const s = host.state();
      const c = host.config();
      if (!s.query.trim()) return;
      const n = visibleConversations(c.items, s.query, s.filter, c.sort).length;
      announce(n ? fill(c.labels.results, { n }) : c.labels.empty, { source: root });
    }, 400);
  };
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKey);
  root.addEventListener("input", onInput);
  return () => {
    clearTimeout(timer);
    unfollowVirtual(root);
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKey);
    root.removeEventListener("input", onInput);
  };
}

export const conversationListWidget: Widget<ConversationListProps, Config, State> = {
  root: "z-conversation-list",
  configure: (p) => ({
    items: p.items ?? [],
    selected: p.selectedId,
    defaultSelected: p.defaultSelectedId,
    search: p.search !== false,
    filters: p.filters === false ? [] : (p.filters ?? ["all", "unread", "groups"]),
    sort: p.sort !== false,
    locale: p.locale,
    timeZone: p.timeZone,
    hourCycle: p.hourCycle,
    now: p.now,
    labels: { ...CONVERSATION_LIST_LABELS, ...p.labels },
    virtualize: p.virtualize,
  }),
  initial: (c) => ({
    selected: c.selected ?? c.defaultSelected ?? null,
    active: c.selected ?? c.defaultSelected ?? null,
    query: "",
    filter: "all",
    view: null,
    heights: new Map(),
  }),
  control: (c, s) => (c.selected !== undefined && c.selected !== s.selected ? { ...s, selected: c.selected } : s),
  tree(c, s, uid) {
    const { labels } = c;
    const now = c.now ?? Date.now();
    const list = visibleConversations(c.items, s.query, s.filter, c.sort);
    const stop = list.find((it) => it.id === s.active) ?? list.find((it) => it.id === s.selected) ?? list[0];
    const win = widgetList({ ...listInput(c, s, list), keep: stop ? [list.indexOf(stop)] : [] });
    return h(
      "div",
      { class: "z-conversation-list" },
      c.search
        ? h(
            "div",
            { class: "z-conversation-list__search" },
            h(
              "span",
              { class: "z-input z-input--search", "data-size": "md" },
              h("span", { class: "z-input__icon" }, icon("magnifying-glass", 16)),
              h("input", {
                class: "z-input__control",
                type: "search",
                id: `${uid}-search`,
                placeholder: labels.search,
                "aria-label": labels.search,
                autocomplete: "off",
                "aria-controls": `${uid}-items`,
              }),
            ),
          )
        : null,
      c.filters.length > 1
        ? h(
            "div",
            { class: "z-conversation-list__filters", role: "radiogroup", "aria-label": labels.filters },
            ...c.filters.map((f) =>
              h(
                "button",
                {
                  type: "button",
                  role: "radio",
                  class: "z-conversation-list__filter",
                  key: f,
                  "data-filter": f,
                  "aria-checked": s.filter === f ? "true" : "false",
                  tabindex: s.filter === f ? 0 : -1,
                },
                f === "all" ? labels.all : f === "unread" ? labels.unreadFilter : labels.groups,
              ),
            ),
          )
        : null,
      list.length
        ? h(
            "ul",
            { class: "z-conversation-list__items", id: `${uid}-items`, "aria-label": labels.list, "data-virtual": on(win.virtual) },
            spacerNode("li", "before", win.before),
            ...win.indices.map((index) => {
              const it = list[index]!;
              const at = toInstant(it.lastAt ?? null);
              const typing = it.typing?.length ? (it.group ? fill(labels.typingName, { name: it.typing[0]! }) : labels.typing) : "";
              const unread = Math.max(0, it.unread ?? 0);
              return h(
                "li",
                {
                  key: it.id,
                  class: "z-conversation-list__item",
                  "data-key": it.id,
                  // Con ventana virtual, la posición y el total para los lectores (no están todas en el documento).
                  "aria-posinset": win.virtual ? index + 1 : undefined,
                  "aria-setsize": win.virtual ? list.length : undefined,
                },
                h(
                  "button",
                  {
                    type: "button",
                    class: "z-conversation",
                    "data-id": it.id,
                    "aria-current": s.selected === it.id ? "true" : undefined,
                    "data-unread": on(unread > 0),
                    "data-muted": on(it.muted),
                    "data-pinned": on(it.pinned),
                    tabindex: stop?.id === it.id ? 0 : -1,
                  },
                  avatarNode(
                    { name: it.title, avatar: it.avatar },
                    {
                      size: "lg",
                      status: it.presence && it.presence !== "offline" ? it.presence : undefined,
                      statusLabel: it.presence ? labels[it.presence] : undefined,
                      decorative: false,
                    },
                  ),
                  h(
                    "span",
                    { class: "z-conversation__body" },
                    h(
                      "span",
                      { class: "z-conversation__top" },
                      h("span", { class: "z-conversation__title" }, it.title),
                      at !== null
                        ? h("time", { class: "z-conversation__time", datetime: new Date(at).toISOString() }, listTime(at, now, labels, c))
                        : null,
                    ),
                    h(
                      "span",
                      { class: "z-conversation__bottom" },
                      typing
                        ? h(
                            "span",
                            { class: "z-conversation__preview z-conversation__preview--typing" },
                            h("span", { class: "z-conversation__text" }, typing),
                          )
                        : it.draft
                          ? h(
                              "span",
                              { class: "z-conversation__preview" },
                              h("span", { class: "z-conversation__draft" }, `${labels.draft}:`),
                              h("span", { class: "z-conversation__text" }, it.draft),
                            )
                          : h(
                              "span",
                              { class: "z-conversation__preview" },
                              it.lastMine && it.status ? deliveryNode(it.status, labels) : null,
                              it.lastMine
                                ? h("span", { class: "z-conversation__author" }, `${labels.you}: `)
                                : it.lastAuthor
                                  ? h("span", { class: "z-conversation__author" }, `${it.lastAuthor}: `)
                                  : null,
                              h("span", { class: "z-conversation__text" }, it.lastMessage ?? ""),
                            ),
                      h(
                        "span",
                        { class: "z-conversation__badges" },
                        it.muted
                          ? h("span", { class: "z-conversation__flag", role: "img", "aria-label": labels.muted }, icon("bell-slash", 14))
                          : null,
                        it.pinned
                          ? h("span", { class: "z-conversation__flag", role: "img", "aria-label": labels.pinned }, icon("bookmark", 14))
                          : null,
                        it.mention && unread
                          ? h(
                              "span",
                              { class: "z-conversation__mention", role: "img", "aria-label": labels.mentioned },
                              icon("at-symbol", 12),
                            )
                          : null,
                        unread
                          ? h(
                              "span",
                              { class: "z-conversation__unread", "data-muted": on(it.muted) },
                              h("span", { "aria-hidden": "true" }, unread > 999 ? "999+" : String(unread)),
                              h("span", { class: "z-sr-only" }, fill(labels.unread, { n: unread })),
                            )
                          : null,
                      ),
                    ),
                  ),
                ),
              );
            }),
            spacerNode("li", "after", win.after),
          )
        : h("p", { class: "z-conversation-list__empty", role: "status" }, labels.empty),
    );
  },
  attach,
  after(root, host, focus) {
    const s = host.state();
    const scroller = root.querySelector<HTMLElement>(".z-conversation-list__items[data-virtual]");
    // Altos reales de lo pintado y desplazamiento: solo se vuelve a pintar si cambia la ventana.
    if (scroller && measureInto(scroller, ":scope > li[data-key]", s.heights)) queueMicrotask(() => host.update({}));
    followVirtual(root, "items", scroller ? ".z-conversation-list__items[data-virtual]" : null, (view) => {
      const st = host.state();
      const cf = host.config();
      if (windowChanges(listInput(cf, st, visibleConversations(cf.items, st.query, st.filter, cf.sort)), view)) host.update({ view });
      else st.view = view;
    });
    if (!focus) return;
    const target = root.querySelector<HTMLElement>('.z-conversation[tabindex="0"]');
    if (target && target !== root.ownerDocument.activeElement) {
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: "nearest" });
    }
  },
  fromDom(el, json) {
    const d = el.dataset;
    return {
      items: json.items as ConversationItem[] | undefined,
      // Sin framework, el atributo es la abierta al empezar: elegir otra la cambia sin esperar a la aplicación.
      defaultSelectedId: d.selectedId ?? d.defaultSelectedId,
      search: d.search === "false" ? false : undefined,
      filters: d.filters === "none" ? false : d.filters ? (d.filters.split(/[\s,]+/).filter(Boolean) as ConversationFilter[]) : undefined,
      sort: d.sort === "false" ? false : undefined,
      locale: d.locale,
      timeZone: d.timeZone,
      hourCycle: d.hourCycle === "h12" || d.hourCycle === "h23" ? d.hourCycle : undefined,
      now: d.now ? Number(d.now) : undefined,
      labels: json.labels as Partial<ConversationListLabels> | undefined,
      virtualize: virtualizeAttr(d.virtualize),
    };
  },
};
