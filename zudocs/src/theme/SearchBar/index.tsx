// Dos correcciones sobre el buscador local, que se aplican tras montar:
//
// 1. Escribe aria-label="Search" a mano, sin pasar por las traducciones. El nombre accesible del campo sale aquí
//    de la misma clave que su texto de ayuda.
// 2. Al recibir el foco empieza a descargar el índice y, cuando termina, llama a `input.focus()` sin mirar dónde
//    está el foco en ese momento. Quien pasa por el campo con Tab y sigue adelante ve cómo el foco vuelve al
//    buscador en cuanto llega el índice (con la red lenta, un segundo después). Aquí ese `focus()` diferido solo
//    se atiende si el foco sigue en el campo o no está en ningún control; el del atajo de teclado (Ctrl K), que
//    ocurre dentro de la propia pulsación, se atiende siempre.
import { translate } from "@docusaurus/Translate";
import SearchBar from "@theme-original/SearchBar";
import { type ComponentProps, useEffect, useRef } from "react";

const GUARDED = Symbol("zudocs.search.focus");
type Guarded = HTMLInputElement & { [GUARDED]?: true };

/** Se está despachando una pulsación de tecla: lo que se enfoque ahora lo ha pedido quien usa la página (el atajo). */
let inKeydown = false;
function trackKeydown(): () => void {
  // Captura en `window` (antes que nadie) y burbuja en `window` (después de todos): el manejador del atajo, que
  // escucha en `document`, corre entre las dos. La descarga del índice termina en otra tarea, nunca en medio.
  const enter = () => {
    inKeydown = true;
    // Si alguien detiene la propagación, la burbuja no llega: se limpia en la tarea siguiente.
    setTimeout(leave, 0);
  };
  const leave = () => {
    inKeydown = false;
  };
  window.addEventListener("keydown", enter, true);
  window.addEventListener("keydown", leave);
  return () => {
    window.removeEventListener("keydown", enter, true);
    window.removeEventListener("keydown", leave);
  };
}

function guardFocus(input: Guarded): void {
  if (input[GUARDED]) return;
  input[GUARDED] = true;
  const focus = HTMLInputElement.prototype.focus;
  input.focus = (options?: FocusOptions) => {
    const active = document.activeElement;
    const elsewhere = active !== null && active !== input && active !== document.body && active !== document.documentElement;
    if (elsewhere && !inKeydown) return;
    focus.call(input, options);
  };
}

export default function SearchBarWrapper(props: ComponentProps<typeof SearchBar>) {
  const ref = useRef<HTMLSpanElement>(null);
  const label = translate({
    id: "theme.SearchBar.label",
    message: "Search",
    description: "The ARIA label and placeholder for search button",
  });
  useEffect(() => {
    const input = ref.current?.querySelector("input");
    if (!input) return;
    input.setAttribute("aria-label", label);
    guardFocus(input);
  });
  useEffect(trackKeydown, []);
  return (
    <span ref={ref} style={{ display: "contents" }}>
      <SearchBar {...props} />
    </span>
  );
}
