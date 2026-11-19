// Página de documento: artículo sobre superficie de lectura (barra con anterior/siguiente y «Copiar página»,
// migas, título, entradilla, metadatos y cuerpo) y rail con el índice de la página.
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import useBaseUrl from "@docusaurus/useBaseUrl";
import MDXContent from "@theme/MDXContent";
import type { ReactNode } from "react";
import { CopyPage } from "../../../components/CopyPage";
import { ArticleBar, Crumbs, Pager, PageGrid, RailCard } from "../../../components/Shell";
import { Toc } from "../../../components/Toc";
import { useSiteData, useZudocs } from "../../../site";

export default function DocItemLayout({ children }: { children: ReactNode }) {
  const { metadata, toc, frontMatter } = useDoc();
  const site = useZudocs();
  const { areas } = useSiteData();
  const area = areas.find((a) => a.items.some((i) => i.path === metadata.permalink));
  const areaHome = area?.items[0];
  const llms = useBaseUrl("/llms.txt");
  const md = `${metadata.permalink.replace(/\/$/, "")}.md`;
  const isHome = areaHome?.path === metadata.permalink;
  const crumbs: { label: string; to?: string }[] = [{ label: "Docs", to: `/docs/${site.docs.areas[0]?.id ?? ""}` }];
  if (area) crumbs.push({ label: area.label, to: isHome ? undefined : areaHome?.path });
  if (!isHome) crumbs.push({ label: metadata.title });
  const showToc = !frontMatter.hide_table_of_contents && toc.length > 0;
  const rail = (
    <>
      {showToc ? <Toc toc={toc} /> : null}
      <RailCard title="Para agentes">
        <p>Esta página en Markdown y el mapa del sitio en llms.txt.</p>
        <div className="zd-rail-card__links">
          {site.llms?.full === false ? null : (
            <a className="z-btn z-btn--secondary" data-size="sm" href={md}>
              Ver .md
            </a>
          )}
          <a className="z-btn z-btn--secondary" data-size="sm" href={llms}>
            llms.txt
          </a>
        </div>
      </RailCard>
    </>
  );
  return (
    <PageGrid rail={rail}>
      <ArticleBar previous={metadata.previous} next={metadata.next} section={area?.label} here={metadata.title} actions={<CopyPage />} />
      <Crumbs items={crumbs} />
      {/* <article>: el buscador local indexa el título y las secciones que encuentra dentro de él. */}
      <article className="zd-markdown markdown">
        <MDXContent>{children}</MDXContent>
      </article>
      <Pager previous={metadata.previous} next={metadata.next} />
    </PageGrid>
  );
}
