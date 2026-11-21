// Galería de efectos: Backdrop, BorderBeam, Glow, AttentionRing y TextEffect en vivo, con sus variantes. Todos son
// decorativos y respetan el movimiento reducido; la vista previa va sobre el lienzo de la marca.
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import {
  AttentionRing,
  Backdrop,
  type BackdropPattern,
  BorderBeam,
  Button,
  Card,
  CardHeader,
  type EffectTone,
  Glow,
  SegmentedControl,
  Switch,
  TextEffect,
} from "@zuccadev-labs/zuix-zui";
import { useState } from "react";
import { Crumbs, DocsShell, PageGrid } from "../components/Shell";

type Intensity = "subtle" | "medium" | "strong";
const TONES: { value: EffectTone; label: string }[] = [
  { value: "accent", label: "Acento" },
  { value: "info", label: "Info" },
  { value: "success", label: "Éxito" },
  { value: "neutral", label: "Neutro" },
];

function BackdropDemo() {
  const [pattern, setPattern] = useState<BackdropPattern>("grid");
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [animated, setAnimated] = useState(false);
  return (
    <>
      <div className="zd-gallery__controls">
        <SegmentedControl
          size="sm"
          label="Dibujo"
          value={pattern}
          onValueChange={setPattern}
          items={[
            { value: "grid", label: "Rejilla" },
            { value: "dots", label: "Puntos" },
            { value: "hex", label: "Hexágonos" },
            { value: "mesh", label: "Malla" },
          ]}
        />
        <SegmentedControl
          size="sm"
          label="Intensidad"
          value={intensity}
          onValueChange={setIntensity}
          items={[
            { value: "subtle", label: "Sutil" },
            { value: "medium", label: "Media" },
            { value: "strong", label: "Fuerte" },
          ]}
        />
        <Switch size="sm" checked={animated} onCheckedChange={setAnimated}>
          Deriva
        </Switch>
      </div>
      <Backdrop className="zd-effect-stage" pattern={pattern} intensity={intensity} animated={animated}>
        <div className="zd-effect-hero">
          <p className="zd-effect-eyebrow">Backdrop · {pattern}</p>
          <p className="zd-effect-title">Un estándar. Cualquier marca.</p>
          <p className="zd-effect-text">El texto encima conserva su contraste en todas las intensidades.</p>
        </div>
      </Backdrop>
      <pre className="zd-gallery__snippet">
        <code>{`<Backdrop pattern="${pattern}"${intensity !== "medium" ? ` intensity="${intensity}"` : ""}${animated ? " animated" : ""}>…</Backdrop>`}</code>
      </pre>
    </>
  );
}

function BeamDemo() {
  const [tone, setTone] = useState<EffectTone>("accent");
  return (
    <>
      <div className="zd-gallery__controls">
        <SegmentedControl size="sm" label="Tono del haz" value={tone} onValueChange={setTone} items={TONES} />
      </div>
      <div className="zd-gallery zd-gallery--tight">
        <BorderBeam tone={tone}>
          <Card>
            <CardHeader title="Pro" subtitle="Everything in Team, plus audit logs and SSO." />
          </Card>
        </BorderBeam>
        <BorderBeam tone={tone} width={2} duration={4} length={30} reverse>
          <Card>
            <CardHeader title="Deploying" subtitle="Grosor 2, 4 s por vuelta, en sentido contrario." />
          </Card>
        </BorderBeam>
      </div>
    </>
  );
}

function GlowDemo() {
  return (
    <div className="zd-gallery zd-gallery--tight">
      {(
        [
          ["border", "accent", "Analytics", "Borde: el canto se ilumina bajo el puntero."],
          ["surface", "info", "Storage", "Superficie: un foco suave por debajo del contenido."],
          ["both", "success", "Functions", "Ambos, con el tono de éxito."],
        ] as const
      ).map(([variant, tone, title, text]) => (
        <Glow key={variant} variant={variant} tone={tone}>
          <Card>
            <CardHeader title={title} subtitle={text} />
          </Card>
        </Glow>
      ))}
    </div>
  );
}

function AttentionDemo() {
  const [run, setRun] = useState(0);
  return (
    <>
      <div className="zd-gallery__controls">
        <Button size="sm" icon="arrow-path" onClick={() => setRun((n) => n + 1)}>
          Repetir
        </Button>
      </div>
      <div className="zd-gallery__stage zd-gallery__stage--row" key={run}>
        <AttentionRing>
          <Button icon="bell">Inbox</Button>
        </AttentionRing>
        <AttentionRing variant="glow" tone="warning">
          <Button icon="exclamation-triangle">Review</Button>
        </AttentionRing>
        <AttentionRing tone="success" repeat={Number.POSITIVE_INFINITY}>
          <Button icon="check-circle">Live</Button>
        </AttentionRing>
      </div>
    </>
  );
}

function TextDemo() {
  const [run, setRun] = useState(0);
  return (
    <>
      <div className="zd-gallery__controls">
        <Button size="sm" icon="arrow-path" onClick={() => setRun((n) => n + 1)}>
          Repetir
        </Button>
      </div>
      <div className="zd-effect-texts" key={run}>
        <TextEffect as="p" className="zd-effect-title">
          Interfaces que se sienten nativas
        </TextEffect>
        <TextEffect as="p" className="zd-effect-title" effect="blur" by="letter">
          Liquid glass
        </TextEffect>
        <TextEffect as="p" className="zd-effect-title" effect="gradient" animated>
          Un estándar, cualquier marca
        </TextEffect>
        <TextEffect as="p" effect="shimmer">
          Pensando…
        </TextEffect>
      </div>
    </>
  );
}

const SECTIONS = [
  {
    id: "backdrop",
    title: "Backdrop",
    slug: "backdrop",
    text: "Fondos de rejilla, puntos, hexágonos o malla de color, en CSS.",
    demo: <BackdropDemo />,
  },
  {
    id: "border-beam",
    title: "BorderBeam",
    slug: "border-beam",
    text: "Un haz que recorre el borde de una pieza destacada.",
    demo: <BeamDemo />,
  },
  {
    id: "glow",
    title: "Glow",
    slug: "glow",
    text: "Brillo que sigue al puntero (solo con un puntero que pasa por encima).",
    demo: <GlowDemo />,
  },
  {
    id: "attention-ring",
    title: "AttentionRing",
    slug: "attention-ring",
    text: "Llama la atención con tres pulsos y queda fijo; el tercero, sin fin.",
    demo: <AttentionDemo />,
  },
  {
    id: "text-effect",
    title: "TextEffect",
    slug: "text-effect",
    text: "Aparición por palabras o letras, degradado con tokens de texto y brillo de espera.",
    demo: <TextDemo />,
  },
];

export default function Effects() {
  return (
    <Layout title="Efectos" description="Backdrop, BorderBeam, Glow, AttentionRing y TextEffect, en vivo.">
      <DocsShell>
        <PageGrid>
          <Crumbs items={[{ label: "Referencia" }, { label: "Efectos" }]} />
          <div className="zd-markdown">
            <h1>Efectos</h1>
            <p className="zd-lead">
              Adornos de cristal para portadas y piezas destacadas. Son decorativos: capas <code>aria-hidden</code> sin puntero, nada tapa
              el texto, sin movimiento con <code>prefers-reduced-motion</code> y en pausa fuera de pantalla. Para las esperas, mira los{" "}
              <Link to="/loaders">cargadores</Link>.
            </p>
            {SECTIONS.map((s) => (
              <section key={s.id} className="zd-section" aria-labelledby={s.id}>
                <h2 id={s.id}>{s.title}</h2>
                <p>
                  {s.text} <Link to={`/components/effects/${s.slug}`}>API de {s.title}</Link>.
                </p>
                <div className="zd-effect-frame z-root">{s.demo}</div>
              </section>
            ))}
          </div>
        </PageGrid>
      </DocsShell>
    </Layout>
  );
}
