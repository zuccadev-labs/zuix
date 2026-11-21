// Índice de componentes: tarjetas por categoría con buscador. Cada tarjeta lleva a la página del componente,
// generada de su manifiesto. Los datos los calcula scripts/site-plugin.mjs.
import Link from "@docusaurus/Link";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { SearchInput } from "@zuccadev-labs/zuix-zui";
import { useMemo, useState } from "react";
import { Crumbs, DocsShell, PageGrid } from "../components/Shell";
import { useSiteData } from "../site";

const BEHAVIOR: Record<string, string> = { none: "Solo CSS", dom: "CSS + zui/dom", react: "Solo React" };
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export default function Components() {
  const { components, groups } = useSiteData();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = fold(query.trim());
    return q ? components.filter((c) => fold(`${c.name} ${c.description}`).includes(q)) : components;
  }, [components, query]);
  const layouts = groups.find((g) => g.id === "layout")?.count ?? 0;
  return (
    <Layout title="Componentes" description="Índice de los componentes de zui y los layouts de zout, con una página por componente.">
      <DocsShell>
        <PageGrid>
          <Crumbs items={[{ label: "Componentes" }]} />
          <div className="zd-markdown">
            <h1>Componentes</h1>
            <p className="zd-lead">
              {components.length - layouts} componentes y {layouts} layouts. Cada uno tiene su página con vista previa en vivo, el código en
              React y en HTML, la API y los tokens que lee.
            </p>
            <div className="zd-index-tools">
              <SearchInput value={query} onValueChange={setQuery} placeholder="Buscar componentes" aria-label="Buscar componentes" />
              <span className="zd-count" aria-live="polite">
                {shown.length} de {components.length}
              </span>
            </div>
            <nav className="zd-index-groups" aria-label="Categorías">
              {groups.map((g) => (
                <a key={g.id} className="zd-chip" href={`#${g.id}`}>
                  <Icon name={g.icon} size={14} /> {g.label} <span className="zd-count">{g.count}</span>
                </a>
              ))}
            </nav>
            {groups.map((g) => {
              const items = shown.filter((c) => c.group === g.id);
              if (!items.length) return null;
              return (
                <section key={g.id} className="zd-section" aria-labelledby={g.id}>
                  <Heading as="h2" id={g.id} className="zd-index-title">
                    <span className="zd-tile" aria-hidden="true">
                      <Icon name={g.icon} size={18} />
                    </span>
                    {g.label} <span className="zd-count">{items.length}</span>
                  </Heading>
                  <ul className="zd-cards">
                    {items.map((c) => (
                      <li key={c.name}>
                        <Link className="zd-card" to={c.path}>
                          <span className="zd-card__title">
                            {c.name}
                            {c.status ? <span className="zd-badge">{c.status === "new" ? "nuevo" : c.status}</span> : null}
                          </span>
                          <span className="zd-card__text">{c.description}</span>
                          <span className="zd-card__meta">{BEHAVIOR[c.behavior] ?? c.behavior}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {!shown.length ? <p className="zd-empty">Ningún componente coincide con «{query}».</p> : null}
          </div>
        </PageGrid>
      </DocsShell>
    </Layout>
  );
}
