// ChatLayout sin framework: la pila de vistas en pantalla estrecha, F6 entre paneles, el historial y el widget flotante.
//   .z-chat-layout[data-view]               vista en pantalla estrecha: list | conversation | details
//   [data-z-chat-view="conversation"]       dentro del layout: pasa a esa vista (z:viewchange { view }, cancelable)
//   data-history                            en .z-chat-layout: bajar en la pila añade una entrada al historial
//   .z-chat-layout[data-variant="widget"]   .z-chat-layout__launcher abre y cierra .z-chat-layout__panel; Escape cierra
import { historyStep, isChatView, nextPane, type ChatView } from "../chat-layout";

const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;
const PANES = ".z-chat-layout__list, .z-chat-layout__main, .z-chat-layout__details";
const viewOf = (el: Element): ChatView =>
  el.matches(".z-chat-layout__list") ? "list" : el.matches(".z-chat-layout__details") ? "details" : "conversation";

function emit(el: HTMLElement, name: string, detail: unknown): boolean {
  return el.dispatchEvent(new CustomEvent(`z:${name}`, { detail, bubbles: true, cancelable: true }));
}

/** Cambia la vista de un ChatLayout (y del historial si lo sincroniza). Devuelve `false` si se canceló. */
export function setChatView(layout: HTMLElement, view: ChatView, fromHistory = false): boolean {
  const from = isChatView(layout.dataset.view) ? layout.dataset.view : "conversation";
  if (from === view) return true;
  if (!emit(layout, "viewchange", { view })) return false;
  layout.dataset.view = view;
  if (layout.hasAttribute("data-history") && !fromHistory && historyStep(from, view) === "push")
    window.history.pushState({ ...(window.history.state ?? {}), zChatView: view }, "");
  const pane = [...layout.querySelectorAll<HTMLElement>(PANES)].find((p) => viewOf(p) === view);
  if (pane?.getClientRects().length)
    (pane.querySelector<HTMLElement>("h1, h2, h3, [tabindex='0']") ?? pane).focus?.({ preventScroll: true });
  return true;
}

/** Abre o cierra el widget flotante. */
export function setChatWidgetOpen(layout: HTMLElement, open: boolean): void {
  const panel = layout.querySelector<HTMLElement>(".z-chat-layout__panel");
  const launcher = layout.querySelector<HTMLButtonElement>(".z-chat-layout__launcher");
  if (!panel) return;
  panel.hidden = !open;
  layout.toggleAttribute("data-open", open);
  launcher?.setAttribute("aria-expanded", String(open));
  if (!emit(layout, open ? "open" : "close", {})) return;
  if (open) (panel.querySelector<HTMLElement>("textarea, input, button") ?? panel).focus?.();
  else launcher?.focus();
}

function cycle(layout: HTMLElement, backwards: boolean): boolean {
  const panes = [...layout.querySelectorAll<HTMLElement>(PANES)].filter(
    (p) => p.closest(".z-chat-layout") === layout && p.getClientRects().length > 0,
  );
  const current = panes.find((p) => p.contains(document.activeElement));
  const next = nextPane(panes.map(viewOf), current ? viewOf(current) : null, backwards);
  const pane = panes.find((p) => viewOf(p) === next);
  if (!pane) return false;
  const target = [...pane.querySelectorAll<HTMLElement>('[tabindex="0"], input, textarea, button:not([disabled]), a[href]')].find(
    (el) => el.getClientRects().length > 0,
  );
  // Un panel sin nada enfocable recibe el foco él mismo (programático, fuera del orden de Tab).
  if (!target && !pane.hasAttribute("tabindex")) pane.tabIndex = -1;
  (target ?? pane).focus();
  return true;
}

export function onChatClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const layout = target?.closest<HTMLElement>(".z-chat-layout");
  if (!target || !layout || !inDom(layout)) return;
  const launcher = target.closest(".z-chat-layout__launcher");
  if (launcher) {
    setChatWidgetOpen(layout, !layout.hasAttribute("data-open"));
    return;
  }
  const to = target.closest<HTMLElement>("[data-z-chat-view]")?.dataset.zChatView;
  if (isChatView(to)) setChatView(layout, to);
}

export function onChatKeydown(event: KeyboardEvent): boolean {
  const target = event.target instanceof Element ? event.target : null;
  const layout = target?.closest<HTMLElement>(".z-chat-layout");
  if (!layout || !inDom(layout)) return false;
  if (event.key === "F6" && cycle(layout, event.shiftKey)) {
    event.preventDefault();
    return true;
  }
  if (event.key === "Escape" && layout.dataset.variant === "widget" && layout.hasAttribute("data-open") && !event.defaultPrevented) {
    setChatWidgetOpen(layout, false);
    return true;
  }
  return false;
}

/** Atrás del navegador: cada layout con historial vuelve a la vista guardada (o a la lista). */
export function onChatPopState(event: PopStateEvent): void {
  const saved = (event.state as { zChatView?: unknown } | null)?.zChatView;
  for (const layout of document.querySelectorAll<HTMLElement>(".z-chat-layout[data-history]"))
    if (inDom(layout)) setChatView(layout, isChatView(saved) ? saved : "list", true);
}

/** El widget empieza cerrado salvo que diga lo contrario. */
export function hydrateChat(root: ParentNode): void {
  const found = [...root.querySelectorAll<HTMLElement>('.z-chat-layout[data-variant="widget"]')];
  for (const layout of found) {
    if (!inDom(layout)) continue;
    const panel = layout.querySelector<HTMLElement>(".z-chat-layout__panel");
    if (panel) panel.hidden = !layout.hasAttribute("data-open");
    layout.querySelector(".z-chat-layout__launcher")?.setAttribute("aria-expanded", String(layout.hasAttribute("data-open")));
  }
}
