// FilterBar como pieza (core/widget): una fila de chips de filtro que desplaza en horizontal con el borde difuminado
// solo del lado con chips ocultos (core/edges). Un chip de interruptor es un botón con `aria-pressed`; uno de menú abre
// un `popover` con casillas o botones de opción nativos (el teclado y los lectores los conocen sin más). «Clear» solo
// aparece con algún filtro activo, y el número de activos se lee en la descripción del grupo y se anuncia al cambiar.
// Valor controlado (`value`) o libre (`defaultValue`); cada cambio sale como `change { value, id }`.

import { trackScrollEdges } from "./edges";
import {
  activeCount,
  chipText,
  filterKind,
  isActive,
  selected,
  toggleFilter,
  toggleOption,
  valueKey,
  type FilterDef,
  type FilterOption,
  type FilterValue,
} from "./filters";
import { place } from "./place";
import { fill, h, icon, on, type VEl } from "./vnode";
import { announceIn, type Widget, type WidgetHost } from "./widget";

export type { FilterDef, FilterOption, FilterValue };

export interface FilterBarLabels {
  /** Nombre del grupo. */
  label: string;
  clear: string;
  /** «{count} filters active» */
  count: string;
  countOne: string;
  none: string;
}

export const FILTER_BAR_LABELS: FilterBarLabels = {
  label: "Filters",
  clear: "Clear",
  count: "{count} filters active",
  countOne: "1 filter active",
  none: "No filters active",
};

export interface FilterBarProps {
  filters: readonly FilterDef[];
  /** Valor controlado: `{ instant: true, price: ["low", "mid"] }`. */
  value?: FilterValue;
  defaultValue?: FilterValue;
  size?: "sm" | "md";
  labels?: Partial<FilterBarLabels>;
}

interface Config {
  filters: readonly FilterDef[];
  value?: FilterValue;
  defaultValue: FilterValue;
  size: "sm" | "md";
  labels: FilterBarLabels;
}
interface State {
  value: FilterValue;
  /** Firma del `value` de la aplicación con el que se pintó: uno nuevo manda. */
  source: string;
  /** Menú abierto (id del filtro). */
  open: string;
}
type Host = WidgetHost<Config, State>;

const countText = (l: FilterBarLabels, n: number) => (n === 0 ? l.none : n === 1 ? l.countOne : fill(l.count, { count: n }));
const safeId = (id: string) => id.replace(/[^\w-]/g, "_");

function chip(def: FilterDef, c: Config, s: State, uid: string): VEl {
  const active = isActive(def, s.value);
  const { label, detail } = chipText(def, s.value);
  const kind = filterKind(def);
  const glyph = def.icon ? icon(def.icon, c.size === "sm" ? 12 : 14) : null;
  if (kind === "toggle") {
    return h(
      "span",
      {
        class: "z-chip z-filter-bar__chip",
        key: def.id,
        "data-size": c.size,
        "data-interactive": "",
        "data-selected": on(active),
        "data-filter": def.id,
      },
      h(
        "button",
        { type: "button", class: "z-chip__main", "aria-pressed": active ? "true" : "false", "data-toggle": def.id },
        glyph,
        h("span", { class: "z-chip__label" }, label),
      ),
    );
  }
  const menuId = `${uid}-m-${safeId(def.id)}`;
  const many = def.multiple !== false;
  const chosen = selected(def, s.value);
  return h(
    "span",
    {
      class: "z-chip z-filter-bar__chip",
      key: def.id,
      "data-size": c.size,
      "data-interactive": "",
      "data-selected": on(active),
      "data-filter": def.id,
      "data-menu": "",
    },
    h(
      "button",
      {
        type: "button",
        class: "z-chip__main",
        popovertarget: menuId,
        "aria-haspopup": "dialog",
        "aria-expanded": s.open === def.id ? "true" : "false",
        "data-part": "menu-trigger",
      },
      glyph,
      h("span", { class: "z-chip__label" }, label),
      detail ? h("span", { class: "z-chip__count" }, detail) : null,
      h("span", { class: "z-filter-bar__chevron", "aria-hidden": "true" }, icon("chevron-down", 12)),
    ),
    h(
      "div",
      {
        id: menuId,
        class: "z-liquid z-popover z-filter-bar__menu",
        popover: "auto",
        role: "dialog",
        "aria-label": def.label,
        "data-filter": def.id,
        "data-state": s.open === def.id ? "open" : "closed",
      },
      h(
        "fieldset",
        { class: "z-filter-bar__options" },
        h("legend", { class: "z-sr-only" }, def.label),
        ...(def.options ?? []).map((o) =>
          h(
            "label",
            { class: "z-filter-bar__option", key: o.value },
            h("input", {
              type: many ? "checkbox" : "radio",
              class: "z-filter-bar__input",
              name: `${menuId}-options`,
              value: o.value,
              // El estado marcado no va como `checked`: React haría de la casilla un control controlado y desharía el clic
              // antes del `change`. `after` lo escribe en la propiedad tras cada pintado (React y modo DOM).
              "data-checked": on(chosen.includes(o.value)),
              "data-option": def.id,
            }),
            h("span", { class: "z-filter-bar__option-label" }, o.label),
          ),
        ),
      ),
    ),
  );
}

/** Vigilancia de los bordes de la fila, por raíz (se suelta al desmontar). */
const edges = new WeakMap<HTMLElement, () => void>();

export const filterBarWidget: Widget<FilterBarProps, Config, State> = {
  root: "z-filter-bar",
  configure: (p) => ({
    filters: Array.isArray(p.filters) ? p.filters.filter((f) => f && typeof f.id === "string") : [],
    value: p.value,
    defaultValue: p.defaultValue ?? {},
    size: p.size === "sm" ? "sm" : "md",
    labels: { ...FILTER_BAR_LABELS, ...p.labels },
  }),
  initial: (c) => ({ value: c.value ?? c.defaultValue, source: valueKey(c.value), open: "" }),
  control(c, s) {
    if (c.value === undefined) return s;
    const key = valueKey(c.value);
    return key === s.source ? s : { ...s, value: c.value, source: key };
  },
  tree(c, s, uid) {
    const l = c.labels;
    const n = activeCount(c.filters, s.value);
    return h(
      "div",
      {
        class: "z-filter-bar",
        role: "group",
        "aria-label": l.label,
        "aria-describedby": `${uid}-count`,
        "data-size": c.size,
        "data-active": n || undefined,
      },
      h("div", { class: "z-filter-bar__scroller", "data-part": "scroller" }, ...c.filters.map((def) => chip(def, c, s, uid))),
      n
        ? h(
            "button",
            { type: "button", class: "z-btn z-btn--ghost z-filter-bar__clear", "data-size": c.size, "data-clear": "" },
            icon("x-mark", 14),
            l.clear,
          )
        : null,
      h("span", { class: "z-sr-only", id: `${uid}-count` }, countText(l, n)),
      h("span", { class: "z-sr-only", role: "status", "data-live": "" }),
    );
  },
  attach(root, host: Host) {
    const commit = (value: FilterValue, id: string) => {
      host.update({ value });
      host.emit("change", { value, id });
      announceIn(root, countText(host.config().labels, activeCount(host.config().filters, value)));
    };
    const defOf = (id: string | undefined) => host.config().filters.find((f) => f.id === id);
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element).closest?.<HTMLElement>("[data-toggle], [data-clear]");
      if (!target || !root.contains(target)) return;
      if (target.dataset.clear !== undefined) {
        // El botón desaparece al limpiar: el foco pasa antes al primer chip.
        root.querySelector<HTMLElement>(".z-chip__main")?.focus();
        commit({}, "");
        return;
      }
      const def = defOf(target.dataset.toggle);
      if (def) commit(toggleFilter(def, host.state().value), def.id);
    };
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const def = defOf(input.dataset?.option);
      if (!def) return;
      commit(toggleOption(def, host.state().value, input.value), def.id);
    };
    // `toggle` no burbujea: se escucha en captura. Al abrir, el menú se coloca bajo su chip y enfoca la primera opción.
    const onToggle = (event: Event) => {
      const menu = event.target;
      if (!(menu instanceof HTMLElement) || !menu.classList.contains("z-filter-bar__menu") || !root.contains(menu)) return;
      const id = menu.dataset.filter ?? "";
      const open = (event as ToggleEvent).newState === "open";
      if (open) {
        host.update({ open: id });
        const trigger = menu.parentElement?.querySelector<HTMLElement>(".z-chip__main");
        if (trigger) place(menu, trigger.getBoundingClientRect(), "bottom-start", 6);
        menu.querySelector<HTMLInputElement>("input:checked, input")?.focus({ preventScroll: true });
      } else if (host.state().open === id) host.update({ open: "" });
    };
    // Un chip que recibe el foco con el teclado se trae a la vista entero (no solo su borde).
    const onFocus = (event: FocusEvent) => {
      const chipEl = (event.target as Element).closest?.<HTMLElement>(".z-filter-bar__chip");
      // Solo con el teclado: con el puntero, desplazar al pulsar movería el chip bajo el dedo y el clic se perdería.
      if (chipEl && (event.target as Element).matches?.(":focus-visible")) chipEl.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    };
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("toggle", onToggle, true);
    root.addEventListener("focusin", onFocus);
    return () => {
      edges.get(root)?.();
      edges.delete(root);
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onChange);
      root.removeEventListener("toggle", onToggle, true);
      root.removeEventListener("focusin", onFocus);
    };
  },
  after(root) {
    // Los bordes se vigilan desde el primer pintado (en el modo DOM la interacción se conecta antes de pintar).
    const scroller = root.querySelector<HTMLElement>(".z-filter-bar__scroller");
    if (scroller && !edges.has(root)) edges.set(root, trackScrollEdges(scroller));
    for (const input of root.querySelectorAll<HTMLInputElement>(".z-filter-bar__input")) input.checked = input.hasAttribute("data-checked");
  },
  fromDom(el, json) {
    return {
      filters: Array.isArray(json.filters) ? (json.filters as FilterDef[]) : [],
      value: json.value && typeof json.value === "object" ? (json.value as FilterValue) : undefined,
      defaultValue: json.defaultValue && typeof json.defaultValue === "object" ? (json.defaultValue as FilterValue) : undefined,
      size: el.dataset.size === "sm" ? "sm" : undefined,
      labels: json.labels as Partial<FilterBarLabels> | undefined,
    };
  },
};
