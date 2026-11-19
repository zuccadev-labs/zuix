// Portada: titular grande sobre el lienzo de la marca, instalación con pestañas por gestor, una composición en
// vivo con los componentes reales, cifras de la suite, categorías de componentes y áreas de documentación.
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import zicon from "@zuccadev-labs/zuix-zicon/manifest.json";
import { Badge, Button, Carousel, Input, SegmentedControl, Switch } from "@zuccadev-labs/zuix-zui";
import { useState } from "react";
import { PackageInstall } from "../components/PackageInstall";
import { useSiteData, useZudocs } from "../site";

const PIECES: { icon: IconName; title: string; text: string; to: string }[] = [
  {
    icon: "swatch",
    title: "Tokens",
    text: "Una marca es un archivo. Colores, material, tipografía y medidas salen de ahí.",
    to: "/tokens",
  },
  { icon: "sparkles", title: "Zicon", text: "Iconos en outline y solid, con búsqueda por concepto en español e inglés.", to: "/icons" },
  {
    icon: "puzzle-piece",
    title: "Zui",
    text: "Componentes accesibles que solo leen tokens. Cada uno con su manifiesto.",
    to: "/components",
  },
  {
    icon: "rectangle-group",
    title: "Zout",
    text: "Shell, paneles divididos, pestañas y rejillas que se adaptan a su contenedor.",
    to: "/components#layout",
  },
  { icon: "book", title: "Zudocs", text: "Este sitio: el estándar de documentación y su plantilla.", to: "/docs/users/zudocs" },
  {
    icon: "command-line",
    title: "Kit de agente",
    text: "Guías, auditoría con objetivo cero y manifiestos legibles por máquina.",
    to: "/docs/agents",
  },
];

/** Composición en vivo: los componentes reales sobre una superficie de cristal. */
function Showcase() {
  const [view, setView] = useState("preview");
  const [on, setOn] = useState(true);
  return (
    <div className="zd-showcase zd-glass z-root" aria-label="Componentes de muestra" role="group">
      <div className="zd-showcase__row">
        <SegmentedControl
          size="sm"
          label="Vista"
          value={view}
          onValueChange={setView}
          items={[
            { value: "preview", label: "Vista previa", icon: "eye" },
            { value: "code", label: "Código", icon: "code-bracket" },
          ]}
        />
        <Badge tone="accent">liquid glass</Badge>
      </div>
      <Input aria-label="Nombre del proyecto" placeholder="Nombre del proyecto" defaultValue="Website redesign" />
      <div className="zd-showcase__row">
        <Switch checked={on} onCheckedChange={setOn}>
          Sincronizar con la marca
        </Switch>
      </div>
      <div className="zd-showcase__row zd-showcase__actions">
        <Button variant="ghost">Cancelar</Button>
        <Button variant="primary" icon="check">
          Guardar
        </Button>
      </div>
    </div>
  );
}

export default function Home() {
  const site = useZudocs();
  const { components, groups, areas } = useSiteData();
  const home = site.home ?? {};
  const eyebrow = home.eyebrow?.replace("{brand}", site.brand);
  const firstArea = site.docs.areas[0]?.id;
  const cta = site.cta ?? (firstArea ? { label: "Empezar", to: `/docs/${firstArea}` } : undefined);
  const docsCount = areas.reduce((n, a) => n + a.items.length, 0);
  const layouts = groups.find((g) => g.id === "layout")?.count ?? 0;
  return (
    <Layout description={site.tagline}>
      <main className="zd-home">
        <section className="zd-container zd-hero" aria-labelledby="zd-hero-title">
          <div className="zd-hero__copy">
            {eyebrow ? (
              <p className="zd-hero__eyebrow">
                <Icon name="sparkles" size={14} /> {eyebrow}
              </p>
            ) : null}
            <h1 id="zd-hero-title" className="zd-hero__title">
              {home.title ?? site.name}
              {home.emphasis ? (
                <>
                  {" "}
                  <em>{home.emphasis}</em>
                </>
              ) : null}
            </h1>
            {site.tagline ? <p className="zd-hero__lead">{site.tagline}</p> : null}
            <div className="zd-hero__actions">
              {cta ? (
                <Link className="z-btn z-btn--primary" data-size="lg" to={cta.to}>
                  {cta.label} <Icon name="arrow-right" size={16} />
                </Link>
              ) : null}
              {site.pages.components ? (
                <Link className="z-btn z-btn--secondary" data-size="lg" to="/components">
                  Ver componentes
                </Link>
              ) : null}
            </div>
            {home.suite ? <PackageInstall title="Añade la suite" packages={["@zuccadev-labs/zuix"]} /> : null}
          </div>
          {home.suite ? <Showcase /> : null}
        </section>

        {home.suite ? (
          <section className="zd-container zd-stats" aria-label="La suite en cifras">
            <dl>
              <div className="zd-stat zd-glass">
                <dt>Componentes</dt>
                <dd>{components.length - layouts}</dd>
              </div>
              <div className="zd-stat zd-glass">
                <dt>Layouts</dt>
                <dd>{layouts}</dd>
              </div>
              <div className="zd-stat zd-glass">
                <dt>Iconos</dt>
                <dd>{zicon.count}</dd>
              </div>
              <div className="zd-stat zd-glass">
                <dt>Documentos</dt>
                <dd>{docsCount}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {site.pages.components && groups.length ? (
          <section className="zd-container zd-home-section" aria-labelledby="zd-home-components">
            <div className="zd-home-section__head">
              <h2 id="zd-home-components">Componentes por categoría</h2>
              <Link className="zd-more" to="/components">
                Ver el índice <Icon name="arrow-right" size={14} />
              </Link>
            </div>
            <ul className="zd-cards zd-cards--home">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link className="zd-card" to={`/components#${g.id}`}>
                    <span className="zd-tile" aria-hidden="true">
                      <Icon name={g.icon} size={18} />
                    </span>
                    <span className="zd-card__title">
                      {g.label} <span className="zd-count">{g.count}</span>
                    </span>
                    <span className="zd-card__text">
                      {components
                        .filter((c) => c.group === g.id)
                        .slice(0, 4)
                        .map((c) => c.name)
                        .join(", ")}
                      {g.count > 4 ? "…" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="zd-container zd-home-section" aria-labelledby="zd-home-docs">
          <div className="zd-home-section__head">
            <h2 id="zd-home-docs">Documentación</h2>
          </div>
          <ul className="zd-cards zd-cards--home">
            {areas.map((area) => (
              <li key={area.id}>
                <Link className="zd-card zd-area" to={area.items[0]?.path ?? `/docs/${area.id}`}>
                  <span className="zd-tile" aria-hidden="true">
                    <Icon name={area.icon ?? "document-text"} size={18} />
                  </span>
                  <span className="zd-card__title">
                    {area.label} <span className="zd-count">{area.items.length}</span>
                  </span>
                  <span className="zd-card__text">{area.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {home.suite ? (
          <section className="zd-container zd-home-section" aria-labelledby="zd-home-pieces">
            <div className="zd-home-section__head">
              <h2 id="zd-home-pieces">Las piezas</h2>
              <p className="zd-home-section__text">Arrastra, usa las flechas o el teclado. Es el Carousel de zui con su efecto lente.</p>
            </div>
            <Carousel
              ariaLabel="Piezas de la suite"
              items={PIECES}
              getKey={(p) => p.title}
              slideWidth={300}
              renderItem={(p) => (
                <article className="zd-slide">
                  <Icon className="zd-slide__icon" name={p.icon} size={28} />
                  <h3 className="zd-slide__title">{p.title}</h3>
                  <p className="zd-slide__text">{p.text}</p>
                  <Link to={p.to}>Abrir</Link>
                </article>
              )}
            />
          </section>
        ) : null}
      </main>
    </Layout>
  );
}
