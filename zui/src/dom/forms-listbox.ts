// Select no nativo y Combobox: campo + popup `.z-liquid.z-listbox[popover]` enlazado por aria-controls.
// Select: el foco entra en la lista (foco itinerante, como en React). Combobox: el foco se queda en el campo y la
// opción activa va por aria-activedescendant.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { createAsyncOptions, type AsyncLoader, type AsyncOptions, type AsyncState } from "../core/async-options";
import { step } from "../core/roving";
import { createTypeahead, isPrintable as printable } from "../core/typeahead";
import { all, emit, flag, fold, hidePopup, inDom, isOpen, ownerOf, popupFor, reposition, showPopup } from "./forms-popup";
import { cloneChildren, setMarkup, type Listen } from "./shared";

registerIcons([check, xMark]);

const ICON_SIZE: Record<string, number> = { sm: 14, md: 16, lg: 18 };
const SELECT = ".z-select:not(.z-datepicker)";
const COMBO = ".z-combobox";

/* ---------- Lista ---------- */

const optionsOf = (popup: Element) => [...popup.querySelectorAll<HTMLElement>(".z-listbox__option")];
const usable = (option: HTMLElement) =>
  !option.hidden && !option.hasAttribute("data-disabled") && option.getAttribute("aria-disabled") !== "true";
const labelOf = (option: HTMLElement) =>
  option.dataset.label ?? (option.querySelector(".z-listbox__text") ?? option).textContent?.trim() ?? "";
const optionValue = (option: HTMLElement) => option.dataset.value ?? labelOf(option);
const activeOf = (popup: Element) => popup.querySelector<HTMLElement>(".z-listbox__option[data-highlighted]");

function mark(popup: Element, value: string | null | ReadonlyArray<string>): HTMLElement | undefined {
  let selected: HTMLElement | undefined;
  for (const option of optionsOf(popup)) {
    const on = value !== null && (typeof value === "string" ? optionValue(option) === value : value.includes(optionValue(option)));
    if (on) selected ??= option;
    option.dataset.state = on ? "checked" : "unchecked";
    option.setAttribute("aria-selected", String(on));
  }
  return selected;
}

function setActive(popup: Element, option: HTMLElement | undefined, focus: boolean, scroll = true): void {
  for (const other of popup.querySelectorAll("[data-highlighted]")) if (other !== option) other.removeAttribute("data-highlighted");
  if (!option) return;
  option.setAttribute("data-highlighted", "");
  if (scroll) option.scrollIntoView({ block: "nearest" });
  if (focus) option.focus({ preventScroll: true });
}

// Búsqueda por letra: lo tecleado en un segundo forma el prefijo; repetir una letra recorre las que empiezan por ella.
const search = createTypeahead();

function typeahead(list: HTMLElement[], key: string, current: HTMLElement | null): HTMLElement | undefined {
  const index = search(list.map(labelOf), key, current ? list.indexOf(current) : -1);
  return index < 0 ? undefined : list[index];
}

/* ---------- Select ---------- */
// Varias (data-multiple): data-value es la lista separada por comas; elegir marca o desmarca sin cerrar, y
// data-max-selected deshabilita el resto al llegar al tope. z:change { value: string[] }.

const isMultiSelect = (select: HTMLElement) => select.hasAttribute("data-multiple");
const multiValue = (select: HTMLElement) => (select.dataset.value ?? "").split(",").filter(Boolean);

function syncMulti(select: HTMLElement, values: ReadonlyArray<string>): void {
  const control = selectControl(select);
  const popup = popupFor(control);
  if (!control || !popup) return;
  mark(popup, values);
  const max = Number(select.dataset.maxSelected) || Infinity;
  for (const option of optionsOf(popup)) {
    option.tabIndex = -1;
    const own = option.hasAttribute("data-own-disabled") || (option.hasAttribute("data-disabled") && !option.hasAttribute("data-max-off"));
    if (own) option.setAttribute("data-own-disabled", "");
    const off = own || (values.length >= max && !values.includes(optionValue(option)));
    flag(option, "data-disabled", off);
    flag(option, "aria-disabled", off, "true");
    flag(option, "data-max-off", off && !own);
  }
  const labels = optionsOf(popup)
    .filter((option) => values.includes(optionValue(option)))
    .map(labelOf);
  const text = control.querySelector<HTMLElement>(".z-select__value");
  if (text) text.textContent = labels.length ? labels.join(", ") : (select.dataset.placeholder ?? "");
  let count = control.querySelector<HTMLElement>(".z-select__count");
  if (labels.length > 1) {
    if (!count) {
      count = document.createElement("span");
      count.className = "z-select__count";
      count.setAttribute("aria-hidden", "true");
      control.append(count);
    }
    count.textContent = String(labels.length);
  } else count?.remove();
  flag(control, "data-placeholder", labels.length === 0);
  select.dataset.value = values.join(",");
  const native = select.querySelector<HTMLSelectElement>("select.z-native-input");
  if (native) for (const option of native.options) option.selected = values.includes(option.value);
  if (!control.dataset.state) control.dataset.state = "closed";
}

const selectControl = (select: Element) => select.querySelector<HTMLButtonElement>("button.z-select__control");
const selectValue = (select: HTMLElement) =>
  select.dataset.value ?? select.querySelector<HTMLInputElement>('input[type="hidden"]')?.value ?? "";

function syncSelect(select: HTMLElement, value: string): void {
  const control = selectControl(select);
  const popup = popupFor(control);
  if (!control || !popup) return;
  const selected = mark(popup, value === "" ? null : value);
  for (const option of optionsOf(popup)) option.tabIndex = -1;
  const text = control.querySelector<HTMLElement>(".z-select__value");
  if (text) text.textContent = selected ? labelOf(selected) : (select.dataset.placeholder ?? value);
  flag(control, "data-placeholder", !selected && value === "");
  // Icono de la opción elegida, delante del texto.
  control.querySelector(".z-select__icon")?.remove();
  const icon = selected?.querySelector(".z-listbox__icon");
  if (icon) {
    const copy = document.createElement("span");
    copy.className = "z-select__icon";
    cloneChildren(icon, copy);
    control.prepend(copy);
  }
  select.dataset.value = value;
  const hidden = select.querySelector<HTMLInputElement>('input[type="hidden"]');
  if (hidden) hidden.value = value;
  if (!control.dataset.state) control.dataset.state = "closed";
}

/** Fija el valor de un Select (`""` lo vacía) y emite z:change si cambia. */
export function setSelectValue(select: HTMLElement, value: string | ReadonlyArray<string>): void {
  if (isMultiSelect(select)) {
    const values = typeof value === "string" ? value.split(",").filter(Boolean) : [...value];
    const before = multiValue(select).join(",");
    syncMulti(select, values);
    if (values.join(",") !== before) emit(select, "change", { value: values });
    return;
  }
  if (typeof value !== "string") value = value[0] ?? "";
  const before = selectValue(select);
  syncSelect(select, value);
  if (value !== before) emit(select, "change", { value });
}

/* Búsqueda dentro del Select (data-searchable, o con setSelectLoader): un campo arriba de la lista que conserva el foco
   y señala la opción activa con aria-activedescendant; filtra por etiqueta y oculta los grupos sin coincidencias. */

const searchOf = (popup: Element) => popup.querySelector<HTMLInputElement>(":scope > .z-listbox__search input");

/** Crea el campo de búsqueda del popup de un Select (una vez). */
export function prepareSelectSearch(select: HTMLElement): void {
  const popup = popupFor(selectControl(select));
  if (!popup || searchOf(popup)) return;
  const viewport = popup.querySelector<HTMLElement>(".z-listbox__viewport");
  if (viewport && !viewport.id) viewport.id = `z-listbox-${++listSeq}`;
  optionsOf(popup).forEach((option, i) => {
    if (!option.id) option.id = `${viewport?.id ?? "z-listbox"}-option-${i}`;
  });
  const label = select.dataset.searchPlaceholder ?? "Search";
  const wrap = document.createElement("div");
  wrap.className = "z-listbox__search";
  const field = document.createElement("span");
  field.className = "z-input z-input--search";
  field.dataset.size = "sm";
  const input = document.createElement("input");
  input.className = "z-input__control";
  input.type = "search";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-label", label);
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "true");
  if (viewport) input.setAttribute("aria-controls", viewport.id);
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = label;
  field.append(input);
  wrap.append(field);
  popup.prepend(wrap);
  popup.setAttribute("data-searchable", "");
  select.setAttribute("data-searchable", "");
}

function setSelectActive(popup: HTMLElement, option: HTMLElement | undefined, scroll = true): void {
  const field = searchOf(popup);
  setActive(popup, option, !field, scroll);
  if (field) flag(field, "aria-activedescendant", Boolean(option), option?.id);
}

function filterSelect(select: HTMLElement, popup: HTMLElement, query: string): void {
  const engine = selectLoaders.get(select);
  if (engine) {
    engine.search(query);
    return;
  }
  const q = fold(query.trim());
  for (const option of optionsOf(popup)) option.hidden = q !== "" && !fold(labelOf(option)).includes(q);
  for (const group of popup.querySelectorAll<HTMLElement>(".z-listbox__group"))
    group.hidden = !group.querySelector(".z-listbox__option:not([hidden])");
  const none = optionsOf(popup).every((option) => option.hidden);
  let status = popup.querySelector<HTMLElement>(":scope > .z-listbox__empty:not([data-async])");
  if (none && !status) {
    status = document.createElement("div");
    status.className = "z-listbox__empty";
    status.setAttribute("role", "status");
    popup.append(status);
  }
  if (none && status) status.textContent = select.dataset.emptyText ?? "No options";
  else status?.remove();
  setSelectActive(popup, optionsOf(popup).filter(usable)[0]);
}

const selectLoaders = new WeakMap<HTMLElement, AsyncOptions<ComboboxOption>>();

/**
 * Opciones del servidor para un Select: activa la búsqueda dentro de la lista y pide con lo escrito (antirrebote,
 * cancelación de la anterior y páginas al llegar al final), como el Combobox. La elegida conserva su etiqueta.
 */
export function setSelectLoader(select: HTMLElement, load: AsyncLoader<ComboboxOption>, options: AsyncLoaderOptions = {}): void {
  prepareSelectSearch(select);
  const popup = popupFor(selectControl(select));
  const viewport = popup?.querySelector<HTMLElement>(".z-listbox__viewport");
  if (!popup || !viewport) return;
  selectLoaders.get(select)?.abort();
  const engine = createAsyncOptions<ComboboxOption>({
    load,
    debounce: options.debounce,
    minLength: options.minLength,
    onChange(state) {
      const field = searchOf(popup);
      if (field) flag(field, "aria-busy", state.status === "loading" || state.loadingMore, "true");
      flag(viewport, "aria-busy", state.status === "loading" || state.loadingMore, "true");
      if (state.status === "ready") {
        const size = ICON_SIZE[popup.dataset.size ?? "md"] ?? 16;
        viewport.replaceChildren(
          ...state.options.map((option, i) => {
            const el = buildOption(option, size);
            el.id = `${viewport.id}-option-${i}`;
            el.tabIndex = -1;
            return el;
          }),
        );
        mark(popup, isMultiSelect(select) ? multiValue(select) : selectValue(select) || null);
        deferLongList(viewport, select);
        if (!activeOf(popup)) setSelectActive(popup, optionsOf(popup).filter(usable)[0], false);
      }
      let status = popup.querySelector<HTMLElement>(":scope > .z-listbox__empty:not([data-async])");
      const empty = state.options.length === 0 && state.status !== "error" && state.status !== "idle";
      if (empty && !status) {
        status = document.createElement("div");
        status.className = "z-listbox__empty";
        status.setAttribute("role", "status");
        popup.append(status);
      }
      if (empty && status)
        status.textContent =
          state.status === "loading" ? (select.dataset.loadingText ?? "Loading") : (select.dataset.emptyText ?? "No options");
      else status?.remove();
      paintAsyncStatus(popup, state, select);
    },
  });
  selectLoaders.set(select, engine);
  viewport.addEventListener(
    "scroll",
    () => {
      if (nearEnd(viewport)) engine.more();
    },
    { passive: true },
  );
  popup.addEventListener("click", (event) => {
    if ((event.target as Element).closest("[data-retry]")) engine.retry();
  });
}

function openSelect(select: HTMLElement, start: "selected" | "first" | "last" = "selected"): void {
  const control = selectControl(select);
  const popup = popupFor(control);
  if (!control || !popup || control.disabled || isOpen(popup)) return;
  const field = searchOf(popup);
  showPopup(popup, select, control, () => {
    control.dataset.state = "closed";
    setActive(popup, undefined, false);
    selectLoaders.get(select)?.abort();
    if (field?.value) {
      field.value = "";
      if (!selectLoaders.has(select)) filterSelect(select, popup, "");
    }
  });
  control.dataset.state = "open";
  if (field) {
    field.focus({ preventScroll: true });
    const engine = selectLoaders.get(select);
    if (engine && engine.state().status === "idle") engine.search("", true);
  }
  const list = optionsOf(popup).filter(usable);
  const selected = list.find((option) => option.dataset.state === "checked");
  setSelectActive(popup, start === "last" ? list[list.length - 1] : start === "selected" ? (selected ?? list[0]) : list[0]);
}

function closeSelect(select: HTMLElement, refocus = true): void {
  const popup = popupFor(selectControl(select));
  if (!popup || !isOpen(popup)) return;
  const inside = popup.contains(document.activeElement);
  hidePopup(popup);
  if (refocus && inside) selectControl(select)?.focus({ preventScroll: true });
}

function chooseSelect(select: HTMLElement, option: HTMLElement): void {
  if (!usable(option)) return;
  if (isMultiSelect(select)) {
    const values = multiValue(select);
    const value = optionValue(option);
    setSelectValue(select, values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
    const popup = popupFor(selectControl(select));
    if (popup && searchOf(popup)) searchOf(popup)?.focus({ preventScroll: true });
    else option.focus({ preventScroll: true });
    return;
  }
  closeSelect(select);
  setSelectValue(select, optionValue(option));
}

function onSelectControlKey(select: HTMLElement, event: KeyboardEvent): void {
  const popup = popupFor(selectControl(select));
  if (!popup || isOpen(popup)) return;
  if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key) || (event.key === " " && !search.pending())) {
    event.preventDefault();
    openSelect(select, "selected");
  } else if (printable(event)) {
    // Cerrado: la letra cambia el valor sin abrir la lista (en múltiple, la abre).
    event.preventDefault();
    if (isMultiSelect(select)) {
      openSelect(select, "selected");
      return;
    }
    const list = optionsOf(popup).filter(usable);
    const next = typeahead(list, event.key, list.find((option) => option.dataset.state === "checked") ?? null);
    if (next) setSelectValue(select, optionValue(next));
  }
}

function onSelectListKey(select: HTMLElement, popup: HTMLElement, event: KeyboardEvent): void {
  const list = optionsOf(popup).filter(usable);
  const current = activeOf(popup);
  const field = searchOf(popup);
  const inSearch = event.target === field;
  // En el campo de búsqueda, Inicio y Fin mueven el cursor del texto.
  const next = step(list, current, inSearch && (event.key === "Home" || event.key === "End") ? "" : event.key, false);
  if (next) {
    event.preventDefault();
    setSelectActive(popup, next);
    if (next === list[list.length - 1]) selectLoaders.get(select)?.more();
  } else if (event.key === "Enter" || (event.key === " " && !inSearch && !search.pending())) {
    event.preventDefault();
    if (!current && selectLoaders.get(select)?.state().status === "error") selectLoaders.get(select)?.retry();
    else if (current) chooseSelect(select, current);
  } else if (event.key === "Tab") {
    // El tabulador no sale de la lista abierta (igual que en React).
    event.preventDefault();
  } else if (!inSearch && printable(event)) {
    event.preventDefault();
    if (field) field.focus();
    else setActive(popup, typeahead(list, event.key, current) ?? current ?? undefined, true);
  }
}

/* ---------- Combobox ---------- */

export interface ComboboxOption {
  value: string;
  label: string;
  /** Nombre de icono: se dibuja con `<z-icon>`. */
  icon?: string;
  disabled?: boolean;
}

interface ComboState {
  /** La persona está escribiendo: el campo no muestra la etiqueta de la selección. */
  editing: boolean;
  /** Etiqueta de la selección; se conserva aunque cambien las opciones. */
  label: string;
}

const combos = new WeakMap<HTMLElement, ComboState>();
let listSeq = 0;

function comboParts(combo: HTMLElement) {
  const input = combo.querySelector<HTMLInputElement>("input.z-input__control");
  const popup = popupFor(input);
  return {
    input,
    popup,
    viewport: popup?.querySelector<HTMLElement>(".z-listbox__viewport") ?? null,
    toggle: combo.querySelector<HTMLButtonElement>(".z-combobox__toggle"),
    clear: combo.querySelector<HTMLButtonElement>(".z-input__action:not(.z-combobox__toggle)"),
    hidden: combo.querySelector<HTMLInputElement>('input[type="hidden"]'),
  };
}

const comboValue = (combo: HTMLElement): string | null => combo.dataset.value ?? null;

function comboState(combo: HTMLElement): ComboState {
  let state = combos.get(combo);
  if (!state) {
    state = { editing: false, label: "" };
    combos.set(combo, state);
  }
  return state;
}

function setComboActive(combo: HTMLElement, option: HTMLElement | undefined, scroll = true): void {
  const { input, popup } = comboParts(combo);
  if (!input || !popup) return;
  setActive(popup, option, false, scroll);
  flag(input, "aria-activedescendant", Boolean(option), option?.id);
}

/** Aplica el filtro, el estado vacío o de carga y la visibilidad del botón de limpiar. */
function refreshCombo(combo: HTMLElement): void {
  const { input, popup, viewport, clear } = comboParts(combo);
  if (!input || !popup) return;
  const state = comboState(combo);
  const text = fold(input.value.trim());
  const filtering = state.editing && text !== "" && combo.dataset.filter !== "false";
  const options = optionsOf(popup);
  options.forEach((option, index) => {
    if (!option.id) option.id = `${viewport?.id || popup.id || "z-listbox"}-option-${index}`;
    option.hidden = filtering && !fold(labelOf(option)).includes(text);
  });
  const none = options.every((option) => option.hidden);
  if (viewport) viewport.hidden = none;
  for (const group of popup.querySelectorAll<HTMLElement>(".z-listbox__group"))
    group.hidden = !group.querySelector(".z-listbox__option:not([hidden])");
  const loading = combo.hasAttribute("data-loading");
  let status = popup.querySelector<HTMLElement>(".z-listbox__empty");
  if (none) {
    if (!status) {
      status = document.createElement("div");
      status.className = "z-listbox__empty";
      status.setAttribute("role", "status");
      popup.append(status);
    }
    status.textContent = loading ? (combo.dataset.loadingText ?? "Loading") : (combo.dataset.emptyText ?? "No results");
    flag(status, "data-loading", loading, "true");
  } else status?.remove();
  if (clear)
    clear.hidden =
      input.disabled ||
      (comboValue(combo) === null && input.value === "") ||
      (isMultiCombo(combo) && !comboMany(combo).length && input.value === "");
  const active = activeOf(popup);
  if (active && !usable(active)) setComboActive(combo, undefined);
  if (isOpen(popup)) reposition(popup);
}

/** Icono de la selección delante del campo, mientras no se escribe. */
function syncComboIcon(combo: HTMLElement): void {
  const { input, popup } = comboParts(combo);
  combo.querySelector(":scope > .z-input__icon[data-z-selected]")?.remove();
  if (!input || !popup || comboState(combo).editing) return;
  const icon = optionsOf(popup)
    .find((option) => option.dataset.state === "checked")
    ?.querySelector(".z-listbox__icon");
  if (!icon) return;
  const copy = document.createElement("span");
  copy.className = "z-input__icon";
  copy.setAttribute("data-z-selected", "");
  cloneChildren(icon, copy);
  combo.prepend(copy);
}

/* Varias (data-multiple): data-value es la lista separada por comas y cada elegida es una pieza .z-tags__tag dentro
   del campo; elegir no cierra la lista y Retroceso con el campo vacío quita la última. Texto libre (data-custom): lo
   escrito vale como valor al pulsar Intro sin opción activa o al salir. */
const isMultiCombo = (combo: HTMLElement) => combo.hasAttribute("data-multiple");
const comboMany = (combo: HTMLElement) => (combo.dataset.value ?? "").split(",").filter(Boolean);

function paintMany(combo: HTMLElement, values: ReadonlyArray<string>): void {
  const { input, popup } = comboParts(combo);
  if (!input || !popup) return;
  combo.dataset.value = values.join(",");
  mark(popup, values);
  const max = Number(combo.dataset.maxSelected) || Infinity;
  for (const option of optionsOf(popup)) {
    const own = option.hasAttribute("data-own-disabled") || (option.hasAttribute("data-disabled") && !option.hasAttribute("data-max-off"));
    if (own) option.setAttribute("data-own-disabled", "");
    const off = own || (values.length >= max && !values.includes(optionValue(option)));
    flag(option, "data-disabled", off);
    flag(option, "aria-disabled", off, "true");
    flag(option, "data-max-off", off && !own);
  }
  for (const chip of combo.querySelectorAll(":scope > .z-tags__tag")) chip.remove();
  const size = combo.dataset.size === "sm" ? 12 : 14;
  for (const value of values) {
    const option = optionsOf(popup).find((item) => optionValue(item) === value);
    const label = option ? labelOf(option) : value;
    const chip = document.createElement("span");
    chip.className = "z-tags__tag";
    chip.dataset.value = value;
    const text = document.createElement("span");
    text.className = "z-tags__text";
    text.textContent = label;
    chip.append(text);
    if (!input.disabled) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "z-tags__remove";
      remove.tabIndex = -1;
      const name = (combo.dataset.removeLabel ?? "Remove {label}").replace("{label}", label);
      remove.setAttribute("aria-label", name);
      remove.title = name;
      setMarkup(remove, iconSvg("x-mark", { size }));
      chip.append(remove);
    }
    combo.insertBefore(chip, input);
  }
  const fieldName = combo.dataset.name;
  if (fieldName) {
    for (const old of combo.querySelectorAll(':scope > input[type="hidden"]')) old.remove();
    for (const value of values) {
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = fieldName;
      hidden.value = value;
      combo.append(hidden);
    }
  }
}

function setMany(combo: HTMLElement, values: ReadonlyArray<string>): void {
  const before = comboMany(combo).join(",");
  paintMany(combo, values);
  if (values.join(",") !== before) emit(combo, "change", { value: [...values] });
}

function commitCustomCombo(combo: HTMLElement): void {
  const { input, popup, hidden } = comboParts(combo);
  const state = comboState(combo);
  if (!combo.hasAttribute("data-custom") || !input || !popup || !state.editing) return;
  const typed = input.value.trim();
  const match = optionsOf(popup).find((option) => fold(labelOf(option)) === fold(typed));
  if (match) {
    commitCombo(combo, match);
    return;
  }
  const before = comboValue(combo);
  state.label = typed;
  state.editing = false;
  mark(popup, null);
  if (typed) combo.dataset.value = typed;
  else delete combo.dataset.value;
  if (hidden) hidden.value = typed;
  if ((typed || null) !== before) emit(combo, "change", { value: typed || null, label: null });
}

function commitCombo(combo: HTMLElement, option: HTMLElement | null): void {
  const { popup, hidden } = comboParts(combo);
  if (!popup) return;
  const before = comboValue(combo);
  const value = option ? optionValue(option) : null;
  const state = comboState(combo);
  state.label = option ? labelOf(option) : "";
  if (value === null) delete combo.dataset.value;
  else combo.dataset.value = value;
  if (hidden) hidden.value = value ?? "";
  mark(popup, value);
  if (value !== before) emit(combo, "change", { value, label: option ? state.label : null });
}

function openCombo(combo: HTMLElement, start: "selected" | "first" | "last"): void {
  const { input, popup, toggle } = comboParts(combo);
  if (!input || !popup || input.disabled) return;
  if (!isOpen(popup)) {
    showPopup(
      popup,
      combo,
      input,
      () => {
        // Al cerrar, el campo vuelve a mostrar la selección.
        const state = comboState(combo);
        state.editing = false;
        input.value = state.label;
        combo.dataset.state = "closed";
        toggle?.setAttribute("aria-expanded", "false");
        setComboActive(combo, undefined);
        loaders.get(combo)?.abort();
        refreshCombo(combo);
        syncComboIcon(combo);
      },
      false,
    );
    combo.dataset.state = "open";
    toggle?.setAttribute("aria-expanded", "true");
    // Del servidor: al abrir sin resultados, se piden ya.
    const engine = loaders.get(combo);
    if (engine && engine.state().status === "idle") engine.search(comboState(combo).editing ? input.value : "", true);
  }
  refreshCombo(combo);
  const list = optionsOf(popup).filter(usable);
  const selected = list.find((option) => option.dataset.state === "checked");
  setComboActive(combo, start === "last" ? list[list.length - 1] : start === "selected" ? (selected ?? list[0]) : list[0]);
}

function closeCombo(combo: HTMLElement): void {
  const { popup } = comboParts(combo);
  if (popup) hidePopup(popup);
}

function chooseCombo(combo: HTMLElement, option: HTMLElement): void {
  if (!usable(option)) return;
  if (isMultiCombo(combo)) {
    const values = comboMany(combo);
    const value = optionValue(option);
    setMany(combo, values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
    const { input } = comboParts(combo);
    if (input) input.value = "";
    comboState(combo).editing = false;
    refreshCombo(combo);
    input?.focus();
    return;
  }
  commitCombo(combo, option);
  // Cerrado no ejecuta el cierre: el texto se fija aquí también.
  const { input } = comboParts(combo);
  const state = comboState(combo);
  state.editing = false;
  if (input) input.value = state.label;
  closeCombo(combo);
  refreshCombo(combo);
  syncComboIcon(combo);
}

function clearCombo(combo: HTMLElement): void {
  const { input } = comboParts(combo);
  if (!input) return;
  if (isMultiCombo(combo)) {
    setMany(combo, []);
    input.value = "";
    refreshCombo(combo);
    input.focus();
    return;
  }
  commitCombo(combo, null);
  comboState(combo).editing = false;
  input.value = "";
  emit(combo, "input", { value: "" });
  refreshCombo(combo);
  syncComboIcon(combo);
  input.focus();
}

function onComboInput(combo: HTMLElement, input: HTMLInputElement): void {
  const { popup } = comboParts(combo);
  if (!popup) return;
  comboState(combo).editing = true;
  syncComboIcon(combo);
  emit(combo, "input", { value: input.value });
  // Vaciar el campo quita la selección.
  if (input.value === "" && comboValue(combo) !== null) commitCombo(combo, null);
  loaders.get(combo)?.search(input.value);
  openCombo(combo, "first");
}

function onComboKey(combo: HTMLElement, event: KeyboardEvent): void {
  const { popup } = comboParts(combo);
  if (!popup) return;
  const shown = isOpen(popup);
  const list = optionsOf(popup).filter(usable);
  const active = shown ? activeOf(popup) : null;
  switch (event.key) {
    case "ArrowDown":
    case "ArrowUp":
      event.preventDefault();
      if (!shown) openCombo(combo, event.key === "ArrowDown" ? "selected" : "last");
      else {
        const next = step(list, active, event.key, true);
        setComboActive(combo, next);
        if (next && next === list[list.length - 1]) loaders.get(combo)?.more();
      }
      break;
    case "Home":
    case "End":
      if (!shown) return;
      event.preventDefault();
      setComboActive(combo, step(list, active, event.key, true));
      break;
    case "Enter":
      if (event.isComposing) return;
      if (!shown) {
        if (combo.hasAttribute("data-custom") && comboState(combo).editing) {
          event.preventDefault();
          commitCustomCombo(combo);
        }
        return;
      }
      // Con la lista abierta, Enter elige y no envía el formulario.
      event.preventDefault();
      if (!active && loaders.get(combo)?.state().status === "error") loaders.get(combo)?.retry();
      else if (active) chooseCombo(combo, active);
      else if (combo.hasAttribute("data-custom")) {
        commitCustomCombo(combo);
        closeCombo(combo);
      }
      break;
    case "Backspace": {
      const { input } = comboParts(combo);
      if (isMultiCombo(combo) && input?.value === "" && comboMany(combo).length) {
        event.preventDefault();
        setMany(combo, comboMany(combo).slice(0, -1));
        refreshCombo(combo);
      }
      break;
    }
    default:
  }
}

export function buildOption(option: ComboboxOption, size: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "z-listbox__option";
  el.setAttribute("role", "option");
  el.dataset.value = option.value;
  if (option.disabled) {
    el.setAttribute("data-disabled", "");
    el.setAttribute("aria-disabled", "true");
  }
  if (option.icon) {
    const icon = document.createElement("span");
    icon.className = "z-listbox__icon";
    const glyph = document.createElement("z-icon");
    glyph.setAttribute("name", option.icon);
    glyph.setAttribute("size", String(size));
    icon.append(glyph);
    el.append(icon);
  }
  const text = document.createElement("span");
  text.className = "z-listbox__text";
  text.textContent = option.label;
  const tick = document.createElement("span");
  tick.className = "z-listbox__check";
  setMarkup(tick, iconSvg("check", { size }));
  el.append(text, tick);
  return el;
}

/** Reemplaza las opciones de un Combobox (carga asíncrona). Conserva la selección y su etiqueta. */
export function setComboboxOptions(combo: HTMLElement, options: ReadonlyArray<ComboboxOption>): void {
  const { popup, viewport } = comboParts(combo);
  if (!popup || !viewport) return;
  const size = ICON_SIZE[popup.dataset.size ?? "md"] ?? 16;
  viewport.replaceChildren(...options.map((option) => buildOption(option, size)));
  mark(popup, comboValue(combo));
  deferLongList(viewport, combo);
  refreshCombo(combo);
  if (isOpen(popup)) setComboActive(combo, optionsOf(popup).filter(usable)[0]);
}

/** Estado de carga: anillo en el campo, aria-busy y texto de carga mientras no haya opciones. */
export function setComboboxLoading(combo: HTMLElement, loading: boolean): void {
  const { input, viewport, toggle } = comboParts(combo);
  flag(combo, "data-loading", loading);
  if (input) flag(input, "aria-busy", loading, "true");
  if (viewport) flag(viewport, "aria-busy", loading, "true");
  let ring = combo.querySelector<HTMLElement>(":scope > .z-input__trailing[data-z-loading]");
  if (loading && !ring) {
    ring = document.createElement("span");
    ring.className = "z-input__trailing";
    ring.setAttribute("data-z-loading", "");
    const spinner = document.createElement("span");
    spinner.className = "z-input__spinner";
    spinner.setAttribute("aria-hidden", "true");
    ring.append(spinner);
    const before = combo.querySelector(":scope > .z-input__action") ?? toggle;
    combo.insertBefore(ring, before);
  } else if (!loading) ring?.remove();
  refreshCombo(combo);
}

/** Fija el valor de un Combobox (`null` lo vacía) y emite z:change si cambia. */
export function setComboboxValue(combo: HTMLElement, value: string | null): void {
  const { input, popup } = comboParts(combo);
  if (!input || !popup) return;
  const option = value === null ? null : (optionsOf(popup).find((item) => optionValue(item) === value) ?? null);
  commitCombo(combo, option);
  const state = comboState(combo);
  state.editing = false;
  input.value = state.label;
  refreshCombo(combo);
  syncComboIcon(combo);
}

function hydrateCombo(combo: HTMLElement): void {
  const { input, popup, viewport, hidden, toggle } = comboParts(combo);
  if (!input || !popup) return;
  if (isMultiCombo(combo)) {
    if (viewport && !viewport.id) viewport.id = `z-listbox-${++listSeq}`;
    paintMany(combo, comboMany(combo));
    combo.dataset.state = "closed";
    input.setAttribute("aria-expanded", "false");
    toggle?.setAttribute("aria-expanded", "false");
    refreshCombo(combo);
    return;
  }
  if (viewport && !viewport.id) viewport.id = `z-listbox-${++listSeq}`;
  const state = comboState(combo);
  const declared =
    combo.dataset.value ??
    (hidden?.value || null) ??
    optionsOf(popup).find((option) => option.getAttribute("aria-selected") === "true")?.dataset.value ??
    null;
  const selected = mark(popup, declared);
  if (selected) {
    combo.dataset.value = optionValue(selected);
    state.label = labelOf(selected);
    if (hidden) hidden.value = optionValue(selected);
    if (!isOpen(popup)) input.value = state.label;
  }
  if (!isOpen(popup)) {
    combo.dataset.state = "closed";
    input.setAttribute("aria-expanded", "false");
    toggle?.setAttribute("aria-expanded", "false");
  }
  if (combo.hasAttribute("data-loading")) setComboboxLoading(combo, true);
  refreshCombo(combo);
  syncComboIcon(combo);
}

/* ---------- Carga asíncrona y listas largas ---------- */

export interface AsyncLoaderOptions {
  /** Espera tras la última tecla (ms). Por defecto 250. */
  debounce?: number;
  /** Letras mínimas para pedir. */
  minLength?: number;
}

const loaders = new WeakMap<HTMLElement, AsyncOptions<ComboboxOption>>();

/**
 * Estado de una carga asíncrona bajo la lista: el texto de error con el botón de reintentar (`data-retry`) o el de
 * «cargando más». El vacío y la primera carga los pinta cada pieza. Lo comparten Select, Combobox y Listbox.
 */
export function paintAsyncStatus(box: HTMLElement, state: AsyncState<unknown>, owner: HTMLElement): void {
  let status = box.querySelector<HTMLElement>(":scope > .z-listbox__empty[data-async]");
  const failed = state.status === "error";
  if (!failed && !state.loadingMore) {
    status?.remove();
    return;
  }
  if (!status) {
    status = document.createElement("div");
    status.className = "z-listbox__empty";
    status.setAttribute("role", "status");
    status.setAttribute("data-async", "");
    box.append(status);
  }
  flag(status, "data-error", failed);
  flag(status, "data-loading", !failed);
  status.textContent = failed
    ? (owner.dataset.errorText ?? "Couldn't load the options")
    : (owner.dataset.loadingMoreText ?? owner.dataset.loadingText ?? "Loading more");
  if (failed) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "z-btn z-btn--ghost z-listbox__retry";
    retry.dataset.size = "sm";
    retry.setAttribute("data-retry", "");
    retry.textContent = owner.dataset.retryLabel ?? "Retry";
    status.append(" ", retry);
  }
}

/** Marca una lista larga del servidor para que las opciones fuera de la vista no se pinten (content-visibility). */
export function deferLongList(viewport: HTMLElement | null, owner?: HTMLElement | null): void {
  if (!viewport) return;
  const count = viewport.querySelectorAll(".z-listbox__option").length;
  const threshold = owner?.dataset.virtualize === "false" ? Infinity : Number(owner?.dataset.virtualize) || 100;
  viewport.toggleAttribute("data-deferred", count > threshold);
}

/** Pide la página siguiente al llegar cerca del final de la lista. */
function nearEnd(viewport: HTMLElement): boolean {
  return viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 48;
}

/**
 * Opciones del servidor para un Combobox: se piden con lo escrito tras el antirrebote (la petición anterior se
 * cancela con su `signal`), con la consulta vacía al abrir y página a página al llegar al final de la lista si la
 * respuesta trae `hasMore`. Sin filtro local. Textos en el Combobox: data-loading-text, data-empty-text,
 * data-error-text, data-retry-label.
 */
export function setComboboxLoader(combo: HTMLElement, load: AsyncLoader<ComboboxOption>, options: AsyncLoaderOptions = {}): void {
  const { popup, viewport } = comboParts(combo);
  if (!popup || !viewport) return;
  combo.dataset.filter = "false";
  loaders.get(combo)?.abort();
  const engine = createAsyncOptions<ComboboxOption>({
    load,
    debounce: options.debounce,
    minLength: options.minLength,
    onChange(state) {
      if (state.status === "ready" || (state.status === "error" && !state.options.length)) setComboboxOptions(combo, state.options);
      setComboboxLoading(combo, state.status === "loading" || state.loadingMore);
      paintAsyncStatus(popup, state, combo);
      if (state.status === "error" && !state.options.length) popup.querySelector(":scope > .z-listbox__empty:not([data-async])")?.remove();
      deferLongList(viewport, combo);
    },
  });
  loaders.set(combo, engine);
  viewport.addEventListener(
    "scroll",
    () => {
      if (nearEnd(viewport)) engine.more();
    },
    { passive: true },
  );
  popup.addEventListener("click", (event) => {
    if ((event.target as Element).closest("[data-retry]")) engine.retry();
  });
}

/** Quita la carga asíncrona de un Combobox. */
export function clearComboboxLoader(combo: HTMLElement): void {
  loaders.get(combo)?.abort();
  loaders.delete(combo);
}

/* ---------- Delegación ---------- */

/** Campo (Select o Combobox) dueño del popup abierto que contiene `target`. */
function ownerAt(target: Element): { popup: HTMLElement; owner: HTMLElement } | null {
  const popup = target.closest<HTMLElement>(".z-listbox");
  const owner = ownerOf(popup);
  return popup && owner ? { popup, owner } : null;
}

function onClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const option = target.closest<HTMLElement>(".z-listbox__option");
  const at = option && ownerAt(option);
  if (option && at) {
    if (at.owner.matches(COMBO)) chooseCombo(at.owner, option);
    else chooseSelect(at.owner, option);
    return;
  }

  if (!inDom(target)) return;

  const control = target.closest<HTMLButtonElement>(`${SELECT} > button.z-select__control`);
  if (control) {
    const select = control.parentElement!;
    if (isOpen(popupFor(control))) closeSelect(select);
    else openSelect(select);
    return;
  }

  const combo = target.closest<HTMLElement>(COMBO);
  if (!combo) return;
  const { input, popup, toggle, clear } = comboParts(combo);
  if (!input || !popup || input.disabled) return;
  const chipRemove = target.closest<HTMLElement>(".z-tags__remove");
  if (chipRemove && isMultiCombo(combo)) {
    const value = chipRemove.closest<HTMLElement>(".z-tags__tag")?.dataset.value;
    setMany(
      combo,
      comboMany(combo).filter((v) => v !== value),
    );
    refreshCombo(combo);
    input.focus();
    return;
  }
  if (clear?.contains(target)) clearCombo(combo);
  else if (toggle?.contains(target)) {
    if (isOpen(popup)) closeCombo(combo);
    else openCombo(combo, "selected");
    input.focus();
  } else if (target === input && !isOpen(popup)) openCombo(combo, "selected");
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || event.defaultPrevented || typeof event.key !== "string") return;
  const at = ownerAt(target);
  if (at && !at.owner.matches(COMBO)) {
    onSelectListKey(at.owner, at.popup, event);
    return;
  }
  if (!inDom(target)) return;
  const control = target.closest<HTMLElement>(`${SELECT} > button.z-select__control`);
  if (control?.parentElement) {
    onSelectControlKey(control.parentElement, event);
    return;
  }
  if (target.matches(`${COMBO} input.z-input__control`)) onComboKey(target.closest<HTMLElement>(COMBO)!, event);
}

export function setup(on: Listen): void {
  on(document, "click", onClick);
  on(document, "keydown", onKeydown);
  on(document, "input", (event) => {
    const input = event.target as Element;
    if (input.matches?.(`${COMBO} input.z-input__control`) && inDom(input))
      onComboInput(input.closest<HTMLElement>(COMBO)!, input as HTMLInputElement);
    else if (input.matches?.(".z-listbox__search input")) {
      const at = ownerAt(input);
      if (at && !at.owner.matches(COMBO)) filterSelect(at.owner, at.popup, (input as HTMLInputElement).value);
    }
  });
  // Combobox: al perder el foco el campo, la lista se cierra (también si el foco no va a ningún elemento).
  on(document, "focusout", (event) => {
    const input = event.target as Element;
    if (!input.matches?.(`${COMBO} input.z-input__control`)) return;
    const combo = input.closest<HTMLElement>(COMBO)!;
    const { popup } = comboParts(combo);
    const next = event.relatedTarget as Node | null;
    if (next && (combo.contains(next) || popup?.contains(next))) return;
    commitCustomCombo(combo);
    if (popup && isOpen(popup)) closeCombo(combo);
  });
  // El puntero marca la opción activa; en Select además le da el foco.
  on(document, "pointermove", (event) => {
    const option = (event.target as Element).closest?.<HTMLElement>(".z-listbox__option");
    const at = option && ownerAt(option);
    if (!option || !at || !usable(option) || option.hasAttribute("data-highlighted")) return;
    if (at.owner.matches(COMBO)) setComboActive(at.owner, option, false);
    else setSelectActive(at.popup, option, false);
  });
  // Combobox: pulsar en la lista o en sus botones no quita el foco del campo.
  on(document, "mousedown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (ownerAt(target)?.owner.matches(COMBO) || (target.closest(`${COMBO} :is(.z-input__action, .z-tags__remove)`) && inDom(target)))
      event.preventDefault();
  });
}

export function hydrate(root: ParentNode): void {
  for (const select of all(root, SELECT))
    if (selectControl(select) && isMultiSelect(select)) syncMulti(select, multiValue(select));
    else if (selectControl(select))
      syncSelect(
        select,
        selectValue(select) ||
          (optionsOf(popupFor(selectControl(select)) ?? select).find((option) => option.getAttribute("aria-selected") === "true")?.dataset
            .value ??
            ""),
      );
  for (const combo of all(root, COMBO)) hydrateCombo(combo);
  // Listas largas del servidor: las opciones fuera de la vista no se pintan (siguen en el documento).
  for (const select of all(root, SELECT)) {
    const popup = popupFor(selectControl(select));
    deferLongList(popup?.querySelector<HTMLElement>(".z-listbox__viewport") ?? null, select);
    if (select.hasAttribute("data-searchable")) prepareSelectSearch(select);
  }
  for (const combo of all(root, COMBO)) deferLongList(comboParts(combo).viewport, combo);
}
