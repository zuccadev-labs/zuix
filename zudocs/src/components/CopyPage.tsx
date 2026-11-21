// «Copiar página»: copia el Markdown de la página (la copia .md que genera llms.mjs, o el que trae la página de
// componente). El menú partido añade ver el .md y copiar el enlace.
import { useLocation } from "@docusaurus/router";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { Menu } from "@zuccadev-labs/zuix-zui";
import { useZudocs } from "../site";
import { useCopy } from "./Copy";
import { clean } from "./SiteNav";

/** Markdown de la página: el .md publicado junto a ella o, si no existe, el texto del artículo. */
async function pageMarkdown(path: string): Promise<string> {
  try {
    const res = await fetch(`${path}.md`, { headers: { Accept: "text/markdown, text/plain" } });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && !type.includes("html")) return await res.text();
  } catch {
    // Sin red o sin copia: se usa el texto que se ve.
  }
  const article = document.querySelector<HTMLElement>(".zd-markdown");
  // biome-ignore lint/performance/useDomNodeTextContent: innerText conserva los saltos de línea que se ven; textContent los pierde
  return article?.innerText.trim() ?? document.title;
}

export function CopyPage({ markdown, mdPath }: { markdown?: string; mdPath?: string }) {
  const site = useZudocs();
  const path = clean(useLocation().pathname);
  const [state, copy] = useCopy();
  const [linkState, copyLink] = useCopy();
  const md = mdPath ?? (site.llms?.full === false ? undefined : `${path}.md`);
  const read = () => (markdown ? Promise.resolve(markdown) : pageMarkdown(path));
  const message =
    state === "copied" ? "Página copiada" : state === "failed" ? "No se pudo copiar" : linkState === "copied" ? "Enlace copiado" : "";
  return (
    <div className="zd-split">
      <button type="button" className="z-btn z-btn--secondary zd-split__main" data-size="sm" onClick={() => void copy(read)}>
        <Icon name={state === "copied" ? "check" : "copy"} size={14} />
        {state === "copied" ? "Copiada" : "Copiar página"}
      </button>
      <Menu
        label="Más acciones de la página"
        align="end"
        trigger={
          <button type="button" className="z-btn z-btn--secondary zd-split__more" data-size="sm" aria-label="Más acciones de la página">
            <Icon name="chevron-down" size={14} />
          </button>
        }
        items={[
          { id: "copy", label: "Copiar como Markdown", icon: "copy", onSelect: () => void copy(read) },
          ...(md
            ? [
                {
                  id: "md",
                  label: "Ver como Markdown",
                  icon: "document-text" as const,
                  onSelect: () => window.open(md, "_blank", "noopener"),
                },
              ]
            : []),
          { id: "link", label: "Copiar enlace", icon: "link", onSelect: () => void copyLink(window.location.href.split("#")[0]) },
        ]}
      />
      <span className="zd-sr-only" role="status">
        {message}
      </span>
    </div>
  );
}
