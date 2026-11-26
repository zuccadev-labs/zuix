// TransferList: dos listas con casillas (disponibles y elegidos), búsqueda opcional en cada una y botones para mover lo
// marcado o todo lo visible. Cada lista es un listbox de selección múltiple con foco por aria-activedescendant: flechas,
// Inicio y Fin recorren, Espacio marca, Mayús+flechas marca un rango, Ctrl+A marca lo visible e Intro mueve lo marcado
// a la otra lista; doble clic mueve una opción. Un solo árbol y una sola interacción para React y el modo DOM.

import { filterTransfer, moveTransfer, rangeTransfer, splitTransfer, type TransferItem } from "./transfer";
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
import { fill, h, icon, on, type VEl } from "./vnode";
import { announceIn, type Widget, type WidgetHost } from "./widget";

export type { TransferItem };

export interface TransferListLabels {
  source: string;
  target: string;
  search: string;
  /** «{count} of {total} selected». */
  count: string;
  moveToTarget: string;
  moveToSource: string;
  moveAllToTarget: string;
  moveAllToSource: string;
  /** «{count} moved to {list}». */
  moved: string;
  empty: string;
  noMatches: string;
  actions: string;
}

export const TRANSFER_LABELS: TransferListLabels = {
  source: "Available",
  target: "Chosen",
  search: "Search",
  count: "{count} of {total} selected",
  moveToTarget: "Move selected to {list}",
  moveToSource: "Move selected to {list}",
  moveAllToTarget: "Move all to {list}",
  moveAllToSource: "Move all to {list}",
  moved: "{count} moved to {list}",
  empty: "No items",
  noMatches: "No matches",
  actions: "Move items",
};

export interface TransferListProps {
  items: TransferItem[];
  /** Valores elegidos (controlado), en su orden. */
  value?: string[];
  defaultValue?: string[];
  /** Búsqueda en cada lista. */
  searchable?: boolean;
  disabled?: boolean;
  /** Nombre del campo: un `<input type="hidden">` por valor elegido. */
  name?: string;
  labels?: Partial<TransferListLabels>;
  /**
   * Ventana virtual en cada lista: solo se pintan las opciones que se ven. `true` siempre, `false` nunca, un número es
   * el umbral; por defecto, a partir de 200 opciones en una lista.
   */
  virtualize?: boolean | number;
}

interface Config extends TransferListProps {
  labels: TransferListLabels;
}

type Side = "source" | "target";
interface State {
  value: string[];
  checked: Record<Side, string[]>;
  query: Record<Side, string>;
  active: Record<Side, string | null>;
  anchor: Record<Side, string | null>;
  prop: string[] | undefined;
  view: Record<Side, ViewportState | null>;
  heights: Map<string, number>;
}

const listInput = (c: Config, s: State, side: Side, visible: TransferItem[]): WidgetListInput => {
  const at = visible.findIndex((i) => i.value === s.active[side]);
  return {
    virtual: wantsVirtual(c.virtualize, visible.length, 200),
    count: visible.length,
    keyOf: (i) => `${side}:${visible[i]!.value}`,
    estimate: 36,
    heights: s.heights,
    view: s.view[side],
    keep: at >= 0 ? [at] : [],
  };
};

const other = (s: Side): Side => (s === "source" ? "target" : "source");
const optionId = (uid: string, side: Side, value: string) => `${uid}-${side}-${value.replace(/[^\w-]/g, "_")}`;

function lists(c: Config, s: State) {
  const split = splitTransfer(c.items, s.value);
  return {
    all: split,
    visible: { source: filterTransfer(split.source, s.query.source), target: filterTransfer(split.target, s.query.target) },
  };
}

function panel(c: Config, s: State, uid: string, side: Side, all: TransferItem[], visible: TransferItem[]): VEl {
  const title = side === "source" ? c.labels.source : c.labels.target;
  const checked = new Set(s.checked[side]);
  const active = visible.some((i) => i.value === s.active[side]) ? s.active[side] : null;
  const count = all.filter((i) => checked.has(i.value)).length;
  const win = widgetList(listInput(c, s, side, visible));
  return h(
    "section",
    { class: "z-transfer__list", "data-side": side, "aria-labelledby": `${uid}-${side}-title` },
    h(
      "header",
      { class: "z-transfer__head" },
      h("span", { class: "z-transfer__title", id: `${uid}-${side}-title` }, title),
      h("span", { class: "z-transfer__count", id: `${uid}-${side}-count` }, fill(c.labels.count, { count, total: all.length })),
    ),
    c.searchable
      ? h(
          "span",
          { class: "z-input z-input--search z-transfer__search", "data-size": "sm" },
          h("span", { class: "z-input__icon" }, icon("magnifying-glass", 16)),
          h("input", {
            type: "search",
            class: "z-input__control",
            "aria-label": `${c.labels.search} ${title}`,
            placeholder: c.labels.search,
            "data-transfer-search": side,
            value: s.query[side],
            disabled: c.disabled || undefined,
          }),
        )
      : null,
    h(
      "div",
      {
        class: "z-transfer__options",
        role: "listbox",
        "aria-multiselectable": "true",
        "aria-labelledby": `${uid}-${side}-title`,
        "aria-describedby": `${uid}-${side}-count`,
        "aria-activedescendant": active ? optionId(uid, side, active) : undefined,
        "aria-disabled": c.disabled ? "true" : undefined,
        tabindex: c.disabled ? -1 : 0,
        "data-side": side,
        "data-virtual": on(win.virtual),
      },
      spacerNode("div", "before", win.before),
      ...(visible.length
        ? win.indices.map((index) => {
            const i = visible[index]!;
            return h(
              "div",
              {
                key: i.value,
                id: optionId(uid, side, i.value),
                class: "z-transfer__option",
                role: "option",
                "data-key": win.virtual ? `${side}:${i.value}` : undefined,
                "aria-posinset": win.virtual ? index + 1 : undefined,
                "aria-setsize": win.virtual ? visible.length : undefined,
                "aria-selected": checked.has(i.value) ? "true" : "false",
                "aria-disabled": i.disabled ? "true" : undefined,
                "data-value": i.value,
                "data-active": on(active === i.value),
              },
              h("span", { class: "z-transfer__check", "aria-hidden": "true" }, icon("check", 14)),
              h(
                "span",
                { class: "z-transfer__text" },
                h("span", { class: "z-transfer__label" }, i.label),
                i.description ? h("span", { class: "z-transfer__description" }, i.description) : null,
              ),
            );
          })
        : // Una lista vacía sigue siendo un listbox: el aviso va como opción deshabilitada (un listbox sin opciones no
          // es válido) y el teclado no la recorre (recorre los datos).
          [
            h(
              "div",
              { class: "z-transfer__empty", role: "option", "aria-disabled": "true", "aria-selected": "false" },
              s.query[side] ? c.labels.noMatches : c.labels.empty,
            ),
          ]),
      spacerNode("div", "after", win.after),
    ),
  );
}

function tree(c: Config, s: State, uid: string): VEl {
  const { all, visible } = lists(c, s);
  const btn = (action: string, label: string, glyph: string, disabled: boolean) =>
    h(
      "button",
      {
        type: "button",
        class: "z-btn z-btn--icon z-btn--secondary",
        "data-size": "sm",
        "data-transfer-action": action,
        "aria-label": label,
        title: label,
        disabled: disabled || c.disabled || undefined,
      },
      icon(glyph, 16),
    );
  const checkedIn = (side: Side) => all[side].some((i) => s.checked[side].includes(i.value) && !i.disabled);
  return h(
    "div",
    { class: "z-transfer", "data-disabled": on(c.disabled), "data-searchable": on(c.searchable), "data-name": c.name },
    panel(c, s, uid, "source", all.source, visible.source),
    h(
      "div",
      { class: "z-transfer__actions", role: "group", "aria-label": c.labels.actions },
      btn(
        "all-target",
        fill(c.labels.moveAllToTarget, { list: c.labels.target }),
        "chevron-double-right",
        !visible.source.some((i) => !i.disabled),
      ),
      btn("to-target", fill(c.labels.moveToTarget, { list: c.labels.target }), "chevron-right", !checkedIn("source")),
      btn("to-source", fill(c.labels.moveToSource, { list: c.labels.source }), "chevron-left", !checkedIn("target")),
      btn(
        "all-source",
        fill(c.labels.moveAllToSource, { list: c.labels.source }),
        "chevron-double-left",
        !visible.target.some((i) => !i.disabled),
      ),
    ),
    panel(c, s, uid, "target", all.target, visible.target),
    h("span", { class: "z-sr-only", "data-live": "", "aria-live": "polite" }),
    ...(c.name ? s.value.map((v) => h("input", { key: v, type: "hidden", name: c.name, value: v })) : []),
  );
}

type Host = WidgetHost<Config, State>;

function move(root: HTMLElement, host: Host, from: Side, keys: string[]): void {
  const c = host.config();
  const s = host.state();
  const to = other(from);
  const next = moveTransfer(c.items, s.value, keys, to);
  const moved = Math.abs(next.length - s.value.length);
  if (!moved) return;
  host.update({
    value: next,
    checked: { ...s.checked, [from]: [] },
    active: { ...s.active, [from]: null },
  });
  host.emit("change", { value: next });
  announceIn(root, fill(c.labels.moved, { count: moved, list: to === "target" ? c.labels.target : c.labels.source }));
}

function attach(root: HTMLElement, host: Host): () => void {
  const sideOf = (el: Element | null): Side | null => {
    const v = el?.closest<HTMLElement>("[data-side]")?.dataset.side;
    return v === "source" || v === "target" ? v : null;
  };
  const visible = (side: Side) => lists(host.config(), host.state()).visible[side];
  const toggle = (side: Side, value: string, range: boolean) => {
    const s = host.state();
    const item = visible(side).find((i) => i.value === value);
    if (!item || item.disabled) return;
    let checked: string[];
    if (range) {
      const add = rangeTransfer(visible(side), s.anchor[side], value);
      checked = [...new Set([...s.checked[side], ...add])];
    } else checked = s.checked[side].includes(value) ? s.checked[side].filter((v) => v !== value) : [...s.checked[side], value];
    host.update({
      checked: { ...s.checked, [side]: checked },
      active: { ...s.active, [side]: value },
      anchor: { ...s.anchor, [side]: range ? s.anchor[side] : value },
    });
  };
  const click = (event: MouseEvent) => {
    if (host.config().disabled) return;
    const target = event.target as Element;
    const action = target.closest<HTMLElement>("[data-transfer-action]");
    if (action && !(action as HTMLButtonElement).disabled) {
      const s = host.state();
      const a = action.dataset.transferAction;
      if (a === "to-target") move(root, host, "source", s.checked.source);
      else if (a === "to-source") move(root, host, "target", s.checked.target);
      else if (a === "all-target")
        move(
          root,
          host,
          "source",
          visible("source").map((i) => i.value),
        );
      else if (a === "all-source")
        move(
          root,
          host,
          "target",
          visible("target").map((i) => i.value),
        );
      return;
    }
    const option = target.closest<HTMLElement>(".z-transfer__option");
    const side = sideOf(option);
    if (!option || !side) return;
    if (event.detail === 2) {
      move(root, host, side, [option.dataset.value ?? ""]);
      return;
    }
    toggle(side, option.dataset.value ?? "", event.shiftKey);
    root.querySelector<HTMLElement>(`.z-transfer__options[data-side="${side}"]`)?.focus({ preventScroll: true });
  };
  const keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (!target.matches(".z-transfer__options") || host.config().disabled) return;
    const side = sideOf(target);
    if (!side) return;
    const s = host.state();
    const list = visible(side);
    if (!list.length) return;
    const at = list.findIndex((i) => i.value === s.active[side]);
    const go = (i: number, extend: boolean) => {
      const item = list[Math.max(0, Math.min(list.length - 1, i))]!;
      if (extend) {
        const checked = [...new Set([...s.checked[side], ...rangeTransfer(list, s.anchor[side] ?? s.active[side], item.value)])];
        host.update({ active: { ...s.active, [side]: item.value }, checked: { ...s.checked, [side]: checked } });
      } else host.update({ active: { ...s.active, [side]: item.value } });
      // Con ventana virtual la opción puede no estar pintada: se desplaza por índice y luego se ajusta.
      scrollToRow(target, listInput(host.config(), host.state(), side, list), list.indexOf(item));
      target.querySelector(`[data-value="${CSS.escape(item.value)}"]`)?.scrollIntoView?.({ block: "nearest" });
    };
    if (event.key === "ArrowDown") go(at + 1, event.shiftKey);
    else if (event.key === "ArrowUp") go(at < 0 ? 0 : at - 1, event.shiftKey);
    else if (event.key === "Home") go(0, event.shiftKey && event.ctrlKey);
    else if (event.key === "End") go(list.length - 1, event.shiftKey && event.ctrlKey);
    else if (event.key === " ") {
      if (at >= 0) toggle(side, list[at]!.value, event.shiftKey);
      else go(0, false);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      const all = list.filter((i) => !i.disabled).map((i) => i.value);
      const every = all.every((v) => s.checked[side].includes(v));
      host.update({ checked: { ...s.checked, [side]: every ? [] : all } });
    } else if (event.key === "Enter") move(root, host, side, s.checked[side].length ? s.checked[side] : at >= 0 ? [list[at]!.value] : []);
    else return;
    event.preventDefault();
  };
  const input = (event: Event) => {
    const field = event.target as HTMLInputElement;
    const side = field.dataset.transferSearch;
    if (side !== "source" && side !== "target") return;
    const s = host.state();
    host.update({ query: { ...s.query, [side]: field.value } });
  };
  const focusin = (event: FocusEvent) => {
    const side = sideOf(event.target as Element);
    const target = event.target as HTMLElement;
    if (!side || !target.matches(".z-transfer__options")) return;
    const s = host.state();
    if (!s.active[side]) {
      const first = visible(side).find((i) => !i.disabled);
      if (first) host.update({ active: { ...s.active, [side]: first.value } });
    }
  };
  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  root.addEventListener("input", input);
  root.addEventListener("focusin", focusin);
  return () => {
    unfollowVirtual(root);
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", keydown);
    root.removeEventListener("input", input);
    root.removeEventListener("focusin", focusin);
  };
}

function after(root: HTMLElement, host: Host): void {
  for (const side of ["source", "target"] as const) {
    const selector = `.z-transfer__options[data-side="${side}"][data-virtual]`;
    const scroller = root.querySelector<HTMLElement>(selector);
    if (scroller && measureInto(scroller, ".z-transfer__option[data-key]", host.state().heights)) queueMicrotask(() => host.update({}));
    followVirtual(root, side, scroller ? selector : null, (view) => {
      const c = host.config();
      const s = host.state();
      const visible = lists(c, s).visible[side];
      if (windowChanges(listInput(c, s, side, visible), view)) host.update({ view: { ...s.view, [side]: view } });
      else s.view = { ...s.view, [side]: view };
    });
  }
}

export const transferListWidget: Widget<TransferListProps, Config, State> = {
  root: "z-transfer",
  configure: (p) => ({ ...p, items: p.items ?? [], labels: { ...TRANSFER_LABELS, ...p.labels } }),
  initial: (c) => ({
    value: [...(c.value ?? c.defaultValue ?? [])],
    checked: { source: [], target: [] },
    query: { source: "", target: "" },
    active: { source: null, target: null },
    anchor: { source: null, target: null },
    prop: c.value,
    view: { source: null, target: null },
    heights: new Map(),
  }),
  control: (c, s) => (c.value !== undefined && c.value !== s.prop ? { ...s, value: [...c.value], prop: c.value } : s),
  tree,
  attach,
  after,
  fromDom(el, json) {
    const d = el.dataset;
    const items = Array.isArray(json.items) ? (json.items as TransferItem[]) : [];
    return {
      items,
      defaultValue: Array.isArray(json.value) ? (json.value as string[]) : (d.value ?? "").split(/[\s,]+/).filter(Boolean),
      searchable: d.searchable !== undefined,
      disabled: d.disabled !== undefined,
      name: d.name,
      labels: json.labels as Partial<TransferListLabels> | undefined,
      virtualize: virtualizeAttr(d.virtualize),
    };
  },
};
