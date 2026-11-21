// Bloque de código con cabecera: lenguaje o título del archivo y botón «Copiar» con texto.
import { useCodeBlockContext } from "@docusaurus/theme-common/internal";
import Container from "@theme/CodeBlock/Container";
import Content from "@theme/CodeBlock/Content";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "@zuccadev-labs/zuix-zui";
import { CopyButton } from "../../../components/Copy";

const NAMES: Record<string, string> = {
  tsx: "TSX",
  jsx: "JSX",
  ts: "TypeScript",
  js: "JavaScript",
  bash: "bash",
  sh: "sh",
  json: "JSON",
  css: "CSS",
  html: "HTML",
  text: "texto",
  md: "Markdown",
};

export default function CodeBlockLayout({ className }: { className?: string }) {
  const { metadata } = useCodeBlockContext();
  const lang = metadata.language ?? "text";
  return (
    <Container as="div" className={cx("zd-code", className, metadata.className)}>
      <div className="zd-code__bar">
        <span className="zd-code__file">
          <Icon name={metadata.title ? "document-text" : "code-bracket"} size={14} />
          {metadata.title ?? NAMES[lang] ?? lang}
        </span>
        <CopyButton text={metadata.code} name="el código" />
      </div>
      <Content />
    </Container>
  );
}
