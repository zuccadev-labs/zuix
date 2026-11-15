// Select no nativo y Combobox: campo + popup `.z-liquid.z-listbox[popover]` enlazado por aria-controls.
// Select: el foco entra en la lista (foco itinerante, como Radix). Combobox: el foco se queda en el campo y la
// opción activa va por aria-activedescendant.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { all, emit, flag, fold, hidePopup, inDom, isOpen, ownerOf, popupFor, reposition, showPopup } from "./forms-popup";

registerIcons([check]);

const ICON_SIZE: Record<string, number> = { sm: 14, md: 16, lg: 18 };
const SELECT = ".z-select:not(.z-datepicker)";
const COMBO = ".z-combobox";

/* ---------- Lista ---------- */

const optionsOf = (popup: Element) => [...popup.querySelectorAll<HTMLElement>(".z-listbox__option")];
const usable = (option: HTMLElement) => !option.hidden && !option.hasAttribute("data-disabled") && option.getAttribute("aria-disabled") !== "true";
const labelOf = (option: HTMLElement) => option.dataset.label ?? (option.querySelector(".z-listbox__text") ?? option).textContent?.trim() ?? "";
const valueOf = (option: HTMLElement) => option.dataset.value ?? labelOf(option);
const activeOf = (popup: Element) => popup.querySelector<HTMLElement>(".z-listbox__option[data-highlighted]");

function mark(popup: Element, value: string | null): HTMLElement | undefined {
  let selected: HTMLElement | undefined;
  for (const option of optionsOf(popup)) {
    const on = value !== null && valueOf(option) === value;
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

/** Opción a la que lleva una tecla de navegación; sin vuelta al otro extremo salvo `wrap`. */
function step(list: HTMLElement[], current: HTMLElement | null, key: string, wrap: boolean): HTMLElement | undefined {
  if (!list.length) return undefined;
  const i = current ? list.indexOf(current) : -1;
  const last = list.length - 1;
  if (key === "Home") return list[0];
  if (key === "End") return list[last];
  if (key === "ArrowDown") return i >= last ? (wrap ? list[0] : list[last]) : list[i + 1];
  if (key === "ArrowUp") return i <= 0 ? (wrap || i < 0 ? list[last] : list[0]) : list[i - 1];
  return undefined;
}

// Búsqueda por letra: lo tecleado en un segundo forma el prefijo; repetir una letra recorre las que empiezan por ella.
let typed = "";
let typedTimer: ReturnType<typeof setTimeout> | undefined;

function typeahead(list: HTMLElement[], key: string, current: HTMLElement | null): HTMLElement | undefined {
  clearTimeout(typedTimer);
  typed += fold(key);
  typedTimer = setTimeout(() => (typed = ""), 1000);
  const search = [...typed].every((ch) => ch === typed[0]) ? typed[0]! : typed;
  const at = current ? list.indexOf(current) : -1;
  const from = search.length === 1 ? at + 1 : Math.max(at, 0);
  return [...list.slice(from), ...list.slice(0, from)].find((option) => fold(labelOf(option)).startsWith(search));
}

const printable = (event: KeyboardEvent) => event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

/* ---------- Select ---------- */

const selectControl = (select: Element) => select.querySelector<HTMLButtonElement>("button.z-select__control");
const selectValue = (select: HTMLElement) => select.dataset.value ?? select.querySelector<HTMLInputElement>('input[type="hidden"]')?.value ?? "";

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
    copy.innerHTML = icon.innerHTML;
    control.prepend(copy);
  }
  select.dataset.value = value;
  const hidden = select.querySelector<HTMLInputElement>('input[type="hidden"]');
  if (hidden) hidden.value = value;
  if (!control.dataset.state) control.dataset.state = "closed";
}

/** Fija el valor de un Select (`""` lo vacía) y emite z:change si cambia. */
export function setSelectValue(select: HTMLElement, value: string): void {
  const before = selectValue(select);
  syncSelect(select, value);
  if (value !== before) emit(select, "change", { value });
}

function openSelect(select: HTMLElement, start: "selected" | "first" | "last" = "selected"): void {
  const control = selectControl(select);
  const popup = popupFor(control);
  if (!control || !popup || control.disabled || isOpen(popup)) return;
  showPopup(popup, select, control, () => {
    control.dataset.state = "closed";
    setActive(popup, undefined, false);
  });
  control.dataset.state = "open";
  const list = optionsOf(popup).filter(usable);
  const selected = list.find((option) => option.dataset.state === "checked");
  setActive(popup, start === "last" ? list[list.length - 1] : start === "selected" ? (selected ?? list[0]) : list[0], true);
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
  closeSelect(select);
  setSelectValue(select, valueOf(option));
}

function onSelectControlKey(select: HTMLElement, event: KeyboardEvent): void {
  const popup = popupFor(selectControl(select));
  if (!popup || isOpen(popup)) return;
  if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key) || (event.key === " " && !typed)) {
    event.preventDefault();
    openSelect(select, "selected");
  } else if (printable(event)) {
    // Cerrado: la letra cambia el valor sin abrir la lista.
    event.preventDefault();
    const list = optionsOf(popup).filter(usable);
    const next = typeahead(list, event.key, list.find((option) => option.dataset.state === "checked") ?? null);
    if (next) setSelectValue(select, valueOf(next));
  }
}

function onSelectListKey(select: HTMLElement, popup: HTMLElement, event: KeyboardEvent): void {
  const list = optionsOf(popup).filter(usable);
  const current = activeOf(popup);
  const next = step(list, current, event.key, false);
  if (next) {
    event.preventDefault();
    setActive(popup, next, true);
  } else if (event.key === "Enter" || (event.key === " " && !typed)) {
    event.preventDefault();
    if (current) chooseSelect(select, current);
  } else if (event.key === "Tab") {
    // Como en Radix: el tabulador no sale de la lista abierta.
    event.preventDefault();
  } else if (printable(event)) {
    event.preventDefault();
    setActive(popup, typeahead(list, event.key, current) ?? current ?? undefined, true);
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
  if (!state) combos.set(combo, (state = { editing: false, label: "" }));
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
  for (const group of popup.querySelectorAll<HTMLElement>(".z-listbox__group")) group.hidden = !group.querySelector(".z-listbox__option:not([hidden])");
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
  if (clear) clear.hidden = input.disabled || (comboValue(combo) === null && input.value === "");
  const active = activeOf(popup);
  if (active && !usable(active)) setComboActive(combo, undefined);
  if (isOpen(popup)) reposition(popup);
}

/** Icono de la selección delante del campo, mientras no se escribe. */
function syncComboIcon(combo: HTMLElement): void {
  const { input, popup } = comboParts(combo);
  combo.querySelector(":scope > .z-input__icon[data-z-selected]")?.remove();
  if (!input || !popup || comboState(combo).editing) return;
  const icon = optionsOf(popup).find((option) => option.dataset.state === "checked")?.querySelector(".z-listbox__icon");
  if (!icon) return;
  const copy = document.createElement("span");
  copy.className = "z-input__icon";
  copy.setAttribute("data-z-selected", "");
  copy.innerHTML = icon.innerHTML;
  combo.prepend(copy);
}

function commitCombo(combo: HTMLElement, option: HTMLElement | null): void {
  const { popup, hidden } = comboParts(combo);
  if (!popup) return;
  const before = comboValue(combo);
  const value = option ? valueOf(option) : null;
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
    showPopup(popup, combo, input, () => {
      // Al cerrar, el campo vuelve a mostrar la selección.
      const state = comboState(combo);
      state.editing = false;
      input.value = state.label;
      combo.dataset.state = "closed";
      toggle?.setAttribute("aria-expanded", "false");
      setComboActive(combo, undefined);
      refreshCombo(combo);
      syncComboIcon(combo);
    }, false);
    combo.dataset.state = "open";
    toggle?.setAttribute("aria-expanded", "true");
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
      else setComboActive(combo, step(list, active, event.key, true));
      break;
    case "Home":
    case "End":
      if (!shown) return;
      event.preventDefault();
      setComboActive(combo, step(list, active, event.key, true));
      break;
    case "Enter":
      if (!shown) return;
      // Con la lista abierta, Enter elige y no envía el formulario.
      event.preventDefault();
      if (active) chooseCombo(combo, active);
      break;
    default:
  }
}

function buildOption(option: ComboboxOption, size: number): HTMLElement {
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
  tick.innerHTML = iconSvg("check", { size });
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
    ring.innerHTML = '<span class="z-input__spinner" aria-hidden="true"></span>';
    const before = combo.querySelector(":scope > .z-input__action") ?? toggle;
    combo.insertBefore(ring, before);
  } else if (!loading) ring?.remove();
  refreshCombo(combo);
}

/** Fija el valor de un Combobox (`null` lo vacía) y emite z:change si cambia. */
export function setComboboxValue(combo: HTMLElement, value: string | null): void {
  const { input, popup } = comboParts(combo);
  if (!input || !popup) return;
  const option = value === null ? null : (optionsOf(popup).find((item) => valueOf(item) === value) ?? null);
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
  if (viewport && !viewport.id) viewport.id = `z-listbox-${++listSeq}`;
  const state = comboState(combo);
  const declared = combo.dataset.value ?? (hidden?.value || null) ?? optionsOf(popup).find((option) => option.getAttribute("aria-selected") === "true")?.dataset.value ?? null;
  const selected = mark(popup, declared);
  if (selected) {
    combo.dataset.value = valueOf(selected);
    state.label = labelOf(selected);
    if (hidden) hidden.value = valueOf(selected);
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
  if (option && at) return at.owner.matches(COMBO) ? chooseCombo(at.owner, option) : chooseSelect(at.owner, option);

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
  if (clear && clear.contains(target)) clearCombo(combo);
  else if (toggle && toggle.contains(target)) {
    if (isOpen(popup)) closeCombo(combo);
    else openCombo(combo, "selected");
    input.focus();
  } else if (target === input && !isOpen(popup)) openCombo(combo, "selected");
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || event.defaultPrevented) return;
  const at = ownerAt(target);
  if (at && !at.owner.matches(COMBO)) return onSelectListKey(at.owner, at.popup, event);
  if (!inDom(target)) return;
  const control = target.closest<HTMLElement>(`${SELECT} > button.z-select__control`);
  if (control) return onSelectControlKey(control.parentElement!, event);
  if (target.matches(`${COMBO} input.z-input__control`)) onComboKey(target.closest<HTMLElement>(COMBO)!, event);
}

export function setup(): void {
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("input", (event) => {
    const input = event.target as Element;
    if (input.matches?.(`${COMBO} input.z-input__control`) && inDom(input)) onComboInput(input.closest<HTMLElement>(COMBO)!, input as HTMLInputElement);
  });
  // Combobox: al perder el foco el campo, la lista se cierra (también si el foco no va a ningún elemento).
  document.addEventListener("focusout", (event) => {
    const input = event.target as Element;
    if (!input.matches?.(`${COMBO} input.z-input__control`)) return;
    const combo = input.closest<HTMLElement>(COMBO)!;
    const { popup } = comboParts(combo);
    const next = event.relatedTarget as Node | null;
    if (popup && isOpen(popup) && !(next && (combo.contains(next) || popup.contains(next)))) closeCombo(combo);
  });
  // El puntero marca la opción activa; en Select además le da el foco.
  document.addEventListener("pointermove", (event) => {
    const option = (event.target as Element).closest?.<HTMLElement>(".z-listbox__option");
    const at = option && ownerAt(option);
    if (!option || !at || !usable(option) || option.hasAttribute("data-highlighted")) return;
    if (at.owner.matches(COMBO)) setComboActive(at.owner, option, false);
    else setActive(at.popup, option, true, false);
  });
  // Combobox: pulsar en la lista o en sus botones no quita el foco del campo.
  document.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (ownerAt(target)?.owner.matches(COMBO) || (target.closest(`${COMBO} .z-input__action`) && inDom(target))) event.preventDefault();
  });
}

export function hydrate(root: ParentNode): void {
  for (const select of all(root, SELECT)) if (selectControl(select)) syncSelect(select, selectValue(select) || (optionsOf(popupFor(selectControl(select)) ?? select).find((option) => option.getAttribute("aria-selected") === "true")?.dataset.value ?? ""));
  for (const combo of all(root, COMBO)) hydrateCombo(combo);
}
