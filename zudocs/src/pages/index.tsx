// Portada: titular grande sobre el lienzo de la marca, instalación con pestañas por gestor, una composición en
// vivo con los componentes reales, Prisma con las piezas de la suite, cifras, categorías y áreas de documentación.
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Layout from "@theme/Layout";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import zicon from "@zuccadev-labs/zuix-zicon/manifest.json";
import {
  Backdrop,
  Badge,
  Button,
  Card,
  FeatureCard,
  Input,
  PaymentCard,
  SegmentedControl,
  StatTile,
  Switch,
  type CardTone,
  type PatternName,
} from "@zuccadev-labs/zuix-zui";
import { useState } from "react";
import { HomePrism } from "../components/HomePrism";
import { PackageInstall } from "../components/PackageInstall";
import { useSiteData, useZudocs } from "../site";

// Portadas de las tarjetas: cada categoría y cada área de documentación lleva un patrón y un tono, en orden. Sin
// semilla: la tesela por defecto de la hoja (nada que pese en el HTML de la página).
const PATTERNS: readonly PatternName[] = ["stars", "contours", "triangles", "halftone", "plus", "pixels", "grain", "mesh"];
const TONES: readonly CardTone[] = ["accent", "info", "success", 3, 5, "warning", 7, 1];

/** Composición en vivo: los componentes reales sobre una tarjeta de cristal, con una tarjeta de metal detrás. */
function Showcase() {
  const [view, setView] = useState("preview");
  const [on, setOn] = useState(true);
  return (
    <div className="zd-showcase-stage z-root">
      <div className="zd-showcase-card" aria-hidden="true">
        <PaymentCard issuer="zuccadev" holder="Ana Ruiz" last4="2026" expires="12/30" tone="accent" />
      </div>
      <Card surface="glass" glow className="zd-showcase" aria-label="Componentes de muestra" role="group">
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
      </Card>
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
  const base = useBaseUrl("/");
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
          <section className="zd-container zd-home-section zd-home-prism" aria-labelledby="zd-home-pieces">
            <div className="zd-home-section__head">
              <h2 id="zd-home-pieces">La suite, pieza a pieza</h2>
              <p className="zd-home-section__text">
                Prisma, el carrusel de la marca. Deslízalo, usa las flechas o deja que pase solo.{" "}
                <Link to="/carousels">Ver todos los carruseles</Link>
              </p>
            </div>
            <HomePrism />
          </section>
        ) : null}

        {home.suite ? (
          <section className="zd-container zd-stats" aria-label="La suite en cifras">
            <StatTile
              variant="elevated"
              layout="stacked"
              tone="info"
              icon="squares-2x2"
              label="Componentes"
              value={components.length - layouts}
            />
            <StatTile variant="elevated" layout="stacked" tone="success" icon="rectangle-group" label="Layouts" value={layouts} />
            <StatTile variant="elevated" layout="stacked" tone="warning" icon="swatch" label="Iconos" value={zicon.count} />
            <StatTile variant="elevated" layout="stacked" tone="accent" icon="book" label="Documentos" value={docsCount} />
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
            <ul className="zd-cards zd-cards--home zd-cats">
              {groups.map((g, i) => (
                <Card key={g.id} as="li" surface="elevated" padding="none" tone={TONES[i % TONES.length]} className="zd-cat">
                  <Backdrop
                    className="zd-cat__cover"
                    pattern={PATTERNS[i % PATTERNS.length]}
                    tone="media"
                    fade="none"
                    intensity={PATTERNS[i % PATTERNS.length] === "mesh" ? "strong" : "medium"}
                  />
                  <span className="zd-cat__icon" aria-hidden="true">
                    <Icon name={g.icon} size={18} />
                  </span>
                  <div className="zd-cat__body">
                    <h3 className="zd-cat__title">
                      <a className="z-card__link" href={`${base}components#${g.id}`}>
                        {g.label}
                      </a>
                      <span className="zd-cat__count">{g.count}</span>
                    </h3>
                    <p className="zd-cat__text">
                      {components
                        .filter((c) => c.group === g.id)
                        .slice(0, 4)
                        .map((c) => c.name)
                        .join(", ")}
                      {g.count > 4 ? "…" : ""}
                    </p>
                  </div>
                </Card>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="zd-container zd-home-section" aria-labelledby="zd-home-docs">
          <div className="zd-home-section__head">
            <h2 id="zd-home-docs">Documentación</h2>
          </div>
          <ul className="zd-areas">
            {areas.map((area, i) => (
              <li key={area.id}>
                <FeatureCard
                  className="zd-area-card"
                  pattern={PATTERNS[(i + 1) % PATTERNS.length]}
                  tone={TONES[(i + 2) % TONES.length]}
                  align="start"
                  eyebrow={`${area.items.length} documentos`}
                  title={area.label}
                  description={area.description}
                  href={area.items[0]?.path ?? `${base}docs/${area.id}`}
                />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </Layout>
  );
}
