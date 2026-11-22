"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../cx";
import { CHAT_LAYOUT_LABELS, historyStep, isChatView, nextPane, type ChatLayoutLabels, type ChatView } from "../chat-layout";

export { CHAT_LAYOUT_LABELS };
export type { ChatLayoutLabels, ChatView };

export interface ChatLayoutProps {
  /** Panel de la lista (ConversationList y su cabecera). */
  list?: ReactNode;
  /** La conversación (ChatHeader, MessageList, Composer). */
  children?: ReactNode;
  /** Panel de detalles (perfil, archivos, hilo). */
  details?: ReactNode;
  /** Detalles abiertos (en pantalla ancha, tercera columna; en media, encima de la conversación). */
  detailsOpen?: boolean;
  /** Vista en pantalla estrecha: una sola a la vez, como una pila. */
  view?: ChatView;
  onViewChange?: (view: ChatView) => void;
  /** Sincroniza la pila con el historial del navegador (atrás del sistema vuelve a la lista). */
  history?: boolean;
  /** `panes` (por defecto) o `widget`: botón flotante que abre la conversación en un panel de cristal. */
  variant?: "panes" | "widget";
  /** Widget abierto (controlado). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Título del panel del widget. */
  title?: string;
  labels?: Partial<ChatLayoutLabels>;
  className?: string;
}

const PANES = ".z-chat-layout__list, .z-chat-layout__main, .z-chat-layout__details";
const viewOf = (el: Element): ChatView =>
  el.matches(".z-chat-layout__list") ? "list" : el.matches(".z-chat-layout__details") ? "details" : "conversation";

/** Lleva el foco al panel siguiente (F6) entre los que se ven. */
function cyclePanes(root: HTMLElement, backwards: boolean): boolean {
  const panes = [...root.querySelectorAll<HTMLElement>(PANES)].filter(
    (p) => p.closest(".z-chat-layout") === root && p.getClientRects().length > 0,
  );
  const current = panes.find((p) => p.contains(root.ownerDocument.activeElement));
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

/**
 * Layout de mensajería en tres paneles: lista, conversación y detalles. En pantalla ancha, columnas; en media, lista y
 * conversación con los detalles encima; en estrecha, una pila (lista → conversación → detalles) con su botón de atrás y,
 * con `history`, sincronizada con el historial. F6 salta entre paneles. `variant="widget"`: asistente flotante.
 */
export function ChatLayout({
  list,
  children,
  details,
  detailsOpen = false,
  view = "conversation",
  onViewChange,
  history = false,
  variant = "panes",
  open = false,
  onOpenChange,
  title,
  labels,
  className,
}: ChatLayoutProps) {
  const l = { ...CHAT_LAYOUT_LABELS, ...labels };
  const uid = useId();
  const root = useRef<HTMLDivElement | null>(null);
  const launcher = useRef<HTMLButtonElement | null>(null);
  const previous = useRef(view);
  const onChange = useRef(onViewChange);
  onChange.current = onViewChange;

  // Pila ↔ historial: bajar añade una entrada; atrás del navegador sube.
  useEffect(() => {
    if (!history || variant !== "panes") return;
    const step = historyStep(previous.current, view);
    previous.current = view;
    if (step === "push") window.history.pushState({ ...(window.history.state ?? {}), zChatView: view }, "");
  }, [view, history, variant]);
  useEffect(() => {
    if (!history || variant !== "panes") return;
    const pop = (event: PopStateEvent) => {
      const next = (event.state as { zChatView?: unknown } | null)?.zChatView;
      const target: ChatView = isChatView(next) ? next : "list";
      previous.current = target;
      onChange.current?.(target);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [history, variant]);

  const openRef = useRef({ open, variant, onOpenChange });
  openRef.current = { open, variant, onOpenChange };
  // F6 entre paneles y Escape del widget: un oyente en la raíz (el teclado llega de cualquier pieza de dentro).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "F6" && cyclePanes(el, event.shiftKey)) event.preventDefault();
      const { open: isOpen, variant: kind, onOpenChange: change } = openRef.current;
      if (event.key === "Escape" && kind === "widget" && isOpen && !event.defaultPrevented) {
        change?.(false);
        launcher.current?.focus();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []);

  if (variant === "widget")
    return (
      <div ref={root} className={cx("z-chat-layout", className)} data-variant="widget" data-open={open || undefined}>
        {open ? (
          <section
            className="z-chat-layout__panel z-liquid"
            role="dialog"
            aria-modal="false"
            aria-label={title ?? l.conversation}
            id={`${uid}-panel`}
          >
            <section className="z-chat-layout__main" aria-label={title ?? l.conversation}>
              {children}
            </section>
          </section>
        ) : null}
        <button
          ref={launcher}
          type="button"
          className="z-chat-layout__launcher"
          aria-expanded={open}
          aria-controls={open ? `${uid}-panel` : undefined}
          aria-label={open ? l.close : l.launcher}
          title={open ? l.close : l.launcher}
          onClick={() => onOpenChange?.(!open)}
        >
          <Icon name={open ? "x-mark" : "chat-bubble-oval-left"} size={22} />
        </button>
      </div>
    );

  return (
    <div ref={root} className={cx("z-chat-layout", className)} data-view={view} data-details={(details && detailsOpen) || undefined}>
      {list ? (
        <section className="z-chat-layout__list" aria-label={l.list}>
          {list}
        </section>
      ) : null}
      <section className="z-chat-layout__main" aria-label={l.conversation}>
        {children}
      </section>
      {details && detailsOpen ? (
        <aside className="z-chat-layout__details" aria-label={l.details}>
          {details}
        </aside>
      ) : null}
    </div>
  );
}
