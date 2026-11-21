"use client";
import { useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type Ref } from "react";
import { cx } from "../../cx";
import { splitText, type TextSplit } from "../../core/effects";
import { useIsoLayoutEffect } from "../../primitives/hooks";

export type TextEffectKind = "reveal" | "blur" | "gradient" | "shimmer";

export interface TextEffectProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** El texto. */
  children: string;
  /** Aparición por piezas que suben (`reveal`), aparición desenfocada (`blur`), degradado o brillo que pasa. */
  effect?: TextEffectKind;
  /** Unidad de la aparición (reveal y blur). */
  by?: TextSplit;
  /** Milisegundos entre una pieza y la siguiente. */
  stagger?: number;
  /** Milisegundos de cada pieza (aparición) o de una pasada (degradado y brillo). */
  duration?: number;
  /** Milisegundos antes de empezar. */
  delay?: number;
  /** Al montarse o al entrar en pantalla (aparición). */
  trigger?: "mount" | "visible";
  /** El degradado se desplaza (solo sin movimiento reducido). */
  animated?: boolean;
  /** Elemento que se pinta: `span` por defecto; `h1`…`p` para un titular. */
  as?: ElementType;
  ref?: Ref<HTMLElement>;
}

const SPLIT = new Set<TextEffectKind>(["reveal", "blur"]);

/**
 * Efectos de texto: aparición por palabras o letras (subiendo o desenfocada), degradado y brillo que pasa. El texto
 * entero llega a los lectores de pantalla una sola vez; las piezas son `aria-hidden`. Sin movimiento reducido no
 * se anima y el texto queda en su estado final; sin JavaScript también se ve entero.
 */
export function TextEffect({
  children,
  effect = "reveal",
  by = "word",
  stagger,
  duration,
  delay,
  trigger = "mount",
  animated,
  as: Tag = "span",
  className,
  style,
  ref,
  ...rest
}: TextEffectProps) {
  const own = useRef<HTMLElement | null>(null);
  const split = SPLIT.has(effect);
  const [pending, setPending] = useState(false);
  // Al entrar en pantalla: espera oculto (antes de pintar) hasta que el elemento se ve.
  useIsoLayoutEffect(() => {
    if (split && trigger === "visible" && typeof IntersectionObserver !== "undefined") setPending(true);
  }, [split, trigger]);
  useEffect(() => {
    const el = own.current;
    if (!pending || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPending(false);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pending]);
  const vars = {
    ...style,
    ...(stagger !== undefined ? { "--z-texteffect-stagger": `${stagger}ms` } : by === "letter" ? { "--z-texteffect-stagger": "18ms" } : {}),
    ...(duration !== undefined ? { "--z-texteffect-duration": `${duration}ms` } : {}),
    ...(delay !== undefined ? { "--z-texteffect-delay": `${delay}ms` } : {}),
  } as CSSProperties;
  const setRef = (node: HTMLElement | null) => {
    own.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };
  return (
    <Tag
      {...rest}
      ref={setRef}
      className={cx("z-texteffect", className)}
      data-effect={effect}
      data-by={split ? by : undefined}
      data-trigger={split && trigger === "visible" ? "visible" : undefined}
      data-state={pending ? "pending" : undefined}
      data-animated={!split && animated !== false && (animated || effect === "shimmer") ? "" : undefined}
      style={vars}
    >
      {split ? (
        <>
          <span className="z-sr-only">{children}</span>
          <span className="z-texteffect__text" aria-hidden="true">
            {splitText(children, by).map((t, i) =>
              "space" in t ? (
                t.space
              ) : t.letters ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: el texto partido es fijo; cada trozo es su posición.
                <span key={i} className="z-texteffect__word">
                  {t.letters.map((l) => (
                    <span key={l.index} className="z-texteffect__piece" style={{ "--z-i": l.index } as CSSProperties}>
                      {l.text}
                    </span>
                  ))}
                </span>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: el texto partido es fijo; cada trozo es su posición.
                <span key={i} className="z-texteffect__piece" style={{ "--z-i": t.index } as CSSProperties}>
                  {t.word}
                </span>
              ),
            )}
          </span>
        </>
      ) : (
        children
      )}
    </Tag>
  );
}
