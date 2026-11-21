// @zuccadev-labs/zuix-zui/dom — comportamiento sin framework para el contrato HTML de zui.
// Mismo marcado, mismas clases y mismos atributos de estado que el binding de React; aquí los mueve el
// navegador (dialog, popover) y este módulo. Sirve en HTML plano, Vue, Svelte, Angular, Astro o plantillas de servidor.
//
// Uso declarativo:   import { init } from "@zuccadev-labs/zuix-zui/dom"; init();
// Uso imperativo:    openDialog(el), closeDialog(el), openPopover(el, anchor), openSubmenu(item), toast({...}), toastPromise(p, {...}), confirm({...}), startTour({...})
//
// Atributos:
//   data-z-open="#id"        abre el <dialog> o el [popover] indicado (el popover se ancla al disparador)
//   data-z-close             cierra el diálogo o popover que lo contiene
//   data-z-context="#id"     abre el menú indicado en la posición del puntero (clic derecho)
//   data-z-submenu="#id"     en un .z-menu__item: abre ese .z-menu[popover] como submenú, a su derecha
//   data-z-tooltip="texto"   tooltip al pasar el puntero o enfocar
//   data-z-placement         bottom-start (por defecto) | bottom | bottom-end | top-start | top | top-end | right | left
//   data-z-anchor="#id"      en un disparador data-z-open: coloca el popover junto a ese elemento (ancla distinta)
//   data-arrow               en un .z-popover: flecha hacia el centro del ancla
//   data-z-static            en un <dialog>: Escape y clic fuera no lo cierran
// Los atributos de referencia (`#id`) se resuelven con getElementById: valen ids con cualquier carácter y un valor
// que no sea un selector válido no lanza. Seguridad (CSP, Trusted Types, texto de la aplicación): ver ./shared.
// Tabs, Accordion, Switch, Checkbox, Radio, Toggle y SegmentedControl se activan solos dentro de un contenedor
// [data-z-dom]. Tras insertar marcado nuevo: hydrate(contenedor). Eventos: z:open, z:close, z:change, z:select.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { exclamationTriangle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-triangle";
import { informationCircle } from "@zuccadev-labs/zuix-zicon/icons/information-circle";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import * as actions from "./actions";
import * as agenda from "./agenda";
import * as widgets from "./widgets";
import * as carousel from "./carousel";
import * as collections from "./collections";
import * as contentDom from "./content";
import * as datatable from "./datatable";
import * as forms from "./forms";
import * as layers from "./layers";
import * as navigation from "./navigation";
import * as reading from "./reading";
import * as effects from "./effects";
import * as color from "./color";
import * as media from "./media";
import * as time from "./time";
import { trapTab } from "../core/focus";
import { trackScrollEdges } from "../core/edges";
import { escapeTop } from "../core/layers";
import { lockScroll } from "../core/scroll-lock";
import { createLongPress } from "../core/long-press";
import { followModalHost, modalHost, moveToHost, settleShown } from "../core/modal-host";
import { createMenuAim } from "../core/menu-aim";
import { isRtl } from "../core/dir";
import { anchorWithCss, settleAnchoring, type CssAnchoring } from "../core/anchor";
import { place, submenuAnchor, topInset, type Placement } from "../core/place";
import { afterExit } from "../core/presence";
import { move, moveBoth } from "../core/roving";
import { swipeDirection, swipeToDismiss } from "../core/swipe";
import { createTimer } from "../core/timer";
import { createTypeahead } from "../core/typeahead";
import { byRef, listener, logicalKey, notePress, pressedOnBackdrop, setMarkup } from "./shared";

// Módulos por grupo: cada uno aporta setup() (listeners, una vez) y hydrate(root) (marcado nuevo).
const modules = [
  actions,
  forms,
  collections,
  datatable,
  carousel,
  time,
  agenda,
  color,
  media,
  widgets,
  contentDom,
  reading,
  effects,
  navigation,
  layers,
];
export { carousel, type CarouselHandle, type CarouselOptions, type CarouselRasterSize, type CarouselRasterSource } from "./carousel";
export { setJsonTreeValue, setStep } from "./content";
export { setHighlightQuery } from "./reading";
export { setDotMatrixPattern } from "./effects";
export { setColorValue } from "./color";
export { setCompareValue } from "./media";
export { download, downloadBlob, downloadUrl, mimeFromName, type DownloadSource } from "../core/download";
export { qrcodeSvg } from "../core/qr-widget";
export { confetti, type ConfettiOptions } from "../core/confetti-runtime";
export { matchesShortcut, normalizeShortcut, parseShortcut, shortcutLabels } from "../core/shortcut";
export { signatureBlob, signatureValue, type SignatureValue } from "../core/signature-widget";
export { cropImage, cropImageBlob, type CropImageOptions } from "../core/crop-image";
export {
  checkTreeItem,
  openPalette,
  renameTreeItem,
  selectTreeItem,
  toggleTreeItem,
  sortTable,
  setPage,
  type SortDirection,
} from "./collections";
export { dataTableSelection, setDataTablePage, setDataTableSelection } from "./datatable";
export {
  setSelectValue,
  setComboboxOptions,
  setComboboxLoading,
  setComboboxValue,
  setCalendarOptions,
  setCalendarValue,
  setDatePickerValue,
  setSliderValue,
  setOtpValue,
  setDateFieldValue,
  setTimeFieldValue,
  setTimePickerValue,
  setNumberInputValue,
  setListboxValue,
  setTagsValue,
  type CalendarOptions,
  type ComboboxOption,
  type DateRange,
} from "./forms";

// Los tres iconos que este módulo dibuja por su cuenta (cierre de aviso, confirmación).
registerIcons([xMark, exclamationTriangle, informationCircle]);

export { place, type Placement };
export { pauseTimer, resetTimer, startTimer, updateRelativeTime } from "./time";
export {
  destroyAgenda,
  setAgendaCalendars,
  setAgendaEvents,
  setAgendaOptions,
  setAgendaView,
  type CalendarEvent,
  type CalendarSource,
} from "./agenda";
export { destroyWidget, setWidgetProps } from "./widgets";
export { openMenubarMenu, setCollapsibleOpen } from "./navigation";
export {
  closeActionBar,
  dismissBanner,
  setDrawerSnap,
  setHintOpen,
  startTour,
  type TourHandle,
  type TourInit,
  type TourStepInit,
} from "./layers";
export { formatDateRange, isoWeekText, PRESET_KEYS, rangePresets, resolvePreset, weekNumber, weekStartOf } from "../core/date";

const isBrowser = typeof document !== "undefined";

function emit(el: Element, name: string, detail?: unknown): boolean {
  return el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, cancelable: true, detail }));
}

/* ---------- Diálogos: <dialog class="z-liquid z-modal"> y <dialog class="z-liquid z-drawer"> ---------- */

/** Abre un `<dialog>` como modal: capa superior, foco atrapado y Escape nativos. */
export function openDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) return;
  dialog.dataset.state = "open";
  dialog.showModal();
  // La página no se desplaza bajo un diálogo modal; se libera cuando el diálogo se cierra, por la vía que sea.
  dialog.addEventListener("close", lockScroll(), { once: true });
  emit(dialog, "open");
}

/** Cierra con animación de salida. `value` llega a `dialog.returnValue`. */
export function closeDialog(dialog: HTMLDialogElement, value?: string): void {
  if (!dialog.open || dialog.dataset.state === "closed") return;
  dialog.dataset.state = "closed";
  afterExit(dialog, () => {
    // Ya cerrado por otra vía (dialog.close() de la aplicación durante la animación): no se cierra dos veces.
    if (!dialog.open) return;
    announced.add(dialog);
    dialog.close(value);
    emit(dialog, "close", { value });
  });
}

// Diálogos cuyo z:close ya se emitió desde closeDialog(): el `close` nativo que llega después no lo repite.
const announced = new WeakSet<HTMLDialogElement>();

/**
 * Cierre que no pasó por closeDialog(): `dialog.close()` de la aplicación, `<form method="dialog">` o el segundo
 * Escape que el navegador no deja cancelar. El estado y el evento z:close quedan igual que en un cierre normal.
 */
function onNativeClose(event: Event): void {
  const dialog = event.target;
  if (!(dialog instanceof HTMLDialogElement) || !dialog.matches(".z-modal, .z-drawer, .z-palette")) return;
  if (announced.delete(dialog)) return;
  dialog.dataset.state = "closed";
  emit(dialog, "close", { value: dialog.returnValue || undefined });
}

/* ---------- Popover, menú y tooltip: elementos con atributo `popover` ---------- */

const anchors = new WeakMap<HTMLElement, Element>();
// Popovers abiertos junto a un elemento: se recolocan si la página se desplaza o cambia de tamaño.
const followers = new Map<HTMLElement, () => void>();

function follow(event: Event): void {
  if (!followers.size) return;
  // El desplazamiento dentro del propio popover (una lista larga) no lo mueve.
  if (event.target instanceof Element && event.target.closest("[popover]")) return;
  for (const [el, reposition] of [...followers]) {
    if (!el.isConnected || !el.matches(":popover-open")) followers.delete(el);
    else reposition();
  }
}

const isDisabled = (item: Element) =>
  item.hasAttribute("data-disabled") || item.getAttribute("aria-disabled") === "true" || (item as HTMLButtonElement).disabled === true;

// Un submenú puede ir anidado en el marcado de su menú padre: cada menú solo cuenta sus propias entradas.
function menuItems(menu: Element): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>(".z-menu__item")].filter((item) => item.closest(".z-menu") === menu && !isDisabled(item));
}

function highlight(menu: Element, item: HTMLElement | undefined): void {
  for (const other of menu.querySelectorAll("[data-highlighted]"))
    if (other.closest(".z-menu") === menu) other.removeAttribute("data-highlighted");
  if (!item) return;
  item.setAttribute("data-highlighted", "");
  item.focus({ preventScroll: true });
}

/**
 * Abre un elemento `[popover]` anclado a `anchor` (un elemento o un punto de la ventana). Anclado a un elemento, lo
 * sigue cuando la página se desplaza o cambia de tamaño; `follow: false` lo deja donde se abrió. `trigger` es quien lo
 * abre cuando no es el ancla (recibe `aria-expanded` y el foco al cerrar). Un `.z-popover` se coloca con CSS anchor
 * positioning donde el navegador lo admite (mejora progresiva); si no, con `place()`.
 */
export function openPopover(
  el: HTMLElement,
  anchor: Element | { x: number; y: number },
  placement: Placement = "bottom-start",
  options: { follow?: boolean; trigger?: Element } = {},
): void {
  if (!el.hasAttribute("popover")) el.setAttribute("popover", "auto");
  el.dataset.state = "open";
  if (!el.matches(":popover-open")) el.showPopover();
  const gap = anchor instanceof Element ? 6 + (el.hasAttribute("data-arrow") ? 7 : 0) : 0;
  let css = anchor instanceof Element && el.classList.contains("z-popover") ? anchorWithCss(el, anchor, placement, gap) : null;
  if (css) cssAnchors.set(el, css);
  const position = () => {
    // Con CSS anchor positioning solo se mide; si el motor la dejó lejos del ancla, se vuelve a `place()`.
    if (css?.measure()) return;
    css?.release();
    css = null;
    cssAnchors.delete(el);
    const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : new DOMRect(anchor.x, anchor.y, 0, 0);
    place(el, rect, placement, gap);
  };
  position();
  // Con CSS anchor positioning, algún motor aplica el desplazamiento de la página con retraso: se vigila un momento.
  if (css) settleAnchoring(() => el.matches(":popover-open") && position());
  if (anchor instanceof Element) {
    const owner = options.trigger ?? anchor;
    anchors.set(el, owner);
    owner.setAttribute("aria-expanded", "true");
    if (options.follow !== false) followers.set(el, position);
  }
  if (el.classList.contains("z-menu")) highlight(el, menuItems(el)[0]);
  emit(el, "open");
}

// Popovers colocados con CSS anchor positioning: al cerrarse se retira el ancla.
const cssAnchors = new WeakMap<HTMLElement, CssAnchoring>();

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
  return byRef(trigger.getAttribute("data-z-submenu"));
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
    // Pegado al borde del menú padre y con la primera entrada a la altura del disparador. En RTL abre hacia la izquierda.
    const position = () => {
      place(
        sub,
        submenuAnchor(parent.getBoundingClientRect(), trigger.getBoundingClientRect(), topInset(sub)),
        isRtl(sub) ? "left-start" : "right-start",
        4,
      );
    };
    position();
    followers.set(sub, position);
    emit(sub, "open");
  }
  if (focusFirst) highlight(sub, menuItems(sub)[0]);
}

let subTimer: ReturnType<typeof setTimeout> | undefined;

const aim = createMenuAim();

/**
 * Puntero sobre una entrada: la resalta y, con un pequeño retardo, abre su submenú o cierra el de otra entrada.
 * Mientras el puntero va camino del submenú abierto (zona de gracia), las entradas que cruza no cuentan.
 */
function onMenuPointer(item: HTMLElement, event: PointerEvent): void {
  const menu = item.closest<HTMLElement>(".z-menu")!;
  const open = openChild(menu);
  if (open && submenuOf(item) !== open && aim.blocks({ x: event.clientX, y: event.clientY })) return;
  highlight(menu, item);
  clearTimeout(subTimer);
  if (item.hasAttribute("data-z-submenu")) {
    if (submenuOf(item) !== open) subTimer = setTimeout(() => openSubmenu(item), 100);
  } else if (open) subTimer = setTimeout(() => closePopover(open), 200);
}

/**
 * Casilla (`menuitemcheckbox`) o radio (`menuitemradio`) de un menú: cambia `aria-checked` y emite `z:change` en la
 * entrada (`{ checked }`) o en su grupo (`{ value }`, el `value` o `data-value` de la opción). Otra entrada no cambia.
 */
function checkItem(item: HTMLElement): void {
  const role = item.getAttribute("role");
  if (role === "menuitemcheckbox") {
    const checked = item.getAttribute("aria-checked") !== "true";
    item.setAttribute("aria-checked", String(checked));
    emit(item, "change", { checked });
  } else if (role === "menuitemradio" && item.getAttribute("aria-checked") !== "true") {
    const group = item.closest<HTMLElement>('[role="group"], .z-menu') ?? item;
    for (const other of group.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
      if (other.closest(".z-menu") === item.closest(".z-menu")) other.setAttribute("aria-checked", String(other === item));
    emit(group, "change", { value: item.getAttribute("value") ?? item.dataset.value ?? "" });
  }
}

// Búsqueda por letra: enfoca la siguiente entrada cuyo texto empieza por lo tecleado.
const menuSearch = createTypeahead(600);

function typeahead(menu: HTMLElement, key: string): boolean {
  const items = menuItems(menu);
  const text = (item: HTMLElement) => (item.querySelector(".z-menu__text") ?? item).textContent ?? "";
  const hit = items[menuSearch(items.map(text), key, items.indexOf(document.activeElement as HTMLElement))];
  if (hit) highlight(menu, hit);
  return hit !== undefined;
}

function onPopoverToggle(event: Event): void {
  const el = event.target as HTMLElement;
  if ((event as ToggleEvent).newState !== "closed" || !el.hasAttribute?.("popover")) return;
  followers.delete(el);
  cssAnchors.get(el)?.release();
  cssAnchors.delete(el);
  const anchor = anchors.get(el);
  if (anchor) {
    anchor.setAttribute("aria-expanded", "false");
    if (anchor.hasAttribute("data-z-submenu")) (anchor as HTMLElement).dataset.state = "closed";
    if (el.contains(document.activeElement) || document.activeElement === document.body)
      (anchor as HTMLElement).focus?.({ preventScroll: true });
    anchors.delete(el);
  }
  el.dataset.state = "closed";
  emit(el, "close");
}

/* ---------- Tooltip ---------- */

// WCAG 1.4.13: la burbuja se puede descartar sin mover el puntero (Escape), el puntero puede pasar a ella sin que
// se cierre (hoverable) y sigue visible mientras el puntero o el foco estén en el disparador o en la burbuja.
const TIP_OPEN_MS = 350;
const TIP_CLOSE_MS = 120;
let tip: HTMLElement | undefined;
let tipHost: HTMLElement | undefined;
let tipTimer: ReturnType<typeof setTimeout> | undefined;
let tipId = 0;

const describedBy = (el: Element) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);

function showTooltip(target: HTMLElement): void {
  const text = target.getAttribute("data-z-tooltip");
  if (!text) return;
  clearTimeout(tipTimer);
  if (tipHost === target) return;
  hideTooltip();
  tipTimer = setTimeout(() => {
    if (!target.isConnected) return;
    tip = document.createElement("div");
    tip.className = "z-liquid z-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.setAttribute("popover", "manual");
    tip.id = `z-tip-${++tipId}`;
    tip.textContent = text;
    // Dentro del diálogo modal que contiene al disparador: fuera de él la burbuja quedaría inerte.
    (target.closest("dialog[open]") ?? document.body).append(tip);
    tip.showPopover();
    place(tip, target.getBoundingClientRect(), (target.getAttribute("data-z-placement") as Placement) ?? "top");
    // Se añade a la descripción que el control ya tuviera (la ayuda de un Field), sin sustituirla.
    target.setAttribute("aria-describedby", [...describedBy(target), tip.id].join(" "));
    tipHost = target;
  }, TIP_OPEN_MS);
}

function hideTooltip(): void {
  clearTimeout(tipTimer);
  if (!tip) return;
  if (tipHost) {
    const rest = describedBy(tipHost).filter((id) => id !== tip!.id);
    if (rest.length) tipHost.setAttribute("aria-describedby", rest.join(" "));
    else tipHost.removeAttribute("aria-describedby");
  }
  tip.remove();
  tip = undefined;
  tipHost = undefined;
}

/** Cierre diferido: da tiempo a que el puntero cruce del disparador a la burbuja. */
function scheduleHideTooltip(): void {
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTooltip, TIP_CLOSE_MS);
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
  /** Nombre accesible de la región de avisos. F8 lleva el foco a ella. */
  regionLabel?: string;
  /** En curso: anillo de carga, `aria-busy` y sin cierre automático hasta que se actualice. */
  loading?: boolean;
}

/** Lo que devuelve `toast()`: descarta el aviso al llamarla; `update()` cambia su texto, intención, duración o carga. */
export interface ToastHandle {
  (): void;
  update(options: Partial<Pick<ToastOptions, "title" | "description" | "intent" | "duration" | "loading">>): void;
}

// Avisos que ya hicieron su entrada: al mudar o volver a mostrar la región no la repiten.
const toastShown = new WeakSet<Element>();
let unfollowToasts: (() => void) | undefined;

/**
 * Lleva la región de avisos al diálogo modal de arriba (fuera de él sería inerte) o a `<body>`, y la vuelve a mostrar
 * para que quede por encima de todo en la capa superior.
 */
function raiseToasts(host: HTMLElement, to: HTMLElement = modalHost()): void {
  moveToHost(host, to);
  if (host.matches(":popover-open")) host.hidePopover();
  host.showPopover();
  settleShown(host, '.z-toast[data-state="open"]', toastShown);
}

function viewport(position: string, label: string): HTMLElement {
  let host = document.querySelector<HTMLElement>(".z-toast-viewport");
  if (!host) {
    host = document.createElement("div");
    host.className = "z-toast-viewport";
    host.setAttribute("popover", "manual");
    // Región con nombre (landmark); cada aviso lleva role status o alert.
    host.setAttribute("role", "region");
    host.tabIndex = -1;
  }
  host.setAttribute("aria-label", label);
  host.dataset.position = position;
  raiseToasts(host);
  // Mientras haya avisos, la región sigue al diálogo modal que se abra o se cierre.
  const region = host;
  unfollowToasts ??= followModalHost((to) => {
    if (region.isConnected || region.children.length) raiseToasts(region, to);
  });
  return host;
}

/**
 * Muestra un aviso con el mismo marcado que el Toast de React. Devuelve una función para descartarlo, con `update()`
 * para cambiarlo en su sitio (lo que usa `toastPromise`).
 */
export function toast({
  title,
  description,
  intent = "info",
  duration = 5000,
  action,
  position = "bottom-right",
  closeLabel = "Close",
  regionLabel = "Notifications (F8)",
  loading = false,
}: ToastOptions): ToastHandle {
  const host = viewport(position, regionLabel);
  const item = document.createElement("div");
  item.className = "z-liquid z-toast";
  item.dataset.intent = intent;
  item.dataset.state = "open";
  item.setAttribute("role", intent === "danger" || intent === "warning" ? "alert" : "status");
  item.tabIndex = 0;
  setMarkup(
    item,
    `<span class="z-toast__dot" aria-hidden="true"></span><div class="z-toast__content"><div class="z-toast__title"></div></div><button type="button" class="z-overlay-close z-toast__close">${iconSvg("x-mark", { size: 16 })}</button>`,
  );
  const content = item.querySelector(".z-toast__content")!;
  content.querySelector(".z-toast__title")!.textContent = title;
  item.querySelector(".z-toast__close")!.setAttribute("aria-label", closeLabel);
  const describe = (text: string | undefined) => {
    let node = content.querySelector<HTMLElement>(".z-toast__description");
    if (!text) return node?.remove();
    if (!node) {
      node = document.createElement("div");
      node.className = "z-toast__description";
      content.querySelector(".z-toast__title")!.after(node);
    }
    node.textContent = text;
  };
  describe(description);
  const setLoading = (on: boolean) => {
    const mark = item.firstElementChild!;
    mark.className = on ? "z-toast__spinner" : "z-toast__dot";
    if (on) {
      item.dataset.loading = "";
      item.setAttribute("aria-busy", "true");
    } else {
      delete item.dataset.loading;
      item.removeAttribute("aria-busy");
    }
  };
  setLoading(loading);
  // Cierre automático con pausa (WCAG 2.2.1): el tiempo no corre mientras el puntero o el foco están en el aviso,
  // ni durante un gesto de descarte; al salir continúa con lo que quedaba.
  let timer = createTimer(loading ? 0 : duration, () => dismiss());
  const hold = (reason: string) => timer.hold(reason);
  const release = (reason: string) => timer.release(reason);
  const whileOpen = new AbortController();
  const dismiss = () => {
    timer.stop();
    whileOpen.abort();
    if (item.dataset.state === "closed") return;
    item.dataset.state = "closed";
    // El foco no se queda en un aviso que desaparece: vuelve a donde estaba antes de entrar en la región.
    const hadFocus = item.contains(document.activeElement);
    afterExit(item, () => {
      item.remove();
      if (!host.children.length) {
        if (host.matches(":popover-open")) host.hidePopover();
        unfollowToasts?.();
        unfollowToasts = undefined;
      }
      if (hadFocus) (toastReturn?.isConnected ? toastReturn : null)?.focus({ preventScroll: true });
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
  item.addEventListener("pointerenter", () => hold("pointer"));
  item.addEventListener("pointerleave", () => release("pointer"));
  item.addEventListener("focusin", () => hold("focus"));
  item.addEventListener("focusout", (event) => {
    if (!item.contains(event.relatedTarget as Node | null)) release("focus");
  });
  item.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dismiss();
  });
  // Con la ventana sin foco nadie está leyendo el aviso: el tiempo se detiene hasta que vuelve.
  window.addEventListener("blur", () => hold("window"), { signal: whileOpen.signal });
  window.addEventListener("focus", () => release("window"), { signal: whileOpen.signal });
  swipeToDismiss(item, {
    direction: swipeDirection(position),
    onStart: () => hold("swipe"),
    onCancel: () => release("swipe"),
    onDismiss: dismiss,
  });
  host.append(item);
  toastShown.add(item);
  timer.start();
  const handle = dismiss as ToastHandle;
  handle.update = (next) => {
    if (item.dataset.state === "closed") return;
    if (next.title !== undefined) content.querySelector(".z-toast__title")!.textContent = next.title;
    if ("description" in next) describe(next.description);
    if (next.intent) {
      item.dataset.intent = next.intent;
      item.setAttribute("role", next.intent === "danger" || next.intent === "warning" ? "alert" : "status");
    }
    const busy = next.loading ?? item.hasAttribute("data-loading");
    setLoading(busy);
    // La cuenta atrás empieza de nuevo con la duración nueva (ninguna mientras está en curso).
    timer.stop();
    timer = createTimer(busy ? 0 : (next.duration ?? duration), () => dismiss());
    if (item.matches(":hover")) timer.hold("pointer");
    if (item.contains(document.activeElement)) timer.hold("focus");
    timer.start();
  };
  return handle;
}

/** Mensaje de un estado de `toastPromise`: un texto o las opciones del aviso. */
export type ToastPromiseMessage<T> = string | Partial<ToastOptions> | ((value: T) => string | Partial<ToastOptions>);

/**
 * Aviso que sigue a una promesa (como `toast.promise` de React): «cargando» sin cierre automático y, al resolverse,
 * el mensaje de éxito o de error en el mismo aviso, que entonces se cierra solo. Devuelve la misma promesa.
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: { loading: string | ToastOptions; success: ToastPromiseMessage<T>; error: ToastPromiseMessage<unknown> },
): Promise<T> {
  const start = typeof messages.loading === "string" ? { title: messages.loading } : messages.loading;
  const handle = toast({ ...start, loading: true });
  const settle = <V>(message: ToastPromiseMessage<V>, value: V, intent: "success" | "danger") => {
    const resolved = typeof message === "function" ? message(value) : message;
    const options = typeof resolved === "string" ? { title: resolved } : resolved;
    handle.update({ intent, description: undefined, ...options, loading: false });
  };
  promise.then(
    (value) => settle(messages.success, value, "success"),
    (error: unknown) => settle(messages.error, error, "danger"),
  );
  return promise;
}

// Elemento que tenía el foco antes de entrar en la región de avisos con F8.
let toastReturn: HTMLElement | null = null;

/** F8 lleva el foco al aviso más reciente, como el Toast de React. */
function focusToasts(): boolean {
  const host = document.querySelector<HTMLElement>(".z-toast-viewport");
  const last = host?.querySelector<HTMLElement>('.z-toast[data-state="open"]:last-of-type');
  if (!host || !last) return false;
  if (!host.contains(document.activeElement)) toastReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  last.focus();
  return true;
}

/* ---------- Confirmación ---------- */

export interface ConfirmOptions {
  title: string;
  description?: string;
  intent?: "default" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
}

let confirmId = 0;

/**
 * Diálogo de confirmación; resuelve `true` si se confirma. Mismo marcado que ConfirmDialog: `role="alertdialog"`
 * con nombre (aria-labelledby) y descripción (aria-describedby). Escape cancela; el clic en el velo no cierra.
 */
export function confirm({
  title,
  description,
  intent = "default",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: ConfirmOptions): Promise<boolean> {
  const dialog = document.createElement("dialog");
  const id = `z-confirm-${++confirmId}`;
  dialog.className = "z-liquid z-modal z-confirm";
  dialog.dataset.intent = intent;
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  dialog.setAttribute("data-z-static", "");
  setMarkup(
    dialog,
    `<header class="z-modal__header"><span class="z-confirm__icon">${iconSvg(intent === "danger" ? "exclamation-triangle" : "information-circle", { size: 16 })}</span><div class="z-modal__heading"><h2 class="z-modal__title" id="${id}-title"></h2></div></header><footer class="z-modal__footer"><button type="button" class="z-dialog-btn" data-variant="secondary" value="cancel"></button><button type="button" class="z-dialog-btn" data-variant="${intent === "danger" ? "danger" : "primary"}" value="confirm"></button></footer>`,
  );
  dialog.querySelector(".z-modal__title")!.textContent = title;
  if (description) {
    const text = document.createElement("p");
    text.className = "z-modal__description";
    text.id = `${id}-description`;
    text.textContent = description;
    dialog.querySelector(".z-modal__heading")!.append(text);
    dialog.setAttribute("aria-describedby", text.id);
  }
  const [cancel, ok] = dialog.querySelectorAll<HTMLButtonElement>(".z-dialog-btn");
  cancel!.textContent = cancelLabel;
  ok!.textContent = confirmLabel;
  document.body.append(dialog);
  return new Promise((resolve) => {
    cancel!.addEventListener("click", () => closeDialog(dialog, "cancel"));
    ok!.addEventListener("click", () => closeDialog(dialog, "confirm"));
    // Escape (y el gesto atrás del sistema) cancelan, como el ConfirmDialog de React. El velo sigue sin cerrar.
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeDialog(dialog, "cancel");
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog(dialog, "cancel");
    });
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

// Un acordeón puede llevar otro dentro de una sección: cada uno solo cuenta sus propias piezas.
const ownPart = <T extends HTMLElement>(item: Element, selector: string) =>
  [...item.querySelectorAll<T>(selector)].find((el) => el.closest(".z-accordion__item") === item);
const accordionItems = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>(".z-accordion__item")].filter((item) => item.closest(".z-accordion") === root);
const sectionValue = (item: HTMLElement) => item.dataset.value ?? ownPart(item, ".z-accordion__content")?.id ?? "";

// Secciones que están terminando su animación de cierre: función que cancela la espera.
const closing = new WeakMap<HTMLElement, () => void>();

/**
 * Abre o cierra una sección. Con `animate`, la altura se anima entre 0 y `--z-accordion-content-height` (medida
 * aquí) y, al cerrar, el contenido se oculta cuando termina la animación. Sin él (marcado inicial) no hay animación.
 */
function setSection(item: Element, open: boolean, animate = false): void {
  const trigger = ownPart<HTMLElement>(item, ".z-accordion__trigger");
  const content = ownPart<HTMLElement>(item, ".z-accordion__content");
  const state = open ? "open" : "closed";
  (item as HTMLElement).dataset.state = state;
  if (trigger) {
    trigger.dataset.state = state;
    trigger.setAttribute("aria-expanded", String(open));
  }
  if (content) {
    const changed = content.dataset.state !== state || content.hidden === open;
    content.dataset.state = state;
    closing.get(content)?.();
    closing.delete(content);
    if (!animate || !changed) {
      content.style.animation = "none";
      content.hidden = !open;
      return;
    }
    content.style.removeProperty("animation");
    content.hidden = false;
    content.style.setProperty("--z-accordion-content-height", `${content.scrollHeight}px`);
    if (!open)
      closing.set(
        content,
        afterExit(content, () => {
          content.hidden = true;
        }),
      );
  }
}

/** `data-collapsible="false"` (una sola abierta): la cabecera de la abierta no la cierra y lleva aria-disabled. */
function lockAccordion(root: HTMLElement): void {
  const lock = root.dataset.collapsible === "false" && root.dataset.type !== "multiple";
  for (const item of accordionItems(root)) {
    const trigger = ownPart<HTMLElement>(item, ".z-accordion__trigger");
    if (!trigger || item.hasAttribute("data-disabled")) continue;
    const locked = lock && item.dataset.state === "open";
    trigger.toggleAttribute("data-locked", locked);
    if (locked) trigger.setAttribute("aria-disabled", "true");
    else if (trigger.hasAttribute("data-locked") || lock) trigger.removeAttribute("aria-disabled");
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

const isChecked = (el: HTMLElement) =>
  el.getAttribute("aria-checked") === "true" || el.dataset.state === "checked" || el.dataset.state === "on";

function toggleChecked(el: HTMLElement): void {
  if (isDisabled(el)) return;
  const next = !isChecked(el);
  setChecked(el, next);
  emit(el, "change", { checked: next });
}

/* ---------- Rating: .z-rating[data-interactive] > .z-rating__stars[role="radiogroup"] ---------- */

const ratingStars = (group: Element) => [...group.querySelectorAll<HTMLElement>(".z-rating__star")];
const starValue = (star: HTMLElement, index: number) => Number(star.dataset.star) || index + 1;

/** Dibuja la valoración: estrellas rellenas hasta `value`, radio marcado y parada de tabulación. */
function paintRating(group: HTMLElement, value: number, shown = value): void {
  const stars = ratingStars(group);
  stars.forEach((star, index) => {
    const n = starValue(star, index);
    const checked = n === value;
    star.setAttribute("aria-checked", String(checked));
    star.tabIndex = checked || ((value < 1 || value > stars.length) && index === 0) ? 0 : -1;
    star.toggleAttribute("data-filled", n <= shown);
    const variant = n <= shown ? "solid" : "outline";
    const glyph = star.querySelector("z-icon");
    const svg = star.querySelector("svg.z-icon");
    if (glyph) {
      if ((glyph.getAttribute("variant") ?? "outline") !== variant) glyph.setAttribute("variant", variant);
    } else if (svg && svg.getAttribute("data-variant") !== variant) {
      const holder = document.createElement("span");
      setMarkup(holder, iconSvg(svg.getAttribute("data-icon") ?? "star", { variant, size: svg.getAttribute("width") ?? 18 }));
      svg.replaceWith(...holder.childNodes);
    }
  });
}

const ratingValue = (group: Element) => {
  const stars = ratingStars(group);
  const at = stars.findIndex((star) => star.getAttribute("aria-checked") === "true");
  return at < 0 ? 0 : starValue(stars[at]!, at);
};

/** Elige una estrella: z:change { value } en `.z-rating`, igual que `onChange` del Rating de React. */
function rate(group: HTMLElement, star: HTMLElement): void {
  const stars = ratingStars(group);
  const value = starValue(star, stars.indexOf(star));
  const before = ratingValue(group);
  paintRating(group, value);
  if (value !== before) emit(group.closest(".z-rating") ?? group, "change", { value });
}

/** Prepara el marcado estático dentro de `[data-z-dom]`: orden de tabulación de pestañas y grupos de radio. */
const edgeTracked = new WeakSet<HTMLElement>();

export function hydrate(root: ParentNode = document): void {
  // Tiras con desplazamiento horizontal: difuminado del borde con contenido oculto (data-scroll-edges).
  for (const strip of root.querySelectorAll<HTMLElement>(
    '[data-z-dom] .z-tabs__list:not([data-orientation="vertical"]), [data-z-dom] .z-listbox[data-orientation="horizontal"] > .z-listbox__viewport',
  )) {
    if (edgeTracked.has(strip)) continue;
    edgeTracked.add(strip);
    trackScrollEdges(strip);
  }
  for (const tabs of root.querySelectorAll<HTMLElement>("[data-z-dom] .z-tabs, .z-tabs[data-z-dom]")) {
    const active = tabs.querySelector<HTMLElement>('.z-tabs__tab[data-state="active"]') ?? tabs.querySelector<HTMLElement>(".z-tabs__tab");
    if (active) selectTabQuiet(tabs, tabKey(active));
  }
  // Un interruptor, casilla o radio sin `aria-checked` no tiene estado para las tecnologías de apoyo: sale de `data-state`.
  for (const el of root.querySelectorAll<HTMLElement>(
    '[data-z-dom] :is([role="switch"], [role="checkbox"], [role="radio"]):not([aria-checked])',
  )) {
    el.setAttribute("aria-checked", el.dataset.state === "indeterminate" ? "mixed" : String(isChecked(el)));
  }
  for (const group of root.querySelectorAll<HTMLElement>('[data-z-dom] [role="radiogroup"]')) {
    if (group.matches(".z-rating__stars")) {
      paintRating(group, ratingValue(group));
      continue;
    }
    const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]')];
    const current = radios.find(isChecked) ?? radios.find((r) => !isDisabled(r));
    for (const radio of radios) radio.tabIndex = radio === current ? 0 : -1;
  }
  for (const section of root.querySelectorAll<HTMLElement>("[data-z-dom] .z-accordion__item"))
    setSection(section, section.dataset.state === "open");
  for (const accordion of root.querySelectorAll<HTMLElement>('[data-z-dom] .z-accordion[data-collapsible="false"]'))
    lockAccordion(accordion);
  for (const trigger of root.querySelectorAll<HTMLElement>(".z-menu__item[data-z-submenu]")) describeSubmenu(trigger);
  for (const mod of modules) mod.hydrate(root);
}

function onClick(event: MouseEvent): void {
  const target = event.target as Element;
  if (!(target instanceof Element)) return;

  const opener = target.closest<HTMLElement>("[data-z-open]");
  if (opener) {
    if (isDisabled(opener)) return;
    const el = byRef(opener.getAttribute("data-z-open"));
    if (el instanceof HTMLDialogElement) openDialog(el);
    else if (el) {
      if (el.matches(":popover-open")) closePopover(el);
      else {
        // `data-z-anchor="#id"`: se coloca junto a otro elemento; el disparador sigue siendo el que lo abre.
        const anchor = byRef(opener.getAttribute("data-z-anchor")) ?? opener;
        openPopover(el, anchor, (opener.getAttribute("data-z-placement") as Placement) ?? "bottom-start", { trigger: opener });
      }
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

  // Clic en el velo de un <dialog>: el objetivo es el propio diálogo. Solo cuenta si la pulsación también empezó
  // en el velo: soltar fuera tras seleccionar texto dentro del diálogo no lo cierra.
  if (target instanceof HTMLDialogElement && target.matches(".z-modal, .z-drawer") && !target.hasAttribute("data-z-static")) {
    if (pressedOnBackdrop(target, event)) closeDialog(target);
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
    checkItem(item);
    emit(item, "select");
    // Elegir cierra toda la cadena: el menú raíz se lleva consigo sus submenús.
    if (!item.hasAttribute("data-keep-open")) closeChain(item.closest<HTMLElement>(".z-menu")!);
    return;
  }

  if (!inDom(target)) return;

  const tab = target.closest<HTMLElement>(".z-tabs__tab");
  if (tab && !isDisabled(tab)) {
    selectTab(tab.closest(".z-tabs")!, tabKey(tab));
    return;
  }

  const trigger = target.closest<HTMLElement>(".z-accordion__trigger");
  if (trigger) {
    const section = trigger.closest<HTMLElement>(".z-accordion__item");
    if (!section || isDisabled(trigger) || section.hasAttribute("data-disabled")) return;
    const root = section.closest<HTMLElement>(".z-accordion");
    const open = trigger.dataset.state !== "open";
    if (open && root && root.dataset.type !== "multiple")
      for (const other of accordionItems(root)) if (other !== section) setSection(other, false, true);
    setSection(section, open, true);
    if (root) lockAccordion(root);
    // Secciones abiertas, como `onValueChange` del Accordion de React.
    if (root)
      emit(root, "change", {
        value: accordionItems(root)
          .filter((item) => item.dataset.state === "open")
          .map(sectionValue),
      });
    return;
  }

  const check = target.closest<HTMLElement>('[role="switch"], [role="checkbox"]');
  if (check) {
    toggleChecked(check);
    return;
  }

  const radio = target.closest<HTMLElement>('[role="radio"]');
  if (radio && !isDisabled(radio)) {
    const group = radio.closest<HTMLElement>('[role="radiogroup"]');
    if (group?.matches(".z-rating__stars")) {
      rate(group, radio);
      return;
    }
    for (const other of group?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [radio]) {
      setChecked(other, other === radio);
      other.tabIndex = other === radio ? 0 : -1;
    }
    if (group) emit(group, "change", { value: radio.getAttribute("value") ?? radio.dataset.value });
    return;
  }

  // Toggle suelto: no los de un ToggleGroup ni el de mostrar contraseña (los atienden ./actions y ./forms-fields), ni
  // los botones de una pieza que lleva su propio estado (Calendar, mapa de calor, gráficos).
  const pressed = target.closest<HTMLElement>("button[aria-pressed]:not(.z-toggle-group > .z-toggle, .z-password__toggle)");
  if (pressed && !pressed.closest(".z-calendar, .z-heatmap, .z-chart")) {
    const next = pressed.getAttribute("aria-pressed") !== "true";
    pressed.setAttribute("aria-pressed", String(next));
    pressed.dataset.state = next ? "on" : "off";
    emit(pressed, "change", { pressed: next });
  }
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as Element;
  // El autocompletado del navegador emite `keydown` sin `key`.
  if (!(target instanceof Element) || typeof event.key !== "string") return;

  if (event.key === "F8" && !event.ctrlKey && !event.metaKey && !event.altKey && focusToasts()) {
    event.preventDefault();
    return;
  }
  // Escape es de la capa de arriba (la lista de un Select o un Combobox, el panel de un DatePicker) antes que del
  // menú o del diálogo que la contenga. Un evento ya cancelado no cierra nada.
  if (event.key === "Escape" && (event.defaultPrevented || escapeTop(event))) return;

  const menu = target.closest<HTMLElement>(".z-menu[popover]");
  if (menu) {
    // Menú de una barra (Menubar): las flechas laterales pueden pasar al menú vecino.
    if (navigation.menubarKeyInMenu(menu, event)) return;
    const current = target.closest<HTMLElement>(".z-menu__item");
    const own = current && current.closest(".z-menu") === menu && !isDisabled(current) ? current : null;
    const parentTrigger = anchors.get(menu);
    const next = move(menuItems(menu), document.activeElement as HTMLElement | null, event.key, true);
    if (next) {
      event.preventDefault();
      // El foco pasa a otra entrada: el submenú que dejó abierto la anterior se cierra.
      const open = openChild(menu);
      if (open && submenuOf(next) !== open) closePopover(open);
      clearTimeout(subTimer);
      highlight(menu, next);
    } else if (event.key === "Tab") closeChain(menu);
    else if (event.key === " " && own?.getAttribute("role") === "menuitemcheckbox") {
      // Espacio cambia la casilla y deja el menú abierto (APG); Intro la cambia y cierra (clic).
      event.preventDefault();
      checkItem(own);
    } else if (
      (logicalKey(event.key, menu) === "ArrowRight" || event.key === "Enter" || event.key === " ") &&
      own?.hasAttribute("data-z-submenu")
    ) {
      event.preventDefault();
      clearTimeout(subTimer);
      openSubmenu(own, true);
    } else if (logicalKey(event.key, menu) === "ArrowLeft" && parentTrigger?.hasAttribute("data-z-submenu")) {
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

  // Tab en un diálogo modal da la vuelta dentro de él: el navegador dejaría salir el foco hacia su propia interfaz.
  if (event.key === "Tab" && !event.defaultPrevented) {
    const dialog = target.closest<HTMLDialogElement>("dialog.z-modal, dialog.z-drawer, dialog.z-palette");
    if (dialog?.open && dialog.matches(":modal") && trapTab(dialog, event)) event.preventDefault();
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
  // Una casilla se marca con Espacio; Intro no la cambia (APG checkbox; igual que en React).
  if (event.key === "Enter" && target.matches('button[role="checkbox"]')) {
    event.preventDefault();
    return;
  }
  // Acordeón (APG): las flechas, Inicio y Fin llevan el foco de una cabecera a otra.
  const header = target.closest<HTMLElement>(".z-accordion__trigger");
  if (header) {
    const root = header.closest(".z-accordion");
    const next = root
      ? move(
          [...root.querySelectorAll<HTMLElement>(".z-accordion__trigger")].filter(
            (t) => t.closest(".z-accordion") === root && (t.hasAttribute("data-locked") || !isDisabled(t)),
          ),
          header,
          event.key,
          true,
        )
      : undefined;
    if (next) {
      event.preventDefault();
      next.focus();
    }
    return;
  }
  const radio = target.closest<HTMLElement>('[role="radio"]');
  if (radio) {
    const list = [...(radio.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])].filter(
      (r) => !isDisabled(r),
    );
    // En RTL la flecha izquierda avanza.
    const next = moveBoth(list, radio, logicalKey(event.key, radio));
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
    const list = [...tabs.querySelectorAll<HTMLElement>(".z-tabs__tab")].filter((t) => t.closest(".z-tabs") === tabs && !isDisabled(t));
    const vertical = (tabs as HTMLElement).dataset.orientation === "vertical";
    const next = move(list, tab, vertical ? event.key : logicalKey(event.key, tab), vertical);
    if (next) {
      event.preventDefault();
      next.focus();
      selectTab(tabs, tabKey(next));
    }
  }
}

// Pulsación larga con dedo o lápiz: iOS no emite `contextmenu`, y un Chromium de escritorio con pantalla táctil tampoco.
const contextPress = createLongPress((point, event) => {
  const menu = contextMenuAt(event.target);
  if (!menu) return;
  openPopover(menu, point, "bottom-start");
  // Al levantar el dedo, el cierre ligero de los popovers `auto` lo trataría como un clic fuera. Con el puntero
  // capturado por el menú, ese `pointerup` cae dentro y no lo cierra; si aun así se cerró, se vuelve a abrir.
  try {
    menu.setPointerCapture(event.pointerId);
  } catch {
    // Puntero sintético o ya liberado.
  }
  const lift = new AbortController();
  const onLift = () => {
    lift.abort();
    setTimeout(() => {
      if (!menu.matches(":popover-open")) openPopover(menu, point, "bottom-start");
    });
  };
  window.addEventListener("pointerup", onLift, { capture: true, signal: lift.signal });
  window.addEventListener("pointercancel", onLift, { capture: true, signal: lift.signal });
});

function contextMenuAt(target: EventTarget | null): HTMLElement | null {
  const zone = target instanceof Element ? target.closest("[data-z-context]") : null;
  return zone ? byRef(zone.getAttribute("data-z-context")) : null;
}

let wiring: AbortController | undefined;

/**
 * Conecta el comportamiento. Idempotente; llamar una vez al cargar. Devuelve `destroy`, que retira todos los
 * listeners del documento (pruebas, microfrontends, navegación con sustitución de página).
 */
export function init(): () => void {
  if (!isBrowser) return () => {};
  if (wiring) return destroy;
  wiring = new AbortController();
  const on = listener(wiring.signal);
  on(document, "click", onClick);
  on(document, "keydown", onKeydown);
  // Escape cierra la burbuja sin mover el puntero ni el foco (WCAG 1.4.13); no consume la tecla.
  on(
    document,
    "keydown",
    (event) => {
      if (event.key === "Escape") hideTooltip();
    },
    true,
  );
  on(document, "pointerdown", notePress, true);
  on(document, "toggle", onPopoverToggle, true);
  on(document, "close", onNativeClose, true);
  on(document, "scroll", follow, { capture: true, passive: true });
  on(window, "resize", follow);
  on(
    document,
    "cancel",
    (event) => {
      // Cierre pedido por el navegador (Escape, gesto atrás del sistema): pasa por la animación de salida, o no
      // ocurre si el diálogo es estático. Con Escape ya lo hizo onKeydown; closeDialog() no repite.
      const dialog = event.target;
      if (!(dialog instanceof HTMLDialogElement) || !dialog.matches("dialog.z-modal, dialog.z-drawer")) return;
      event.preventDefault();
      if (!dialog.hasAttribute("data-z-static")) closeDialog(dialog);
    },
    true,
  );
  on(document, "contextmenu", (event) => {
    const menu = contextMenuAt(event.target);
    if (!menu) return;
    event.preventDefault();
    // Con el dedo ya lo abre (o lo va a abrir) la pulsación larga: Android emite además `contextmenu`.
    if (contextPress.pending() || contextPress.sinceFired() < 1000) return;
    const point = { x: event.clientX, y: event.clientY };
    const open = () => openPopover(menu, point, "bottom-start");
    // En Linux y macOS `contextmenu` llega al pulsar el botón, no al soltarlo: el `pointerup` que sigue cuenta como
    // clic fuera y cerraría el menú recién abierto (Firefox y WebKit). Con el botón aún pulsado se abre al soltar.
    if (event.buttons & 2) {
      const release = new AbortController();
      const onRelease = () => {
        release.abort();
        setTimeout(open);
      };
      window.addEventListener("pointerup", onRelease, { capture: true, signal: release.signal });
      window.addEventListener("pointercancel", onRelease, { capture: true, signal: release.signal });
    } else open();
  });
  on(
    document,
    "pointerdown",
    (event) => {
      contextPress.cancel();
      if (contextMenuAt(event.target)) contextPress.down(event);
    },
    true,
  );
  on(document, "pointermove", (event) => contextPress.move(event), true);
  on(document, "pointerup", () => contextPress.cancel(), true);
  on(document, "pointercancel", () => contextPress.cancel(), true);
  on(document, "pointerover", (event) => {
    const item = (event.target as Element).closest?.<HTMLElement>(".z-menu[popover] .z-menu__item");
    if (item && !isDisabled(item)) onMenuPointer(item, event);
    const host = (event.target as Element).closest?.<HTMLElement>("[data-z-tooltip]");
    if (host) showTooltip(host);
    // El puntero llegó a la burbuja: sigue abierta.
    else if (tip?.contains(event.target as Node)) clearTimeout(tipTimer);
  });
  on(document, "pointerout", (event) => {
    const from = event.target as Element;
    const to = event.relatedTarget as Node | null;
    // El puntero sale de una entrada con el submenú abierto: empieza la zona de gracia hacia él.
    const trigger = from.closest?.<HTMLElement>('.z-menu__item[data-z-submenu][aria-expanded="true"]');
    const sub = trigger && !trigger.contains(to) ? submenuOf(trigger) : null;
    if (sub?.matches(":popover-open"))
      aim.start({ x: event.clientX, y: event.clientY }, sub.getBoundingClientRect(), sub.dataset.side === "left" ? "left" : "right");
    const host = from.closest?.("[data-z-tooltip]");
    if (host && !host.contains(to)) {
      // Con el foco en el disparador la burbuja se queda: se cierra al perder el foco o con Escape.
      if (tipHost === host && host.matches(":focus-visible")) return;
      if (tip?.contains(to)) return;
      if (tipHost === host) scheduleHideTooltip();
      else hideTooltip();
    } else if (tip?.contains(from) && !tip.contains(to) && !(tipHost?.contains(to) ?? false)) scheduleHideTooltip();
  });
  on(document, "focusin", (event) => {
    const host = (event.target as Element).closest?.<HTMLElement>("[data-z-tooltip]");
    if (host?.matches(":focus-visible")) showTooltip(host);
  });
  on(document, "focusout", (event) => {
    if (!tipHost || tipHost.contains(event.target as Node)) hideTooltip();
  });
  for (const mod of modules) mod.setup(on);
  const ready = () => {
    detectSourceNesting();
    hydrate();
  };
  if (document.readyState === "loading") on(document, "DOMContentLoaded", ready);
  else ready();
  return destroy;
}

/**
 * Deshace `init()`: retira los listeners del documento y de la ventana, desmonta las agendas y las piezas de árbol
 * (gráficos, línea de tiempo, mapa de calor…) que montó `hydrate()` y cierra la burbuja de ayuda. El marcado queda
 * como está (los diálogos y popovers abiertos siguen abiertos). `init()` se puede volver a llamar.
 */
export function destroy(): void {
  wiring?.abort();
  wiring = undefined;
  agenda.destroyAgendas();
  widgets.destroyWidgets();
  contextPress.cancel();
  clearTimeout(subTimer);
  aim.clear();
  hideTooltip();
  unfollowToasts?.();
  unfollowToasts = undefined;
}
