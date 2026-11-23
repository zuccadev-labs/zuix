// `ref` como prop en React 18 y 19 (mismo criterio que zui/src/react-compat.ts, que zicon no puede importar). La versión
// se lee una vez, de la copia de React que resuelve la aplicación. Sin hooks: vale en un Server Component.
import { forwardRef, version, type ReactNode } from "react";

/**
 * En React 19 devuelve la misma función: `ref` ya llega en las props. En React 18 la envuelve en `forwardRef` y vuelve
 * a poner la ref en las props, para que el cuerpo del componente sea el mismo en las dos versiones.
 */
export function withRef<C extends (props: never) => ReactNode>(render: C): C {
  if (Number.parseInt(version, 10) >= 19) return render;
  const call = render as unknown as (props: object) => ReactNode;
  const forwarded = forwardRef<unknown, object>((props, ref) => call(ref == null ? props : { ...props, ref }));
  forwarded.displayName = render.name;
  return forwarded as unknown as C;
}
