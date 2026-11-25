// Carrusel de la portada: Prisma (coverflow de cristal con profundidad) con una pieza de la suite por slide. Cada
// slide lleva una composición en vivo con los componentes reales sobre una ilustración propia; la composición es
// decorativa (inerte y oculta a lectores de pantalla) y el pie de cristal dice qué es y lleva a su documentación.
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { Badge, Button, Carousel, SegmentedControl, Sparkline, Switch } from "@zuccadev-labs/zuix-zui";
import type { ReactNode } from "react";

interface Piece {
  id: string;
  icon: IconName;
  title: string;
  text: string;
  to: string;
  art: string;
  demo: ReactNode;
}

const ICONS: IconName[] = [
  "sparkles",
  "calendar",
  "chart-bar",
  "bell",
  "cog",
  "magnifying-glass",
  "heart",
  "bolt",
  "cloud",
  "lock-closed",
  "photo",
  "user",
];
const SWATCHES = ["accent", "info", "success", "warning", "danger", "fg"];

const PIECES: Piece[] = [
  {
    id: "zui",
    icon: "puzzle-piece",
    title: "Zui",
    text: "Componentes accesibles que solo leen tokens, con su manifiesto.",
    to: "/components",
    art: "aurora",
    demo: (
      <div className="zd-piece__stack">
        <SegmentedControl
          size="sm"
          label="Vista"
          value="preview"
          onValueChange={() => {}}
          items={[
            { value: "preview", label: "Vista", icon: "eye" },
            { value: "code", label: "Código", icon: "code-bracket" },
          ]}
        />
        <Switch size="sm" checked onCheckedChange={() => {}}>
          Sincronizar
        </Switch>
        <div className="zd-piece__row">
          <Button size="sm" variant="ghost">
            Cancelar
          </Button>
          <Button size="sm" variant="primary" icon="check">
            Guardar
          </Button>
        </div>
      </div>
    ),
  },
  {
    id: "carousels",
    icon: "rectangle-stack",
    title: "Carruseles",
    text: "Prisma, layouts de Material 3, mazo, historias y galería, sin bibliotecas.",
    to: "/carousels",
    art: "city",
    demo: (
      <div className="zd-piece__deck" data-art="city">
        <span />
        <span />
        <span />
      </div>
    ),
  },
  {
    id: "tokens",
    icon: "swatch",
    title: "Tokens",
    text: "Una marca es un archivo: color, material, tipografía y medidas.",
    to: "/tokens",
    art: "dunes",
    demo: (
      <div className="zd-piece__swatches">
        {SWATCHES.map((s) => (
          <span key={s} className="zd-piece__swatch" data-tone={s} />
        ))}
      </div>
    ),
  },
  {
    id: "zicon",
    icon: "sparkles",
    title: "Zicon",
    text: "Iconos en outline y solid, con búsqueda por concepto.",
    to: "/icons",
    art: "glacier",
    demo: (
      <div className="zd-piece__icons">
        {ICONS.map((name) => (
          <Icon key={name} name={name} size={20} />
        ))}
      </div>
    ),
  },
  {
    id: "zout",
    icon: "rectangle-group",
    title: "Zout",
    text: "Shell, paneles divididos y rejillas que se adaptan a su contenedor.",
    to: "/components#layout",
    art: "forest",
    demo: (
      <div className="zd-piece__shell">
        <span className="zd-piece__pane" data-part="rail" />
        <span className="zd-piece__pane" data-part="side" />
        <span className="zd-piece__pane" data-part="main" />
      </div>
    ),
  },
  {
    id: "charts",
    icon: "chart-bar",
    title: "Gráficos",
    text: "Líneas, barras, anillos y minigráficos con los colores de la marca.",
    to: "/components#charts",
    art: "reef",
    demo: (
      <div className="zd-piece__stack">
        <Badge tone="accent">+24 %</Badge>
        <Sparkline values={[12, 18, 14, 22, 19, 28, 26, 34, 31, 40]} type="area" label="Visitas" locale="es-ES" />
        <Sparkline values={[6, 9, 5, 11, 8, 12, 10, 14]} type="bar" color={3} label="Altas" locale="es-ES" />
      </div>
    ),
  },
  {
    id: "dom",
    icon: "code-bracket",
    title: "Sin framework",
    text: "El estándar es HTML, CSS y tokens; React es un binding más.",
    to: "/docs/agents",
    art: "volcano",
    demo: (
      <pre className="zd-piece__code">
        <code>{`<div class="z-carousel"\n     data-z-carousel\n     data-effect="prism">\n  …\n</div>`}</code>
      </pre>
    ),
  },
  {
    id: "docs",
    icon: "book",
    title: "Zudocs",
    text: "Este sitio: el estándar de documentación y su plantilla.",
    to: "/docs/users/zudocs",
    art: "mist",
    demo: (
      <div className="zd-piece__lines">
        <span data-w="70" />
        <span data-w="95" />
        <span data-w="88" />
        <span data-w="60" />
      </div>
    ),
  },
];

function Art({ piece }: { piece: Piece }) {
  const src = useBaseUrl(`/img/carousel/${piece.art}.svg`);
  return (
    <div className="z-carousel__media zd-piece__art" aria-hidden="true" inert>
      <img className="zd-piece__bg" src={src} alt="" loading="lazy" decoding="async" />
      <div className="zd-piece__window">{piece.demo}</div>
    </div>
  );
}

/** Prisma de la portada. */
export function HomePrism() {
  return (
    <Carousel
      className="zd-prism"
      ariaLabel="Piezas de la suite"
      effect="prism"
      autoplay={6000}
      indicators="progress"
      items={PIECES}
      getKey={(p) => p.id}
      labels={{
        previous: "Pieza anterior",
        next: "Pieza siguiente",
        slide: (i, n) => `${i + 1} de ${n}`,
        carousel: "carrusel",
        slideRole: "pieza",
        pause: "Pausar el pase automático",
        play: "Reanudar el pase automático",
        goTo: (i, n) => `Ir a la pieza ${i + 1} de ${n}`,
        indicators: "Elegir pieza",
      }}
      renderItem={(p) => (
        <>
          <Art piece={p} />
          <div className="z-carousel__caption zd-piece__caption">
            <span className="zd-tile" aria-hidden="true">
              <Icon name={p.icon} size={18} />
            </span>
            <div className="zd-piece__copy">
              <h3 className="zd-piece__title">{p.title}</h3>
              <p className="zd-piece__text">{p.text}</p>
            </div>
            <Link className="z-btn z-btn--secondary zd-piece__link" data-size="sm" to={p.to}>
              Abrir <span className="z-sr-only">{p.title}</span>
            </Link>
          </div>
        </>
      )}
    />
  );
}
