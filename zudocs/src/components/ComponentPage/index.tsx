// Página de un componente, generada de su manifiesto (scripts/components.mjs → scripts/site-plugin.mjs):
// título, entradilla, enlaces, vista previa, instalación, ejemplos (Vista previa / Código, React o HTML), API,
// accesibilidad y teclado, tokens y clases, y componentes del mismo grupo.
// Página de catálogo: carga el set completo de iconos (los ejemplos y demos pueden usar cualquiera).
import "@zuccadev-labs/zuix-zicon/all";
import Link from "@docusaurus/Link";
import CodeBlock from "@theme/CodeBlock";
import Heading from "@theme/Heading";
import Layout from "@theme/Layout";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { useSiteData, useZudocs } from "../../site";
import { CopyPage } from "../CopyPage";
import { PackageInstall } from "../PackageInstall";
import { ArticleBar, Crumbs, DocsShell, Pager, PageGrid, RailCard } from "../Shell";
import { Fragment, useEffect, useRef } from "react";
import { Toc, type TocEntry } from "../Toc";
import { COLUMN, useDemos } from "./demos";
import { Example, useCodeMode } from "./Example";

interface Prop {
  name: string;
  type: string;
  values?: (string | number)[];
  default?: unknown;
  description?: string;
}
interface ExampleData {
  title: string;
  code?: string;
  html?: string;
  script?: string;
}
export interface ComponentData {
  name: string;
  slug: string;
  group: string;
  groupLabel: string;
  package: string;
  packageId: string;
  version: string;
  path: string;
  description: string;
  import: string;
  props: Prop[];
  states: string[];
  tokens: string[];
  classes: string[];
  a11y: string;
  keyboard: string[];
  apg?: string;
  file?: string;
  behavior: "none" | "dom" | "react" | string;
  examples: ExampleData[];
  htmlOnly: ExampleData[];
  related: { name: string; path: string; description: string }[];
  previous?: { title: string; path: string };
  next?: { title: string; path: string };
  markdown: string;
}

const BEHAVIOR: Record<string, string> = { none: "Solo CSS", dom: "CSS + zui/dom", react: "Solo React" };

/** Ancla de un título: minúsculas, sin tildes, palabras unidas por guiones. */
const anchor = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** El índice pinta HTML (como el de los documentos): los títulos de los ejemplos van escapados. */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Código de una celda con puntos de corte entre piezas (tras `<`, `,`, `|`, `:`, `(`, `{`, `=>`), nunca dentro de un nombre. */
function breakable(text: string) {
  const parts = text.split(/(?<=[<,|:({]|=>)/);
  return parts.map((part, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: las piezas de un texto fijo no se reordenan
    <Fragment key={i}>
      {i ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}

function typeOf(p: Prop) {
  if (p.values?.length) return p.values.map((v) => JSON.stringify(v)).join(" | ");
  return p.type;
}

/**
 * Tabla de props que pasa a tarjetas cuando no cabe: mide una vez el ancho mínimo de la tabla (sin partir palabras) y
 * lo compara con su caja al cambiar de tamaño. Escribe `data-layout` ("table" o "cards"); la hoja hace el resto.
 */
function usePropsLayout() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const table = box?.querySelector("table");
    if (!box || !table || typeof ResizeObserver === "undefined") return;
    let need = 0;
    const measure = () => {
      box.dataset.layout = "table";
      table.style.inlineSize = "min-content";
      need = table.getBoundingClientRect().width;
      table.style.inlineSize = "";
    };
    const decide = () => {
      box.dataset.layout = need > box.clientWidth + 1 ? "cards" : "table";
    };
    measure();
    decide();
    const ro = new ResizeObserver(decide);
    ro.observe(box);
    // La fuente de la marca llega después y cambia el ancho de las palabras.
    let live = true;
    document.fonts?.ready.then(() => {
      if (!live) return;
      measure();
      decide();
    });
    return () => {
      live = false;
      ro.disconnect();
    };
  }, []);
  return ref;
}

export default function ComponentPage({ data }: { data: ComponentData }) {
  const propsRef = usePropsLayout();
  const site = useZudocs();
  const { groups } = useSiteData();
  const demos = useDemos();
  const [, setMode] = useCodeMode();
  const demo = demos[data.name];
  const group = groups.find((g) => g.id === data.group);
  const examples = [...data.examples, ...data.htmlOnly];
  const used = new Set<string>([
    "vista-previa",
    "instalacion",
    "ejemplos",
    "api",
    "accesibilidad",
    "teclado",
    "tokens-y-clases",
    "relacionados",
  ]);
  const ids = examples.map((e) => {
    let id = anchor(e.title) || "ejemplo";
    while (used.has(id)) id = `${id}-2`;
    used.add(id);
    return id;
  });
  const toc: TocEntry[] = [
    ...(demo ? [{ id: "vista-previa", value: "Vista previa", level: 2 }] : []),
    { id: "instalacion", value: "Instalación", level: 2 },
    ...(examples.length
      ? [{ id: "ejemplos", value: "Ejemplos", level: 2 }, ...examples.map((e, i) => ({ id: ids[i], value: escapeHtml(e.title), level: 3 }))]
      : []),
    ...(data.props.length ? [{ id: "api", value: "API", level: 2 }] : []),
    ...(data.a11y ? [{ id: "accesibilidad", value: "Accesibilidad", level: 2 }] : []),
    ...(data.tokens.length || data.classes.length ? [{ id: "tokens-y-clases", value: "Tokens y clases", level: 2 }] : []),
    ...(data.related.length ? [{ id: "relacionados", value: "Relacionados", level: 2 }] : []),
  ];
  const manifestUrl =
    site.repository && data.file && /github\.com/.test(site.repository)
      ? `${site.repository.replace(/\/$/, "")}/blob/main/${data.file}`
      : undefined;
  const firstHtml = examples.find((e) => e.html)?.html;
  const firstReact = data.examples[0]?.code;
  const usage = [data.import, firstReact].filter(Boolean).join("\n\n");
  const previous = data.previous ? { title: data.previous.title, permalink: data.previous.path } : undefined;
  const next = data.next ? { title: data.next.title, permalink: data.next.path } : undefined;

  const rail = (
    <>
      <Toc toc={toc} />
      <RailCard title="Contrato">
        <dl className="zd-facts">
          <div>
            <dt>Paquete</dt>
            <dd>
              <code>{data.package}</code>
            </dd>
          </div>
          <div>
            <dt>Comportamiento</dt>
            <dd>{BEHAVIOR[data.behavior] ?? data.behavior}</dd>
          </div>
          <div>
            <dt>Clases</dt>
            <dd>{data.classes.map((c) => `.${c}`).join(", ") || "—"}</dd>
          </div>
        </dl>
      </RailCard>
    </>
  );

  return (
    <Layout title={data.name} description={data.description}>
      <DocsShell>
        <PageGrid rail={rail}>
          <ArticleBar
            previous={previous}
            next={next}
            section={data.groupLabel}
            here={data.name}
            actions={<CopyPage markdown={data.markdown} />}
          />
          <Crumbs
            items={[
              { label: "Componentes", to: "/components" },
              { label: group?.label ?? data.groupLabel, to: `/components#${data.group}` },
              { label: data.name },
            ]}
          />
          <div className="zd-markdown">
            <h1 className="zd-h1--component">{data.name}</h1>
            <p className="zd-lead">{data.description}</p>
            <ul className="zd-chips" aria-label="Enlaces">
              {data.apg ? (
                <li>
                  <a
                    className="zd-chip"
                    href={`https://www.w3.org/WAI/ARIA/apg/patterns/${data.apg}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    APG <Icon name="arrow-up-right" size={12} />
                    <span className="zd-sr-only"> (patrón de accesibilidad, se abre en otra pestaña)</span>
                  </a>
                </li>
              ) : null}
              {manifestUrl ? (
                <li>
                  <a className="zd-chip" href={manifestUrl} target="_blank" rel="noopener noreferrer">
                    Manifiesto <Icon name="arrow-up-right" size={12} />
                    <span className="zd-sr-only"> (se abre en otra pestaña)</span>
                  </a>
                </li>
              ) : null}
              {firstHtml ? (
                <li>
                  <button
                    type="button"
                    className="zd-chip"
                    onClick={() => {
                      setMode("html");
                      document.getElementById("ejemplos")?.scrollIntoView();
                    }}
                  >
                    HTML sin React <Icon name="arrow-down" size={12} />
                  </button>
                </li>
              ) : null}
            </ul>
            <p className="zd-meta">
              <span>
                <Icon name="cube" size={14} /> {data.package}@{data.version}
              </span>
              <span>
                <Icon name="bolt" size={14} /> {BEHAVIOR[data.behavior] ?? data.behavior}
              </span>
              <span>
                <Icon name="squares-2x2" size={14} /> {examples.length} {examples.length === 1 ? "ejemplo" : "ejemplos"}
              </span>
            </p>

            {demo ? (
              <section className="zd-section" aria-labelledby="vista-previa">
                <Heading as="h2" id="vista-previa">
                  Vista previa
                </Heading>
                <Example title="Vista previa" react={usage || undefined} html={firstHtml} preview={demo} column={COLUMN.has(data.name)} />
              </section>
            ) : null}

            <section className="zd-section" aria-labelledby="instalacion">
              <Heading as="h2" id="instalacion">
                Instalación
              </Heading>
              <PackageInstall packages={[data.package]} />
              {data.import ? <CodeBlock language="tsx">{data.import}</CodeBlock> : null}
            </section>

            {examples.length ? (
              <section className="zd-section" aria-labelledby="ejemplos">
                <Heading as="h2" id="ejemplos">
                  Ejemplos
                </Heading>
                {examples.map((e, i) => (
                  <div key={ids[i]} className="zd-example-block">
                    <Heading as="h3" id={ids[i]}>
                      {e.title}
                    </Heading>
                    <Example title={e.title} react={e.code} html={e.html} />
                  </div>
                ))}
              </section>
            ) : null}

            {data.props.length ? (
              <section className="zd-section" aria-labelledby="api">
                <Heading as="h2" id="api">
                  API
                </Heading>
                {/* biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable en pantallas estrechas */}
                <div ref={propsRef} className="zd-table zd-table--props" role="region" aria-label={`Props de ${data.name}`} tabIndex={0}>
                  <table className="zd-props">
                    <thead>
                      <tr>
                        <th scope="col">Prop</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Por defecto</th>
                        <th scope="col">Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.props.map((p) => (
                        <tr key={p.name}>
                          <th scope="row">
                            <code className="zd-props__name">{p.name}</code>
                          </th>
                          <td className="zd-props__type-cell">
                            <code className="zd-props__type">{breakable(typeOf(p))}</code>
                          </td>
                          <td className="zd-props__default-cell">
                            {p.default === undefined ? (
                              "—"
                            ) : (
                              <code className="zd-props__default">{breakable(JSON.stringify(p.default))}</code>
                            )}
                          </td>
                          <td className="zd-props__desc">{p.description ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.states.length ? (
                  <p className="zd-states">
                    Estados:{" "}
                    {data.states.map((s) => (
                      <code key={s}>{s}</code>
                    ))}
                  </p>
                ) : null}
              </section>
            ) : null}

            {data.a11y ? (
              <section className="zd-section" aria-labelledby="accesibilidad">
                <Heading as="h2" id="accesibilidad">
                  Accesibilidad
                </Heading>
                <p>{data.a11y}</p>
                {data.keyboard.length ? (
                  <>
                    <Heading as="h3" id="teclado">
                      Teclado
                    </Heading>
                    <ul className="zd-keys">
                      {data.keyboard.map((k) => (
                        <li key={k}>{k}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            ) : null}

            {data.tokens.length || data.classes.length ? (
              <section className="zd-section" aria-labelledby="tokens-y-clases">
                <Heading as="h2" id="tokens-y-clases">
                  Tokens y clases
                </Heading>
                <p>Lo único que lee su hoja de estilos. Una marca nueva cambia estos valores; el componente no cambia.</p>
                <ul className="zd-token-list" aria-label="Tokens">
                  {data.tokens.map((t) => (
                    <li key={t}>
                      <code>--z-{t}</code>
                    </li>
                  ))}
                </ul>
                {data.classes.length ? (
                  <p className="zd-states">
                    Clases:{" "}
                    {data.classes.map((c) => (
                      <code key={c}>.{c}</code>
                    ))}
                  </p>
                ) : null}
              </section>
            ) : null}

            {data.related.length ? (
              <section className="zd-section" aria-labelledby="relacionados">
                <Heading as="h2" id="relacionados">
                  Relacionados
                </Heading>
                <ul className="zd-cards">
                  {data.related.map((r) => (
                    <li key={r.name}>
                      <Link className="zd-card" to={r.path}>
                        <span className="zd-card__title">{r.name}</span>
                        <span className="zd-card__text">{r.description}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          <Pager previous={previous} next={next} />
        </PageGrid>
      </DocsShell>
    </Layout>
  );
}
