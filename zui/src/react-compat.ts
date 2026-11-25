// Lo que cambia entre React 18 y 19 y el binding necesita en los dos. La versión se lee una vez, al cargar el módulo,
// de la copia de React que resuelve la aplicación (los paquetes la piden como peer). Sin hooks: también vale en un
// Server Component.
import { forwardRef, version, type ReactElement, type ReactNode, type Ref } from "react";

/** Versión mayor de React que resuelve la aplicación. */
export const REACT_MAJOR = Number.parseInt(version, 10);
/** React 18: `ref` no llega como prop a un componente de función e `inert` es un atributo de cadena. */
export const LEGACY_REACT = REACT_MAJOR < 19;
const legacy = LEGACY_REACT;

/**
 * Componente de función que recibe `ref` como una prop más, en React 18 y 19. En 19 devuelve la misma función: React
 * ya pasa `ref` en las props. En 18 la envuelve en `forwardRef` y vuelve a poner la ref en las props, de modo que el
 * cuerpo del componente es el mismo en las dos versiones. El tipo es el de la función (conserva los genéricos).
 */
export function withRef<C extends (props: never) => ReactNode>(render: C): C {
  if (!legacy) return render;
  const call = render as unknown as (props: object) => ReactNode;
  const forwarded = forwardRef<unknown, object>((props, ref) => call(ref == null ? props : { ...props, ref }));
  forwarded.displayName = render.name;
  return forwarded as unknown as C;
}

/** La ref de un elemento: en 19 es una prop (`element.props.ref`; leer `element.ref` avisa); en 18, `element.ref`. */
export function elementRef(element: ReactElement): Ref<unknown> | undefined {
  return (legacy ? (element as { ref?: Ref<unknown> }).ref : (element.props as { ref?: Ref<unknown> }).ref) ?? undefined;
}

/**
 * Valor de la prop `inert`. React 19 la conoce y espera un booleano; React 18 no la conoce: descarta `true` con un aviso
 * y solo escribe el atributo si recibe una cadena (`inert=""`). Sin `on`, `undefined`: no hay atributo.
 */
export function inertProp(on: boolean | undefined): boolean | undefined {
  if (!on) return undefined;
  return legacy ? ("" as unknown as boolean) : true;
}
