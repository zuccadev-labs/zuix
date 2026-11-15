// @zuccadev-labs/zuix-zui/dom — comportamiento sin framework para el contrato HTML de zui.
// Mismo marcado, mismas clases y mismos atributos de estado que el binding de React; aquí los mueve el
// navegador (dialog, popover) y este módulo. Sirve en HTML plano, Vue, Svelte, Angular, Astro o plantillas de servidor.
//
// Uso declarativo:   import { init } from "@zuccadev-labs/zuix-zui/dom"; init();
// Uso imperativo:    openDialog(el), closeDialog(el), openPopover(el, anchor), openSubmenu(item), toast({...}), confirm({...})
//
// Atributos:
//   data-z-open="#id"        abre el <dialog> o el [popover] indicado (el popover se ancla al disparador)
//   data-z-close             cierra el diálogo o popover que lo contiene
//   data-z-context="#id"     abre el menú indicado en la posición del puntero (clic derecho)
//   data-z-submenu="#id"     en un .z-menu__item: abre ese .z-menu[popover] como submenú, a su derecha
//   data-z-tooltip="texto"   tooltip al pasar el puntero o enfocar
//   data-z-placement         bottom-start (por defecto) | bottom | bottom-end | top-start | top | top-end | right | left
//   data-z-static            en un <dialog>: Escape y clic fuera no lo cierran
// Tabs, Accordion, Switch, Checkbox, Radio, Toggle y SegmentedControl se activan solos dentro de un contenedor
// [data-z-dom]. Tras insertar marcado nuevo: hydrate(contenedor). Eventos: z:open, z:close, z:change, z:select.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { exclamationTriangle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-triangle";
import { informationCircle } from "@zuccadev-labs/zuix-zicon/icons/information-circle";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import * as carousel from "./carousel";
import * as collections from "./collections";
import * as forms from "./forms";

// Módulos por grupo: cada uno aporta setup() (listeners, una vez) y hydrate(root) (marcado nuevo).
const modules = [forms, collections, carousel];
export { carousel, type CarouselHandle, type CarouselOptions, type CarouselRasterSize, type CarouselRasterSource } from "./carousel";
export { openPalette, selectTreeItem, toggleTreeItem, sortTable, setPage, type SortDirection } from "./collections";
export { setSelectValue, setComboboxOptions, setComboboxLoading, setComboboxValue, setCalendarValue, setDatePickerValue, setSliderValue, setOtpValue, type ComboboxOption, type DateRange } from "./forms";

// Los tres iconos que este módulo dibuja por su cuenta (cierre de aviso, confirmación).
registerIcons([xMark, exclamationTriangle, informationCircle]);

export type Placement = "bottom-start" | "bottom" | "bottom-end" | "top-start" | "top" | "top-end" | "right" | "right-start" | "right-end" | "left" | "left-start" | "left-end";

const EXIT_MS = 220;
const isBrowser = typeof document !== "undefined";

function emit(el: Element, name: string, detail?: unknown): boolean {
  return el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, cancelable: true, detail }));
}

function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Espera la animación de salida (data-state="closed") antes de retirar el elemento. */
function afterExit(el: HTMLElement, done: () => void): void {
  if (reducedMotion()) return done();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.removeEventListener("animationend", onEnd);
    done();
  };
  const onEnd = (event: AnimationEvent) => {
    if (event.target === el) finish();
  };
  el.addEventListener("animationend", onEnd);
  setTimeout(finish, EXIT_MS);
}

/* ---------- Diálogos: <dialog class="z-liquid z-modal"> y <dialog class="z-liquid z-drawer"> ---------- */

/** Abre un `<dialog>` como modal: capa superior, foco atrapado y Escape nativos. */
export function openDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) return;
  dialog.dataset.state = "open";
  dialog.showModal();
  emit(dialog, "open");
}

/** Cierra con animación de salida. `value` llega a `dialog.returnValue`. */
export function closeDialog(dialog: HTMLDialogElement, value?: string): void {
  if (!dialog.open || dialog.dataset.state === "closed") return;
  dialog.dataset.state = "closed";
  afterExit(dialog, () => {
    dialog.close(value);
    emit(dialog, "close", { value });
  });
}

/* ---------- Popover, menú y tooltip: elementos con atributo `popover` ---------- */

const anchors = new WeakMap<HTMLElement, Element>();

export function place(el: HTMLElement, rect: DOMRect, placement: Placement, gap = 6): void {
  const { width, height } = el.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  let [side, align = "center"] = placement.split("-") as [string, string?];
  // Voltea al lado opuesto si no cabe.
  if (side === "bottom" && rect.bottom + gap + height > vh && rect.top - gap - height >= 0) side = "top";
  else if (side === "top" && rect.top - gap - height < 0) side = "bottom";
  else if (side === "right" && rect.right + gap + width > vw) side = "left";
  else if (side === "left" && rect.left - gap - width < 0) side = "right";
  let x: number;
  let y: number;
  if (side === "top" || side === "bottom") {
    y = side === "bottom" ? rect.bottom + gap : rect.top - gap - height;
    x = align === "start" ? rect.left : align === "end" ? rect.right - width : rect.left + rect.width / 2 - width / 2;
  } else {
    x = side === "right" ? rect.right + gap : rect.left - gap - width;
    y = align === "start" ? rect.top : align === "end" ? rect.bottom - height : rect.top + rect.height / 2 - height / 2;
  }
  el.style.left = `${Math.round(Math.min(Math.max(8, x), Math.max(8, vw - width - 8)))}px`;
  el.style.top = `${Math.round(Math.min(Math.max(8, y), Math.max(8, vh - height - 8)))}px`;
  el.dataset.side = side;
}

const isDisabled = (item: Element) => item.hasAttribute("data-disabled") || (item as HTMLButtonElement).disabled === true;

// Un submenú puede ir anidado en el marcado de su menú padre: cada menú solo cuenta sus propias entradas.
function menuItems(menu: Element): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>(".z-menu__item")].filter((item) => item.closest(".z-menu") === menu && !isDisabled(item));
}

function highlight(menu: Element, item: HTMLElement | undefined): void {
  for (const other of menu.querySelectorAll("[data-highlighted]")) if (other.closest(".z-menu") === menu) other.removeAttribute("data-highlighted");
  if (!item) return;
  item.setAttribute("data-highlighted", "");
  item.focus({ preventScroll: true });
}

/** Abre un elemento `[popover]` anclado a `anchor` (un elemento o un punto de la ventana). */
export function openPopover(el: HTMLElement, anchor: Element | { x: number; y: number }, placement: Placement = "bottom-start"): void {
  if (!el.hasAttribute("popover")) el.setAttribute("popover", "auto");
  el.dataset.state = "open";
  if (!el.matches(":popover-open")) el.showPopover();
  const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : new DOMRect(anchor.x, anchor.y, 0, 0);
  place(el, rect, placement, anchor instanceof Element ? 6 : 0);
  if (anchor instanceof Element) {
    anchors.set(el, anchor);
    anchor.setAttribute("aria-expanded", "true");
  }
  if (el.classList.contains("z-menu")) highlight(el, menuItems(el)[0]);
  emit(el, "open");
}

export function closePopover(el: HTMLElement): void {
  if (el.matches(":popover-open")) el.hidePopover();
}

/* ---------- Submenús: <button class="z-menu__item" data-z-submenu="#id"> + <div id popover class="z-liquid z-menu"> ---------- */

// Un popover `auto` que no desciende de otro lo cierra al abrirse. El submenú se declara hijo de su menú con
// `showPopover({ source })`; donde el navegador no lo admite, se mueve dentro del menú padre (anidado en el DOM).
let sourceNesting: boolean | undefined;

function detectSourceNesting(): void {
  if (sourceNesting !== undefined || !document.body) return;
  sourceNesting = false;
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const invoker = document.createElement("button");
  try {
    outer.setAttribute("popover", "auto");
    inner.setAttribute("popover", "auto");
    outer.append(invoker);
    document.body.append(outer, inner);
    outer.showPopover();
    (inner.showPopover as (options?: { source?: HTMLElement }) => void)({ source: invoker });
    sourceNesting = outer.matches(":popover-open");
  } catch {
    sourceNesting = false;
  }
  outer.remove();
  inner.remove();
}

function submenuOf(trigger: Element): HTMLElement | null {
  const selector = trigger.getAttribute("data-z-submenu");
  if (!selector) return null;
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
}

function describeSubmenu(trigger: Element, sub: HTMLElement | null = submenuOf(trigger)): void {
  trigger.setAttribute("aria-haspopup", "menu");
  if (!trigger.hasAttribute("aria-expanded")) trigger.setAttribute("aria-expanded", "false");
  if (sub?.id) trigger.setAttribute("aria-controls", sub.id);
}

/** Submenú abierto desde una entrada de `menu`, si lo hay. */
function openChild(menu: Element): HTMLElement | undefined {
  for (const trigger of menu.querySelectorAll<HTMLElement>('[data-z-submenu][aria-expanded="true"]')) {
    if (trigger.closest(".z-menu") !== menu) continue;
    const sub = submenuOf(trigger);
    if (sub?.matches(":popover-open")) return sub;
  }
  return undefined;
}

/** Menú raíz de la cadena a la que pertenece `menu` (él mismo si no es un submenú). */
function rootMenu(menu: HTMLElement): HTMLElement {
  let current = menu;
  for (;;) {
    const anchor = anchors.get(current);
    const parent = anchor?.hasAttribute("data-z-submenu") ? anchor.closest<HTMLElement>(".z-menu") : null;
    if (!parent) return current;
    current = parent;
  }
}

/** Cierra el menú raíz y, con él, sus submenús. El foco vuelve al disparador del menú, si lo tiene. */
function closeChain(menu: HTMLElement): void {
  const root = rootMenu(menu);
  const anchor = anchors.get(root);
  closePopover(root);
  if (anchor instanceof HTMLElement) anchor.focus({ preventScroll: true });
}

/** Abre el submenú de una entrada `[data-z-submenu]`, a su derecha (o a la izquierda si no cabe). `focusFirst` enfoca su primera entrada. */
export function openSubmenu(trigger: HTMLElement, focusFirst = false): void {
  const sub = submenuOf(trigger);
  const parent = trigger.closest<HTMLElement>(".z-menu");
  if (!sub || !parent || sub === parent || sub.contains(parent) || isDisabled(trigger)) return;
  if (!sub.matches(":popover-open")) {
    if (!sub.hasAttribute("popover")) sub.setAttribute("popover", "auto");
    // Sin init() no se ha comprobado `source` (la comprobación cerraría los menús abiertos): se anida en el DOM.
    if (!sourceNesting && !parent.contains(sub)) parent.append(sub);
    describeSubmenu(trigger, sub);
    sub.dataset.state = "open";
    (sub.showPopover as (options?: { source?: HTMLElement }) => void)({ source: trigger });
    anchors.set(sub, trigger);
    trigger.setAttribute("aria-expanded", "true");
    trigger.dataset.state = "open";
    // Pegado al borde del menú padre y con la primera entrada a la altura del disparador.
    const menuRect = parent.getBoundingClientRect();
    const itemRect = trigger.getBoundingClientRect();
    const style = getComputedStyle(sub);
    const inset = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.borderTopWidth) || 0);
    place(sub, new DOMRect(menuRect.left, itemRect.top - inset, menuRect.width, itemRect.height + inset * 2), "right-start", 4);
    emit(sub, "open");
  }
  if (focusFirst) highlight(sub, menuItems(sub)[0]);
}

let subTimer: ReturnType<typeof setTimeout> | undefined;

/** Puntero sobre una entrada: la resalta y, con un pequeño retardo, abre su submenú o cierra el de otra entrada. */
function onMenuPointer(item: HTMLElement): void {
  const menu = item.closest<HTMLElement>(".z-menu")!;
  highlight(menu, item);
  clearTimeout(subTimer);
  const open = openChild(menu);
  if (item.hasAttribute("data-z-submenu")) {
    if (submenuOf(item) !== open) subTimer = setTimeout(() => openSubmenu(item), 100);
  } else if (open) subTimer = setTimeout(() => closePopover(open), 200);
}

let typed = "";
let typedAt = 0;

/** Búsqueda por letra: enfoca la siguiente entrada cuyo texto empieza por lo tecleado. */
function typeahead(menu: HTMLElement, key: string): boolean {
  const now = Date.now();
  typed = now - typedAt > 600 ? key : typed + key;
  typedAt = now;
  const query = typed.toLowerCase();
  const repeated = [...query].every((char) => char === query[0]);
  const items = menuItems(menu);
  const at = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
  // Una letra (o la misma repetida) avanza desde la entrada siguiente; una palabra busca desde la actual.
  const order = repeated ? [...items.slice(at + 1), ...items.slice(0, at + 1)] : [...items.slice(at), ...items.slice(0, at)];
  const text = (item: HTMLElement) => (item.querySelector(".z-menu__text") ?? item).textContent!.trim().toLowerCase();
  const hit = order.find((item) => text(item).startsWith(repeated ? query[0]! : query));
  if (hit) highlight(menu, hit);
  return hit !== undefined;
}

function onPopoverToggle(event: Event): void {
  const el = event.target as HTMLElement;
  if ((event as ToggleEvent).newState !== "closed" || !el.hasAttribute?.("popover")) return;
  const anchor = anchors.get(el);
  if (anchor) {
    anchor.setAttribute("aria-expanded", "false");
    if (anchor.hasAttribute("data-z-submenu")) (anchor as HTMLElement).dataset.state = "closed";
    if (el.contains(document.activeElement) || document.activeElement === document.body) (anchor as HTMLElement).focus?.({ preventScroll: true });
    anchors.delete(el);
  }
  el.dataset.state = "closed";
  emit(el, "close");
}

/* ---------- Tooltip ---------- */

let tip: HTMLElement | undefined;
let tipTimer: ReturnType<typeof setTimeout> | undefined;
let tipId = 0;

function showTooltip(target: HTMLElement): void {
  const text = target.getAttribute("data-z-tooltip");
  if (!text) return;
  hideTooltip();
  tipTimer = setTimeout(() => {
    tip = document.createElement("div");
    tip.className = "z-liquid z-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.setAttribute("popover", "manual");
    tip.id = `z-tip-${++tipId}`;
    tip.textContent = text;
    document.body.append(tip);
    tip.showPopover();
    place(tip, target.getBoundingClientRect(), (target.getAttribute("data-z-placement") as Placement) ?? "top");
    target.setAttribute("aria-describedby", tip.id);
  }, 350);
}

function hideTooltip(): void {
  clearTimeout(tipTimer);
  if (!tip) return;
  document.querySelector(`[aria-describedby="${tip.id}"]`)?.removeAttribute("aria-describedby");
  tip.remove();
  tip = undefined;
}

/* ---------- Avisos ---------- */

export interface ToastOptions {
  title: string;
  description?: string;
  intent?: "info" | "success" | "warning" | "danger";
  /** Milisegundos visibles; 0 lo deja hasta que se cierre a mano. */
  duration?: number;
  action?: { label: string; onClick: () => void };
  position?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
  closeLabel?: string;
}

function viewport(position: string): HTMLElement {
  let host = document.querySelector<HTMLElement>(".z-toast-viewport");
  if (!host) {
    host = document.createElement("ol");
    host.className = "z-toast-viewport";
    host.setAttribute("popover", "manual");
    host.tabIndex = -1;
    document.body.append(host);
  }
  host.dataset.position = position;
  // Capa superior: los avisos quedan por encima de un <dialog> abierto.
  if (host.matches(":popover-open")) host.hidePopover();
  host.showPopover();
  return host;
}

const SWIPE_THRESHOLD = 50;

/**
 * Deslizar para descartar, con ratón, lápiz o dedo, igual que el Toast de React: hacia la derecha, o hacia el borde
 * (arriba o abajo) en las posiciones centradas. El CSS lee `data-swipe` y las mismas variables que escribe Radix.
 */
function swipeToDismiss(item: HTMLElement, position: string, dismiss: () => void, pause: () => void, resume: () => void): void {
  const vertical = position.endsWith("center");
  const sign = position === "top-center" ? -1 : 1;
  const axis = vertical ? "y" : "x";
  let swipe: { id: number; x: number; y: number; active: boolean } | undefined;
  // Solo cuenta el avance en la dirección de descarte.
  const delta = (event: PointerEvent, from: { x: number; y: number }) => Math.max(0, (vertical ? event.clientY - from.y : event.clientX - from.x) * sign) * sign;
  item.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || item.dataset.state === "closed") return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
  });
  item.addEventListener("pointermove", (event) => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const moved = delta(event, swipe);
    if (!swipe.active) {
      // Un dedo tiembla más que un ratón: margen mayor antes de dar el gesto por empezado.
      const buffer = event.pointerType === "touch" ? 10 : 2;
      const cross = Math.abs(vertical ? event.clientX - swipe.x : event.clientY - swipe.y);
      if (Math.abs(moved) > buffer) {
        swipe.active = true;
        pause();
        item.dataset.swipe = "move";
        try { item.setPointerCapture(event.pointerId); } catch { /* puntero sintético o ya liberado */ }
      } else if (cross > buffer) {
        swipe = undefined;
        return;
      } else return;
    }
    item.style.setProperty(`--radix-toast-swipe-move-${axis}`, `${moved}px`);
  });
  const end = (event: PointerEvent, cancelled: boolean) => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const { active } = swipe;
    const moved = delta(event, swipe);
    swipe = undefined;
    if (!active) return;
    item.style.removeProperty(`--radix-toast-swipe-move-${axis}`);
    // El clic que sigue al gesto no debe activar la acción ni el cierre que quedaran bajo el dedo.
    const swallow = (click: Event) => { click.preventDefault(); click.stopPropagation(); };
    item.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => item.removeEventListener("click", swallow, { capture: true }));
    if (!cancelled && Math.abs(moved) > SWIPE_THRESHOLD) {
      item.style.setProperty(`--radix-toast-swipe-end-${axis}`, `${moved}px`);
      item.dataset.swipe = "end";
      dismiss();
    } else {
      item.dataset.swipe = "cancel";
      resume();
    }
  };
  item.addEventListener("pointerup", (event) => end(event, false));
  item.addEventListener("pointercancel", (event) => end(event, true));
}

/** Muestra un aviso con el mismo marcado que el Toast de React. Devuelve una función para descartarlo. */
export function toast({ title, description, intent = "info", duration = 5000, action, position = "bottom-right", closeLabel = "Close" }: ToastOptions): () => void {
  const host = viewport(position);
  const item = document.createElement("li");
  item.className = "z-liquid z-toast";
  item.dataset.intent = intent;
  item.dataset.state = "open";
  item.setAttribute("role", intent === "danger" || intent === "warning" ? "alert" : "status");
  item.innerHTML = `<span class="z-toast__dot" aria-hidden="true"></span><div class="z-toast__content"><div class="z-toast__title"></div></div><button type="button" class="z-overlay-close z-toast__close">${iconSvg("x-mark", { size: 16 })}</button>`;
  const content = item.querySelector(".z-toast__content")!;
  content.querySelector(".z-toast__title")!.textContent = title;
  item.querySelector(".z-toast__close")!.setAttribute("aria-label", closeLabel);
  if (description) {
    const text = document.createElement("div");
    text.className = "z-toast__description";
    text.textContent = description;
    content.append(text);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dismiss = () => {
    clearTimeout(timer);
    if (item.dataset.state === "closed") return;
    item.dataset.state = "closed";
    afterExit(item, () => {
      item.remove();
      if (!host.children.length && host.matches(":popover-open")) host.hidePopover();
    });
  };
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "z-toast__action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      action.onClick();
      dismiss();
    });
    content.append(button);
  }
  item.querySelector(".z-toast__close")!.addEventListener("click", dismiss);
  swipeToDismiss(item, position, dismiss, () => clearTimeout(timer), () => { if (duration > 0) timer = setTimeout(dismiss, duration); });
  host.append(item);
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}

/* ---------- Confirmación ---------- */

export interface ConfirmOptions {
  title: string;
  description?: string;
  intent?: "default" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Diálogo de confirmación; resuelve `true` si se confirma. Mismo marcado que ConfirmDialog. */
export function confirm({ title, description, intent = "default", confirmLabel = "Confirm", cancelLabel = "Cancel" }: ConfirmOptions): Promise<boolean> {
  const dialog = document.createElement("dialog");
  dialog.className = "z-liquid z-modal z-confirm";
  dialog.dataset.intent = intent;
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("data-z-static", "");
  dialog.innerHTML = `<header class="z-modal__header"><span class="z-confirm__icon">${iconSvg(intent === "danger" ? "exclamation-triangle" : "information-circle", { size: 16 })}</span><div class="z-modal__heading"><h2 class="z-modal__title"></h2></div></header><footer class="z-modal__footer"><button type="button" class="z-dialog-btn" data-variant="secondary" value="cancel"></button><button type="button" class="z-dialog-btn" data-variant="${intent === "danger" ? "danger" : "primary"}" value="confirm"></button></footer>`;
  dialog.querySelector(".z-modal__title")!.textContent = title;
  if (description) {
    const text = document.createElement("p");
    text.className = "z-modal__description";
    text.textContent = description;
    dialog.querySelector(".z-modal__heading")!.append(text);
  }
  const [cancel, ok] = dialog.querySelectorAll<HTMLButtonElement>(".z-dialog-btn");
  cancel!.textContent = cancelLabel;
  ok!.textContent = confirmLabel;
  document.body.append(dialog);
  return new Promise((resolve) => {
    cancel!.addEventListener("click", () => closeDialog(dialog, "cancel"));
    ok!.addEventListener("click", () => closeDialog(dialog, "confirm"));
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "confirm");
      dialog.remove();
    });
    openDialog(dialog);
    cancel!.focus();
  });
}

/* ---------- Tema y marca ---------- */

export function setTheme(theme: "light" | "dark", root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}

export function setBrand(brand: string, root: HTMLElement = document.documentElement): void {
  root.dataset.brand = brand;
}

/* ---------- Pestañas ---------- */

const tabKey = (tab: HTMLElement) => tab.dataset.value ?? tab.getAttribute("aria-controls") ?? "";

/** Activa una pestaña. `value` es su `data-value` o, si no lo tiene, el id del panel (`aria-controls`). */
export function selectTab(tabs: Element, value: string): void {
  selectTabQuiet(tabs, value);
  emit(tabs, "change", { value });
}

function selectTabQuiet(tabs: Element, value: string): void {
  for (const tab of tabs.querySelectorAll<HTMLElement>(".z-tabs__tab")) {
    if (tab.closest(".z-tabs") !== tabs) continue;
    const active = tabKey(tab) === value;
    tab.dataset.state = active ? "active" : "inactive";
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of tabs.querySelectorAll<HTMLElement>(".z-tabs__panel")) {
    if (panel.closest(".z-tabs") !== tabs) continue;
    const active = (panel.dataset.value ?? panel.id) === value;
    panel.dataset.state = active ? "active" : "inactive";
    panel.hidden = !active;
  }
}

/* ---------- Acordeón ---------- */

function setSection(item: Element, open: boolean): void {
  const trigger = item.querySelector<HTMLElement>(".z-accordion__trigger");
  const content = item.querySelector<HTMLElement>(".z-accordion__content");
  const state = open ? "open" : "closed";
  (item as HTMLElement).dataset.state = state;
  if (trigger) {
    trigger.dataset.state = state;
    trigger.setAttribute("aria-expanded", String(open));
  }
  if (content) {
    content.dataset.state = state;
    content.hidden = !open;
  }
}

/* ---------- Delegación de eventos ---------- */

const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;

// Marca interior de casilla y radio: existe solo mientras está marcado, igual que en el binding de React.
const MARKS: Record<string, string> = { "z-check__box": "z-check__mark", "z-radio__dot": "z-radio__mark" };

function setChecked(el: HTMLElement, checked: boolean): void {
  const binary = el.dataset.state === "on" || el.dataset.state === "off";
  const state = binary ? (checked ? "on" : "off") : checked ? "checked" : "unchecked";
  el.dataset.state = state;
  el.setAttribute("aria-checked", String(checked));
  for (const child of el.querySelectorAll<HTMLElement>("[data-state]")) child.dataset.state = state;
  for (const [host, mark] of Object.entries(MARKS)) {
    if (!el.classList.contains(host)) continue;
    const current = el.querySelector(`.${mark}`);
    if (checked && !current) {
      const span = document.createElement("span");
      span.className = mark;
      span.dataset.state = state;
      el.append(span);
    } else if (!checked) current?.remove();
  }
  // Campo nativo oculto que acompaña al control: mantiene el valor en formularios.
  const input = el.parentElement?.querySelector<HTMLInputElement>(':scope > input[type="checkbox"], :scope > input[type="radio"]');
  if (input) input.checked = checked;
}

const isChecked = (el: HTMLElement) => el.getAttribute("aria-checked") === "true" || el.dataset.state === "checked" || el.dataset.state === "on";

function toggleChecked(el: HTMLElement): void {
  if (el.hasAttribute("data-disabled") || (el as HTMLButtonElement).disabled) return;
  const next = !isChecked(el);
  setChecked(el, next);
  emit(el, "change", { checked: next });
}

/** Prepara el marcado estático dentro de `[data-z-dom]`: orden de tabulación de pestañas y grupos de radio. */
export function hydrate(root: ParentNode = document): void {
  for (const tabs of root.querySelectorAll<HTMLElement>("[data-z-dom] .z-tabs, .z-tabs[data-z-dom]")) {
    const active = tabs.querySelector<HTMLElement>('.z-tabs__tab[data-state="active"]') ?? tabs.querySelector<HTMLElement>(".z-tabs__tab");
    if (active) selectTabQuiet(tabs, tabKey(active));
  }
  // Un interruptor, casilla o radio sin `aria-checked` no tiene estado para las tecnologías de apoyo: sale de `data-state`.
  for (const el of root.querySelectorAll<HTMLElement>('[data-z-dom] :is([role="switch"], [role="checkbox"], [role="radio"]):not([aria-checked])')) {
    el.setAttribute("aria-checked", el.dataset.state === "indeterminate" ? "mixed" : String(isChecked(el)));
  }
  for (const group of root.querySelectorAll<HTMLElement>('[data-z-dom] [role="radiogroup"]')) {
    const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')];
    const current = radios.find(isChecked) ?? radios.find((r) => !(r as HTMLButtonElement).disabled);
    for (const radio of radios) radio.tabIndex = radio === current ? 0 : -1;
  }
  for (const section of root.querySelectorAll<HTMLElement>("[data-z-dom] .z-accordion__item")) setSection(section, section.dataset.state === "open");
  for (const trigger of root.querySelectorAll<HTMLElement>(".z-menu__item[data-z-submenu]")) describeSubmenu(trigger);
  for (const mod of modules) mod.hydrate(root);
}

function onClick(event: MouseEvent): void {
  const target = event.target as Element;
  if (!(target instanceof Element)) return;

  const opener = target.closest<HTMLElement>("[data-z-open]");
  if (opener) {
    const el = document.querySelector<HTMLElement>(opener.getAttribute("data-z-open")!);
    if (el instanceof HTMLDialogElement) openDialog(el);
    else if (el) {
      if (el.matches(":popover-open")) closePopover(el);
      else openPopover(el, opener, (opener.getAttribute("data-z-placement") as Placement) ?? "bottom-start");
    }
    return;
  }

  const closer = target.closest("[data-z-close]");
  if (closer) {
    const dialog = closer.closest("dialog");
    const pop = closer.closest<HTMLElement>("[popover]");
    if (pop && (!dialog || dialog.contains(pop))) closePopover(pop);
    else if (dialog) closeDialog(dialog, closer.getAttribute("value") ?? undefined);
    return;
  }

  // Clic en el velo de un <dialog>: el objetivo es el propio diálogo.
  if (target instanceof HTMLDialogElement && target.matches(".z-modal, .z-drawer") && !target.hasAttribute("data-z-static")) {
    const r = target.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(target);
    return;
  }

  const item = target.closest<HTMLElement>(".z-menu[popover] .z-menu__item");
  if (item && !isDisabled(item)) {
    if (item.hasAttribute("data-z-submenu")) {
      // Una entrada con submenú no se elige: lo abre. Activada con teclado (detail 0), enfoca su primera entrada.
      clearTimeout(subTimer);
      openSubmenu(item, event.detail === 0);
      return;
    }
    emit(item, "select");
    // Elegir cierra toda la cadena: el menú raíz se lleva consigo sus submenús.
    if (!item.hasAttribute("data-keep-open")) closeChain(item.closest<HTMLElement>(".z-menu")!);
    return;
  }

  if (!inDom(target)) return;

  const tab = target.closest<HTMLElement>(".z-tabs__tab");
  if (tab && !tab.hasAttribute("data-disabled")) return selectTab(tab.closest(".z-tabs")!, tabKey(tab));

  const trigger = target.closest<HTMLElement>(".z-accordion__trigger");
  if (trigger && !trigger.hasAttribute("data-disabled")) {
    const section = trigger.closest(".z-accordion__item")!;
    const root = section.closest<HTMLElement>(".z-accordion");
    const open = trigger.dataset.state !== "open";
    if (open && root?.dataset.type !== "multiple") for (const other of root?.querySelectorAll(".z-accordion__item") ?? []) if (other !== section) setSection(other, false);
    setSection(section, open);
    return;
  }

  const check = target.closest<HTMLElement>('[role="switch"], [role="checkbox"]');
  if (check) return toggleChecked(check);

  const radio = target.closest<HTMLElement>('[role="radio"]');
  if (radio && !radio.hasAttribute("data-disabled") && !(radio as HTMLButtonElement).disabled) {
    const group = radio.closest('[role="radiogroup"]');
    for (const other of group?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [radio]) {
      setChecked(other, other === radio);
      other.tabIndex = other === radio ? 0 : -1;
    }
    if (group) emit(group, "change", { value: radio.getAttribute("value") ?? radio.dataset.value });
    return;
  }

  const pressed = target.closest<HTMLElement>("button[aria-pressed]");
  if (pressed) {
    const next = pressed.getAttribute("aria-pressed") !== "true";
    pressed.setAttribute("aria-pressed", String(next));
    pressed.dataset.state = next ? "on" : "off";
    emit(pressed, "change", { pressed: next });
  }
}

function move(list: HTMLElement[], current: Element | null, key: string, vertical: boolean): HTMLElement | undefined {
  const i = list.indexOf(current as HTMLElement);
  const next = vertical ? "ArrowDown" : "ArrowRight";
  const prev = vertical ? "ArrowUp" : "ArrowLeft";
  if (key === next) return list[(i + 1) % list.length];
  if (key === prev) return list[(i - 1 + list.length) % list.length];
  if (key === "Home") return list[0];
  if (key === "End") return list[list.length - 1];
  return undefined;
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as Element;
  if (!(target instanceof Element)) return;

  const menu = target.closest<HTMLElement>(".z-menu[popover]");
  if (menu) {
    const current = target.closest<HTMLElement>(".z-menu__item");
    const own = current && current.closest(".z-menu") === menu && !isDisabled(current) ? current : null;
    const parentTrigger = anchors.get(menu);
    const next = move(menuItems(menu), document.activeElement, event.key, true);
    if (next) {
      event.preventDefault();
      // El foco pasa a otra entrada: el submenú que dejó abierto la anterior se cierra.
      const open = openChild(menu);
      if (open && submenuOf(next) !== open) closePopover(open);
      clearTimeout(subTimer);
      highlight(menu, next);
    } else if (event.key === "Tab") closeChain(menu);
    else if ((event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") && own?.hasAttribute("data-z-submenu")) {
      event.preventDefault();
      clearTimeout(subTimer);
      openSubmenu(own, true);
    } else if (event.key === "ArrowLeft" && parentTrigger?.hasAttribute("data-z-submenu")) {
      // Cierra solo este submenú; el foco vuelve a la entrada que lo abrió.
      event.preventDefault();
      closePopover(menu);
      const parent = parentTrigger.closest(".z-menu");
      if (parent) highlight(parent, parentTrigger as HTMLElement);
    } else if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (typeahead(menu, event.key)) event.preventDefault();
    }
    return;
  }

  // Escape en un diálogo: se cierra con animación, o no se cierra si es estático.
  if (event.key === "Escape") {
    const dialog = target.closest<HTMLDialogElement>("dialog.z-modal, dialog.z-drawer");
    if (dialog?.open && !target.closest(":popover-open")) {
      event.preventDefault();
      if (!dialog.hasAttribute("data-z-static")) closeDialog(dialog);
    }
    return;
  }

  if (!inDom(target)) return;
  const radio = target.closest<HTMLElement>('[role="radio"]');
  if (radio) {
    const list = [...(radio.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])].filter((r) => !(r as HTMLButtonElement).disabled);
    const next = move(list, radio, event.key, true) ?? move(list, radio, event.key, false);
    if (next) {
      event.preventDefault();
      next.focus();
      next.click();
    }
    return;
  }
  const tab = target.closest<HTMLElement>(".z-tabs__tab");
  if (tab) {
    const tabs = tab.closest(".z-tabs")!;
    const list = [...tabs.querySelectorAll<HTMLElement>(".z-tabs__tab")].filter((t) => t.closest(".z-tabs") === tabs && !t.hasAttribute("data-disabled"));
    const next = move(list, tab, event.key, (tabs as HTMLElement).dataset.orientation === "vertical");
    if (next) {
      event.preventDefault();
      next.focus();
      selectTab(tabs, tabKey(next));
    }
  }
}

const LONG_PRESS_MS = 600;
let longPress: { id: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | undefined;
let longPressOpened = 0;
function cancelLongPress(): void {
  if (longPress) clearTimeout(longPress.timer);
  longPress = undefined;
}

let wired = false;

/** Conecta el comportamiento. Idempotente; llamar una vez al cargar. */
export function init(): void {
  if (!isBrowser || wired) return;
  wired = true;
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("toggle", onPopoverToggle, true);
  document.addEventListener("cancel", (event) => {
    // Evita el cierre nativo sin animación; onKeydown ya lo gestiona.
    if ((event.target as Element).matches?.("dialog.z-modal, dialog.z-drawer")) event.preventDefault();
  }, true);
  document.addEventListener("contextmenu", (event) => {
    const zone = (event.target as Element).closest?.("[data-z-context]");
    const menu = zone && document.querySelector<HTMLElement>(zone.getAttribute("data-z-context")!);
    if (!menu) return;
    event.preventDefault();
    // Con el dedo ya lo abre (o lo va a abrir) la pulsación larga de más abajo: Android emite además `contextmenu`.
    if (longPress || Date.now() - longPressOpened < 1000) return;
    const point = { x: event.clientX, y: event.clientY };
    const open = () => openPopover(menu, point, "bottom-start");
    // En Linux y macOS `contextmenu` llega al pulsar el botón, no al soltarlo: el `pointerup` que sigue cuenta como
    // clic fuera y cerraría el menú recién abierto (Firefox y WebKit). Con el botón aún pulsado se abre al soltar.
    if (event.buttons & 2) {
      const release = new AbortController();
      const onRelease = () => { release.abort(); setTimeout(open); };
      window.addEventListener("pointerup", onRelease, { capture: true, signal: release.signal });
      window.addEventListener("pointercancel", onRelease, { capture: true, signal: release.signal });
    } else open();
  });
  // Pulsación larga con dedo o lápiz: iOS no emite `contextmenu`, y un Chromium de escritorio con pantalla táctil tampoco.
  document.addEventListener("pointerdown", (event) => {
    cancelLongPress();
    if (event.pointerType === "mouse") return;
    const zone = (event.target as Element).closest?.("[data-z-context]");
    const menu = zone && document.querySelector<HTMLElement>(zone.getAttribute("data-z-context")!);
    if (!menu) return;
    const point = { x: event.clientX, y: event.clientY };
    const timer = setTimeout(() => {
      longPress = undefined;
      longPressOpened = Date.now();
      openPopover(menu, point, "bottom-start");
      // Al levantar el dedo, el cierre ligero de los popovers `auto` lo trataría como un clic fuera. Con el puntero
      // capturado por el menú, ese `pointerup` cae dentro y no lo cierra; si aun así se cerró, se vuelve a abrir.
      try { menu.setPointerCapture(event.pointerId); } catch { /* puntero sintético o ya liberado */ }
      const lift = new AbortController();
      const onLift = () => {
        lift.abort();
        setTimeout(() => { if (!menu.matches(":popover-open")) openPopover(menu, point, "bottom-start"); });
      };
      window.addEventListener("pointerup", onLift, { capture: true, signal: lift.signal });
      window.addEventListener("pointercancel", onLift, { capture: true, signal: lift.signal });
    }, LONG_PRESS_MS);
    longPress = { id: event.pointerId, x: point.x, y: point.y, timer };
  }, true);
  document.addEventListener("pointermove", (event) => {
    if (longPress && event.pointerId === longPress.id && Math.hypot(event.clientX - longPress.x, event.clientY - longPress.y) > 10) cancelLongPress();
  }, true);
  document.addEventListener("pointerup", cancelLongPress, true);
  document.addEventListener("pointercancel", cancelLongPress, true);
  document.addEventListener("pointerover", (event) => {
    const item = (event.target as Element).closest?.<HTMLElement>(".z-menu[popover] .z-menu__item");
    if (item && !isDisabled(item)) onMenuPointer(item);
    const host = (event.target as Element).closest?.<HTMLElement>("[data-z-tooltip]");
    if (host && !host.hasAttribute("aria-describedby")) showTooltip(host);
  });
  document.addEventListener("pointerout", (event) => {
    const host = (event.target as Element).closest?.("[data-z-tooltip]");
    if (host && !host.contains(event.relatedTarget as Node | null)) hideTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const host = (event.target as Element).closest?.<HTMLElement>("[data-z-tooltip]");
    if (host?.matches(":focus-visible")) showTooltip(host);
  });
  document.addEventListener("focusout", hideTooltip);
  for (const mod of modules) mod.setup();
  const ready = () => {
    detectSourceNesting();
    hydrate();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
}
