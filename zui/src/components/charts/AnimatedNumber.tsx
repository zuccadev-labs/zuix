"use client";
import { cloneElement, useRef, type ReactElement, type Ref } from "react";
import {
  animatedNumberConfig,
  animatedNumberTree,
  type AnimatedNumberProps as CoreProps,
  stopAnimatedNumber,
  syncAnimatedNumber,
} from "../../core/animated-number";
import { cx } from "../../cx";
import { useIsoLayoutEffect } from "../../primitives/hooks";
import { withRef } from "../../react-compat";
import { useMergedRef } from "../../refs";
import { toReact } from "../vnode";

export interface AnimatedNumberProps extends CoreProps {
  className?: string;
  id?: string;
  ref?: Ref<HTMLSpanElement>;
}

/**
 * Número que cuenta del valor anterior al nuevo con `Intl.NumberFormat`. El servidor pinta ya el valor final (sin
 * desajuste de hidratación); los lectores de pantalla leen solo el final y, con `live`, lo oyen una vez por cambio.
 */
export const AnimatedNumber = withRef(function AnimatedNumber({ className, id, ref, ...props }: AnimatedNumberProps) {
  const root = useRef<HTMLSpanElement | null>(null);
  const setRoot = useMergedRef(root, ref);
  const config = animatedNumberConfig(props);
  useIsoLayoutEffect(() => {
    if (root.current) syncAnimatedNumber(root.current, config);
  });
  useIsoLayoutEffect(() => {
    const el = root.current;
    return () => {
      if (el) stopAnimatedNumber(el);
    };
  }, []);
  const el = toReact(animatedNumberTree(config)) as ReactElement<{ className?: string; id?: string; ref?: unknown }>;
  return cloneElement(el, { id, className: cx("z-animated-number", className), ref: setRoot });
});
