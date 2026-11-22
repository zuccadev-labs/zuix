// Galería de cargadores: las tres formas de Spinner y los 18 patrones de DotMatrix en vivo, con tamaño, tono,
// rejilla y baldosa, y los ocho patrones de Skeleton. Cada tarjeta enseña el código de lo que muestra.
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import {
  DOT_PATTERNS,
  DotMatrix,
  type DotPattern,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  type SkeletonPattern,
  Spinner,
  Switch,
} from "@zuccadev-labs/zuix-zui";
import { useState } from "react";
import { CopyButton } from "../components/Copy";
import { Crumbs, DocsShell, PageGrid } from "../components/Shell";

const NAMES: Record<DotPattern, string> = {
  wave: "Onda",
  rain: "Lluvia",
  spiral: "Espiral",
  pulse: "Pulso",
  sweep: "Barrido",
  checker: "Ajedrez",
  orbit: "Órbita",
  ripple: "Onda de esquina",
  cross: "Cruz",
  snake: "Serpiente",
  equalizer: "Ecualizador",
  sparkle: "Destellos",
  diamond: "Rombo",
  radar: "Radar",
  zigzag: "Zigzag",
  helix: "Hélice",
  heart: "Corazón",
  cascade: "Cascada",
};

const SKELETONS: [SkeletonPattern, string][] = [
  ["card", "Tarjeta"],
  ["list", "Lista"],
  ["table", "Tabla"],
  ["profile", "Perfil"],
  ["chat", "Chat"],
  ["chart", "Gráfico"],
  ["article", "Artículo"],
  ["calendar", "Calendario"],
];

type Size = "sm" | "md" | "lg";
type Tone = "accent" | "muted" | "current";

export default function Loaders() {
  const [size, setSize] = useState<Size>("lg");
  const [tone, setTone] = useState<Tone>("accent");
  const [cols, setCols] = useState("5");
  const [framed, setFramed] = useState(true);
  const props = [
    size !== "md" && `size="${size}"`,
    tone !== "accent" && `tone="${tone}"`,
    cols !== "5" && `cols={${cols}}`,
    framed && "framed",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Layout title="Cargadores" description="Spinner con formas y los 18 patrones de DotMatrix, en vivo.">
      <DocsShell>
        <PageGrid>
          <Crumbs items={[{ label: "Referencia" }, { label: "Cargadores" }]} />
          <div className="zd-markdown">
            <h1>Cargadores</h1>
            <p className="zd-lead">
              Indicadores de espera de duración desconocida: <Link to="/components/feedback/spinner">Spinner</Link> en anillo, puntos o
              barras, y <Link to="/components/feedback/dot-matrix">DotMatrix</Link>, una rejilla de puntos con 18 patrones propios. Todos
              llevan <code>role="status"</code> con nombre, se animan solo con CSS (opacidad y escala), quedan quietos con movimiento
              reducido y se detienen fuera de pantalla.
            </p>
            <section className="zd-section" aria-labelledby="spinner">
              <h2 id="spinner">Spinner</h2>
              <div className="zd-gallery zd-gallery--tight z-root">
                {(["ring", "dots", "bars"] as const).map((shape) => (
                  <figure key={shape} className="zd-gallery__card">
                    <div className="zd-gallery__stage">
                      {(["sm", "md", "lg"] as const).map((s) => (
                        <span key={s} className="zd-gallery__cell">
                          <Spinner shape={shape} size={s} label={`Loading (${shape}, ${s})`} />
                        </span>
                      ))}
                    </div>
                    <figcaption className="zd-gallery__caption">
                      <code>{`<Spinner shape="${shape}" />`}</code>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
            <section className="zd-section" aria-labelledby="dotmatrix">
              <h2 id="dotmatrix">DotMatrix</h2>
              <div className="zd-gallery__controls">
                <SegmentedControl
                  size="sm"
                  label="Tamaño de punto"
                  value={size}
                  onValueChange={setSize}
                  items={[
                    { value: "sm", label: "sm" },
                    { value: "md", label: "md" },
                    { value: "lg", label: "lg" },
                  ]}
                />
                <SegmentedControl
                  size="sm"
                  label="Tono"
                  value={tone}
                  onValueChange={setTone}
                  items={[
                    { value: "accent", label: "Acento" },
                    { value: "muted", label: "Atenuado" },
                    { value: "current", label: "Texto" },
                  ]}
                />
                <SegmentedControl
                  size="sm"
                  label="Rejilla"
                  value={cols}
                  onValueChange={setCols}
                  items={[
                    { value: "5", label: "5 × 5" },
                    { value: "7", label: "7 × 7" },
                  ]}
                />
                <Switch size="sm" checked={framed} onCheckedChange={setFramed}>
                  Baldosa
                </Switch>
              </div>
              <ul className="zd-gallery z-root">
                {DOT_PATTERNS.map((p) => {
                  const code = `<DotMatrix pattern="${p}"${props ? ` ${props}` : ""} />`;
                  return (
                    <li key={p} className="zd-gallery__card">
                      <div className="zd-gallery__stage">
                        <DotMatrix pattern={p} size={size} tone={tone} cols={Number(cols)} framed={framed} label={`Loading: ${NAMES[p]}`} />
                      </div>
                      <div className="zd-gallery__caption">
                        <span className="zd-gallery__name">{NAMES[p]}</span>
                        <CopyButton text={code} name={`el código de ${NAMES[p]}`} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="zd-section" aria-labelledby="skeletons">
              <h2 id="skeletons">Skeletons por patrón</h2>
              <p>
                Cuando sé qué forma tendrá lo que llega, enseño esa forma: <Link to="/components/feedback/skeleton">Skeleton</Link> trae
                ocho patrones. El contenedor lleva <code>aria-busy</code> (lo pone <code>SkeletonGroup</code>), los huesos no se leen y el
                brillo va sincronizado; con movimiento reducido es un tono plano.
              </p>
              <SkeletonGroup className="zd-gallery zd-gallery--tight z-root">
                {SKELETONS.map(([pattern, name]) => (
                  <figure key={pattern} className="zd-gallery__card">
                    <div className="zd-gallery__stage zd-skeleton-stage">
                      <Skeleton pattern={pattern} rows={3} messages={4} paragraphs={1} columns={3} />
                    </div>
                    <figcaption className="zd-gallery__caption">
                      <span className="zd-gallery__name">{name}</span>
                      <CopyButton text={`<Skeleton pattern="${pattern}" />`} name={`el código de ${name}`} />
                    </figcaption>
                  </figure>
                ))}
              </SkeletonGroup>
            </section>
          </div>
        </PageGrid>
      </DocsShell>
    </Layout>
  );
}
