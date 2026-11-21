// Bloques de código: una orden de instalación de un gestor (`pnpm add …`, `npm install …`) se convierte en el
// bloque con pestañas pnpm/npm/yarn/bun; el resto va al bloque de código del tema con su cabecera (CodeBlock/Layout).
import CodeBlock from "@theme-original/CodeBlock";
import type { ComponentProps } from "react";
import { PackageInstall, parseInstall } from "../../components/PackageInstall";

const SHELL = /^(bash|sh|shell|console|zsh)$/;

export default function CodeBlockWrapper(props: ComponentProps<typeof CodeBlock>) {
  const lang = props.language ?? props.className?.match(/language-(\S+)/)?.[1] ?? "";
  const code = typeof props.children === "string" ? props.children : undefined;
  const spec = code && SHELL.test(lang) && !props.title ? parseInstall(code) : undefined;
  if (spec) return <PackageInstall {...spec} />;
  return <CodeBlock {...props} />;
}
