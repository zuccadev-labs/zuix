// @zuccadev-labs/zuix-zout/dom — comportamiento sin framework de los layouts: Shell responsive (acoplado/cajón),
// ResizeHandle, SplitPane, TabStrip y secciones de Sidebar. Mismo marcado, clases y atributos de estado que el
// binding de React; los cálculos salen de ../logic, que comparten los dos lados.
//
// Uso declarativo:   import { init } from "@zuccadev-labs/zuix-zout/dom"; init();
// Uso imperativo:    setPanelOpen, togglePanel, closeDrawers, getShellModes, resizeTo, getSplitSizes, setSplitSizes,
//                    selectWorkTab, closeWorkTab, addWorkTab, setSectionOpen, dispose
//
// Todo se activa dentro de un contenedor [data-z-dom], para no chocar con React en la misma página.
// Atributos:
//   data-z-shell-toggle="sidebar|inspector"   botón que abre o cierra ese panel (data-z-shell="#id" si está fuera del shell)
//   data-z-close                              dentro de un cajón del shell: lo cierra
//   data-sidebar-breakpoint, data-inspector-breakpoint   en .z-shell: cortes en px (880 y 1180 por defecto)
//   data-panel-mode="auto|docked|overlay"     en el <aside>: preferencia de modo (auto por defecto)
//   hidden                                    en el <aside>: panel cerrado
//   data-close-label                          en .z-shell: nombre accesible del velo
//   data-default-size, data-step, data-var, data-z-resize="#id"   en .z-resize (data-side: left|right|top|bottom, o start|end, que siguen la dirección de escritura)
//   data-min-fraction                         en .z-split
//   data-new-title="Untitled"                 en .z-tabstrip__add: crea la pestaña sin código de la aplicación
// Tras insertar marcado nuevo: hydrate(contenedor).
// Eventos (burbujean y se pueden cancelar): z:modechange, z:open, z:close, z:resize, z:select, z:add, z:change.
import { iconElement, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { chevronDownSmall } from "@zuccadev-labs/zuix-zicon/icons/chevron-down-small";
import { chevronRightSmall } from "@zuccadev-labs/zuix-zicon/icons/chevron-right-small";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import {
  INSPECTOR_BREAKPOINT, RESIZE_MAX, RESIZE_MIN, RESIZE_STEP, SIDEBAR_BREAKPOINT, SPLIT_MIN_FRACTION,
  clamp, dividerKeyDelta, evenFractions, isHorizontal, moveDivider, panelMode, physicalSide, resizeByKey, resizeSign, revealOffset, tabKeyIndex,
  type PanelMode, type PhysicalSide, type ResizeSide,
} from "../logic";

export type { PanelMode } from "../logic";
export type ShellSide = "sidebar" | "inspector";
export type ShellModes = Record<ShellSide, PanelMode>;

// Iconos que este módulo dibuja por su cuenta cuando el marcado no usa <z-icon>.
registerIcons([xMark, chevronDownSmall, chevronRightSmall]);

const isBrowser = typeof document !== "undefined";
const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;

function emit(el: Element, name: string, detail?: unknown): boolean {
  return el.dispatchEvent(new CustomEvent(`z:${name}`, { bubbles: true, cancelable: true, detail }));
}

/** Elementos de `root` (incluido él mismo) que cumplen el selector y están bajo [data-z-dom]. */
function all(root: ParentNode, selector: string): HTMLElement[] {
  const list = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root);
  return list.filter(inDom);
}

const isRtl = (el: Element) => getComputedStyle(el).direction === "rtl";

/** `document.querySelector` con un selector que viene de un atributo del marcado: uno inválido no rompe el manejador. */
function query(selector: string): HTMLElement | null {
  try { return document.querySelector<HTMLElement>(selector); } catch { return null; }
}

const num = (value: string | null | undefined, fallback: number) => (value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : fallback);

/* ---------- Shell ---------- */

const SIDES: readonly ShellSide[] = ["sidebar", "inspector"];
const PANEL: Record<ShellSide, string> = { sidebar: ":scope > .z-shell__body > .z-shell__side", inspector: ":scope > .z-shell__body > .z-shell__inspector" };

interface PanelState {
  /** Si ahora mismo está abierto como cajón. */
  overlay: boolean;
  /** Elemento con foco antes de abrir el cajón. */
  previous: HTMLElement | null;
  /** Si estaba abierto la última vez que estuvo acoplado. */
  dockedOpen: boolean;
}
interface ShellState { width: number | null; modes: ShellModes | null; panels: Record<ShellSide, PanelState> }

const shells = new WeakMap<HTMLElement, ShellState>();
const panelOf = (shell: HTMLElement, side: ShellSide) => shell.querySelector<HTMLElement>(PANEL[side]);

function autoModes(shell: HTMLElement, state: ShellState): ShellModes {
  const mode = (side: ShellSide, fallback: number) =>
    panelMode(state.width, num(shell.getAttribute(`data-${side}-breakpoint`), fallback), panelOf(shell, side)?.dataset.panelMode as PanelMode | "auto" | undefined);
  return { sidebar: mode("sidebar", SIDEBAR_BREAKPOINT), inspector: mode("inspector", INSPECTOR_BREAKPOINT) };
}

function shellOf(el: Element): HTMLElement | null {
  // Un botón con `data-z-shell="#id"` apunta a ese shell aunque esté dentro de otro (shells anidados).
  const named = el.getAttribute("data-z-shell");
  const shell = (named ? query(named) : null) ?? el.closest<HTMLElement>(".z-shell") ?? query("[data-z-dom] .z-shell, .z-shell[data-z-dom]");
  return shell && shells.has(shell) ? shell : null;
}

/** Lleva al DOM el estado del shell: clases y roles de cajón, velo, zonas inertes, foco y botones. */
function syncShell(shell: HTMLElement): void {
  const state = shells.get(shell);
  const body = shell.querySelector<HTMLElement>(":scope > .z-shell__body");
  if (!state || !body) return;
  const auto = autoModes(shell, state);
  const panels = SIDES.map((side) => {
    const el = panelOf(shell, side);
    return { side, el, mode: el && !el.hidden ? auto[side] : null };
  });
  const drawerOpen = panels.some((p) => p.mode === "overlay");

  for (const { side, el, mode } of panels) {
    if (!el) continue;
    const overlay = mode === "overlay";
    el.classList.toggle("z-shell__drawer", overlay);
    el.dataset.mode = auto[side];
    el.dataset.panelMode ??= "auto";
    el.dataset.side ??= side === "sidebar" ? "left" : "right";
    if (overlay) {
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.tabIndex = -1;
    } else {
      for (const name of ["role", "aria-modal", "tabindex"]) el.removeAttribute(name);
    }
    // Con un cajón abierto, el panel que siga acoplado queda bajo el velo.
    el.inert = drawerOpen && mode === "docked";
  }
  for (const zone of body.querySelectorAll<HTMLElement>(":scope > .z-shell__rail, :scope > .z-shell__main")) zone.inert = drawerOpen;

  let scrim = body.querySelector<HTMLElement>(":scope > .z-shell__scrim");
  if (drawerOpen && !scrim) {
    scrim = document.createElement("button");
    scrim.setAttribute("type", "button");
    scrim.className = "z-shell__scrim";
    scrim.setAttribute("aria-label", shell.dataset.closeLabel ?? "Close panel");
    body.append(scrim);
  } else if (!drawerOpen) scrim?.remove();

  for (const toggle of document.querySelectorAll<HTMLElement>("[data-z-shell-toggle]")) {
    if (shellOf(toggle) !== shell) continue;
    const el = panelOf(shell, toggle.getAttribute("data-z-shell-toggle") as ShellSide);
    toggle.setAttribute("aria-expanded", String(!!el && !el.hidden));
  }

  // Foco: primero se devuelve el de los cajones que se cierran y después entra en el que se abre.
  for (const { side, el, mode } of panels) {
    const st = state.panels[side];
    if (!el || !st.overlay || mode === "overlay") continue;
    st.overlay = false;
    const previous = st.previous;
    st.previous = null;
    const active = document.activeElement;
    if (previous?.isConnected && (!active || active === document.body || el.contains(active))) previous.focus({ preventScroll: true });
  }
  for (const { side, el, mode } of panels) {
    const st = state.panels[side];
    if (!el || st.overlay || mode !== "overlay") continue;
    st.overlay = true;
    st.previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!el.contains(st.previous)) el.focus({ preventScroll: true });
  }
}

function setHidden(panel: HTMLElement, hidden: boolean, silent = false): void {
  if (panel.hidden === hidden) return;
  panel.hidden = hidden;
  if (!silent) emit(panel, hidden ? "close" : "open");
}

/** Recalcula los modos con el ancho medido y avisa con `z:modechange` si cambian. */
function measure(shell: HTMLElement, width: number): void {
  const state = shells.get(shell);
  if (!state) return;
  state.width = width;
  shell.dataset.measured = "";
  const next = autoModes(shell, state);
  const prev = state.modes;
  if (!prev || prev.sidebar !== next.sidebar || prev.inspector !== next.inspector) {
    state.modes = next;
    // Por defecto un panel que pasa a cajón se cierra y, al volver a caber, recupera cómo estaba acoplado.
    // Con preventDefault() en z:modechange la aplicación decide qué queda abierto.
    if (emit(shell, "modechange", next)) {
      for (const side of SIDES) {
        const el = panelOf(shell, side);
        const st = state.panels[side];
        if (!el) continue;
        if (next[side] === "overlay" && prev?.[side] !== "overlay") {
          st.dockedOpen = !el.hidden;
          setHidden(el, true, !prev);
        } else if (next[side] === "docked" && prev?.[side] === "overlay") setHidden(el, !st.dockedOpen);
      }
    }
  }
  syncShell(shell);
}

let shellObserver: ResizeObserver | undefined;

function hydrateShell(shell: HTMLElement): void {
  if (shells.has(shell)) return syncShell(shell);
  const panel = (): PanelState => ({ overlay: false, previous: null, dockedOpen: true });
  shells.set(shell, { width: null, modes: null, panels: { sidebar: panel(), inspector: panel() } });
  // Se mide antes del primer pintado para que un shell estrecho no muestre un instante los paneles acoplados.
  measure(shell, shell.getBoundingClientRect().width);
  if (typeof ResizeObserver === "undefined") return;
  shellObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const target = entry.target as HTMLElement;
      // Un shell retirado del documento deja de observarse: el observador no lo retiene y vuelve a activarse con hydrate().
      if (!target.isConnected) { shellObserver?.unobserve(target); shells.delete(target); continue; }
      measure(target, entry.contentRect.width);
    }
  });
  shellObserver.observe(shell);
}

/** Modo que corresponde a cada panel según el ancho medido, esté abierto o no. `null` si el shell no está activo. */
export function getShellModes(shell: HTMLElement): ShellModes | null {
  return shells.get(shell)?.modes ?? null;
}

/** Abre o cierra un panel del shell. Abrir uno cierra el otro si está en cajón: nunca hay dos cajones a la vez. */
export function setPanelOpen(shell: HTMLElement, side: ShellSide, open: boolean): void {
  const state = shells.get(shell);
  const el = panelOf(shell, side);
  if (!state || !el || el.hidden === !open) return;
  if (open) {
    const other: ShellSide = side === "sidebar" ? "inspector" : "sidebar";
    const otherEl = panelOf(shell, other);
    if (otherEl && state.modes?.[other] === "overlay") setHidden(otherEl, true);
  }
  setHidden(el, !open);
  syncShell(shell);
}

export function togglePanel(shell: HTMLElement, side: ShellSide): void {
  const el = panelOf(shell, side);
  // `hidden` no es solo booleano: "until-found" también es un panel oculto, y alternarlo es abrirlo.
  if (el) setPanelOpen(shell, side, el.hidden !== false);
}

/** Cierra el cajón abierto (lo que hacen Escape y el velo). Devuelve si había alguno. */
export function closeDrawers(shell: HTMLElement): boolean {
  const state = shells.get(shell);
  let closed = false;
  for (const side of SIDES) {
    const el = panelOf(shell, side);
    if (!state || !el || el.hidden || state.modes?.[side] !== "overlay") continue;
    setHidden(el, true);
    closed = true;
  }
  if (closed) syncShell(shell);
  return closed;
}

/* ---------- ResizeHandle ---------- */

function resizeOptions(handle: HTMLElement) {
  const side: PhysicalSide = physicalSide((handle.dataset.side ?? "right") as ResizeSide, isRtl(handle));
  const sel = handle.getAttribute("data-z-resize");
  return {
    side,
    target: sel ? query(sel) : handle.parentElement,
    min: num(handle.getAttribute("aria-valuemin"), RESIZE_MIN),
    max: num(handle.getAttribute("aria-valuemax"), RESIZE_MAX),
    step: num(handle.dataset.step, RESIZE_STEP),
    defaultSize: handle.dataset.defaultSize ? num(handle.dataset.defaultSize, 0) : undefined,
  };
}

function currentSize(handle: HTMLElement, { side, target }: { side: PhysicalSide; target: HTMLElement | null }): number {
  if (!target) return num(handle.getAttribute("aria-valuenow"), 0);
  const rect = target.getBoundingClientRect();
  return isHorizontal(side) ? rect.width : rect.height;
}

/**
 * Lleva el panel de un tirador a `size` px (acotado a su mínimo y máximo). En un panel del shell escribe
 * `--z-shell-panel-width`, como el binding de React; en otro elemento, su ancho o alto (o la variable de `data-var`).
 */
export function resizeTo(handle: HTMLElement, size: number): void {
  const { side, target, min, max } = resizeOptions(handle);
  const next = clamp(size, min, max);
  if (!emit(handle, "resize", { size: next })) return;
  handle.setAttribute("aria-valuenow", String(Math.round(next)));
  if (!target) return;
  const custom = handle.dataset.var ?? (target.matches(".z-shell__side, .z-shell__inspector") ? "--z-shell-panel-width" : undefined);
  if (custom) target.style.setProperty(custom, `${next}px`);
  else {
    // `next` es el tamaño exterior: con `box-sizing: content-box` se descuenta relleno y borde.
    const prop = isHorizontal(side) ? "width" : "height";
    const extra = currentSize(handle, { side, target }) - parseFloat(getComputedStyle(target)[prop]);
    target.style[prop] = `${next - (Number.isFinite(extra) ? extra : 0)}px`;
  }
}

/* ---------- SplitPane ---------- */

const parts = (split: Element, cls: string) => [...split.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains(cls));
const directionOf = (split: HTMLElement) => (split.dataset.direction === "column" ? "column" : "row");

/** Reparto actual, una fracción por panel (el `flex-grow` de cada uno). */
export function getSplitSizes(split: HTMLElement): number[] {
  const sizes = parts(split, "z-split__pane").map((pane) => parseFloat(pane.style.flexGrow));
  return sizes.every((v) => Number.isFinite(v) && v >= 0) ? sizes : evenFractions(sizes.length);
}

/** Fija el reparto sin emitir `z:resize`. */
export function setSplitSizes(split: HTMLElement, sizes: number[]): void {
  parts(split, "z-split__pane").forEach((pane, i) => { pane.style.flexGrow = String(sizes[i] ?? 0); });
  parts(split, "z-split__divider").forEach((divider, i) => divider.setAttribute("aria-valuenow", String(Math.round((sizes[i] ?? 0) * 100))));
}

function minFraction(split: HTMLElement): number {
  const fromDivider = num(split.querySelector(":scope > .z-split__divider")?.getAttribute("aria-valuemin"), SPLIT_MIN_FRACTION * 100) / 100;
  return num(split.dataset.minFraction, fromDivider);
}

function moveSplit(split: HTMLElement, index: number, a: number, b: number, delta: number): void {
  const sizes = moveDivider(getSplitSizes(split), index, a, b, delta, minFraction(split));
  if (emit(split, "resize", { sizes, index })) setSplitSizes(split, sizes);
}

function hydrateSplit(split: HTMLElement): void {
  const min = Math.round(minFraction(split) * 100);
  for (const divider of parts(split, "z-split__divider")) {
    if (!divider.hasAttribute("role")) divider.setAttribute("role", "separator");
    if (!divider.hasAttribute("tabindex")) divider.tabIndex = 0;
    if (!divider.hasAttribute("aria-orientation")) divider.setAttribute("aria-orientation", directionOf(split) === "row" ? "vertical" : "horizontal");
    if (!divider.hasAttribute("aria-valuemin")) divider.setAttribute("aria-valuemin", String(min));
    if (!divider.hasAttribute("aria-valuemax")) divider.setAttribute("aria-valuemax", String(100 - min));
    // El divisor controla el panel que tiene delante (patrón «window splitter»).
    const primary = divider.previousElementSibling;
    if (!divider.hasAttribute("aria-controls") && primary?.id) divider.setAttribute("aria-controls", primary.id);
  }
  setSplitSizes(split, getSplitSizes(split));
}

/* ---------- TabStrip ---------- */

export interface WorkTabInit {
  id: string;
  title: string;
  /** Nombre de un icono de zicon, a la izquierda del título. */
  icon?: string;
  closable?: boolean;
  closeLabel?: string;
  /** Id del panel que muestra la pestaña (`aria-controls`). */
  controls?: string;
  /** Selecciona la pestaña al añadirla. Por defecto, true. */
  select?: boolean;
}

const selects = (strip: Element) => [...strip.querySelectorAll<HTMLElement>(".z-tabstrip__select")];
const findTab = (strip: Element, id: string) => selects(strip).find((s) => s.dataset.tabId === id);
const activeTab = (strip: Element) => selects(strip).find((s) => s.getAttribute("aria-selected") === "true");
const panelFor = (select: HTMLElement) => (select.getAttribute("aria-controls") ? document.getElementById(select.getAttribute("aria-controls")!) : null);

/** Desplaza la tira para que la pestaña activa quede a la vista. */
function reveal(strip: Element): void {
  const list = strip.querySelector<HTMLElement>(".z-tabstrip__list");
  const tab = activeTab(strip)?.parentElement;
  if (!list || !tab) return;
  const offset = revealOffset(tab.getBoundingClientRect(), list.getBoundingClientRect());
  if (offset) list.scrollLeft += offset;
}

function applyTab(strip: Element, id: string): void {
  for (const select of selects(strip)) {
    const selected = select.dataset.tabId === id;
    const tab = select.parentElement!;
    if (selected) tab.dataset.selected = "true";
    else delete tab.dataset.selected;
    select.setAttribute("aria-selected", String(selected));
    select.tabIndex = selected ? 0 : -1;
    // El cierre es ayuda de puntero: fuera del árbol accesible y del orden de tabulación. Teclado: Supr.
    const close = tab.querySelector<HTMLElement>(".z-tabstrip__close");
    if (close) {
      close.tabIndex = -1;
      close.setAttribute("aria-hidden", "true");
      select.setAttribute("aria-keyshortcuts", "Delete");
    }
    const panel = panelFor(select);
    if (panel) panel.hidden = !selected;
  }
  reveal(strip);
}

/** Activa una pestaña de trabajo por su `data-tab-id`. Emite `z:select`; devuelve false si no existe o se canceló. */
export function selectWorkTab(strip: HTMLElement, id: string): boolean {
  if (!findTab(strip, id) || !emit(strip, "select", { id })) return false;
  applyTab(strip, id);
  return true;
}

/**
 * Cierra una pestaña: emite `z:close` y, si no se cancela, retira la pestaña, oculta su panel (`aria-controls`) y
 * activa la vecina cuando era la activa.
 */
export function closeWorkTab(strip: HTMLElement, id: string): boolean {
  const select = findTab(strip, id);
  if (!select || !emit(strip, "close", { id })) return false;
  const tab = select.parentElement!;
  const index = selects(strip).indexOf(select);
  const wasActive = select.getAttribute("aria-selected") === "true";
  const hadFocus = tab.contains(document.activeElement);
  const panel = panelFor(select);
  if (panel) panel.hidden = true;
  tab.remove();
  const rest = selects(strip);
  const next = rest[Math.min(index, rest.length - 1)];
  if (wasActive && next) selectWorkTab(strip, next.dataset.tabId ?? "");
  else reveal(strip);
  if (hadFocus) (activeTab(strip) ?? strip.querySelector<HTMLElement>(".z-tabstrip__add"))?.focus();
  return true;
}

/** Añade una pestaña con el marcado del contrato. Devuelve su botón, o null si el id ya existe. */
export function addWorkTab(strip: HTMLElement, { id, title, icon, closable = true, closeLabel, controls, select = true }: WorkTabInit): HTMLElement | null {
  const list = strip.querySelector<HTMLElement>(".z-tabstrip__list");
  if (!list || findTab(strip, id)) return null;
  const tab = document.createElement("div");
  tab.className = "z-tabstrip__tab";
  tab.setAttribute("role", "presentation");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "z-tabstrip__select";
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", "false");
  button.tabIndex = -1;
  button.dataset.tabId = id;
  if (controls) button.setAttribute("aria-controls", controls);
  if (icon) {
    const leading = document.createElement("z-icon");
    leading.setAttribute("name", icon);
    leading.setAttribute("size", "14");
    button.append(leading);
  }
  const label = document.createElement("span");
  label.className = "z-tabstrip__title";
  label.textContent = title;
  button.append(label);
  tab.append(button);
  if (closable) {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "z-tabstrip__close";
    close.title = closeLabel ?? strip.querySelector(".z-tabstrip__close")?.getAttribute("title") ?? "Close tab";
    close.setAttribute("aria-hidden", "true");
    close.tabIndex = -1;
    button.setAttribute("aria-keyshortcuts", "Delete");
    close.append(iconElement("x-mark", { size: 12 }));
    tab.append(close);
  }
  list.append(tab);
  if (select) selectWorkTab(strip, id);
  return button;
}

let created = 0;
/** Botón de alta: emite `z:add`. Si nadie lo cancela y el botón trae `data-new-title`, crea aquí la pestaña. */
function addRequested(strip: HTMLElement, button: HTMLElement): void {
  const title = button.dataset.newTitle;
  if (!emit(strip, "add") || !title) return;
  let id: string;
  do id = `tab-${++created}`; while (findTab(strip, id));
  addWorkTab(strip, { id, title: `${title} ${selects(strip).length + 1}` })?.focus();
}

let stripObserver: ResizeObserver | undefined;
const observedLists = new WeakSet<Element>();

function hydrateStrip(strip: HTMLElement): void {
  const active = activeTab(strip) ?? selects(strip)[0];
  if (active?.dataset.tabId !== undefined) applyTab(strip, active.dataset.tabId);
  const list = strip.querySelector(".z-tabstrip__list");
  if (!list || observedLists.has(list) || typeof ResizeObserver === "undefined") return;
  // Al estrecharse la tira, la pestaña activa sigue a la vista.
  stripObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (!entry.target.isConnected) { stripObserver?.unobserve(entry.target); observedLists.delete(entry.target); continue; }
      const owner = entry.target.closest(".z-tabstrip");
      if (owner) reveal(owner);
    }
  });
  stripObserver.observe(list);
  observedLists.add(list);
}

/* ---------- Sidebar en acordeón ---------- */

/** Abre o pliega una sección de sidebar (`.z-sidebar__section`). */
export function setSectionOpen(section: HTMLElement, open: boolean): void {
  if (open) section.dataset.open = "true";
  else delete section.dataset.open;
  const fold = section.querySelector<HTMLElement>(".z-sidebar__fold");
  const body = section.querySelector<HTMLElement>(":scope > .z-sidebar__body");
  fold?.setAttribute("aria-expanded", String(open));
  if (body) body.hidden = !open;
  // El indicador cambia de sentido, igual que en React.
  const icon = fold?.querySelector(":scope > z-icon, :scope > svg.z-icon");
  const attr = icon?.localName === "z-icon" ? "name" : "data-icon";
  if (!icon || !/^chevron-(down|right)-small$/.test(icon.getAttribute(attr) ?? "")) return;
  const name = open ? "chevron-down-small" : "chevron-right-small";
  if (attr === "name") icon.setAttribute("name", name);
  else icon.replaceWith(iconElement(name, { size: icon.getAttribute("width") ?? 12 }));
}

/* ---------- Delegación de eventos ---------- */

function onClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || !inDom(target)) return;

  const toggle = target.closest<HTMLElement>("[data-z-shell-toggle]");
  if (toggle) {
    const shell = shellOf(toggle);
    if (!shell) return;
    // El foco queda en el botón (hay navegadores que no enfocan al hacer clic): ahí vuelve al cerrar el cajón.
    if (document.activeElement !== toggle) toggle.focus({ preventScroll: true });
    return togglePanel(shell, toggle.getAttribute("data-z-shell-toggle") as ShellSide);
  }

  const scrim = target.closest(".z-shell__scrim");
  if (scrim) {
    const shell = scrim.closest<HTMLElement>(".z-shell");
    if (shell) closeDrawers(shell);
    return;
  }

  const closer = target.closest("[data-z-close]");
  if (closer) {
    // Solo si lo más cercano que se puede cerrar es un cajón del shell; diálogos y popovers son de zui/dom.
    const host = closer.closest("dialog, [popover], .z-shell__drawer");
    const shell = host?.classList.contains("z-shell__drawer") ? host.closest<HTMLElement>(".z-shell") : null;
    if (shell) closeDrawers(shell);
    return;
  }

  const strip = target.closest<HTMLElement>(".z-tabstrip");
  if (strip) {
    const id = target.closest(".z-tabstrip__tab")?.querySelector<HTMLElement>(".z-tabstrip__select")?.dataset.tabId;
    if (id !== undefined && target.closest(".z-tabstrip__close")) closeWorkTab(strip, id);
    else if (id !== undefined && target.closest(".z-tabstrip__select")) selectWorkTab(strip, id);
    else if (target.closest(".z-tabstrip__add")) addRequested(strip, target.closest<HTMLElement>(".z-tabstrip__add")!);
    return;
  }

  const fold = target.closest(".z-sidebar__fold");
  const section = fold?.closest<HTMLElement>(".z-sidebar__section");
  if (section) {
    const open = fold!.getAttribute("aria-expanded") !== "true";
    setSectionOpen(section, open);
    emit(section, "change", { open });
  }
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // Escape cierra el cajón abierto, salvo que lo haya gestionado otro (un diálogo o un menú por encima).
  if (event.key === "Escape") {
    if (event.defaultPrevented || target.closest("dialog[open], :popover-open")) return;
    for (const drawer of document.querySelectorAll(".z-shell__drawer")) {
      const shell = drawer.closest<HTMLElement>(".z-shell");
      if (shell && shells.has(shell)) closeDrawers(shell);
    }
    return;
  }
  if (!inDom(target)) return;

  const handle = target.closest<HTMLElement>(".z-resize");
  if (handle) {
    const options = resizeOptions(handle);
    const next = resizeByKey(event.key, options.side, currentSize(handle, options), options);
    if (next === undefined) return;
    event.preventDefault();
    return resizeTo(handle, next);
  }

  const divider = target.closest<HTMLElement>(".z-split__divider");
  const split = divider?.parentElement;
  if (divider && split?.classList.contains("z-split")) {
    const delta = dividerKeyDelta(event.key, directionOf(split), isRtl(split));
    if (!delta) return;
    event.preventDefault();
    const index = parts(split, "z-split__divider").indexOf(divider);
    const sizes = getSplitSizes(split);
    return moveSplit(split, index, sizes[index] ?? 0, sizes[index + 1] ?? 0, delta);
  }

  const list = target.closest(".z-tabstrip__list");
  const strip = list?.closest<HTMLElement>(".z-tabstrip");
  if (list && strip) {
    const tabs = selects(strip);
    const current = activeTab(strip);
    // Supr cierra la pestaña activa si tiene cierre (misma vía de teclado que el binding de React).
    if (event.key === "Delete" && current?.parentElement?.querySelector(".z-tabstrip__close")) {
      event.preventDefault();
      closeWorkTab(strip, current.dataset.tabId ?? "");
      activeTab(strip)?.focus();
      return;
    }
    const next = tabs[tabKeyIndex(event.key, tabs.indexOf(activeTab(strip)!), tabs.length, isRtl(list))];
    if (!next) return;
    event.preventDefault();
    selectWorkTab(strip, next.dataset.tabId ?? "");
    next.focus();
  }
}

// Arrastre en curso (tirador o divisor): el puntero queda capturado en el elemento.
let drag: { el: HTMLElement; move: (event: PointerEvent) => void } | null = null;

function onPointerDown(event: PointerEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || event.button !== 0 || !inDom(target)) return;
  let move: ((event: PointerEvent) => void) | undefined;
  const el = target.closest<HTMLElement>(".z-resize, .z-split__divider");
  if (!el) return;

  if (el.classList.contains("z-resize")) {
    const options = resizeOptions(el);
    const horizontal = isHorizontal(options.side);
    const pos = horizontal ? event.clientX : event.clientY;
    const size = currentSize(el, options);
    move = (e) => resizeTo(el, size + resizeSign(options.side) * ((horizontal ? e.clientX : e.clientY) - pos));
  } else {
    const split = el.parentElement;
    if (!split?.classList.contains("z-split")) return;
    const row = directionOf(split) === "row";
    const rect = split.getBoundingClientRect();
    const total = row ? rect.width : rect.height;
    if (total <= 0) return;
    const index = parts(split, "z-split__divider").indexOf(el);
    const sizes = getSplitSizes(split);
    const [a, b] = [sizes[index] ?? 0, sizes[index + 1] ?? 0];
    const pos = row ? event.clientX : event.clientY;
    // En una fila RTL el primer panel queda a la derecha: arrastrar a la derecha lo encoge.
    const sign = row && isRtl(split) ? -1 : 1;
    move = (e) => moveSplit(split, index, a, b, (sign * ((row ? e.clientX : e.clientY) - pos)) / total);
    el.dataset.dragging = "";
  }
  drag = { el, move };
  try { el.setPointerCapture(event.pointerId); } catch { /* puntero ya liberado */ }
}

function onPointerEnd(): void {
  if (drag) delete drag.el.dataset.dragging;
  drag = null;
}

function onDoubleClick(event: MouseEvent): void {
  // Divisor: los dos paneles que separa se reparten su espacio a partes iguales.
  const divider = event.target instanceof Element ? event.target.closest<HTMLElement>(".z-split__divider") : null;
  const split = divider?.parentElement;
  if (divider && split?.classList.contains("z-split") && inDom(divider)) {
    const index = parts(split, "z-split__divider").indexOf(divider);
    const sizes = getSplitSizes(split);
    const half = ((sizes[index] ?? 0) + (sizes[index + 1] ?? 0)) / 2;
    return moveSplit(split, index, half, half, 0);
  }
  const handle = event.target instanceof Element ? event.target.closest<HTMLElement>(".z-resize") : null;
  if (!handle || !inDom(handle)) return;
  const { defaultSize } = resizeOptions(handle);
  if (defaultSize !== undefined) resizeTo(handle, defaultSize);
}

/** Prepara el marcado bajo `[data-z-dom]`: mide los shells, completa divisores y pestañas. Repetible. */
export function hydrate(root: ParentNode = document): void {
  if (!isBrowser) return;
  for (const shell of all(root, ".z-shell")) hydrateShell(shell);
  for (const split of all(root, ".z-split")) hydrateSplit(split);
  for (const strip of all(root, ".z-tabstrip")) hydrateStrip(strip);
  for (const handle of all(root, ".z-resize")) {
    // Un tirador escrito solo con su clase recibe el rol y los atributos del patrón «window splitter».
    if (!handle.hasAttribute("role")) handle.setAttribute("role", "separator");
    if (!handle.hasAttribute("tabindex")) handle.tabIndex = 0;
    if (!handle.hasAttribute("aria-orientation")) handle.setAttribute("aria-orientation", isHorizontal((handle.dataset.side ?? "right") as ResizeSide) ? "vertical" : "horizontal");
    if (!handle.hasAttribute("aria-valuemin")) handle.setAttribute("aria-valuemin", String(RESIZE_MIN));
    if (!handle.hasAttribute("aria-valuemax")) handle.setAttribute("aria-valuemax", String(RESIZE_MAX));
    const options = resizeOptions(handle);
    if (options.target && !handle.closest("[hidden]")) handle.setAttribute("aria-valuenow", String(Math.round(currentSize(handle, options))));
  }
}

/**
 * Suelta lo que este módulo guarda de los layouts de `root` (observadores de tamaño y estado de shells): se llama
 * antes de retirar del documento un bloque de marcado en una aplicación que monta y desmonta vistas. Los
 * manejadores de eventos son del documento y no dependen de ningún elemento: no hay nada más que soltar.
 */
export function dispose(root: ParentNode = document): void {
  if (!isBrowser) return;
  for (const shell of all(root, ".z-shell")) { shellObserver?.unobserve(shell); shells.delete(shell); }
  for (const strip of all(root, ".z-tabstrip")) {
    const list = strip.querySelector(".z-tabstrip__list");
    if (list) { stripObserver?.unobserve(list); observedLists.delete(list); }
  }
}

let wired = false;
/** Conecta el comportamiento. Idempotente; llamar una vez al cargar. */
export function init(): void {
  if (!isBrowser || wired) return;
  wired = true;
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("dblclick", onDoubleClick);
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("pointermove", (event) => drag?.move(event));
  document.addEventListener("pointerup", onPointerEnd);
  document.addEventListener("pointercancel", onPointerEnd);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => hydrate());
  else hydrate();
}
