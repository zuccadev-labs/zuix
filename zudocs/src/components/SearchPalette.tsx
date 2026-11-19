// Paleta de búsqueda (⌘K): el buscador local del sitio dentro de un diálogo modal de cristal. El diálogo es el de
// zui (`<dialog>` + showModal: foco atrapado, Escape y clic fuera cierran, el foco vuelve al disparador).
import SearchBar from "@theme/SearchBar";
import { Modal } from "@zuccadev-labs/zuix-zui";
import { useEffect, useRef } from "react";

export function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const body = useRef<HTMLDivElement>(null);
  // Al abrir, el foco va al campo (con el focus del prototipo: theme/SearchBar envuelve el del campo). El campo
  // puede montarse un poco después que el diálogo; si para entonces la persona ya ha pulsado una tecla o hecho
  // clic, no se le mueve el foco.
  useEffect(() => {
    if (!open) return;
    let acted = false;
    const act = () => {
      acted = true;
    };
    window.addEventListener("keydown", act, true);
    window.addEventListener("pointerdown", act, true);
    let tries = 0;
    const id = setInterval(() => {
      const input = body.current?.querySelector<HTMLInputElement>("input");
      if (input || acted || ++tries > 20) clearInterval(id);
      if (input && !acted && document.activeElement !== input) HTMLInputElement.prototype.focus.call(input);
    }, 16);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", act, true);
      window.removeEventListener("pointerdown", act, true);
    };
  }, [open]);
  // El buscador vuelve a enfocar su campo al terminar de cargar el índice, y puede hacerlo sobre un campo nuevo que
  // no pasa por theme/SearchBar. Si la persona ya había llevado el foco a otro control del diálogo (Tab, clic) y
  // el campo lo recibe sin que medie una tecla ni un clic, el foco vuelve a ese control.
  useEffect(() => {
    if (!open) return;
    let dialog: HTMLDialogElement | null = null;
    let acting = false;
    let last: Element | null = null;
    const act = () => {
      acting = true;
      setTimeout(() => {
        acting = false;
      }, 0);
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches("input") && !acting && last && last !== target && dialog?.contains(last)) (last as HTMLElement).focus();
      else last = target;
    };
    const id = setInterval(() => {
      dialog = body.current?.closest("dialog") ?? null;
      if (!dialog) return;
      clearInterval(id);
      dialog.addEventListener("keydown", act, true);
      dialog.addEventListener("pointerdown", act, true);
      dialog.addEventListener("focusin", onFocusIn);
    }, 16);
    return () => {
      clearInterval(id);
      dialog?.removeEventListener("keydown", act, true);
      dialog?.removeEventListener("pointerdown", act, true);
      dialog?.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      label="Buscar en la documentación"
      size="md"
      closeLabel="Cerrar la búsqueda"
      className="zd-palette"
    >
      <div ref={body} className="zd-palette__body">
        <SearchBar />
        <p className="zd-palette__hint">
          <span>
            <kbd className="zd-kbd">↑</kbd> <kbd className="zd-kbd">↓</kbd> elegir
          </span>
          <span>
            <kbd className="zd-kbd">Enter</kbd> abrir
          </span>
          <span>
            <kbd className="zd-kbd">Esc</kbd> cerrar
          </span>
        </p>
      </div>
    </Modal>
  );
}
