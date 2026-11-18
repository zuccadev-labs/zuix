// Slot propio: fusiona props y ref con un elemento hijo (disparadores `trigger`, `asChild`). Sin hooks.
import { cloneElement, isValidElement, type ReactElement, type ReactNode, type Ref } from "react";
import { cx } from "../cx";
import { mergeRefs } from "../refs";

type Props = Record<string, unknown>;

/**
 * Props de la primitiva (`slot`) sobre las del hijo (`child`). Las clases se suman, los estilos se mezclan, las refs
 * se unen y los manejadores se encadenan: primero el del hijo y después el de la primitiva, salvo que el hijo haya
 * cancelado el evento (`preventDefault`). En el resto gana la primitiva; un valor `undefined` no pisa al del hijo.
 */
export function mergeProps(slot: Props, child: Props): Props {
  const out: Props = { ...child };
  for (const [key, value] of Object.entries(slot)) {
    const own = child[key];
    if (/^on[A-Z]/.test(key) && typeof value === "function" && typeof own === "function") {
      out[key] = (...args: unknown[]) => {
        (own as (...a: unknown[]) => void)(...args);
        if (!(args[0] as { defaultPrevented?: boolean } | undefined)?.defaultPrevented) (value as (...a: unknown[]) => void)(...args);
      };
    } else if (key === "className") out[key] = cx(value as string, own as string);
    else if (key === "style") out[key] = { ...(own as object), ...(value as object) };
    else if (key === "ref") out[key] = own ? mergeRefs(value as Ref<unknown>, own as Ref<unknown>) : value;
    else if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Clona `child` con las props fusionadas; `children`, si se pasa, sustituye a los del hijo. */
export function slot(child: ReactElement, props: Props, children?: ReactNode): ReactElement {
  const merged = mergeProps(props, child.props as Props);
  return children === undefined ? cloneElement(child, merged) : cloneElement(child, merged, children);
}

/** El único hijo si es un elemento; si no, null. */
export const onlyElement = (node: ReactNode): ReactElement | null => (isValidElement(node) ? node : null);
