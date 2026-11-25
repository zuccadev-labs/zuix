import { Fragment, type HTMLAttributes, type Ref } from "react";
import { highlightParts, type HighlightOptions } from "../../core/format";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface HighlightProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children">, HighlightOptions {
  /** Texto en el que se buscan las coincidencias. */
  text: string;
  /** Una o varias consultas. */
  query: string | readonly string[];
  /** Estilo de la marca: fondo de acento o subrayado ondulado. */
  variant?: "fill" | "underline";
  ref?: Ref<HTMLSpanElement>;
}

/** Marca con `<mark>` las coincidencias de una o varias consultas (sin distinguir mayúsculas y, si se pide, acentos). */
export const Highlight = withRef(function Highlight({
  text,
  query,
  ignoreCase,
  ignoreAccents,
  wholeWord,
  variant = "fill",
  className,
  ref,
  ...rest
}: HighlightProps) {
  const parts = highlightParts(text, query, { ignoreCase, ignoreAccents, wholeWord });
  const queries = typeof query === "string" ? query : query.join("\n");
  // La posición de cada trozo en el texto es su clave (no cambia mientras el texto no cambie).
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((n, p) => n + p.text.length, 0));
  return (
    <span
      {...rest}
      ref={ref}
      className={cx("z-highlight", className)}
      data-variant={variant}
      data-query={queries}
      data-ignore-case={ignoreCase === false ? "false" : undefined}
      data-ignore-accents={ignoreAccents ? "" : undefined}
      data-whole-word={wholeWord ? "" : undefined}
    >
      {parts.map((p, i) => {
        const key = `${starts[i]}`;
        return p.match ? (
          <mark key={key} className="z-highlight__mark">
            {p.text}
          </mark>
        ) : (
          <Fragment key={key}>{p.text}</Fragment>
        );
      })}
    </span>
  );
});
