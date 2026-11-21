// Ejemplo con pestañas Vista previa / Código. La vista previa va sobre el lienzo de la marca (el cristal se
// juzga sobre su fondo real) y el código se ve como React o como HTML (preferencia recordada).
import CodeBlock from "@theme/CodeBlock";
import { SegmentedControl } from "@zuccadev-labs/zuix-zui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createChoice, useChoice } from "../store";

export type CodeMode = "react" | "html";
const codeMode = createChoice<CodeMode>("zudocs.code", ["react", "html"], "react");
/** Lenguaje del código de los ejemplos (React o HTML): se recuerda y se comparte entre todos los ejemplos. */
export const useCodeMode = () => useChoice(codeMode);

let runtime: Promise<void> | undefined;
/** Comportamiento sin framework (zui/dom, zout/dom) e iconos `<z-icon>`, una sola vez y solo donde hay ejemplos. */
function loadRuntime(): Promise<void> {
  runtime ??= Promise.all([
    import("@zuccadev-labs/zuix-zicon/all"),
    import("@zuccadev-labs/zuix-zicon/element"),
    import("@zuccadev-labs/zuix-zui/dom"),
    import("@zuccadev-labs/zuix-zout/dom"),
  ]).then(([, , zui, zout]) => {
    zui.init();
    zout.init();
  });
  return runtime;
}

/**
 * Las rutas de ejemplo del contrato (`/people/ana.jpg`, `href="/projects"`) no existen en el sitio: en la vista previa
 * se quitan las imágenes y sus precargas (el componente muestra su alternativa: iniciales, icono) y los enlaces
 * apuntan a `#`. El código las conserva tal cual.
 */
const withoutSamplePaths = (html: string) =>
  html
    .replace(/<link\b[^>]*\shref="\/[^"]*"[^>]*>\n?/g, "")
    .replace(/<img\b[^>]*\ssrc="\/[^"]*"[^>]*>/g, "")
    .replace(/\shref="\/[^"]*"/g, ' href="#"');

/**
 * Script del ejemplo (el que acompaña al marcado en html.json: pintar un lienzo, escuchar un evento, abrir un tour).
 * Sus `import { … } from "@zuccadev-labs/zuix-zui/dom"` (o zout) se resuelven con los módulos ya cargados; otro
 * import no se puede ejecutar aquí y el script se omite.
 */
function runScript(script: string, modules: { zui: unknown; zout: unknown }) {
  const body = script.replace(
    /^import\s*\{([^}]*)\}\s*from\s*"@zuccadev-labs\/zuix-(zui|zout)\/dom";?[ \t]*$/gm,
    (_, names: string, pkg: string) => `const {${names}} = __${pkg};`,
  );
  if (/^\s*import\s/m.test(body)) return;
  try {
    new Function("__zui", "__zout", body)(modules.zui, modules.zout);
  } catch (error) {
    console.error("zudocs: el script del ejemplo falló", error);
  }
}

/** Marcado del contrato HTML en vivo: el mismo que emite el binding de React, movido por zui/dom. */
export function HtmlPreview({ html, script }: { html: string; script?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    void loadRuntime().then(async () => {
      if (!alive || !ref.current) return;
      const [zui, zout] = await Promise.all([import("@zuccadev-labs/zuix-zui/dom"), import("@zuccadev-labs/zuix-zout/dom")]);
      zui.hydrate(ref.current);
      zout.hydrate(ref.current);
      if (script) runScript(script, { zui, zout });
    });
    return () => {
      alive = false;
    };
  }, [script]);
  const markup = { __html: withoutSamplePaths(html) };
  // biome-ignore lint/security/noDangerouslySetInnerHtml: marcado del contrato HTML de la suite (html.json), generado en el repositorio
  return <div ref={ref} className="zd-preview__stage z-root" data-z-dom="" dangerouslySetInnerHTML={markup} />;
}

export function Example({
  title,
  react,
  html,
  preview,
  column,
  script,
}: {
  title: string;
  react?: string;
  html?: string;
  /** Script del ejemplo HTML (se ejecuta tras hidratar la vista previa). */
  script?: string;
  /** Vista previa propia (demo de React). Sin ella se pinta el HTML. */
  preview?: ReactNode;
  column?: boolean;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [mode, setMode] = useCodeMode();
  const both = Boolean(react && html);
  const shown: CodeMode = both ? mode : react ? "react" : "html";
  const code = shown === "react" ? react : html;
  const canPreview = Boolean(preview || html);
  const current = canPreview ? tab : "code";
  return (
    <div className="zd-example">
      <div className="zd-example__bar">
        {canPreview ? (
          <SegmentedControl
            size="sm"
            label={`${title}: vista`}
            value={current}
            onValueChange={(v) => setTab(v as "preview" | "code")}
            items={[
              { value: "preview", label: "Vista previa", icon: "eye" },
              { value: "code", label: "Código", icon: "code-bracket" },
            ]}
          />
        ) : (
          <span className="zd-example__note">Sin marcado estático: solo React</span>
        )}
        {current === "code" && both ? (
          <SegmentedControl
            size="sm"
            label={`${title}: lenguaje del código`}
            value={mode}
            onValueChange={(v) => setMode(v as CodeMode)}
            items={[
              { value: "react", label: "React" },
              { value: "html", label: "HTML" },
            ]}
          />
        ) : null}
      </div>
      {current === "preview" ? (
        <div className="zd-preview" data-column={column || undefined}>
          {preview ? <div className="zd-preview__stage z-root">{preview}</div> : html ? <HtmlPreview html={html} script={script} /> : null}
        </div>
      ) : code ? (
        <CodeBlock language={shown === "react" ? "tsx" : "html"}>{code}</CodeBlock>
      ) : null}
    </div>
  );
}
