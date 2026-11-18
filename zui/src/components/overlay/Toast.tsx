"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { followModalHost, modalHost, moveToHost, settleShown } from "../../core/modal-host";
import { focusQuiet } from "../../core/focus";
import { afterExit } from "../../core/presence";
import { swipeDirection, swipeToDismiss } from "../../core/swipe";
import { createTimer } from "../../core/timer";
import { useIsoLayoutEffect, useLatest } from "../../primitives/hooks";
import { CloseButton } from "./internal";

export type ToastIntent = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  intent?: ToastIntent;
  /** Milisegundos visibles; por defecto el del proveedor. 0 lo deja hasta que se cierre a mano. */
  duration?: number;
  /** Acción opcional dentro del aviso. */
  action?: { label: string; onClick: () => void };
}

export interface ToastApi {
  /** Muestra un aviso y devuelve su id. */
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export interface ToastProviderProps {
  children?: ReactNode;
  /** Duración por defecto en ms. */
  duration?: number;
  position?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
  /** Máximo de avisos simultáneos; los más antiguos se retiran. */
  limit?: number;
  closeLabel?: string;
  /** Nombre accesible de la región de avisos. F8 lleva el foco a ella. */
  regionLabel?: string;
}

interface ToastItem extends ToastOptions {
  id: string;
  open: boolean;
}

const ToastContext = createContext<ToastApi | null>(null);
let counter = 0;

/** Contenedor de la región de avisos: no ocupa sitio en el diálogo o la página que lo aloja. */
function createToastRoot(): HTMLElement {
  const root = document.createElement("div");
  root.dataset.zToastRoot = "";
  root.style.display = "contents";
  return root;
}

interface ToastViewProps {
  item: ToastItem;
  duration: number;
  position: string;
  closeLabel: string;
  dismiss: (id: string) => void;
  remove: (id: string) => void;
  /** Elemento al que vuelve el foco si el aviso se cierra con el foco dentro. */
  returnTo: { current: HTMLElement | null };
}

function ToastView({ item, duration, position, closeLabel, dismiss, remove, returnTo }: ToastViewProps) {
  const node = useRef<HTMLDivElement | null>(null);
  const intent = item.intent ?? "info";
  const latest = useLatest({ dismiss, remove });
  const { id, open } = item;

  // Cierre automático con pausa (WCAG 2.2.1): el tiempo no corre mientras el puntero o el foco están en el aviso,
  // durante un gesto de descarte ni con la ventana sin foco; al volver continúa con lo que quedaba.
  useEffect(() => {
    const el = node.current;
    if (!el || !open) return;
    const close = () => latest.current.dismiss(id);
    const timer = createTimer(duration, close);
    const wiring = new AbortController();
    const { signal } = wiring;
    el.addEventListener("pointerenter", () => timer.hold("pointer"), { signal });
    el.addEventListener("pointerleave", () => timer.release("pointer"), { signal });
    el.addEventListener("focusin", () => timer.hold("focus"), { signal });
    el.addEventListener(
      "focusout",
      (event) => {
        if (!el.contains(event.relatedTarget as Node | null)) timer.release("focus");
      },
      { signal },
    );
    window.addEventListener("blur", () => timer.hold("window"), { signal });
    window.addEventListener("focus", () => timer.release("window"), { signal });
    const unswipe = swipeToDismiss(el, {
      direction: swipeDirection(position),
      onStart: () => timer.hold("swipe"),
      onCancel: () => timer.release("swipe"),
      onDismiss: close,
    });
    if (el.contains(document.activeElement)) timer.hold("focus");
    timer.start();
    return () => {
      timer.stop();
      wiring.abort();
      unswipe();
    };
  }, [id, open, duration, position, latest]);

  // Salida: se espera la animación y el aviso se retira; el foco no se queda en un aviso que desaparece.
  useIsoLayoutEffect(() => {
    const el = node.current;
    if (open || !el) return;
    const hadFocus = el.contains(document.activeElement);
    return afterExit(el, () => {
      latest.current.remove(id);
      if (hadFocus) focusQuiet(returnTo.current);
    });
  }, [open, id, latest, returnTo]);

  return (
    // El aviso admite el foco (F8 lo lleva a él) y Escape lo descarta desde el teclado.
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape descarta el aviso enfocado.
    <div
      ref={node}
      className="z-liquid z-toast"
      role={intent === "danger" || intent === "warning" ? "alert" : "status"}
      tabIndex={0}
      data-intent={intent}
      data-state={open ? "open" : "closed"}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        dismiss(id);
      }}
    >
      <span className="z-toast__dot" aria-hidden="true" />
      <div className="z-toast__content">
        <div className="z-toast__title">{item.title}</div>
        {item.description ? <div className="z-toast__description">{item.description}</div> : null}
        {item.action ? (
          <button
            type="button"
            className="z-toast__action"
            onClick={() => {
              item.action?.onClick();
              dismiss(id);
            }}
          >
            {item.action.label}
          </button>
        ) : null}
      </div>
      <CloseButton label={closeLabel} className="z-toast__close" onClick={() => dismiss(id)} />
    </div>
  );
}

/**
 * Región de avisos. Mismo marcado que `toast()` de `@zuccadev-labs/zuix-zui/dom`: una región con nombre (`role="region"`) en la
 * capa superior, y cada aviso con `role="status"` o `role="alert"`.
 */
export function ToastProvider({
  children,
  duration = 5000,
  position = "bottom-right",
  limit = 5,
  closeLabel = "Close",
  regionLabel = "Notifications (F8)",
}: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  // Contenedor propio de la región, fuera del árbol que pinta React: es lo que se muda entre `<body>` y el diálogo
  // modal vigente. Mover el contenedor (y no cambiar el destino del portal) conserva los avisos montados, con su
  // temporizador y su foco.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  // Elemento que tenía el foco antes de entrar en la región con F8.
  const returnTo = useRef<HTMLElement | null>(null);

  const dismiss = useCallback(
    (id: string) => setItems((list) => list.map((item) => (item.id === id ? { ...item, open: false } : item))),
    [],
  );
  const remove = useCallback((id: string) => setItems((list) => list.filter((item) => item.id !== id)), []);

  const api = useMemo<ToastApi>(
    () => ({
      toast: (options) => {
        counter += 1;
        const id = `z-toast-${counter}`;
        setHost((current) => current ?? createToastRoot());
        setItems((list) => [...list, { ...options, id, open: true }].slice(-limit));
        return id;
      },
      dismiss,
      dismissAll: () => setItems((list) => list.map((item) => ({ ...item, open: false }))),
    }),
    [dismiss, limit],
  );

  // Capa superior: con cada aviso nuevo, y cada vez que se abre o se cierra un diálogo modal, la región se muda al
  // diálogo de arriba (fuera de él sería inerte) y se vuelve a mostrar para quedar por encima de todo.
  const last = items[items.length - 1]?.id;
  const active = items.length > 0;
  // Avisos que ya hicieron su entrada: al mudar o volver a mostrar la región no la repiten.
  const shown = useRef(new WeakSet<Element>());
  useIsoLayoutEffect(() => {
    if (!host || !active) return;
    const raise = (to: HTMLElement) => {
      moveToHost(host, to);
      const el = viewport.current;
      if (!el) return;
      try {
        if (el.matches(":popover-open")) el.hidePopover();
        el.showPopover();
      } catch {
        // Navegador sin Popover API: la región queda con su posición fija y su z-index.
      }
      settleShown(el, '.z-toast[data-state="open"]', shown.current);
    };
    raise(modalHost());
    return followModalHost(raise);
  }, [last, host, active]);
  // Sin avisos (o al desmontar el proveedor) el contenedor no se queda en el documento.
  useEffect(() => {
    if (!host || active) return;
    host.remove();
  }, [host, active]);
  useEffect(() => () => host?.remove(), [host]);

  // F8 lleva el foco al aviso más reciente.
  const count = items.length;
  useEffect(() => {
    if (!count) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "F8" || event.ctrlKey || event.metaKey || event.altKey) return;
      const el = viewport.current;
      const target = [...(el?.querySelectorAll<HTMLElement>('.z-toast[data-state="open"]') ?? [])].pop();
      if (!el || !target) return;
      event.preventDefault();
      if (!el.contains(document.activeElement))
        returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      target.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {host && count
        ? createPortal(
            <div
              ref={viewport}
              className="z-toast-viewport"
              role="region"
              aria-label={regionLabel}
              tabIndex={-1}
              popover="manual"
              data-position={position}
            >
              {items.map((item) => (
                <ToastView
                  key={item.id}
                  item={item}
                  duration={item.duration ?? duration}
                  position={position}
                  closeLabel={closeLabel}
                  dismiss={dismiss}
                  remove={remove}
                  returnTo={returnTo}
                />
              ))}
            </div>,
            host,
          )
        : null}
    </ToastContext.Provider>
  );
}

/** Acceso a los avisos; requiere un `ToastProvider` por encima. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
