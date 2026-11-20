// Comportamiento sin framework de las capas y avisos de la oleada 4. `setup()` conecta los listeners delegados una
// vez; `hydrate(root)` prepara marcado nuevo. Todo se activa dentro de `[data-z-dom]`.
//
// Banner       .z-banner con button.z-banner__close: el cierre emite z:dismiss (cancelable) en el banner y, si nadie lo
//              cancela, lo oculta (`hidden`). El foco sigue hacia delante, al siguiente elemento tabulable.
// HoverCard    [data-z-hovercard="#id"] (un enlace) + #id.z-hovercard[popover=manual][role=tooltip]. Se abre al pasar
//              el puntero (data-open-delay, 500 ms) o al enfocar con el teclado, y se cierra al irse de los dos
//              (data-close-delay, 300 ms), con Escape o con una pulsación fuera. La tarjeta describe al enlace.
// Toggletip    button.z-toggletip__trigger[data-z-toggletip="#id"][aria-label] + #id.z-toggletip[popover=manual]
//              [role=tooltip]. Como HoverCard, y además el clic la deja fija (aria-expanded en el botón).
//              En los dos: data-z-placement en el disparador (bottom / top por defecto), data-arrow en la capa,
//              Tab entra en la capa y sale hacia lo que sigue al disparador. z:open y z:close en la capa.
// ActionBar    .z-toolbar.z-actionbar[role=toolbar] (el foco itinerante es el de Toolbar). button.z-actionbar__close o
//              Escape dentro de la barra emiten z:close (cancelable) y, si nadie lo cancela, la ocultan (`hidden`).
// Drawer       dialog.z-drawer[data-drag] con button.z-drawer__handle: arrastrar el asa hacia el borde lo cierra. Con
//              data-snap-points="0.4 0.9" (top o bottom) y data-snap="1", el asa (role=slider) cambia el alto entre
//              anclajes con el puntero o las flechas. z:change { snap } en el cajón.
import { focusQuiet, nextTabbable, tabbable } from "../core/focus";
import { bridgeTab, createInterest, type Interest, type InterestSource } from "../core/interest";
import { pushLayer } from "../core/layers";
import { attachSheet, type SheetSide } from "../core/sheet";
import { place, type Placement } from "../core/place";
import { afterExit } from "../core/presence";
import { emit, inDom } from "./forms-popup";
import { closeDialog } from "./index";
import { byRef, type Listen } from "./shared";

/* ---------- Banner ---------- */

/** Cierra un `.z-banner`: emite `z:dismiss` y, si no se cancela, lo oculta. Devuelve si se cerró. */
export function dismissBanner(banner: HTMLElement): boolean {
  if (banner.hidden || !emit(banner, "dismiss")) return false;
  const next = banner.contains(document.activeElement) ? nextTabbable(banner) : undefined;
  banner.hidden = true;
  focusQuiet(next);
  return true;
}

/* ---------- Drawer que se arrastra ---------- */

const sheets = new WeakMap<HTMLElement, () => void>();
const snapsOf = (drawer: HTMLElement) =>
  (drawer.dataset.snapPoints ?? "")
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => n > 0 && n <= 1);

/** Lleva un cajón con anclajes al anclaje `index`: alto, `data-snap`, valor del asa y `z:change { snap }`. */
export function setDrawerSnap(drawer: HTMLElement, index: number): void {
  const snaps = snapsOf(drawer);
  if (!snaps.length) return;
  const i = Math.min(Math.max(index, 0), snaps.length - 1);
  const changed = drawer.dataset.snap !== String(i);
  drawer.dataset.snap = String(i);
  drawer.style.setProperty("--z-drawer-snap", String(snaps[i]));
  const handle = drawer.querySelector<HTMLElement>(":scope > .z-drawer__handle");
  if (handle) {
    handle.setAttribute("aria-valuenow", String(i));
    handle.setAttribute("aria-valuetext", `${Math.round(snaps[i]! * 100)}%`);
  }
  if (changed) emit(drawer, "change", { snap: i });
}

function attachDrawer(drawer: HTMLElement): void {
  const handle = drawer.querySelector<HTMLElement>(":scope > .z-drawer__handle");
  if (!handle || sheets.has(drawer)) return;
  if (snapsOf(drawer).length) setDrawerSnap(drawer, Number(drawer.dataset.snap ?? snapsOf(drawer).length - 1));
  sheets.set(
    drawer,
    attachSheet(drawer, handle, {
      side: (drawer.dataset.side as SheetSide) ?? "right",
      snaps: () => snapsOf(drawer),
      current: () => Number(drawer.dataset.snap ?? 0),
      onSnap: (index) => setDrawerSnap(drawer, index),
      onClose: () => closeDialog(drawer as HTMLDialogElement),
    }),
  );
}

/* ---------- ActionBar ---------- */

/** Cierra una `.z-actionbar` (vaciar la selección): emite `z:close` y, si no se cancela, la oculta. */
export function closeActionBar(bar: HTMLElement): boolean {
  if (bar.hidden || !emit(bar, "close")) return false;
  const next = bar.contains(document.activeElement) ? nextTabbable(bar) : undefined;
  bar.hidden = true;
  focusQuiet(next);
  return true;
}

/* ---------- HoverCard y Toggletip ---------- */

interface Hint {
  trigger: HTMLElement;
  layer: HTMLElement;
  toggle: boolean;
  interest: Interest;
  pinned: boolean;
  release?: () => void;
  cancelExit?: () => void;
}

const hints = new WeakMap<HTMLElement, Hint>();
const openHints = new Set<Hint>();
const HINT_TRIGGER = "[data-z-hovercard], [data-z-toggletip]";

const layerOf = (trigger: Element) => byRef(trigger.getAttribute("data-z-hovercard") ?? trigger.getAttribute("data-z-toggletip"));

function positionHint(hint: Hint): void {
  const toggle = hint.toggle;
  const placement = (hint.trigger.getAttribute("data-z-placement") as Placement | null) ?? (toggle ? "top" : "bottom");
  const gap = 6 + (hint.layer.hasAttribute("data-arrow") ? 7 : 0);
  place(hint.layer, hint.trigger.getBoundingClientRect(), placement, gap);
}

function showHint(hint: Hint): void {
  const { trigger, layer } = hint;
  hint.cancelExit?.();
  hint.cancelExit = undefined;
  if (!layer.hasAttribute("popover")) layer.setAttribute("popover", "manual");
  layer.dataset.state = "open";
  if (!layer.matches(":popover-open")) layer.showPopover();
  positionHint(hint);
  if (hint.toggle) {
    trigger.setAttribute("aria-expanded", "true");
    if (layer.id) trigger.setAttribute("aria-controls", layer.id);
  } else if (layer.id) {
    const ids = (trigger.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
    if (!ids.includes(layer.id)) trigger.setAttribute("aria-describedby", [...ids, layer.id].join(" "));
  }
  openHints.add(hint);
  hint.release ??= pushLayer({
    contains: (target) => layer.contains(target) || trigger.contains(target),
    onEscape: () => closeHint(hint, true),
    onPointerOutside: () => closeHint(hint, false),
  });
  emit(layer, "open");
}

function hideHint(hint: Hint): void {
  const { trigger, layer } = hint;
  hint.pinned = false;
  hint.release?.();
  hint.release = undefined;
  openHints.delete(hint);
  if (hint.toggle) trigger.setAttribute("aria-expanded", "false");
  else if (layer.id) {
    const ids = (trigger.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && id !== layer.id);
    if (ids.length) trigger.setAttribute("aria-describedby", ids.join(" "));
    else trigger.removeAttribute("aria-describedby");
  }
  if (layer.dataset.state === "closed") return;
  layer.dataset.state = "closed";
  hint.cancelExit = afterExit(layer, () => {
    hint.cancelExit = undefined;
    if (layer.matches(":popover-open")) layer.hidePopover();
  });
  emit(layer, "close");
}

/** Cierra la capa (Escape, pulsación fuera, otro clic en el toggletip). Con `refocus`, el foco vuelve al disparador si estaba dentro. */
function closeHint(hint: Hint, refocus: boolean): void {
  const inside = hint.layer.contains(document.activeElement);
  hint.pinned = false;
  hint.interest.hide();
  // Fijada, el controlador de interés ya la daba por cerrada: se cierra aquí.
  if (openHints.has(hint)) hideHint(hint);
  if (refocus && inside) focusQuiet(hint.trigger);
}

function hintFor(trigger: HTMLElement): Hint | null {
  const known = hints.get(trigger);
  if (known) return known;
  const layer = layerOf(trigger);
  if (!layer) return null;
  const toggle = trigger.hasAttribute("data-z-toggletip");
  const hint: Hint = {
    trigger,
    layer,
    toggle,
    pinned: false,
    interest: createInterest({
      openDelay: Number(trigger.dataset.openDelay ?? (toggle ? 300 : 500)),
      closeDelay: Number(trigger.dataset.closeDelay ?? (toggle ? 200 : 300)),
      onChange: (open) => {
        if (open) showHint(hint);
        else if (!hint.pinned) hideHint(hint);
      },
    }),
  };
  hints.set(trigger, hint);
  hints.set(layer, hint);
  return hint;
}

/** Disparador o capa de un HoverCard o Toggletip que contiene a `node`, y en cuál de las dos zonas está. */
function hintAt(node: EventTarget | null): { hint: Hint; zone: "trigger" | "content" } | null {
  if (!(node instanceof Element)) return null;
  const trigger = node.closest<HTMLElement>(HINT_TRIGGER);
  if (trigger && inDom(trigger)) {
    const hint = hintFor(trigger);
    return hint ? { hint, zone: "trigger" } : null;
  }
  const layer = node.closest<HTMLElement>(".z-hovercard, .z-toggletip");
  const hint = layer ? hints.get(layer) : undefined;
  return hint ? { hint, zone: "content" } : null;
}

const zoneSource = (zone: "trigger" | "content", kind: "pointer" | "focus") => `${zone}-${kind}` as InterestSource;

/** Abre o cierra un HoverCard o un Toggletip desde código (`pin`: fijado, como tras un clic en el toggletip). */
export function setHintOpen(trigger: HTMLElement, open: boolean, pin = false): void {
  const hint = hintFor(trigger);
  if (!hint) return;
  if (open) {
    hint.pinned = pin;
    hint.interest.show();
  } else closeHint(hint, true);
}

export function setup(on: Listen): void {
  on(document, "pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const at = hintAt(event.target);
    const from = hintAt(event.relatedTarget);
    if (at && !(from?.hint === at.hint && from.zone === at.zone)) at.hint.interest.enter(zoneSource(at.zone, "pointer"));
  });
  on(document, "pointerout", (event) => {
    const at = hintAt(event.target);
    const to = hintAt(event.relatedTarget);
    if (at && !(to?.hint === at.hint && to.zone === at.zone)) at.hint.interest.leave(zoneSource(at.zone, "pointer"));
  });
  on(document, "focusin", (event) => {
    const at = hintAt(event.target);
    if (!at) return;
    if (at.zone === "content" || (event.target as Element).matches(":focus-visible")) at.hint.interest.enter(zoneSource(at.zone, "focus"));
  });
  on(document, "focusout", (event) => {
    const at = hintAt(event.target);
    const to = hintAt(event.relatedTarget);
    if (at && !(to?.hint === at.hint && to.zone === at.zone)) at.hint.interest.leave(zoneSource(at.zone, "focus"));
  });
  on(document, "keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const bar = event.target instanceof Element ? event.target.closest<HTMLElement>(".z-actionbar") : null;
    if (bar && inDom(bar) && closeActionBar(bar)) event.preventDefault();
  });
  on(document, "keydown", (event) => {
    if (event.key !== "Tab" || event.defaultPrevented) return;
    const at = hintAt(document.activeElement);
    if (!at || !openHints.has(at.hint)) return;
    const { trigger, layer } = at.hint;
    const target = bridgeTab(document.activeElement, event.shiftKey, {
      trigger,
      content: layer,
      tabbables: tabbable(layer),
      after: () => {
        const next = nextTabbable(trigger);
        return next && layer.contains(next) ? undefined : next;
      },
    });
    if (!target) return;
    event.preventDefault();
    if (target.close) closeHint(at.hint, false);
    focusQuiet(target.focus);
  });
  on(document, "z:open", (event) => {
    const drawer = event.target instanceof HTMLElement && event.target.matches("dialog.z-drawer[data-drag]") ? event.target : null;
    if (drawer && inDom(drawer)) attachDrawer(drawer);
  });
  on(document, "z:close", (event) => {
    const drawer = event.target instanceof HTMLElement ? event.target : null;
    if (!drawer || !sheets.has(drawer)) return;
    sheets.get(drawer)?.();
    sheets.delete(drawer);
  });
  on(document, "scroll", () => openHints.forEach(positionHint), { capture: true, passive: true });
  on(window, "resize", () => openHints.forEach(positionHint));
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !inDom(target)) return;
    const close = target.closest(".z-banner__close");
    const banner = close?.closest<HTMLElement>(".z-banner");
    if (banner) {
      dismissBanner(banner);
      return;
    }
    // Asa de un cajón sin anclajes: el clic (o Intro y Espacio) lo cierra.
    const grip = target.closest(".z-drawer__handle:not([role='slider'])")?.closest<HTMLDialogElement>("dialog.z-drawer");
    if (grip && inDom(grip)) {
      closeDialog(grip);
      return;
    }
    const barClose = target.closest(".z-actionbar__close")?.closest<HTMLElement>(".z-actionbar");
    if (barClose) {
      closeActionBar(barClose);
      return;
    }
    // Toggletip: el clic la deja fija; otro clic con ella fija la cierra.
    const tip = target.closest<HTMLElement>("[data-z-toggletip]");
    const hint = tip ? hintFor(tip) : null;
    if (!hint) return;
    if (hint.pinned && openHints.has(hint)) closeHint(hint, false);
    else {
      hint.pinned = true;
      hint.interest.show();
      if (!openHints.has(hint)) showHint(hint);
    }
  });
}

export function hydrate(root: ParentNode): void {
  for (const trigger of root.querySelectorAll<HTMLElement>("[data-z-toggletip]")) {
    if (!inDom(trigger)) continue;
    if (!trigger.hasAttribute("aria-expanded")) trigger.setAttribute("aria-expanded", "false");
  }
}
