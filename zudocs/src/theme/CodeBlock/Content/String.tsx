// Bloque de código de texto, sin el ajuste de línea del tema. La cabecera del sitio (CodeBlock/Layout) no pinta el
// botón «Ajustar líneas», así que el estado de `useCodeWordWrap` no lo lee nadie; y su escucha de `resize` lee el
// <pre> por una referencia que en un teléfono puede llegar vacía y lanza «Cannot destructure property
// 'scrollWidth' of 'a.current'» (visto en la auditoría visual a 390 px). Se pasa un estado fijo, sin escuchas.
import { useThemeConfig } from "@docusaurus/theme-common";
import { CodeBlockContextProvider, createCodeBlockMetadata } from "@docusaurus/theme-common/internal";
import CodeBlockLayout from "@theme/CodeBlock/Layout";
import type { Props } from "@theme/CodeBlock/Content/String";
import { useMemo, useRef } from "react";

export default function CodeBlockString(props: Props) {
  const { prism } = useThemeConfig();
  const metadata = createCodeBlockMetadata({
    code: props.children,
    className: props.className,
    metastring: props.metastring,
    magicComments: prism.magicComments,
    defaultLanguage: prism.defaultLanguage,
    language: props.language,
    title: props.title,
    showLineNumbers: props.showLineNumbers,
  });
  const codeBlockRef = useRef<HTMLPreElement>(null);
  const wordWrap = useMemo(() => ({ codeBlockRef, isEnabled: false, isCodeScrollable: false, toggle: () => {} }), []);
  return (
    <CodeBlockContextProvider metadata={metadata} wordWrap={wordWrap}>
      <CodeBlockLayout />
    </CodeBlockContextProvider>
  );
}
