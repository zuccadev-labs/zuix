// Comportamiento sin framework de la navegación de la oleada 4: Collapsible y Menubar. `setup()` conecta los
// listeners delegados una vez; `hydrate(root)` prepara marcado nuevo. Todo se activa dentro de `[data-z-dom]`.
//
// Collapsible  .z-collapsible > button.z-collapsible__trigger[aria-expanded][aria-controls] + .z-collapsible__content.
//              Plegado lleva `hidden="until-found"` (la búsqueda en la página lo abre); con data-peek no se oculta:
//              se recorta a --z-collapsible-peek y el foco que entra lo despliega. z:change { open } en .z-collapsible.
// Menubar     .z-menubar[role=menubar] > button.z-menubar__trigger[role=menuitem][aria-haspopup=menu][data-z-open="#menu"]
//              y cada .z-menu[popover] aparte. Una parada de Tab; flechas laterales entre títulos (con un menú abierto,
//              abren el del vecino); Flecha abajo, Intro o Espacio abren y enfocan la primera entrada, Flecha arriba la
//              última. Dentro de un menú, la flecha izquierda (primer nivel) o la derecha (entrada sin submenú) pasan al
//              menú vecino. Con un menú abierto, el puntero sobre otro título lo abre.
import { logicalKey } from "../core/dir";
import { menubarIndex, menubarKey } from "../core/menubar";
import { all, emit, inDom } from "./forms-popup";
import { closePopover, openPopover } from "./core";
import { byRef, type Listen } from "./shared";

/* ---------- Collapsible ---------- */

const contentOf = (root: Element) => root.querySelector<HTMLElement>(":scope > .z-collapsible__content");
const triggerOf = (root: Element) => root.querySelector<HTMLButtonElement>(":scope > .z-collapsible__trigger");

/** Abre o pliega un `.z-collapsible`. Emite `z:change { open }` si cambia. */
export function setCollapsibleOpen(root: HTMLElement, open: boolean): void {
  const trigger = triggerOf(root);
  const content = contentOf(root);
  if (!trigger || !content || (root.dataset.state === "open") === open) return;
  root.dataset.state = open ? "open" : "closed";
  content.dataset.state = root.dataset.state;
  trigger.setAttribute("aria-expanded", String(open));
  if (root.hasAttribute("data-peek")) content.removeAttribute("hidden");
  else if (open) content.removeAttribute("hidden");
  else content.setAttribute("hidden", "until-found");
  emit(root, "change", { open });
}

/* ---------- Menubar ---------- */

const barTriggers = (bar: Element) =>
  [...bar.querySelectorAll<HTMLElement>(":scope > .z-menubar__trigger")].filter((t) => t.getAttribute("aria-disabled") !== "true");
const menuOfTrigger = (trigger: Element) => byRef(trigger.getAttribute("data-z-open"));

/** Título de la barra del que cuelga `menu` (también a través de sus submenús) y nivel del menú, o null. */
function menubarRoot(menu: HTMLElement): { trigger: HTMLElement; root: HTMLElement; depth: number } | null {
  let current = menu;
  for (let depth = 0; depth < 16; depth += 1) {
    if (!current.id) return null;
    const trigger = document.querySelector<HTMLElement>(`.z-menubar__trigger[data-z-open="#${CSS.escape(current.id)}"]`);
    if (trigger) return { trigger, root: current, depth };
    const parent = document.querySelector(`[data-z-submenu="#${CSS.escape(current.id)}"]`)?.closest<HTMLElement>(".z-menu");
    if (!parent) return null;
    current = parent;
  }
  return null;
}

const openBarMenu = (bar: Element) => barTriggers(bar).find((t) => menuOfTrigger(t)?.matches(":popover-open"));

function rove(bar: Element, stop: HTMLElement): void {
  for (const trigger of bar.querySelectorAll<HTMLElement>(":scope > .z-menubar__trigger")) trigger.tabIndex = trigger === stop ? 0 : -1;
}

/** Abre el menú de un título de la barra y enfoca su primera o su última entrada. */
export function openMenubarMenu(trigger: HTMLElement, focus: "first" | "last" = "first"): void {
  const menu = menuOfTrigger(trigger);
  const bar = trigger.closest(".z-menubar");
  if (!menu || !bar) return;
  rove(bar, trigger);
  if (!menu.matches(":popover-open")) openPopover(menu, trigger, "bottom-start");
  if (focus === "last") {
    const items = [...menu.querySelectorAll<HTMLElement>(".z-menu__item")].filter(
      (item) => item.closest(".z-menu") === menu && item.getAttribute("aria-disabled") !== "true",
    );
    const last = items[items.length - 1];
    if (last) {
      for (const other of menu.querySelectorAll("[data-highlighted]")) other.removeAttribute("data-highlighted");
      last.setAttribute("data-highlighted", "");
      last.focus({ preventScroll: true });
    }
  }
}

/** Lleva el foco al título vecino; si había un menú de la barra abierto, lo cierra y abre el del nuevo título. */
function stepMenubar(from: HTMLElement, to: "prev" | "next" | "first" | "last", reopen: boolean): void {
  const bar = from.closest(".z-menubar");
  if (!bar) return;
  const list = barTriggers(bar);
  const target = list[menubarIndex(to, list.indexOf(from), list.length)];
  if (!target) return;
  const current = openBarMenu(bar);
  if (current) closePopover(menuOfTrigger(current)!);
  rove(bar, target);
  if (reopen) openMenubarMenu(target);
  else target.focus();
}

/**
 * Tecla dentro de un menú abierto: si cuelga de una barra y la tecla pasa al menú vecino, lo hace y devuelve true.
 * La llama el manejador de menús de ./index antes de mover el foco entre entradas.
 */
export function menubarKeyInMenu(menu: HTMLElement, event: KeyboardEvent): boolean {
  const owner = menubarRoot(menu);
  if (!owner) return false;
  const current = event.target instanceof Element ? event.target.closest(".z-menu__item") : null;
  const action = menubarKey(logicalKey(event.key, menu), {
    at: "menu",
    depth: owner.depth,
    opensSubmenu: current?.hasAttribute("data-z-submenu") ?? false,
  });
  if (action?.type !== "move" || (action.to !== "prev" && action.to !== "next")) return false;
  event.preventDefault();
  stepMenubar(owner.trigger, action.to, true);
  return true;
}

export function setup(on: Listen): void {
  on(document, "keydown", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>(".z-menubar > .z-menubar__trigger") : null;
    if (!trigger || event.defaultPrevented || typeof event.key !== "string") return;
    const action = menubarKey(logicalKey(event.key, trigger), { at: "trigger" });
    if (!action) return;
    if (trigger.getAttribute("aria-disabled") === "true" && action.type === "open") return;
    event.preventDefault();
    if (action.type === "open") openMenubarMenu(trigger, action.focus);
    else stepMenubar(trigger, action.to, Boolean(openBarMenu(trigger.closest(".z-menubar")!)));
  });
  on(document, "pointerover", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>(".z-menubar > .z-menubar__trigger") : null;
    if (!trigger || event.pointerType !== "mouse" || trigger.getAttribute("aria-disabled") === "true") return;
    const bar = trigger.closest(".z-menubar")!;
    const current = openBarMenu(bar);
    // Con otro menú de la barra abierto, el puntero cambia de menú; sin ninguno, no hace nada.
    if (!current || current === trigger) return;
    closePopover(menuOfTrigger(current)!);
    openMenubarMenu(trigger);
  });
  on(document, "focusin", (event) => {
    const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>(".z-menubar > .z-menubar__trigger") : null;
    if (trigger) rove(trigger.closest(".z-menubar")!, trigger);
  });
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !inDom(target)) return;
    const trigger = target.closest<HTMLButtonElement>(".z-collapsible__trigger");
    const root = trigger?.parentElement;
    if (!trigger || !root?.classList.contains("z-collapsible") || trigger.disabled) return;
    setCollapsibleOpen(root, root.dataset.state !== "open");
  });
  // La búsqueda en la página encontró texto en una región plegada: se abre antes de mostrarlo.
  on(
    document,
    "beforematch",
    (event) => {
      const content = event.target instanceof Element ? event.target.closest(".z-collapsible__content") : null;
      const root = content?.parentElement;
      if (root?.classList.contains("z-collapsible") && inDom(root)) setCollapsibleOpen(root, true);
    },
    true,
  );
  on(document, "focusin", (event) => {
    const content = event.target instanceof Element ? event.target.closest(".z-collapsible__content") : null;
    const root = content?.parentElement;
    if (root?.hasAttribute("data-peek") && root.dataset.state !== "open" && inDom(root)) setCollapsibleOpen(root, true);
  });
}

export function hydrate(root: ParentNode): void {
  for (const bar of all(root, ".z-menubar")) {
    const triggers = barTriggers(bar);
    const stop = triggers.find((t) => t.tabIndex === 0 && t.hasAttribute("tabindex")) ?? triggers[0];
    if (stop) rove(bar, stop);
    for (const trigger of triggers) {
      const menu = menuOfTrigger(trigger);
      if (menu?.id) trigger.setAttribute("aria-controls", menu.id);
    }
  }
  for (const el of all(root, ".z-collapsible")) {
    const trigger = triggerOf(el);
    const content = contentOf(el);
    if (!trigger || !content) continue;
    if (content.id) trigger.setAttribute("aria-controls", content.id);
    const open = trigger.getAttribute("aria-expanded") === "true";
    el.dataset.state = open ? "open" : "closed";
    content.dataset.state = el.dataset.state;
    if (!open && !el.hasAttribute("data-peek")) content.setAttribute("hidden", "until-found");
  }
}
