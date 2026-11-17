/// <reference types="@docusaurus/theme-mermaid" />
// Diagrama Mermaid con el tema de la marca. Solo se carga con `markdown.mermaid: true` en
// zudocs.config.json: docusaurus.config.ts registra entonces esta carpeta como tema.
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import ErrorBoundary from "@docusaurus/ErrorBoundary";
import { ErrorBoundaryErrorMessageFallback } from "@docusaurus/theme-common";
import { MermaidContainerClassName, useMermaidConfig, useMermaidRenderResult } from "@docusaurus/theme-mermaid/client";
import type { Props } from "@theme/Mermaid";
import { useMermaidTokens, type MermaidTokens } from "../../tokens";
import styles from "./styles.module.css";

type RenderResult = NonNullable<ReturnType<typeof useMermaidRenderResult>>;

function Result({ renderResult }: { renderResult: RenderResult }): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) renderResult.bindFunctions?.(ref.current);
  }, [renderResult]);
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: es el SVG que devuelve Mermaid, que con su securityLevel "strict" (el valor por defecto) lo sanea con DOMPurify. El componente oficial de Docusaurus lo inserta igual.
    <div ref={ref} className={`${MermaidContainerClassName} ${styles.container}`} dangerouslySetInnerHTML={{ __html: renderResult.svg }} />
  );
}

function Renderer({ value, tokens }: Props & { tokens: MermaidTokens | null }): ReactNode {
  const base = useMermaidConfig();
  // Sin lienzo 2D no se pueden resolver los tokens: se deja el tema propio de Mermaid para ese modo.
  const config = useMemo(
    () => (tokens ? { ...base, theme: "base" as const, themeVariables: tokens.variables } : { ...base, theme: "neutral" as const }),
    [base, tokens],
  );
  const renderResult = useMermaidRenderResult({ text: value, config });
  return renderResult ? <Result renderResult={renderResult} /> : null;
}

export default function Mermaid(props: Props): ReactNode {
  const tokens = useMermaidTokens();
  // `undefined`: los tokens aún no se han leído (primer render en el navegador).
  if (tokens === undefined) return null;
  return (
    <ErrorBoundary fallback={(params) => <ErrorBoundaryErrorMessageFallback {...params} />}>
      <Renderer {...props} tokens={tokens} />
    </ErrorBoundary>
  );
}
