// Pintado sin estado de un árbol de core/vnode como elemento de React (sirve en un Server Component): las piezas de
// solo marcado de chat e IA. La clase de la aplicación se suma a la de la raíz y las props de evento se reenvían.
import { cloneElement, isValidElement, type ReactElement } from "react";
import type { VEl } from "../../core/vnode";
import { toReact } from "../vnode";

export function staticNode(node: VEl, extra: { className?: string; id?: string } & Record<string, unknown> = {}): ReactElement {
  const element = toReact(node);
  if (!isValidElement(element)) throw new Error("staticNode: el árbol no tiene raíz");
  const { className, ...rest } = extra;
  const base = (element.props as { className?: string }).className;
  const props: Record<string, unknown> = { ...rest };
  if (className) props.className = base ? `${base} ${className}` : className;
  for (const [k, v] of Object.entries(props)) if (v === undefined) delete props[k];
  return cloneElement(element, props);
}
