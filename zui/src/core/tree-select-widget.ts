// TreeSelect: un select con un árbol dentro de su panel. El campo es un combobox con un popup `tree` (APG «combobox»
// con aria-haspopup="tree"): el foco se queda en el campo y la fila activa va por aria-activedescendant. Flechas
// recorren las filas visibles, derecha expande o baja al primer hijo, izquierda contrae o sube al padre, Intro elige
// (o marca, con casillas). Lo tecleado filtra y expande lo que coincide. `multiple` pone casillas con estado mixto en
// cascada (las de ./tree, las mismas que Tree) y el valor sale según `showCheckedStrategy`. Lo elegido va en piezas
// dentro del campo. Un solo árbol y una sola interacción para React y el modo DOM.
import { localize } from "./locale";
import { openAnchored, type Anchored } from "./anchored";
import { logicalKey } from "./dir";
import { highlightParts } from "./format";
import { chip, nativeInputs, PICKER_ICON, syncNatives } from "./picker-parts";
import {
  filterTree,
  findNode,
  labelPath,
  toShape,
  toggleValue,
  treeKey,
  valueStates,
  visibleRows,
  type ShowStrategy,
  type TreeSelectNode,
} from "./tree-select";
import { fill, h, icon, on, type VEl, type VNode } from "./vnode";
import { isPrintable } from "./typeahead";
import { announceIn, type Widget, type WidgetHost } from "./widget";

export type { TreeSelectNode };

export interface TreeSelectLabels {
  placeholder: string;
  tree: string;
  empty: string;
  noResults: string;
  clear: string;
  toggle: string;
  /** «Remove {label}». */
  remove: string;
  /** «{count} results». */
  results: string;
  /** Pieza con las que no caben: «+{count}». */
  more: string;
}

export const TREE_SELECT_LABELS: TreeSelectLabels = {
  placeholder: "Select",
  tree: "Options",
  empty: "No options",
  noResults: "No results",
  clear: "Clear selection",
  toggle: "Show options",
  remove: "Remove {label}",
  results: "{count} results",
  more: "+{count}",
};

export interface TreeSelectProps {
  nodes: ReadonlyArray<TreeSelectNode>;
  /** Valor elegido (`null` sin selección) o, con `multiple`, los valores. Controlado. */
  value?: string | null | ReadonlyArray<string>;
  defaultValue?: string | null | ReadonlyArray<string>;
  /** Casillas con estado mixto; elegir no cierra el panel. */
  multiple?: boolean;
  /** Con `multiple`: `all` (todo lo marcado), `parent` (la rama en lugar de sus hijos si están todos) o `child` (solo hojas). */
  showCheckedStrategy?: ShowStrategy;
  /** Teclear filtra el árbol (por defecto, sí). */
  searchable?: boolean;
  /** Ramas expandidas al abrir. */
  defaultExpanded?: ReadonlyArray<string>;
  /** Piezas visibles como mucho; el resto se resume en «+N». */
  maxChips?: number;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  name?: string;
  size?: "sm" | "md" | "lg";
  labels?: Partial<TreeSelectLabels>;
  controlId?: string;
  describedBy?: string;
  labelledBy?: string;
  ariaLabel?: string;
}

interface Config extends Omit<TreeSelectProps, "labels"> {
  nodes: ReadonlyArray<TreeSelectNode>;
  labels: TreeSelectLabels;
  showCheckedStrategy: ShowStrategy;
  searchable: boolean;
  size: "sm" | "md" | "lg";
}

interface State {
  open: boolean;
  value: string[];
  prop: unknown;
  expanded: string[];
  active: string | null;
  query: string;
}

type Host = WidgetHost<Config, State>;

const safe = (text: string) => text.replace(/[^\w-]/g, "_");
const itemId = (uid: string, value: string) => `${uid}-n-${safe(value)}`;
const toValue = (raw: TreeSelectProps["value"]): string[] =>
  raw === null || raw === undefined ? [] : typeof raw === "string" ? [raw] : [...raw];

/** Filas visibles con la búsqueda aplicada. */
function view(c: Config, s: State) {
  const filter = c.searchable ? filterTree(c.nodes, s.query) : null;
  const expanded = new Set(filter ? [...s.expanded, ...filter.expand] : s.expanded);
  return { filter, expanded, rows: visibleRows(c.nodes, expanded, filter?.keep ?? null) };
}

const label = (c: Config, value: string) => findNode(c.nodes, value)?.label ?? value;

function tree(c: Config, s: State, uid: string): VEl {
  const l = c.labels;
  const { filter, expanded, rows } = view(c, s);
  const shape = toShape(c.nodes);
  const states = c.multiple ? valueStates(shape, s.value) : null;
  const picked = new Set(s.value);
  const visible = new Set(rows.map((r) => r.node.value));
  const active = s.active && visible.has(s.active) ? s.active : null;
  const treeId = `${uid}-tree`;

  const render = (list: ReadonlyArray<TreeSelectNode>, level: number): VNode[] => {
    const shown = filter ? list.filter((n) => filter.keep.has(n.value)) : list;
    return shown.map((node, i) => {
      const kids = Boolean(node.children?.length);
      const isOpen = kids && expanded.has(node.value);
      const check = states?.get(node.value) ?? "false";
      const selected = c.multiple ? check === "true" : picked.has(node.value);
      const parts = filter?.matches.has(node.value)
        ? highlightParts(node.label, s.query, { ignoreAccents: true }).map((p) =>
            p.match ? h("mark", { class: "z-treeselect__mark" }, p.text) : p.text,
          )
        : [node.label];
      return h(
        "li",
        {
          key: node.value,
          id: itemId(uid, node.value),
          role: "treeitem",
          class: "z-tree__item z-treeselect__item",
          "aria-level": level,
          "aria-setsize": shown.length,
          "aria-posinset": i + 1,
          "aria-expanded": kids ? (isOpen ? "true" : "false") : undefined,
          "aria-selected": c.multiple ? undefined : selected ? "true" : "false",
          "aria-checked": c.multiple ? check : undefined,
          "aria-disabled": node.disabled ? "true" : undefined,
          "data-value": node.value,
          "data-highlighted": on(active === node.value),
        },
        h(
          "div",
          { class: "z-tree__row z-treeselect__row", s: { "--z-tree-level": level - 1 } },
          h(
            "span",
            {
              class: "z-tree__toggle",
              "data-state": isOpen ? "open" : "closed",
              "aria-hidden": "true",
              "data-expander": kids ? "" : undefined,
            },
            kids ? icon("chevron-right", 12) : null,
          ),
          c.multiple
            ? h(
                "span",
                {
                  class: "z-check__box z-tree__check",
                  "data-state": check === "true" ? "checked" : check === "mixed" ? "indeterminate" : "unchecked",
                  "aria-hidden": "true",
                },
                h("span", { class: "z-check__mark" }),
              )
            : null,
          h("span", { class: "z-tree__label" }, ...parts),
          !c.multiple && selected
            ? h("span", { class: "z-listbox__check z-treeselect__check", "aria-hidden": "true" }, icon("check", 14))
            : null,
        ),
        isOpen ? h("ul", { role: "group", class: "z-tree__group" }, ...render(node.children!, level + 1)) : null,
      );
    });
  };

  const chips: VNode[] = [];
  if (c.multiple) {
    const max = c.maxChips ?? Number.POSITIVE_INFINITY;
    s.value.slice(0, max).forEach((v) => {
      const full = labelPath(c.nodes, v).join(" / ") || v;
      chips.push(chip(v, label(c, v), full, fill(l.remove, { label: label(c, v) }), c.size, c.disabled));
    });
    if (s.value.length > max)
      chips.push(h("span", { key: "more", class: "z-tags__tag z-treeselect__more" }, fill(l.more, { count: s.value.length - max })));
  }
  const single = !c.multiple && s.value[0] !== undefined ? label(c, s.value[0]) : "";
  const hasValue = s.value.length > 0;
  return h(
    "div",
    {
      class: "z-treeselect",
      "data-size": c.size,
      "data-multiple": on(c.multiple),
      "data-disabled": on(c.disabled),
      "data-invalid": on(c.invalid),
      "data-name": c.name,
      "data-value": c.multiple ? s.value.join(",") : (s.value[0] ?? undefined),
    },
    h(
      "span",
      {
        class: "z-input z-combobox z-treeselect__control",
        "data-picker": "",
        "data-size": c.size,
        "data-state": s.open ? "open" : "closed",
        "data-multiple": on(c.multiple),
        "data-invalid": on(c.invalid),
        "data-disabled": on(c.disabled),
      },
      // Las piezas van en su propia caja (`display: contents`): el campo no cambia de sitio entre sus hermanos al
      // añadir o quitar una, y no pierde el foco.
      c.multiple ? h("span", { key: "chips", class: "z-picker-chips" }, ...chips) : null,
      // Con clave: las piezas de delante cambian y el campo (con el foco) no se vuelve a crear.
      h("input", {
        key: "input",
        type: "text",
        id: c.controlId ?? `${uid}-input`,
        class: "z-input__control z-treeselect__input",
        role: "combobox",
        "aria-haspopup": "tree",
        "aria-expanded": s.open ? "true" : "false",
        "aria-controls": s.open ? treeId : undefined,
        "aria-activedescendant": s.open && active ? itemId(uid, active) : undefined,
        "aria-autocomplete": c.searchable ? "list" : undefined,
        "aria-label": c.ariaLabel,
        "aria-labelledby": c.labelledBy,
        "aria-describedby": c.describedBy,
        "aria-invalid": c.invalid ? "true" : undefined,
        "aria-required": c.required ? "true" : undefined,
        readonly: c.searchable ? undefined : true,
        disabled: c.disabled || undefined,
        autocomplete: "off",
        autocapitalize: "none",
        spellcheck: "false",
        placeholder: c.multiple && hasValue ? undefined : (s.open && c.searchable && single) || (c.placeholder ?? l.placeholder),
        value: s.open && c.searchable ? s.query : single,
      }),
      c.clearable && hasValue && !c.disabled
        ? h(
            "button",
            {
              key: "clear",
              type: "button",
              class: "z-input__action",
              tabindex: -1,
              "aria-label": l.clear,
              title: l.clear,
              "data-clear": "",
            },
            icon("x-mark", PICKER_ICON[c.size]),
          )
        : null,
      h(
        "button",
        {
          key: "toggle",
          type: "button",
          class: "z-input__action z-combobox__toggle",
          tabindex: -1,
          "aria-label": l.toggle,
          "aria-expanded": s.open ? "true" : "false",
          "aria-controls": s.open ? treeId : undefined,
          disabled: c.disabled || undefined,
          "data-toggle": "",
        },
        icon("chevron-down", PICKER_ICON[c.size]),
      ),
    ),
    ...nativeInputs(c.name, s.value, c.required, c.disabled),
    h(
      "div",
      {
        id: `${uid}-popup`,
        class: "z-liquid z-listbox z-treeselect__popup",
        popover: "manual",
        role: "presentation",
        "data-size": c.size,
        "data-state": s.open ? "open" : "closed",
      },
      // Cerrado, el panel va vacío: un árbol grande no se pinta hasta que hace falta.
      !s.open
        ? null
        : h(
            "ul",
            {
              id: treeId,
              role: "tree",
              class: "z-tree z-listbox__viewport z-treeselect__tree",
              "aria-label": c.labelledBy ? undefined : (c.ariaLabel ?? l.tree),
              "aria-labelledby": c.labelledBy,
              "aria-multiselectable": c.multiple ? "true" : undefined,
              "data-checkable": on(c.multiple),
              "data-widget": "",
            },
            ...render(c.nodes, 1),
          ),
      !s.open || rows.length ? null : h("div", { class: "z-listbox__empty", role: "presentation" }, filter ? l.noResults : l.empty),
    ),
    h("span", { class: "z-sr-only", "data-live": "", "aria-live": "polite" }),
  );
}

const layers = new WeakMap<HTMLElement, Anchored>();

function attach(root: HTMLElement, host: Host): () => void {
  const input = () => root.querySelector<HTMLInputElement>(".z-treeselect__input");
  const popup = () => root.querySelector<HTMLElement>(".z-treeselect__popup");
  const control = () => root.querySelector<HTMLElement>(".z-treeselect__control");

  const close = () => {
    layers.get(root)?.close();
    layers.delete(root);
    if (host.state().open) host.update({ open: false, query: "" });
  };
  const open = () => {
    const c = host.config();
    const s = host.state();
    if (c.disabled || s.open) return;
    // Se abre con lo elegido a la vista: sus antepasados expandidos y la primera elección activa.
    const ancestors = new Set(s.expanded);
    for (const v of s.value) {
      const trail: string[] = [];
      const walk = (list: ReadonlyArray<TreeSelectNode>): boolean => {
        for (const n of list) {
          if (n.value === v) return true;
          trail.push(n.value);
          if (walk(n.children ?? [])) return true;
          trail.pop();
        }
        return false;
      };
      if (walk(c.nodes)) for (const id of trail) ancestors.add(id);
    }
    host.update({ open: true, query: "", expanded: [...ancestors], active: s.value[0] ?? c.nodes[0]?.value ?? null });
    const p = popup();
    const anchor = control();
    if (p && anchor) layers.set(root, openAnchored(p, anchor, { onDismiss: () => close() }));
  };
  const commit = (value: string[]) => {
    host.update({ value });
    const c = host.config();
    if (c.multiple) host.emit("change", { value, labels: value.map((v) => label(c, v)) });
    else host.emit("change", { value: value[0] ?? null, label: value[0] ? label(c, value[0]) : null });
  };
  const choose = (value: string) => {
    const c = host.config();
    const node = findNode(c.nodes, value);
    if (!node || node.disabled) return;
    host.update({ active: value });
    if (c.multiple) {
      commit(toggleValue(toShape(c.nodes), host.state().value, value, c.showCheckedStrategy));
      return;
    }
    commit([value]);
    close();
  };
  const setExpanded = (value: string, open: boolean) => {
    const s = host.state();
    const next = new Set(view(host.config(), s).expanded);
    if (open) next.add(value);
    else next.delete(value);
    host.update({ expanded: [...next] });
  };

  const keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (!target.matches(".z-treeselect__input")) return;
    const c = host.config();
    const s = host.state();
    if (c.disabled) return;
    const key = logicalKey(event.key, target);
    if (key === "Backspace" && c.multiple && !(input()?.value ?? "") && s.value.length) {
      event.preventDefault();
      commit(s.value.slice(0, -1));
      return;
    }
    // Teclear con el panel cerrado empieza una búsqueda nueva: el texto de la selección no se queda delante.
    if (!s.open && c.searchable && isPrintable(event)) {
      open();
      const field = input();
      if (field) field.value = "";
      return;
    }
    if (!s.open) {
      if (key === "ArrowDown" || key === "ArrowUp" || (key === "Enter" && !event.isComposing) || (key === " " && !c.searchable)) {
        event.preventDefault();
        open();
      }
      return;
    }
    if ((key === "Home" || key === "End") && c.searchable && (input()?.value ?? "")) return;
    if (key === "Escape" && s.query) {
      // Escape primero vacía la búsqueda; con ella vacía, la capa cierra.
      event.preventDefault();
      const field = input();
      if (field) field.value = "";
      host.update({ query: "" });
      return;
    }
    const { rows, expanded } = view(c, s);
    const step = treeKey(rows, s.active, key, expanded);
    if (step) {
      event.preventDefault();
      if (step.expand) setExpanded(step.expand, true);
      if (step.collapse) setExpanded(step.collapse, false);
      host.update({ active: step.active });
      return;
    }
    if ((key === "Enter" && !event.isComposing) || (key === " " && !c.searchable)) {
      event.preventDefault();
      if (s.active) choose(s.active);
    } else if (key === "Tab") close();
  };
  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (!target.matches(".z-treeselect__input") || !host.config().searchable) return;
    if (!host.state().open) open();
    const c = host.config();
    const filter = filterTree(c.nodes, target.value);
    const first = filter ? [...filter.matches][0] : (host.state().value[0] ?? c.nodes[0]?.value);
    host.update({ query: target.value, active: first ?? null });
    if (filter) announceIn(root, filter.matches.size ? fill(c.labels.results, { count: filter.matches.size }) : c.labels.noResults);
  };
  const click = (event: MouseEvent) => {
    const c = host.config();
    if (c.disabled) return;
    const target = event.target as Element;
    const remove = target.closest<HTMLElement>("[data-remove]");
    if (remove) {
      commit(host.state().value.filter((v) => v !== remove.dataset.remove));
      input()?.focus();
      return;
    }
    if (target.closest("[data-clear]")) {
      commit([]);
      input()?.focus();
      return;
    }
    const item = target.closest<HTMLElement>(".z-treeselect__item");
    if (item) {
      const value = item.dataset.value ?? "";
      if (target.closest("[data-expander]")) {
        setExpanded(value, item.getAttribute("aria-expanded") !== "true");
        host.update({ active: value });
      } else choose(value);
      return;
    }
    if (target.closest("[data-toggle]") || target.closest(".z-treeselect__control")) {
      if (host.state().open && target.closest("[data-toggle]")) close();
      else open();
      input()?.focus();
    }
  };
  const mousedown = (event: MouseEvent) => {
    if ((event.target as Element).closest(".z-treeselect__popup, .z-input__action, .z-tags__remove")) event.preventDefault();
  };
  const hover = (event: MouseEvent) => {
    const item = (event.target as Element).closest?.<HTMLElement>(".z-treeselect__row")?.closest<HTMLElement>(".z-treeselect__item");
    const value = item?.dataset.value;
    if (value && value !== host.state().active) host.update({ active: value });
  };
  const invalid = (event: Event) => {
    if ((event.target as HTMLElement).matches?.("[data-native]")) input()?.focus();
  };
  // El navegador enfoca el campo nativo oculto al informar de un error: el foco pasa al control visible.
  const nativeFocus = (event: FocusEvent) => {
    if ((event.target as HTMLElement).matches?.("[data-native]")) input()?.focus();
  };
  const form = root.closest("form");
  const initial = host.state().value;
  // `form.reset()`: vuelve al valor con el que se montó y lo anuncia (un valor controlado se entera).
  const reset = () =>
    setTimeout(() => {
      host.update({ query: "" });
      commit(initial);
    }, 0);
  root.addEventListener("keydown", keydown);
  root.addEventListener("input", onInput);
  root.addEventListener("click", click);
  root.addEventListener("mousedown", mousedown);
  root.addEventListener("mousemove", hover);
  root.addEventListener("invalid", invalid, true);
  root.addEventListener("focusin", nativeFocus);
  form?.addEventListener("reset", reset);
  return () => {
    layers.get(root)?.close();
    layers.delete(root);
    root.removeEventListener("keydown", keydown);
    root.removeEventListener("input", onInput);
    root.removeEventListener("click", click);
    root.removeEventListener("mousedown", mousedown);
    root.removeEventListener("mousemove", hover);
    root.removeEventListener("invalid", invalid, true);
    root.removeEventListener("focusin", nativeFocus);
    form?.removeEventListener("reset", reset);
  };
}

function after(root: HTMLElement, host: Host): void {
  const c = host.config();
  const s = host.state();
  const field = root.querySelector<HTMLInputElement>(".z-treeselect__input");
  const shown = s.open && c.searchable ? s.query : !c.multiple && s.value[0] ? label(c, s.value[0]) : "";
  if (field && field.value !== shown) field.value = shown;
  syncNatives(root, s.value);
  const layer = layers.get(root);
  if (s.open) {
    layer?.reposition();
    const id = field?.getAttribute("aria-activedescendant");
    if (id) root.ownerDocument.getElementById(id)?.querySelector(".z-tree__row")?.scrollIntoView?.({ block: "nearest" });
  } else if (layer) {
    layer.close();
    layers.delete(root);
  }
}

export const treeSelectWidget: Widget<TreeSelectProps, Config, State> = {
  root: "z-treeselect",
  configure: (p) => ({
    ...p,
    nodes: p.nodes ?? [],
    labels: { ...localize("treeSelect", TREE_SELECT_LABELS), ...p.labels },
    showCheckedStrategy: p.showCheckedStrategy ?? "parent",
    searchable: p.searchable ?? true,
    size: p.size ?? "md",
  }),
  initial: (c) => ({
    open: false,
    value: toValue(c.value ?? c.defaultValue),
    prop: c.value,
    expanded: [...(c.defaultExpanded ?? [])],
    active: null,
    query: "",
  }),
  control: (c, s) => (c.value !== undefined && c.value !== s.prop ? { ...s, value: toValue(c.value), prop: c.value } : s),
  tree,
  attach,
  after,
  fromDom(el, json) {
    const d = el.dataset;
    const multiple = d.multiple !== undefined;
    const raw = json.value ?? (d.value ? (multiple ? d.value.split(",").filter(Boolean) : d.value) : undefined);
    return {
      nodes: Array.isArray(json.nodes) ? (json.nodes as TreeSelectNode[]) : [],
      defaultValue: raw as string | string[] | undefined,
      multiple,
      searchable: d.searchable !== "false",
      clearable: d.clearable !== undefined,
      disabled: d.disabled !== undefined,
      required: d.required !== undefined,
      name: d.name,
      placeholder: d.placeholder,
      maxChips: d.maxChips ? Number(d.maxChips) : undefined,
      size: d.size === "sm" || d.size === "lg" ? d.size : undefined,
      showCheckedStrategy: d.strategy === "all" || d.strategy === "child" || d.strategy === "parent" ? d.strategy : undefined,
      defaultExpanded: Array.isArray(json.defaultExpanded) ? (json.defaultExpanded as string[]) : undefined,
      labels: json.labels as Partial<TreeSelectLabels> | undefined,
      ariaLabel: d.label,
    };
  },
};
