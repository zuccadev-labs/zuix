// Lo que cambia entre React 18 y 19 en los atributos que escriben los layouts. Es el mismo criterio que
// zui/src/react-compat.ts; zout no lo importa de zui porque ahí es interno. Sin hooks: vale en un Server Component.
import { version } from "react";

/** React 18: `inert` y `popovertarget` no son props conocidas y se escriben como atributos de cadena. */
const legacy = Number.parseInt(version, 10) < 19;

/** Valor de la prop `inert`: booleano en React 19; en React 18, `""` (con `true` lo descarta y avisa). */
export function inertProp(on: boolean | undefined): boolean | undefined {
  if (!on) return undefined;
  return legacy ? ("" as unknown as boolean) : true;
}

/** Props de un botón que abre o cierra un `popover` declarativo: camelCase en React 19, minúsculas en React 18. */
export function popoverTarget(id: string, action?: "toggle" | "show" | "hide"): Record<string, string> {
  if (legacy) return action ? { popovertarget: id, popovertargetaction: action } : { popovertarget: id };
  return action ? { popoverTarget: id, popoverTargetAction: action } : { popoverTarget: id };
}
