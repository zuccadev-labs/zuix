"use client";
import { useEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { attachAffix } from "../../core/affix";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";
import { useMergedRef } from "../../refs";

export interface AffixProps extends HTMLAttributes<HTMLDivElement> {
  /** Borde al que se pega (`top`). */
  side?: "top" | "bottom";
  /** Distancia al borde en px (lo que tape una barra fija). */
  offset?: number;
  /** Se pegó o se soltó. */
  onStuckChange?: (stuck: boolean) => void;
  ref?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

/** Fija su contenido al desplazar con `position: sticky`; `data-stuck` (sombra) cuando está pegado. */
export const Affix = withRef(function Affix({ side = "top", offset = 0, onStuckChange, className, style, ref, children, ...rest }: AffixProps) {
  const node = useRef<HTMLDivElement | null>(null);
  const setNode = useMergedRef(node, ref);
  const handler = useRef(onStuckChange);
  handler.current = onStuckChange;
  // biome-ignore lint/correctness/useExhaustiveDependencies: el observador lee lado y distancia del DOM; cambiarlos lo vuelve a conectar.
  useEffect(() => (node.current ? attachAffix(node.current, (stuck) => handler.current?.(stuck)) : undefined), [side, offset]);
  return (
    <div
      {...rest}
      ref={setNode}
      className={cx("z-affix", className)}
      data-side={side}
      style={{ ...style, "--z-affix-offset": `${Math.max(0, offset)}px` } as CSSProperties}
    >
      {children}
    </div>
  );
});
