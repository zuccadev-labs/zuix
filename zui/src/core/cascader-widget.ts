// Cascader: selección jerárquica por columnas (país › región › ciudad). El campo es un combobox (APG): el foco se
// queda en él y la opción activa de las columnas (cada una, un listbox) va por aria-activedescendant. Flechas arriba y
// abajo recorren la columna; derecha abre la rama (y pide sus hijos con `loadChildren` si aún no los tiene); izquierda
// vuelve a la columna anterior; Intro elige. Con `searchable`, lo tecleado busca en la ruta completa y las columnas
// dejan paso a una lista de rutas. `multiple` pone casillas con estado mixto (las de ./tree). En una ventana estrecha
// se ve una columna cada vez, con un botón para volver al nivel anterior. Un solo árbol y una sola interacción para
// React y el modo DOM.
import { openAnchored, type Anchored } from "./anchored";
import { chip, nativeInputs, PICKER_ICON, syncNatives } from "./picker-parts";
import {
  cascaderShape,
  childrenOf,
  columnsOf,
  isBranch,
  keysOf,
  nodesOf,
  parsePath,
  pathKey,
  pathsOf,
  pathText,
  searchPaths,
  type CascaderMatch,
  type CascaderOption,
} from "./cascader";
import { logicalKey } from "./dir";
import { highlightParts } from "./format";
import { toggleValue, valueStates, type ShowStrategy } from "./tree-select";
import { createTypeahead, isPrintable } from "./typeahead";
import { fill, h, icon, on, type VEl, type VNode } from "./vnode";
import { announceIn, type Widget, type WidgetHost } from "./widget";

export type { CascaderOption };

export interface CascaderLabels {
  placeholder: string;
  /** Nombre de cada columna; `{n}` es el nivel. */
  level: string;
  empty: string;
  noResults: string;
  loading: string;
  back: string;
  clear: string;
  toggle: string;
  /** «Remove {label}». */
  remove: string;
  /** «{count} results». */
  results: string;
}

export const CASCADER_LABELS: CascaderLabels = {
  placeholder: "Select",
  level: "Level {n}",
  empty: "No options",
  noResults: "No results",
  loading: "Loading",
  back: "Back",
  clear: "Clear selection",
  toggle: "Show options",
  remove: "Remove {label}",
  results: "{count} results",
};

export interface CascaderProps {
  options: ReadonlyArray<CascaderOption>;
  /** Ruta elegida (`["es", "madrid"]`), o varias con `multiple`. Controlado. */
  value?: ReadonlyArray<string> | ReadonlyArray<ReadonlyArray<string>> | null;
  defaultValue?: ReadonlyArray<string> | ReadonlyArray<ReadonlyArray<string>> | null;
  multiple?: boolean;
  /** Con `multiple`: qué rutas forman el valor cuando una rama está marcada entera. */
  showCheckedStrategy?: ShowStrategy;
  /** Elegir una rama ya cambia el valor (sin llegar a una hoja). */
  changeOnSelect?: boolean;
  /** Teclear busca en la ruta completa. */
  searchable?: boolean;
  /** Hijos de una opción con `isLeaf: false` (y sin `children`), al abrirla. */
  loadChildren?: (option: CascaderOption, path: string[]) => Promise<ReadonlyArray<CascaderOption>>;
  /** Nombre de cada columna, por nivel (`["Country", "Region", "City"]`). */
  levelLabels?: ReadonlyArray<string>;
  /** Separador del texto del campo. */
  displaySeparator?: string;
  /** Separador del valor que envía el formulario (`es/madrid`). */
  separator?: string;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  name?: string;
  size?: "sm" | "md" | "lg";
  labels?: Partial<CascaderLabels>;
  /** Del Field que lo envuelve (React) o del marcado: id del campo, descripción y nombre accesible. */
  controlId?: string;
  describedBy?: string;
  labelledBy?: string;
  ariaLabel?: string;
}

interface Config extends Omit<CascaderProps, "labels"> {
  options: ReadonlyArray<CascaderOption>;
  labels: CascaderLabels;
  displaySeparator: string;
  separator: string;
  showCheckedStrategy: ShowStrategy;
  size: "sm" | "md" | "lg";
}

interface State {
  open: boolean;
  paths: string[][];
  prop: unknown;
  /** Ruta abierta en las columnas. */
  trail: string[];
  /** Opción activa: columna y valor. */
  active: { col: number; value: string } | null;
  query: string;
  match: number;
  loaded: Record<string, ReadonlyArray<CascaderOption>>;
  loading: string[];
  /** Etiquetas de las rutas elegidas (para las que vienen de una carga). */
  known: Record<string, string[]>;
}

type Host = WidgetHost<Config, State>;

const safe = (text: string) => text.replace(/[^\w-]/g, "_");
const toPaths = (raw: CascaderProps["value"], multiple: boolean | undefined): string[][] => {
  if (!raw || !Array.isArray(raw) || !raw.length) return [];
  if (Array.isArray(raw[0])) return (raw as ReadonlyArray<ReadonlyArray<string>>).map((p) => [...p]).filter((p) => p.length);
  return multiple ? [[...(raw as ReadonlyArray<string>)]] : [[...(raw as ReadonlyArray<string>)]];
};

const lazy = (c: Config) => typeof c.loadChildren === "function";

function labelsOf(c: Config, s: State, path: string[]): string[] {
  const nodes = nodesOf(c.options, path, s.loaded);
  return nodes ? nodes.map((n) => n.label) : (s.known[pathKey(path)] ?? path);
}

function columnsFor(c: Config, s: State): ReadonlyArray<CascaderOption>[] {
  return columnsOf(c.options, s.trail, s.loaded);
}

/** Columna que se ve en una ventana estrecha: la de la opción activa o la última. */
const currentColumn = (columns: number, s: State) => (s.active ? Math.min(s.active.col, columns - 1) : columns - 1);

function matches(c: Config, s: State): CascaderMatch[] {
  return searchPaths(c.options, s.query, s.loaded, {
    changeOnSelect: c.changeOnSelect || c.multiple,
    lazy: lazy(c),
    separator: c.displaySeparator,
  });
}

const optionId = (uid: string, col: number, value: string) => `${uid}-c${col}-${safe(value)}`;
const matchId = (uid: string, i: number) => `${uid}-m${i}`;

function displayText(c: Config, s: State): string {
  if (c.multiple || !s.paths[0]) return "";
  return labelsOf(c, s, s.paths[0]).join(c.displaySeparator);
}

function tree(c: Config, s: State, uid: string): VEl {
  const l = c.labels;
  const columns = columnsFor(c, s);
  const searching = Boolean(c.searchable && s.query.trim());
  const found = searching ? matches(c, s) : [];
  const shape = c.multiple ? cascaderShape(c.options, s.loaded) : [];
  const states = c.multiple ? valueStates(shape, keysOf(s.paths)) : null;
  const chosen = new Set(c.multiple ? [] : (s.paths[0] ?? []).map((v, i) => `${i}:${v}`));
  const current = currentColumn(columns.length, s);
  const activeId = !s.open
    ? undefined
    : searching
      ? found[s.match]
        ? matchId(uid, s.match)
        : undefined
      : s.active
        ? optionId(uid, s.active.col, s.active.value)
        : undefined;
  const popupId = `${uid}-popup`;
  const listIds = searching ? `${uid}-results` : columns.map((_, i) => `${uid}-col${i}`).join(" ");

  const column = (list: ReadonlyArray<CascaderOption>, col: number): VEl => {
    const parentPath = s.trail.slice(0, col);
    const key = pathKey(parentPath);
    return h(
      "div",
      {
        key: `col${col}`,
        id: `${uid}-col${col}`,
        class: "z-listbox__viewport z-cascader__column",
        role: "listbox",
        "aria-label": c.levelLabels?.[col] ?? fill(l.level, { n: col + 1 }),
        "aria-multiselectable": c.multiple ? "true" : undefined,
        "aria-busy": s.loading.includes(key) ? "true" : undefined,
        "data-col": col,
        "data-current": on(col === current),
      },
      ...list.map((node) => {
        const path = [...parentPath, node.value];
        const k = pathKey(path);
        const branch = isBranch(node, path, s.loaded, lazy(c));
        const loading = s.loading.includes(k);
        const inTrail = s.trail[col] === node.value;
        const check = states?.get(k) ?? "false";
        const selected = c.multiple ? check === "true" : chosen.has(`${col}:${node.value}`) && (s.paths[0]?.length ?? 0) > col;
        return h(
          "div",
          {
            key: node.value,
            id: optionId(uid, col, node.value),
            class: "z-listbox__option z-cascader__option",
            role: "option",
            "aria-selected": selected ? "true" : "false",
            "aria-disabled": node.disabled ? "true" : undefined,
            "aria-checked": c.multiple ? check : undefined,
            "data-value": node.value,
            "data-col": col,
            "data-branch": on(branch),
            "data-open": on(inTrail && branch),
            "data-highlighted": on(s.active?.col === col && s.active.value === node.value),
            "data-loading": on(loading),
          },
          c.multiple
            ? h(
                "span",
                {
                  class: "z-check__box z-cascader__check",
                  "data-state": check === "true" ? "checked" : check === "mixed" ? "indeterminate" : "unchecked",
                  "aria-hidden": "true",
                },
                h("span", { class: "z-check__mark" }),
              )
            : null,
          h("span", { class: "z-listbox__text" }, node.label),
          loading
            ? h("span", { class: "z-input__spinner z-cascader__spinner", "aria-hidden": "true" })
            : branch
              ? h("span", { class: "z-cascader__chevron", "aria-hidden": "true" }, icon("chevron-right", 14))
              : !c.multiple && selected
                ? h("span", { class: "z-listbox__check" }, icon("check", 14))
                : null,
        );
      }),
      list.length ? null : h("div", { class: "z-listbox__empty", role: "presentation" }, s.loading.includes(key) ? l.loading : l.empty),
    );
  };

  const results = (): VEl =>
    h(
      "div",
      {
        id: `${uid}-results`,
        class: "z-listbox__viewport z-cascader__results",
        role: "listbox",
        "aria-label": fill(l.results, { count: found.length }),
        "aria-multiselectable": c.multiple ? "true" : undefined,
      },
      ...found.map((m, i) => {
        const k = pathKey(m.path);
        const check = states?.get(k) ?? "false";
        const selected = c.multiple ? check === "true" : pathKey(s.paths[0] ?? []) === k;
        const text = m.labels.join(c.displaySeparator);
        return h(
          "div",
          {
            key: k,
            id: matchId(uid, i),
            class: "z-listbox__option z-cascader__option",
            role: "option",
            "aria-selected": selected ? "true" : "false",
            "aria-disabled": m.disabled ? "true" : undefined,
            "data-match": i,
            "data-highlighted": on(i === s.match),
          },
          c.multiple
            ? h(
                "span",
                {
                  class: "z-check__box z-cascader__check",
                  "data-state": check === "true" ? "checked" : "unchecked",
                  "aria-hidden": "true",
                },
                h("span", { class: "z-check__mark" }),
              )
            : null,
          h(
            "span",
            { class: "z-listbox__text" },
            ...highlightParts(text, s.query, { ignoreAccents: true }).map((part) =>
              part.match ? h("mark", { class: "z-cascader__mark" }, part.text) : part.text,
            ),
          ),
        );
      }),
      found.length ? null : h("div", { class: "z-listbox__empty", role: "presentation" }, l.noResults),
    );

  const crumb = current > 0 ? (nodesOf(c.options, s.trail.slice(0, current), s.loaded)?.[current - 1]?.label ?? "") : "";
  const chips: VNode[] = c.multiple
    ? s.paths.map((path) => {
        const labels = labelsOf(c, s, path);
        const full = labels.join(c.displaySeparator);
        return chip(pathKey(path), labels[labels.length - 1] ?? "", full, fill(l.remove, { label: full }), c.size, c.disabled);
      })
    : [];
  const formValues = s.paths.map((p) => pathText(p, c.separator));
  const hasValue = s.paths.length > 0;

  return h(
    "div",
    {
      class: "z-cascader",
      "data-size": c.size,
      "data-multiple": on(c.multiple),
      "data-searchable": on(c.searchable),
      "data-change-on-select": on(c.changeOnSelect),
      "data-disabled": on(c.disabled),
      "data-invalid": on(c.invalid),
      "data-name": c.name,
      "data-separator": c.separator === "/" ? undefined : c.separator,
      "data-value": c.multiple ? undefined : formValues[0],
    },
    h(
      "span",
      {
        class: "z-input z-combobox z-cascader__control",
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
        class: "z-input__control z-cascader__input",
        role: "combobox",
        "aria-haspopup": "listbox",
        "aria-expanded": s.open ? "true" : "false",
        "aria-controls": s.open ? listIds : undefined,
        "aria-activedescendant": activeId,
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
        // Abierto con búsqueda, el campo es para teclear: la ruta elegida pasa al texto de ayuda.
        placeholder: c.multiple && hasValue ? undefined : (s.open && c.searchable && displayText(c, s)) || (c.placeholder ?? l.placeholder),
        value: s.open && c.searchable ? s.query : displayText(c, s),
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
          "aria-controls": s.open ? popupId : undefined,
          disabled: c.disabled || undefined,
          "data-toggle": "",
        },
        icon("chevron-down", PICKER_ICON[c.size]),
      ),
    ),
    ...nativeInputs(c.name, formValues, c.required, c.disabled),
    h(
      "div",
      {
        id: popupId,
        class: "z-liquid z-listbox z-cascader__popup",
        popover: "manual",
        role: "presentation",
        "data-size": c.size,
        "data-state": s.open ? "open" : "closed",
        "data-searching": on(searching),
      },
      // Cerrado, el panel va vacío: un árbol grande no se pinta hasta que hace falta.
      s.open && !searching && current > 0
        ? h(
            "div",
            { class: "z-cascader__bar" },
            h(
              "button",
              { type: "button", class: "z-btn z-btn--ghost z-cascader__back", "data-size": "sm", "data-back": "", tabindex: -1 },
              icon("chevron-left", 16),
              h("span", {}, l.back),
            ),
            h("span", { class: "z-cascader__crumb" }, crumb),
          )
        : null,
      !s.open ? null : searching ? results() : h("div", { class: "z-cascader__columns" }, ...columns.map(column)),
    ),
    h("span", { class: "z-sr-only", "data-live": "", "aria-live": "polite" }),
  );
}

interface Runtime {
  layer: Anchored | null;
  typeahead: ReturnType<typeof createTypeahead>;
  /** Tras cargar los hijos de esta ruta, la opción activa pasa a su primer hijo. */
  enter: string | null;
}
const runtimes = new WeakMap<HTMLElement, Runtime>();

function emitValue(host: Host, paths: string[][]): void {
  const c = host.config();
  const s = host.state();
  const known = { ...s.known };
  for (const p of paths) known[pathKey(p)] = labelsOf(c, s, p);
  host.update({ paths, known });
  if (c.multiple) host.emit("change", { value: paths, labels: paths.map((p) => known[pathKey(p)]) });
  else {
    const path = paths[0] ?? [];
    const nodes = nodesOf(c.options, path, s.loaded);
    host.emit("change", { value: path, labels: known[pathKey(path)] ?? [], option: nodes?.[nodes.length - 1] ?? null });
  }
}

function load(root: HTMLElement, host: Host, node: CascaderOption, path: string[], enter: boolean): void {
  const c = host.config();
  const s = host.state();
  const key = pathKey(path);
  const rt = runtimes.get(root);
  if (rt && enter) rt.enter = key;
  if (!c.loadChildren || s.loading.includes(key) || childrenOf(node, path, s.loaded)) return;
  host.update({ loading: [...s.loading, key] });
  announceIn(root, c.labels.loading);
  const done = (kids: ReadonlyArray<CascaderOption>) => {
    const now = host.state();
    host.update({ loaded: { ...now.loaded, [key]: kids }, loading: now.loading.filter((k) => k !== key) });
    const r = runtimes.get(root);
    if (r?.enter === key) {
      r.enter = null;
      const first = kids.find((k) => !k.disabled) ?? kids[0];
      const cur = host.state();
      if (first && cur.open && pathKey(cur.trail) === key) host.update({ active: { col: path.length, value: first.value } });
    }
    host.emit("load", { path, options: kids });
  };
  Promise.resolve()
    .then(() => c.loadChildren?.(node, path))
    .then(
      (kids) => done(Array.isArray(kids) ? kids : []),
      (error: unknown) => {
        done([]);
        host.emit("loaderror", { path, error });
      },
    );
}

function attach(root: HTMLElement, host: Host): () => void {
  const rt: Runtime = { layer: null, typeahead: createTypeahead(), enter: null };
  runtimes.set(root, rt);
  const input = () => root.querySelector<HTMLInputElement>(".z-cascader__input");
  const popup = () => root.querySelector<HTMLElement>(".z-cascader__popup");
  const control = () => root.querySelector<HTMLElement>(".z-cascader__control");
  const narrow = () => root.ownerDocument.defaultView?.matchMedia?.("(max-width: 640px)").matches ?? false;

  const close = () => {
    rt.layer?.close();
    rt.layer = null;
    if (host.state().open) host.update({ open: false, query: "", match: 0 });
  };
  const open = () => {
    const c = host.config();
    if (c.disabled || host.state().open) return;
    const s = host.state();
    const path = c.multiple ? [] : (s.paths[0] ?? []);
    const nodes = nodesOf(c.options, path, s.loaded);
    // Se abre en la ruta elegida: sus columnas a la vista y la opción elegida activa.
    const trail = nodes ? [...path] : [];
    const last = trail[trail.length - 1];
    const first = c.options.find((o) => !o.disabled) ?? c.options[0];
    const active = last !== undefined ? { col: trail.length - 1, value: last } : first ? { col: 0, value: first.value } : null;
    host.update({ open: true, trail, active, query: "", match: 0 });
    const p = popup();
    const anchor = control();
    if (p && anchor) rt.layer = openAnchored(p, anchor, { onDismiss: () => close() });
  };

  const nodeAt = (col: number, value: string) => {
    const s = host.state();
    const list = columnsFor(host.config(), s)[col];
    return list?.find((o) => o.value === value) ?? null;
  };
  /** Abre la rama activa en la columna siguiente; `enter` lleva la opción activa a su primer hijo. */
  const expand = (col: number, node: CascaderOption, enter: boolean) => {
    const c = host.config();
    const s = host.state();
    const path = [...s.trail.slice(0, col), node.value];
    if (!isBranch(node, path, s.loaded, lazy(c))) return false;
    const kids = childrenOf(node, path, s.loaded);
    const first = kids?.find((k) => !k.disabled) ?? kids?.[0];
    host.update({
      trail: path,
      active: enter && first ? { col: col + 1, value: first.value } : { col, value: node.value },
    });
    if (!kids) load(root, host, node, path, enter);
    return true;
  };
  const choose = (col: number, node: CascaderOption) => {
    const c = host.config();
    const s = host.state();
    if (node.disabled) return;
    const path = [...s.trail.slice(0, col), node.value];
    const branch = isBranch(node, path, s.loaded, lazy(c));
    if (c.multiple) {
      const shape = cascaderShape(c.options, s.loaded);
      emitValue(host, pathsOf(toggleValue(shape, keysOf(s.paths), pathKey(path), c.showCheckedStrategy)));
      host.update({ active: { col, value: node.value } });
      return;
    }
    if (branch) {
      if (c.changeOnSelect) emitValue(host, [path]);
      expand(col, node, narrow());
      return;
    }
    emitValue(host, [path]);
    close();
  };
  const chooseMatch = (index: number) => {
    const c = host.config();
    const s = host.state();
    const m = matches(c, s)[index];
    if (!m || m.disabled) return;
    if (c.multiple) {
      const shape = cascaderShape(c.options, s.loaded);
      emitValue(host, pathsOf(toggleValue(shape, keysOf(s.paths), pathKey(m.path), c.showCheckedStrategy)));
      return;
    }
    emitValue(host, [m.path]);
    close();
  };
  const back = () => {
    const s = host.state();
    const columns = columnsFor(host.config(), s).length;
    const cur = currentColumn(columns, s);
    if (cur <= 0) return;
    host.update({ active: { col: cur - 1, value: s.trail[cur - 1]! }, trail: s.trail.slice(0, cur) });
  };

  const keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (!target.matches(".z-cascader__input")) return;
    const c = host.config();
    const s = host.state();
    if (c.disabled) return;
    const key = logicalKey(event.key, target);
    // Varias: con el campo vacío, Retroceso quita la última.
    if (key === "Backspace" && c.multiple && !(input()?.value ?? "") && s.paths.length) {
      event.preventDefault();
      emitValue(host, s.paths.slice(0, -1));
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
    const searching = Boolean(c.searchable && s.query.trim());
    if (searching) {
      const found = matches(c, s);
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        if (found.length) host.update({ match: (s.match + (key === "ArrowDown" ? 1 : found.length - 1)) % found.length });
      } else if (key === "Enter" && !event.isComposing) {
        event.preventDefault();
        chooseMatch(s.match);
      } else if (key === "Escape") {
        event.preventDefault();
        setQuery("");
      }
      return;
    }
    const columns = columnsFor(c, s);
    const at = s.active ?? { col: 0, value: columns[0]?.[0]?.value ?? "" };
    const list = columns[at.col] ?? [];
    const index = list.findIndex((o) => o.value === at.value);
    const move = (i: number) => {
      const next = list[Math.max(0, Math.min(list.length - 1, i))];
      if (next) host.update({ active: { col: at.col, value: next.value }, trail: s.trail.slice(0, at.col) });
    };
    const node = list[index];
    switch (key) {
      case "ArrowDown":
        move(index + 1);
        break;
      case "ArrowUp":
        move(index < 0 ? list.length - 1 : index - 1);
        break;
      case "Home":
        if (c.searchable && (input()?.value ?? "")) return;
        move(0);
        break;
      case "End":
        if (c.searchable && (input()?.value ?? "")) return;
        move(list.length - 1);
        break;
      case "ArrowRight":
        if (!node || node.disabled || !expand(at.col, node, true)) return;
        break;
      case "ArrowLeft":
        if (at.col === 0) return;
        host.update({ active: { col: at.col - 1, value: s.trail[at.col - 1]! }, trail: s.trail.slice(0, at.col) });
        break;
      case "Enter":
        if (event.isComposing) return;
        if (node) {
          const path = [...s.trail.slice(0, at.col), node.value];
          if (!c.multiple && !c.changeOnSelect && isBranch(node, path, s.loaded, lazy(c))) expand(at.col, node, true);
          else choose(at.col, node);
        }
        break;
      case "Escape":
        // La capa (./anchored) cierra.
        return;
      case "Tab":
        close();
        return;
      default: {
        if (c.searchable || !isPrintable(event)) return;
        const hit = rt.typeahead(
          list.map((o) => o.label),
          event.key,
          index,
        );
        if (hit >= 0) move(hit);
      }
    }
    event.preventDefault();
  };

  const setQuery = (text: string) => {
    const field = input();
    if (field && field.value !== text) field.value = text;
    host.update({ query: text, match: 0 });
  };
  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (!target.matches(".z-cascader__input") || !host.config().searchable) return;
    if (!host.state().open) open();
    host.update({ query: target.value, match: 0 });
    const c = host.config();
    const count = target.value.trim() ? matches(c, host.state()).length : 0;
    if (target.value.trim()) announceIn(root, count ? fill(c.labels.results, { count }) : c.labels.noResults);
  };

  const click = (event: MouseEvent) => {
    const c = host.config();
    if (c.disabled) return;
    const target = event.target as Element;
    const remove = target.closest<HTMLElement>("[data-remove]");
    if (remove) {
      const key = remove.dataset.remove;
      emitValue(
        host,
        host.state().paths.filter((p) => pathKey(p) !== key),
      );
      input()?.focus();
      return;
    }
    if (target.closest("[data-clear]")) {
      emitValue(host, []);
      setQuery("");
      input()?.focus();
      return;
    }
    if (target.closest("[data-back]")) {
      back();
      return;
    }
    const match = target.closest<HTMLElement>("[data-match]");
    if (match) {
      chooseMatch(Number(match.dataset.match));
      return;
    }
    const option = target.closest<HTMLElement>(".z-cascader__option[data-col]");
    if (option) {
      const col = Number(option.dataset.col);
      const node = nodeAt(col, option.dataset.value ?? "");
      if (!node || node.disabled) return;
      const s = host.state();
      const path = [...s.trail.slice(0, col), node.value];
      const branch = isBranch(node, path, s.loaded, lazy(c));
      // Con casillas, la casilla marca y la etiqueta de una rama la abre.
      if (c.multiple && branch && !target.closest(".z-cascader__check")) expand(col, node, narrow());
      else choose(col, node);
      return;
    }
    if (target.closest("[data-toggle]") || target.closest(".z-cascader__control")) {
      if (host.state().open && target.closest("[data-toggle]")) close();
      else open();
      input()?.focus();
    }
  };
  // El foco no sale del campo: pulsar en el panel o en un botón del campo no se lo quita.
  const mousedown = (event: MouseEvent) => {
    const target = event.target as Element;
    if (target.closest(".z-cascader__popup, .z-input__action, .z-tags__remove")) event.preventDefault();
  };
  const hover = (event: MouseEvent) => {
    const option = (event.target as Element).closest?.<HTMLElement>(".z-cascader__option");
    if (!option) return;
    const s = host.state();
    if (option.dataset.match !== undefined) {
      const m = Number(option.dataset.match);
      if (m !== s.match) host.update({ match: m });
      return;
    }
    const col = Number(option.dataset.col);
    const value = option.dataset.value ?? "";
    if (s.active?.col !== col || s.active.value !== value) host.update({ active: { col, value } });
  };
  const invalid = (event: Event) => {
    if ((event.target as HTMLElement).matches?.("[data-native]")) input()?.focus({ preventScroll: false });
  };
  // El navegador enfoca el campo nativo oculto al informar de un error: el foco pasa al control visible.
  const nativeFocus = (event: FocusEvent) => {
    if ((event.target as HTMLElement).matches?.("[data-native]")) input()?.focus();
  };
  const form = root.closest("form");
  const initial = host.state().paths;
  // `form.reset()`: vuelve al valor con el que se montó y lo anuncia (un valor controlado se entera).
  const reset = () =>
    setTimeout(() => {
      host.update({ query: "" });
      emitValue(host, initial);
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
    rt.layer?.close();
    runtimes.delete(root);
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
  const field = root.querySelector<HTMLInputElement>(".z-cascader__input");
  // El texto del campo: lo que se busca (abierto con búsqueda) o la ruta elegida.
  const shown = s.open && c.searchable ? s.query : displayText(c, s);
  if (field && field.value !== shown) field.value = shown;
  syncNatives(
    root,
    s.paths.map((p) => pathText(p, c.separator)),
  );
  const rt = runtimes.get(root);
  if (s.open) {
    rt?.layer?.reposition();
    // La opción activa a la vista.
    const id = field?.getAttribute("aria-activedescendant");
    if (id) root.ownerDocument.getElementById(id)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  } else if (rt?.layer) {
    rt.layer.close();
    rt.layer = null;
  }
}

export const cascaderWidget: Widget<CascaderProps, Config, State> = {
  root: "z-cascader",
  configure: (p) => ({
    ...p,
    options: p.options ?? [],
    labels: { ...CASCADER_LABELS, ...p.labels },
    displaySeparator: p.displaySeparator ?? " / ",
    separator: p.separator ?? "/",
    showCheckedStrategy: p.showCheckedStrategy ?? "parent",
    size: p.size ?? "md",
  }),
  initial: (c) => ({
    open: false,
    paths: toPaths(c.value ?? c.defaultValue, c.multiple),
    prop: c.value,
    trail: [],
    active: null,
    query: "",
    match: 0,
    loaded: {},
    loading: [],
    known: {},
  }),
  control: (c, s) => (c.value !== undefined && c.value !== s.prop ? { ...s, paths: toPaths(c.value, c.multiple), prop: c.value } : s),
  tree,
  attach,
  after,
  fromDom(el, json) {
    const d = el.dataset;
    const separator = d.separator ?? "/";
    const multiple = d.multiple !== undefined;
    const raw = json.value ?? (d.value ? parsePath(d.value, separator) : undefined);
    return {
      options: Array.isArray(json.options) ? (json.options as CascaderOption[]) : [],
      defaultValue: Array.isArray(raw) ? (raw as string[]) : undefined,
      multiple,
      searchable: d.searchable !== undefined,
      changeOnSelect: d.changeOnSelect !== undefined,
      clearable: d.clearable !== undefined,
      disabled: d.disabled !== undefined,
      required: d.required !== undefined,
      name: d.name,
      separator,
      placeholder: d.placeholder,
      size: d.size === "sm" || d.size === "lg" ? d.size : undefined,
      showCheckedStrategy: d.strategy === "all" || d.strategy === "child" ? d.strategy : undefined,
      levelLabels: Array.isArray(json.levelLabels) ? (json.levelLabels as string[]) : undefined,
      labels: json.labels as Partial<CascaderLabels> | undefined,
      ariaLabel: d.label,
    };
  },
};
