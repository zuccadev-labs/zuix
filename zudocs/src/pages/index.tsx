import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { Badge, Carousel, StatTile } from "@zuccadev-labs/zuix-zui";
import { Grid } from "@zuccadev-labs/zuix-zout";
import zui from "@zuccadev-labs/zuix-zui/manifest.json";
import zout from "@zuccadev-labs/zuix-zout/manifest.json";
import zicon from "@zuccadev-labs/zuix-zicon/manifest.json";
import { useZudocs } from "../site";

const PIECES: { icon: IconName; title: string; text: string; to: string }[] = [
  { icon: "swatch", title: "Tokens", text: "Una marca es un archivo. Colores, material, tipografía y medidas salen de ahí.", to: "/tokens" },
  { icon: "sparkles", title: "Zicon", text: "Iconos en outline y solid, con búsqueda por concepto en español e inglés.", to: "/icons" },
  { icon: "puzzle-piece", title: "Zui", text: "Componentes accesibles que solo leen tokens. Cada uno con su manifiesto.", to: "/components" },
  { icon: "rectangle-group", title: "Zout", text: "Shell, paneles divididos, pestañas y rejillas que se adaptan a su contenedor.", to: "/components" },
  { icon: "book", title: "Zudocs", text: "Este sitio: el estándar de documentación y su plantilla.", to: "/docs/users/zudocs" },
  { icon: "command-line", title: "Kit de agente", text: "Guías, auditoría con objetivo cero y manifiestos legibles por máquina.", to: "/docs/agents" },
];

function Suite() {
  return (
    <>
      <section>
        <Grid min={200} gap={3}>
          <StatTile label="Componentes" value={String(zui.count)} hint="zui" icon="puzzle-piece" />
          <StatTile label="Layouts" value={String(zout.count)} hint="zout" icon="rectangle-group" />
          <StatTile label="Iconos" value={String(zicon.count)} hint="× 2 variantes" icon="sparkles" />
          <StatTile label="Hallazgos de auditoría" value="0" hint="objetivo permanente" icon="shield-check" />
        </Grid>
      </section>

      <section>
        <h2 className="zd-h2">Las piezas</h2>
        <p className="zd-sub">Arrastra, usa las flechas o el teclado. Es el Carousel de zui con su efecto lente.</p>
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
    </>
  );
}

export default function Home() {
  const site = useZudocs();
  const home = site.home ?? {};
  const eyebrow = home.eyebrow?.replace("{brand}", site.brand);
  return (
    <Layout description={site.tagline}>
      <main className="zd-page z-root">
        <div className="zd-wrap">
          <section className="zd-hero z-liquid">
            {eyebrow && <span className="zd-hero__eyebrow"><Icon name="sparkles" size={14} /> {eyebrow}</span>}
            <h1 className="zd-hero__title">{home.title ?? site.name}{home.emphasis && <> <em>{home.emphasis}</em></>}</h1>
            <p className="zd-hero__lead">{site.tagline}</p>
            <div className="zd-hero__actions">
              <Link className="z-btn z-btn--primary" data-size="lg" to={`/docs/${site.docs.areas[0]?.id ?? ""}`}>Leer la documentación</Link>
              {site.pages.components && <Link className="z-btn z-btn--secondary" data-size="lg" to="/components">Ver componentes</Link>}
            </div>
          </section>

          {home.suite && <Suite />}

          <section>
            <h2 className="zd-h2">Documentación</h2>
            <p className="zd-sub">Organizada por áreas. Cada área responde a un lector distinto.</p>
            <Grid min={260} gap={4}>
              {site.docs.areas.map((area) => (
                <Link key={area.id} className="zd-area z-liquid" to={`/docs/${area.id}`}>
                  <span className="zd-area__icon"><Icon name={area.icon ?? "document-text"} size={20} /></span>
                  <h3 className="zd-area__title">{area.label} <Badge tone="neutral">{area.id}</Badge></h3>
                  <p className="zd-area__text">{area.description}</p>
                </Link>
              ))}
            </Grid>
          </section>
        </div>
      </main>
    </Layout>
  );
}
