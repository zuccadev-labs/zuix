// Navegación de sitio: NavigationMenu, Navbar y SkipLink. Un solo comportamiento para el binding de React
// y el modo sin framework: los dos llaman a estas funciones sobre el marcado del contrato. Sin efectos al importar.
//
// Es navegación, no un menú de aplicación: los enlaces siguen en el orden de Tab, sin role=menu ni
// flechas. Cada grupo es un disclosure: un <button aria-expanded aria-controls> seguido de su panel.
//   - Horizontal: el panel es `popover="auto"` y el botón lo abre con `popovertarget` (funciona sin JavaScript);
//     aquí se coloca bajo el botón, se sincroniza aria-expanded con `toggle`, se previsualiza al pasar el puntero y
//     se cierra al salir el foco del grupo.
//   - Vertical (el cajón del Navbar estrecho): sin popover; el botón alterna aria-expanded y el CSS muestra el panel.
// Navbar: mide si la fila entera cabe (sin punto de corte fijo). Si no cabe, `data-collapsed` y la lista pasa a un
// cajón `popover="auto"` que abre el botón de menú; dentro, el NavigationMenu en vertical.
import { navbarShouldMeasure } from "./logic";

const GAP = 8;
const hoverable = () => typeof matchMedia === "function" && matchMedia("(hover: hover)").matches;
const isOpen = (el: Element) => {
  try {
    return el.matches(":popover-open");
  } catch {
    return false;
  }
};
const rtl = (el: Element) => getComputedStyle(el).direction === "rtl";

/** Disparadores y paneles de un NavigationMenu (sin los de un menú anidado en otro). */
function groups(menu: HTMLElement): { trigger: HTMLButtonElement; panel: HTMLElement }[] {
  const out: { trigger: HTMLButtonElement; panel: HTMLElement }[] = [];
  for (const trigger of menu.querySelectorAll<HTMLButtonElement>(".z-navmenu__trigger")) {
    if (trigger.closest(".z-navmenu") !== menu) continue;
    const panel = trigger.nextElementSibling;
    if (panel instanceof HTMLElement && panel.classList.contains("z-navmenu__panel")) out.push({ trigger, panel });
  }
  return out;
}

export const navMenuOrientation = (menu: HTMLElement): "horizontal" | "vertical" =>
  menu.dataset.orientation === "vertical" ? "vertical" : "horizontal";

/** Coloca el panel bajo su botón, alineado al inicio de línea y dentro del viewport. */
export function placeNavPanel(trigger: HTMLElement, panel: HTMLElement): void {
  const t = trigger.getBoundingClientRect();
  const width = panel.offsetWidth || 0;
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const start = rtl(trigger) ? t.right - width : t.left;
  const left = Math.max(GAP, Math.min(start, vw - width - GAP));
  panel.style.position = "fixed";
  panel.style.margin = "0";
  panel.style.inset = "auto";
  panel.style.top = `${Math.round(t.bottom + GAP)}px`;
  panel.style.left = `${Math.round(left)}px`;
}

/** Pone cada grupo en el modo de su orientación, cerrado. */
export function syncNavMenu(menu: HTMLElement): void {
  const horizontal = navMenuOrientation(menu) === "horizontal";
  for (const { trigger, panel } of groups(menu)) {
    if (isOpen(panel)) panel.hidePopover();
    if (horizontal) {
      panel.setAttribute("popover", "auto");
      if (panel.id) trigger.setAttribute("popovertarget", panel.id);
    } else {
      panel.removeAttribute("popover");
      trigger.removeAttribute("popovertarget");
      for (const p of ["position", "margin", "inset", "top", "left"]) panel.style.removeProperty(p);
    }
    trigger.setAttribute("aria-expanded", "false");
    delete panel.dataset.preview;
  }
}

/** Abre o cierra un grupo (en los dos modos). */
export function setNavGroupOpen(trigger: HTMLElement, open: boolean, preview = false): void {
  const panel = trigger.nextElementSibling;
  const menu = trigger.closest<HTMLElement>(".z-navmenu");
  if (!(panel instanceof HTMLElement) || !menu) return;
  if (navMenuOrientation(menu) === "vertical" || !panel.hasAttribute("popover")) {
    trigger.setAttribute("aria-expanded", String(open));
    return;
  }
  if (open && !isOpen(panel)) {
    if (preview) panel.dataset.preview = "";
    placeNavPanel(trigger, panel);
    panel.showPopover();
  } else if (!open && isOpen(panel)) panel.hidePopover();
}

/**
 * Conecta un NavigationMenu: clic en modo vertical, `toggle` de los paneles, previsualización al pasar el puntero,
 * cierre al salir el foco y Escape. Devuelve la función que lo desconecta.
 */
export function wireNavMenu(menu: HTMLElement): () => void {
  const abort = new AbortController();
  const signal = abort.signal;
  syncNavMenu(menu);
  const vertical = () => navMenuOrientation(menu) === "vertical";
  menu.addEventListener(
    "click",
    (event) => {
      const trigger = (event.target as Element).closest<HTMLButtonElement>(".z-navmenu__trigger");
      if (!trigger || trigger.closest(".z-navmenu") !== menu) return;
      const panel = trigger.nextElementSibling as HTMLElement | null;
      if (vertical()) {
        setNavGroupOpen(trigger, trigger.getAttribute("aria-expanded") !== "true");
        return;
      }
      // Abierto solo por el puntero: el clic lo fija en vez de cerrarlo.
      if (panel && panel.dataset.preview !== undefined && isOpen(panel)) {
        event.preventDefault();
        delete panel.dataset.preview;
      } else if (panel && !trigger.hasAttribute("popovertarget")) {
        event.preventDefault();
        setNavGroupOpen(trigger, !isOpen(panel));
      }
    },
    { signal },
  );
  menu.addEventListener(
    "beforetoggle",
    (event) => {
      const panel = event.target as HTMLElement;
      const e = event as ToggleEvent;
      const trigger = panel.previousElementSibling as HTMLElement | null;
      if (!panel.classList.contains("z-navmenu__panel") || !trigger) return;
      if (e.newState === "open") placeNavPanel(trigger, panel);
    },
    { capture: true, signal },
  );
  menu.addEventListener(
    "toggle",
    (event) => {
      const panel = event.target as HTMLElement;
      const trigger = panel.previousElementSibling as HTMLElement | null;
      if (!panel.classList.contains("z-navmenu__panel") || !trigger) return;
      const open = (event as ToggleEvent).newState === "open";
      trigger.setAttribute("aria-expanded", String(open));
      if (open) placeNavPanel(trigger, panel);
      else delete panel.dataset.preview;
    },
    { capture: true, signal },
  );
  for (const { trigger, panel } of groups(menu)) {
    const item = trigger.parentElement;
    if (!item) continue;
    item.addEventListener(
      "pointerenter",
      (event) => {
        if (vertical() || event.pointerType === "touch" || !hoverable() || isOpen(panel)) return;
        setNavGroupOpen(trigger, true, true);
      },
      { signal },
    );
    item.addEventListener(
      "pointerleave",
      () => {
        if (panel.dataset.preview !== undefined) setNavGroupOpen(trigger, false);
      },
      { signal },
    );
    item.addEventListener(
      "focusout",
      (event) => {
        const next = event.relatedTarget;
        if (vertical() || !(next instanceof Node) || item.contains(next)) return;
        setNavGroupOpen(trigger, false);
      },
      { signal },
    );
    item.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || trigger.getAttribute("aria-expanded") !== "true") return;
        event.preventDefault();
        event.stopPropagation();
        setNavGroupOpen(trigger, false);
        trigger.focus();
      },
      { signal },
    );
  }
  return () => abort.abort();
}

// ── Navbar ────────────────────────────────────────────────────────────────────────────────────────────────────

const parts = (header: HTMLElement) => ({
  inner: header.querySelector<HTMLElement>(".z-navbar__inner"),
  menu: header.querySelector<HTMLElement>(".z-navbar__menu"),
  toggle: header.querySelector<HTMLElement>(".z-navbar__toggle"),
  nav: header.querySelector<HTMLElement>(".z-navbar__menu .z-navmenu"),
});

/** Pone el Navbar en modo cajón (`collapsed`) o en fila, con su NavigationMenu en la orientación que toca. */
export function applyNavbar(header: HTMLElement, collapsed: boolean): void {
  const { menu, toggle, nav } = parts(header);
  const was = header.hasAttribute("data-collapsed");
  header.toggleAttribute("data-collapsed", collapsed);
  if (menu) {
    if (collapsed) menu.setAttribute("popover", "auto");
    else {
      if (isOpen(menu)) menu.hidePopover();
      menu.removeAttribute("popover");
    }
  }
  toggle?.setAttribute("aria-expanded", "false");
  if (nav && (was !== collapsed || nav.dataset.orientation !== (collapsed ? "vertical" : "horizontal"))) {
    nav.dataset.orientation = collapsed ? "vertical" : "horizontal";
    syncNavMenu(nav);
  }
}

/** Verdadero si la fila entera (marca, enlaces y acciones) cabe sin plegarse. Mide en fila y deja todo como estaba. */
export function navbarFits(header: HTMLElement): boolean {
  const { inner, menu } = parts(header);
  if (!inner) return true;
  const collapsed = header.hasAttribute("data-collapsed");
  const wasOpen = menu ? isOpen(menu) : false;
  const hadPopover = menu?.hasAttribute("popover") ?? false;
  header.setAttribute("data-measuring", "");
  header.removeAttribute("data-collapsed");
  if (menu && hadPopover) menu.removeAttribute("popover");
  const fits = inner.scrollWidth <= inner.clientWidth + 1;
  header.toggleAttribute("data-collapsed", collapsed);
  if (menu && hadPopover) {
    menu.setAttribute("popover", "auto");
    if (wasOpen) menu.showPopover();
  }
  requestAnimationFrame(() => header.removeAttribute("data-measuring"));
  return fits;
}

/**
 * Conecta un Navbar: mide al cambiar de tamaño (ResizeObserver en la barra y en la lista), sincroniza el botón de
 * menú con el cajón y cierra el cajón al seguir un enlace. `onChange` recibe el modo cada vez que cambia.
 */
export function wireNavbar(header: HTMLElement, onChange?: (collapsed: boolean) => void): () => void {
  const abort = new AbortController();
  const signal = abort.signal;
  const { menu, toggle, nav } = parts(header);
  const unwireNav = nav ? wireNavMenu(nav) : () => {};
  let lastWidth = 0;
  const measure = () => {
    const width = header.clientWidth;
    const collapsed = header.hasAttribute("data-collapsed");
    if (!navbarShouldMeasure(collapsed, width, lastWidth)) {
      lastWidth = width;
      return;
    }
    lastWidth = width;
    const next = !navbarFits(header);
    if (next !== collapsed || nav?.dataset.orientation !== (next ? "vertical" : "horizontal")) {
      applyNavbar(header, next);
      onChange?.(next);
    }
  };
  // Primera medida: de cajón (el marcado sin JavaScript) a fila si cabe.
  applyNavbar(header, header.hasAttribute("data-collapsed"));
  lastWidth = 0;
  measure();
  let ro: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => measure());
    ro.observe(header);
    if (menu) ro.observe(menu);
  }
  menu?.addEventListener(
    "toggle",
    (event) => {
      if (event.target !== menu) return;
      const open = (event as ToggleEvent).newState === "open";
      toggle?.setAttribute("aria-expanded", String(open));
      header.toggleAttribute("data-open", open);
    },
    { signal },
  );
  menu?.addEventListener(
    "click",
    (event) => {
      if (!header.hasAttribute("data-collapsed") || !menu || !isOpen(menu)) return;
      if ((event.target as Element).closest("a[href]")) menu.hidePopover();
    },
    { signal },
  );
  return () => {
    abort.abort();
    ro?.disconnect();
    unwireNav();
  };
}

// ── SkipLink ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lleva el foco al destino de un enlace de salto. Si el destino no es enfocable, recibe `tabindex="-1"` (lo
 * pueden seguir las lupas de pantalla) sin entrar en el orden de Tab. Devuelve el destino o null.
 */
export function skipTo(link: HTMLAnchorElement): HTMLElement | null {
  const id = decodeURIComponent((link.getAttribute("href") ?? "").replace(/^#/, ""));
  const target = id ? link.ownerDocument.getElementById(id) : null;
  if (!target) return null;
  if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus();
  return target;
}
