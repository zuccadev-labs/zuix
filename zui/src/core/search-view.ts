// SearchView (Material 3 «search view»): una barra de búsqueda que, al pulsarla, crece hasta una vista de búsqueda.
// En pantalla estrecha ocupa la pantalla entera; en ancha se queda acoplada bajo la barra, con su ancho. Es un
// `<dialog>` modal (`showModal()`): el resto de la página queda inerte, Escape y el botón de volver cierran y el foco
// vuelve a la barra. El crecimiento es un `clip-path` desde la caja de la barra (variables escritas al abrir), sin
// animación con movimiento reducido. Lo mismo para React y el modo DOM. Solo toca el documento al llamarse.
import { isRtl } from "./dir";

export interface SearchViewHost {
  /** Abierta o cerrada por la persona (barra, volver, Escape, fuera). */
  openChange(open: boolean): void;
  valueChange(value: string): void;
  submit(value: string): void;
}

export interface SearchViewApi {
  open(): void;
  close(): void;
  detach(): void;
}

/** Caja de la barra como recortes desde cada borde de la ventana (px), para el `clip-path` de entrada. */
export function growFrom(bar: { left: number; top: number; right: number; bottom: number }, viewport: { width: number; height: number }) {
  const clamp = (v: number) => Math.max(0, Math.round(v));
  return {
    top: clamp(bar.top),
    right: clamp(viewport.width - bar.right),
    bottom: clamp(viewport.height - bar.bottom),
    left: clamp(bar.left),
  };
}

/** Conecta un `.z-searchview`: la barra `.z-searchview__bar` y el `<dialog class="z-searchview__view">`. */
export function attachSearchView(root: HTMLElement, host: SearchViewHost): SearchViewApi {
  const doc = root.ownerDocument;
  const bar = () => root.querySelector<HTMLElement>(":scope > .z-searchview__bar");
  const view = () => root.querySelector<HTMLDialogElement>(":scope > .z-searchview__view");
  const input = () => view()?.querySelector<HTMLInputElement>(".z-searchview__input") ?? null;

  const writeGeometry = (dialog: HTMLElement, from: HTMLElement) => {
    const box = from.getBoundingClientRect();
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    const g = growFrom(box, { width: vw, height: vh });
    const s = dialog.style;
    s.setProperty("--z-sv-clip-top", `${g.top}px`);
    s.setProperty("--z-sv-clip-right", `${g.right}px`);
    s.setProperty("--z-sv-clip-bottom", `${g.bottom}px`);
    s.setProperty("--z-sv-clip-left", `${g.left}px`);
    // Vista acoplada: sobre la barra, con su ancho, desde su borde inicial (en RTL, el derecho).
    s.setProperty("--z-sv-top", `${Math.round(box.top)}px`);
    s.setProperty("--z-sv-start", `${Math.round(isRtl(root) ? vw - box.right : box.left)}px`);
    s.setProperty("--z-sv-width", `${Math.round(box.width)}px`);
  };

  const open = () => {
    const dialog = view();
    const from = bar();
    if (!dialog || !from || dialog.open) return;
    writeGeometry(dialog, from);
    dialog.dataset.state = "open";
    dialog.showModal();
    from.setAttribute("aria-expanded", "true");
    const field = input();
    field?.focus();
    field?.select?.();
  };
  const close = () => {
    const dialog = view();
    if (dialog?.open) dialog.close();
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target as Element;
    const dialog = view();
    if (target.closest?.(".z-searchview__bar") && bar()?.contains(target)) {
      open();
      host.openChange(true);
    } else if (target.closest?.(".z-searchview__back")) {
      close();
    } else if (target.closest?.(".z-searchview__clear")) {
      const field = input();
      if (field) {
        field.value = "";
        field.focus();
        host.valueChange("");
        root.toggleAttribute("data-filled", false);
      }
    } else if (dialog && target === dialog) {
      // Pulsar el velo (fuera de la vista acoplada) cierra.
      const box = dialog.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) close();
    }
  };
  const onInput = (event: Event) => {
    const field = event.target as HTMLInputElement;
    if (!field.classList?.contains("z-searchview__input")) return;
    root.toggleAttribute("data-filled", Boolean(field.value));
    host.valueChange(field.value);
  };
  const onKey = (event: KeyboardEvent) => {
    const field = event.target as HTMLInputElement;
    // Escape en un campo de búsqueda con texto lo vaciaría y la vista seguiría abierta: aquí cierra, sin perder lo escrito.
    if (event.key === "Escape" && field.classList?.contains("z-searchview__input") && view()?.open) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Enter" && field.classList?.contains("z-searchview__input") && !event.isComposing) {
      event.preventDefault();
      host.submit(field.value);
    }
  };
  // `close` del diálogo (volver, Escape, velo o close()): estado y foco a la barra.
  const onClose = (event: Event) => {
    const dialog = view();
    if (event.target !== dialog || !dialog) return;
    dialog.dataset.state = "closed";
    bar()?.setAttribute("aria-expanded", "false");
    bar()?.focus({ preventScroll: true });
    host.openChange(false);
  };
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("keydown", onKey);
  root.addEventListener("close", onClose, true);
  return {
    open,
    close,
    detach() {
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("close", onClose, true);
    },
  };
}
