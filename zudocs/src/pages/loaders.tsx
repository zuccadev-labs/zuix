// Galería de cargadores: las tres formas de Spinner y los 12 patrones de DotMatrix en vivo, con tamaño, tono,
// rejilla y baldosa. Cada tarjeta enseña el código de lo que muestra.
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import { DOT_PATTERNS, DotMatrix, type DotPattern, SegmentedControl, Spinner, Switch } from "@zuccadev-labs/zuix-zui";
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
};

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
    <Layout title="Cargadores" description="Spinner con formas y los 12 patrones de DotMatrix, en vivo.">
      <DocsShell>
        <PageGrid>
          <Crumbs items={[{ label: "Referencia" }, { label: "Cargadores" }]} />
          <div className="zd-markdown">
            <h1>Cargadores</h1>
            <p className="zd-lead">
              Indicadores de espera de duración desconocida: <Link to="/components/feedback/spinner">Spinner</Link> en anillo, puntos o
              barras, y <Link to="/components/feedback/dot-matrix">DotMatrix</Link>, una rejilla de puntos con 12 patrones propios. Todos
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
                        <Spinner key={s} shape={shape} size={s} label={`Loading (${shape}, ${s})`} />
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
          </div>
        </PageGrid>
      </DocsShell>
    </Layout>
  );
}
