// Barra de menús de aplicación (patrón APG «menubar»): qué hace una tecla en un título de la barra o dentro de uno de
// sus menús. Sin DOM: recibe la tecla ya reflejada con `logicalKey` (en RTL la flecha izquierda avanza) y el contexto.
// La comparten Menubar (React) y el modo DOM.

export type MenubarAction =
  /** Ir al título anterior o siguiente (con vuelta). Con un menú abierto, se abre el del título nuevo. */
  | { type: "move"; to: "prev" | "next" | "first" | "last" }
  /** Abrir el menú del título y enfocar su primera o su última entrada. */
  | { type: "open"; focus: "first" | "last" };

export interface MenubarKeyContext {
  /** Dónde está el foco: en un título de la barra o en una entrada de un menú abierto. */
  at: "trigger" | "menu";
  /** Nivel del menú (0 = el de la barra; 1 o más = submenús). Solo con `at: "menu"`. */
  depth?: number;
  /** La entrada enfocada abre un submenú. Solo con `at: "menu"`. */
  opensSubmenu?: boolean;
}

/** Acción de la barra para una tecla, o null si la tecla la atiende otro (el propio menú o el navegador). */
export function menubarKey(key: string, context: MenubarKeyContext): MenubarAction | null {
  if (context.at === "trigger") {
    if (key === "ArrowRight") return { type: "move", to: "next" };
    if (key === "ArrowLeft") return { type: "move", to: "prev" };
    if (key === "Home") return { type: "move", to: "first" };
    if (key === "End") return { type: "move", to: "last" };
    if (key === "ArrowDown" || key === "Enter" || key === " ") return { type: "open", focus: "first" };
    if (key === "ArrowUp") return { type: "open", focus: "last" };
    return null;
  }
  // Dentro de un menú: la flecha izquierda en el primer nivel salta al menú anterior (en un submenú cierra solo ese
  // nivel, lo hace el menú); la derecha en una entrada sin submenú salta al menú siguiente, desde cualquier nivel.
  if (key === "ArrowLeft" && (context.depth ?? 0) === 0) return { type: "move", to: "prev" };
  if (key === "ArrowRight" && !context.opensSubmenu) return { type: "move", to: "next" };
  return null;
}

/** Índice al que lleva un movimiento entre `count` títulos desde `current`, con vuelta. */
export function menubarIndex(to: "prev" | "next" | "first" | "last", current: number, count: number): number {
  if (count <= 0) return -1;
  if (to === "first") return 0;
  if (to === "last") return count - 1;
  return (current + (to === "next" ? 1 : -1) + count) % count;
}
