"use client";
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "children" | "onCopy"> {
  /** Código a mostrar y copiar. */
  code: string;
  /** Rótulo de la cabecera (nombre de archivo). */
  title?: ReactNode;
  /** Lenguaje: se muestra en la cabecera y se expone como `data-language`. */
  language?: string;
  /** Ajusta las líneas largas en lugar de desplazar en horizontal. */
  wrap?: boolean;
  /** Alto máximo (longitud CSS); a partir de ahí desplaza. */
  maxHeight?: string;
  /** Oculta el botón de copiar. */
  hideCopy?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  /** Nombre accesible de la región de código, enfocable para desplazarla con teclado. */
  label?: string;
  onCopy?: (code: string) => void;
}

/** Bloque de código sin resaltado, con botón de copiar. */
export function CodeBlock({
  code,
  title,
  language,
  wrap,
  maxHeight,
  hideCopy,
  copyLabel = "Copy",
  copiedLabel = "Copied",
  label = "Code",
  onCopy,
  className,
  ...rest
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Sin permiso de portapapeles no se confirma la copia.
      return;
    }
    onCopy?.(code);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  const hasHeader = Boolean(title || language);
  const copyButton = hideCopy ? null : (
    <button type="button" className="z-code__copy" data-copied={copied || undefined} onClick={copy}>
      <Icon name={copied ? "check" : "copy"} size={14} />
      <span aria-live="polite">{copied ? copiedLabel : copyLabel}</span>
    </button>
  );
  return (
    <div
      {...rest}
      className={cx("z-code", className)}
      data-language={language}
      data-wrap={wrap || undefined}
      data-header={hasHeader || undefined}
    >
      {hasHeader ? (
        <div className="z-code__header">
          <span className="z-code__title">{title ?? language}</span>
          {title && language ? <span className="z-code__language">{language}</span> : null}
          {copyButton}
        </div>
      ) : (
        copyButton
      )}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: el bloque se desplaza; una región con scroll debe poder enfocarse para recorrerla con el teclado (WCAG 2.1.1). */}
      <pre className="z-code__pre" tabIndex={0} role="region" aria-label={label} style={maxHeight ? { maxHeight } : undefined}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
