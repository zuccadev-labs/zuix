// Interés: abrir una capa ligera (HoverCard, Toggletip) cuando el puntero o el foco llegan a su disparador o a la
// propia capa, y cerrarla cuando ya no está en ninguno de los dos. Con retardos de apertura y de cierre (el puntero
// puede cruzar del disparador a la capa sin que se cierre: WCAG 1.4.13) y cierre inmediato con Escape.
// Sin DOM: solo temporizadores. La comparten el binding de React y el modo DOM.

export type InterestSource = "trigger-pointer" | "trigger-focus" | "content-pointer" | "content-focus";

export interface InterestOptions {
  /** Milisegundos desde que llega el interés hasta abrir. */
  openDelay: number;
  /** Milisegundos desde que se va hasta cerrar. */
  closeDelay: number;
  onChange: (open: boolean) => void;
}

export interface Interest {
  /** El puntero o el foco llegan a una de las dos zonas. */
  enter(source: InterestSource): void;
  /** Se van de esa zona. */
  leave(source: InterestSource): void;
  /** Abre ya (clic en un toggletip). */
  show(): void;
  /** Cierra ya y olvida las zonas activas (Escape, pulsación fuera). */
  hide(): void;
  isOpen(): boolean;
  /** Cambia los retardos sin rehacer el controlador. */
  setDelays(openDelay: number, closeDelay: number): void;
  dispose(): void;
}

export function createInterest({ openDelay, closeDelay, onChange }: InterestOptions): Interest {
  const active = new Set<InterestSource>();
  let open = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delays = { open: openDelay, close: closeDelay };

  const set = (next: boolean) => {
    clearTimeout(timer);
    timer = undefined;
    if (open === next) return;
    open = next;
    onChange(next);
  };
  const schedule = (next: boolean, ms: number) => {
    clearTimeout(timer);
    if (ms <= 0) set(next);
    else timer = setTimeout(() => set(next), ms);
  };

  return {
    enter(source) {
      active.add(source);
      // Ya abierta: solo se cancela un cierre pendiente. El foco abre sin esperar al retardo del puntero.
      if (open) {
        clearTimeout(timer);
        timer = undefined;
      } else schedule(true, source.endsWith("focus") ? 0 : delays.open);
    },
    leave(source) {
      active.delete(source);
      if (active.size) return;
      if (open) schedule(false, delays.close);
      else {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    show: () => set(true),
    hide() {
      active.clear();
      set(false);
    },
    isOpen: () => open,
    setDelays(nextOpen, nextClose) {
      delays = { open: nextOpen, close: nextClose };
    },
    dispose() {
      clearTimeout(timer);
      active.clear();
    },
  };
}

/**
 * Tab entre un disparador y su capa montada en otro punto del documento (capa superior), para que el orden de
 * tabulación siga al visual: desde el disparador entra en la capa; desde el primer control de la capa, Mayús+Tab
 * vuelve al disparador; desde el último, Tab sale hacia lo que sigue al disparador. Devuelve el elemento al que
 * llevar el foco (`"close"` si hay que cerrar la capa además), o null si Tab sigue su curso normal.
 */
export function bridgeTab(
  active: Element | null,
  shift: boolean,
  {
    trigger,
    content,
    tabbables,
    after,
  }: { trigger: Element; content: Element; tabbables: HTMLElement[]; after: () => HTMLElement | undefined },
): { focus: HTMLElement | undefined; close: boolean } | null {
  if (!active) return null;
  if (active === trigger || trigger.contains(active)) {
    if (shift || !tabbables.length) return null;
    return { focus: tabbables[0], close: false };
  }
  if (!content.contains(active)) return null;
  const first = tabbables[0];
  const last = tabbables[tabbables.length - 1];
  if (shift && (active === first || active === content)) return { focus: trigger as HTMLElement, close: false };
  if (!shift && (active === last || !tabbables.length)) return { focus: after(), close: true };
  return null;
}
