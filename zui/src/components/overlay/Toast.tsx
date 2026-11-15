"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Toast as RadixToast } from "radix-ui";
import { CloseButton } from "./internal";

export type ToastIntent = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  intent?: ToastIntent;
  /** Milisegundos visibles; por defecto el del proveedor. */
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
  /** Nombre que anuncian los lectores de pantalla para cada aviso. */
  label?: string;
}

interface ToastItem extends ToastOptions {
  id: string;
  open: boolean;
}

const ToastContext = createContext<ToastApi | null>(null);

// Margen para que termine la animación de salida antes de retirar el aviso del estado.
const EXIT_MS = 400;
let counter = 0;

export function ToastProvider({ children, duration = 5000, position = "bottom-right", limit = 5, closeLabel = "Close", label = "Notification" }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const viewportRef = useRef<HTMLOListElement>(null);

  // Radix pausa el cierre automático mientras el puntero o el foco están en la región de avisos y solo lo
  // reanuda con eventos de esa región, que deja de escuchar cuando se queda vacía. Si el último aviso se cerró
  // a mano (puntero o foco dentro), la pausa quedaba puesta y los avisos siguientes no se cerraban nunca solos.
  // Al volver a haber avisos abiertos, si ni el puntero ni el foco están en la región, se le notifica la salida.
  const empty = !items.some((item) => item.open);
  useEffect(() => {
    if (empty) return;
    // Radix vuelve a escuchar la región en un render posterior al del primer aviso: se espera a ese momento.
    const resume = () => {
      const region = viewportRef.current?.parentElement;
      if (!region || region.contains(document.activeElement) || region.matches(":hover")) return;
      region.dispatchEvent(new FocusEvent("focusout"));
    };
    const first = setTimeout(resume, 0);
    const second = setTimeout(resume, 120);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [empty]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, open: false } : item)));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((list) => list.filter((item) => item.id !== id));
    }, EXIT_MS);
    timers.current.add(timer);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast: (options) => {
        counter += 1;
        const id = `z-toast-${counter}`;
        setItems((list) => [...list, { ...options, id, open: true }].slice(-limit));
        return id;
      },
      dismiss,
      dismissAll: () => setItems([]),
    }),
    [dismiss, limit],
  );

  const swipe = position.endsWith("center") ? (position.startsWith("top") ? "up" : "down") : "right";

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider duration={duration} label={label} swipeDirection={swipe}>
        {children}
        {items.map((item) => {
          const intent = item.intent ?? "info";
          return (
            <RadixToast.Root
              key={item.id}
              className="z-liquid z-toast"
              data-intent={intent}
              type={intent === "danger" || intent === "warning" ? "foreground" : "background"}
              open={item.open}
              duration={item.duration}
              onOpenChange={(open) => {
                if (!open) dismiss(item.id);
              }}
            >
              <span className="z-toast__dot" aria-hidden="true" />
              <div className="z-toast__content">
                <RadixToast.Title className="z-toast__title">{item.title}</RadixToast.Title>
                {item.description ? <RadixToast.Description className="z-toast__description">{item.description}</RadixToast.Description> : null}
                {item.action ? (
                  <RadixToast.Action asChild altText={item.action.label}>
                    <button type="button" className="z-toast__action" onClick={item.action.onClick}>
                      {item.action.label}
                    </button>
                  </RadixToast.Action>
                ) : null}
              </div>
              <RadixToast.Close asChild>
                <CloseButton label={closeLabel} className="z-toast__close" />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}
        <RadixToast.Viewport ref={viewportRef} className="z-toast-viewport" data-position={position} />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

/** Acceso a los avisos; requiere un `ToastProvider` por encima. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
