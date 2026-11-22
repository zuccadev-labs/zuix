// Galería de carruseles: Prisma y coverflow, los layouts de Material 3, pantalla completa con parallax o fundido,
// mazo, rueda, historias, galería con visor y dos recetas (logos en marquesina y testimonios). Todo en vivo, con
// imágenes propias del sitio, y el código de lo que se ve.
import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Layout from "@theme/Layout";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import {
  Avatar,
  Carousel,
  type CarouselEffect,
  type CarouselLayout,
  Gallery,
  Marquee,
  SegmentedControl,
  Stories,
  Switch,
} from "@zuccadev-labs/zuix-zui";
import { useState } from "react";
import { Crumbs, DocsShell, PageGrid } from "../components/Shell";

const SCENES = [
  { id: "aurora", title: "Aurora", text: "Cielo de invierno sobre la sierra." },
  { id: "dunes", title: "Dunas", text: "La última luz sobre la arena." },
  { id: "glacier", title: "Glaciar", text: "Hielo azul a primera hora." },
  { id: "forest", title: "Bosque", text: "Niebla entre los pinos." },
  { id: "city", title: "Ciudad", text: "El horizonte al anochecer." },
  { id: "reef", title: "Arrecife", text: "Agua clara en la costa." },
  { id: "volcano", title: "Volcán", text: "Brasas bajo un cielo sin luna." },
  { id: "mist", title: "Bruma", text: "Colinas lavanda al alba." },
];
type Scene = (typeof SCENES)[number];

/** URL de una ilustración del sitio (están en static/img/carousel). */
function useScenes() {
  const base = useBaseUrl("/img/carousel/");
  return SCENES.map((s) => ({ ...s, src: `${base}${s.id}.svg`, alt: `${s.title}: ${s.text.toLowerCase().replace(/\.$/, "")}` }));
}

const LABELS = {
  previous: "Anterior",
  next: "Siguiente",
  slide: (i: number, n: number) => `${i + 1} de ${n}`,
  carousel: "carrusel",
  slideRole: "diapositiva",
  pause: "Pausar el pase automático",
  play: "Reanudar el pase automático",
  goTo: (i: number, n: number) => `Ir a la ${i + 1} de ${n}`,
  indicators: "Elegir diapositiva",
};

function Media({ scene, caption = true, layer }: { scene: Scene & { src: string; alt: string }; caption?: boolean; layer?: boolean }) {
  return (
    <>
      <img
        className="z-carousel__media"
        src={scene.src}
        alt={scene.alt}
        loading="lazy"
        decoding="async"
        data-parallax-layer={layer ? "0.35" : undefined}
      />
      {caption ? (
        <div className="z-carousel__caption zd-carousel-caption">
          <strong>{scene.title}</strong>
          <span>{scene.text}</span>
        </div>
      ) : null}
    </>
  );
}

function PrismDemo() {
  const scenes = useScenes();
  const [effect, setEffect] = useState<CarouselEffect>("prism");
  const [autoplay, setAutoplay] = useState(true);
  return (
    <>
      <div className="zd-gallery__controls">
        <SegmentedControl
          size="sm"
          label="Efecto"
          value={effect}
          onValueChange={setEffect}
          items={[
            { value: "prism", label: "Prisma" },
            { value: "coverflow", label: "Coverflow" },
          ]}
        />
        <Switch size="sm" checked={autoplay} onCheckedChange={setAutoplay}>
          Pase automático
        </Switch>
      </div>
      <Carousel
        key={`${effect}-${autoplay}`}
        ariaLabel="Paisajes"
        effect={effect}
        autoplay={autoplay ? 5000 : undefined}
        indicators={autoplay ? "progress" : "dots"}
        labels={LABELS}
        items={scenes}
        getKey={(s) => s.id}
        renderItem={(s) => <Media scene={s} />}
      />
      <pre className="zd-gallery__snippet zd-gallery__snippet--wrap">
        <code>{`<Carousel effect="${effect}"${autoplay ? ' autoplay={5000} indicators="progress"' : ' indicators="dots"'} items={photos} renderItem={…} />`}</code>
      </pre>
    </>
  );
}

function MaterialDemo() {
  const scenes = useScenes();
  const [layout, setLayout] = useState<CarouselLayout>("multi-browse");
  return (
    <>
      <div className="zd-gallery__controls">
        <SegmentedControl
          size="sm"
          label="Layout"
          value={layout}
          onValueChange={setLayout}
          items={[
            { value: "multi-browse", label: "Multi-browse" },
            { value: "hero", label: "Hero" },
            { value: "hero-center", label: "Centrado" },
            { value: "uncontained", label: "Libre" },
          ]}
        />
      </div>
      <Carousel
        key={layout}
        ariaLabel={`Paisajes en ${layout}`}
        layout={layout}
        effect="none"
        loop={false}
        indicators="dots"
        labels={LABELS}
        items={scenes}
        getKey={(s) => s.id}
        renderItem={(s) => <Media scene={s} />}
      />
      <pre className="zd-gallery__snippet zd-gallery__snippet--wrap">
        <code>{`<Carousel layout="${layout}" effect="none" items={photos} renderItem={…} />`}</code>
      </pre>
    </>
  );
}

function FullscreenDemo() {
  const scenes = useScenes();
  const [effect, setEffect] = useState<CarouselEffect>("parallax");
  return (
    <>
      <div className="zd-gallery__controls">
        <SegmentedControl
          size="sm"
          label="Transición"
          value={effect}
          onValueChange={setEffect}
          items={[
            { value: "parallax", label: "Parallax" },
            { value: "fade", label: "Fundido" },
          ]}
        />
      </div>
      <Carousel
        key={effect}
        ariaLabel="Paisajes a pantalla completa"
        layout="fullscreen"
        effect={effect}
        kenBurns={effect === "fade"}
        indicators="dots"
        labels={LABELS}
        items={scenes}
        getKey={(s) => s.id}
        renderItem={(s) => <Media scene={s} layer={effect === "parallax"} />}
      />
      <pre className="zd-gallery__snippet zd-gallery__snippet--wrap">
        <code>
          {effect === "parallax"
            ? '<Carousel layout="fullscreen" effect="parallax" items={photos} renderItem={(p) => <img className="z-carousel__media" data-parallax-layer="0.35" … />} />'
            : '<Carousel layout="fullscreen" effect="fade" kenBurns items={photos} renderItem={…} />'}
        </code>
      </pre>
    </>
  );
}

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "swatch", title: "Elige la marca", text: "Un archivo de tokens cambia color, material y tipografía." },
  { icon: "puzzle-piece", title: "Monta la pantalla", text: "Componentes de zui sobre los layouts de zout." },
  { icon: "code-bracket", title: "Sin framework si quieres", text: "El mismo marcado funciona con /dom, sin React." },
  { icon: "check-circle", title: "Comprueba", text: "Auditoría de estilo, contraste y pruebas en navegador." },
];

function StackDemo() {
  return (
    <>
      <div className="zd-carousel-narrow">
        <Carousel
          ariaLabel="Primeros pasos"
          layout="stack"
          loop={false}
          labels={LABELS}
          items={STEPS}
          getKey={(s) => s.title}
          renderItem={(s) => (
            <div className="zd-step">
              <span className="zd-tile" aria-hidden="true">
                <Icon name={s.icon} size={18} />
              </span>
              <h3 className="zd-step__title">{s.title}</h3>
              <p className="zd-step__text">{s.text}</p>
            </div>
          )}
        />
      </div>
      <pre className="zd-gallery__snippet zd-gallery__snippet--wrap">
        <code>{'<Carousel layout="stack" items={steps} renderItem={(s) => <Step {...s} />} />'}</code>
      </pre>
    </>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

function WheelDemo() {
  const [hour, setHour] = useState(9);
  return (
    <>
      <div className="zd-carousel-wheel">
        <Carousel
          ariaLabel="Hora"
          effect="wheel"
          loop={false}
          indicators="none"
          defaultIndex={9}
          onIndexChange={setHour}
          labels={{ ...LABELS, slide: (i) => HOURS[i] ?? "", slideRole: "hora" }}
          items={HOURS}
          renderItem={(h) => <span className="zd-wheel-item">{h}</span>}
        />
        <p className="zd-wheel-value">
          Hora elegida: <strong>{HOURS[hour]}</strong>
        </p>
      </div>
      <pre className="zd-gallery__snippet zd-gallery__snippet--wrap">
        <code>
          {'<Carousel effect="wheel" loop={false} indicators="none" items={hours} onIndexChange={setHour} renderItem={(h) => h} />'}
        </code>
      </pre>
    </>
  );
}

function StoriesDemo() {
  const scenes = useScenes();
  const by = (ids: string[]) =>
    ids.map((id) => {
      const s = scenes.find((x) => x.id === id)!;
      return { id, media: s.src, alt: s.alt, caption: s.text };
    });
  return (
    <>
      <Stories
        ariaLabel="Historias del equipo"
        labels={{
          stories: "historias",
          story: "historia",
          previous: "Historia anterior",
          next: "Historia siguiente",
          pause: "Pausar las historias",
          previousGroup: "Persona anterior",
          nextGroup: "Persona siguiente",
          position: "Historia {index} de {count}, {author}",
        }}
        groups={[
          { id: "ana", author: { name: "Ana", avatar: scenes[0]!.src }, items: by(["aurora", "glacier", "mist"]) },
          { id: "leo", author: { name: "Leo", avatar: scenes[3]!.src }, items: by(["forest", "dunes"]) },
          { id: "mar", author: { name: "Mar", avatar: scenes[5]!.src }, items: by(["reef", "city", "volcano"]) },
        ]}
      />
      <pre className="zd-gallery__snippet zd-gallery__snippet--wrap">
        <code>
          {
            '<Stories ariaLabel="Historias del equipo" groups={[{ id: "ana", author: { name: "Ana", avatar }, items: [{ id, media, alt }] }]} />'
          }
        </code>
      </pre>
    </>
  );
}

function GalleryDemo() {
  const scenes = useScenes();
  const [thumbs, setThumbs] = useState<"bottom" | "side">("bottom");
  return (
    <>
      <div className="zd-gallery__controls">
        <SegmentedControl
          size="sm"
          label="Miniaturas"
          value={thumbs}
          onValueChange={setThumbs}
          items={[
            { value: "bottom", label: "Debajo" },
            { value: "side", label: "Al lado" },
          ]}
        />
      </div>
      <Gallery
        ariaLabel="Galería de paisajes"
        thumbnails={thumbs}
        labels={{
          ...LABELS,
          expand: "Ver a pantalla completa",
          lightbox: {
            dialog: "Visor de imágenes",
            close: "Cerrar",
            previous: "Imagen anterior",
            next: "Imagen siguiente",
            zoomIn: "Ampliar",
            zoomOut: "Reducir",
            image: "Imagen {index} de {count}",
          },
        }}
        items={scenes.map((s) => ({ src: s.src, alt: s.alt, caption: s.title, width: 1600, height: 1000 }))}
      />
      <pre className="zd-gallery__snippet zd-gallery__snippet--wrap">
        <code>{`<Gallery ariaLabel="Galería" thumbnails="${thumbs}" items={photos} />`}</code>
      </pre>
    </>
  );
}

const BRANDS: { icon: IconName; name: string }[] = [
  { icon: "bolt", name: "Voltio" },
  { icon: "cloud", name: "Nimbo" },
  { icon: "sparkles", name: "Destello" },
  { icon: "cube", name: "Bloque" },
  { icon: "globe-alt", name: "Órbita" },
  { icon: "beaker", name: "Probeta" },
  { icon: "rocket-launch", name: "Lanza" },
  { icon: "sun", name: "Solar" },
];

function LogoCloudDemo() {
  return (
    <>
      <Marquee className="zd-logo-cloud" label="Equipos que usan la suite" fade pauseOnHover showControl duration={40}>
        {BRANDS.map((b) => (
          <span key={b.name} className="zd-logo">
            <Icon name={b.icon} size={22} />
            {b.name}
          </span>
        ))}
      </Marquee>
      <pre className="zd-gallery__snippet zd-gallery__snippet--wrap">
        <code>{'<Marquee className="logo-cloud" label="Clientes" fade pauseOnHover showControl>{logos}</Marquee>'}</code>
      </pre>
    </>
  );
}

const QUOTES = [
  { name: "Lucía Prado", role: "Diseño de producto", text: "Cambiamos de marca tocando un archivo. Las pantallas siguieron funcionando." },
  { name: "Tomás Ibarra", role: "Frontend", text: "El mismo marcado en React y en una plantilla de servidor. Por fin." },
  { name: "Elena Ruiz", role: "Accesibilidad", text: "Los carruseles anuncian lo justo y se paran cuando tienen que pararse." },
  { name: "Marco Sanz", role: "Plataforma", text: "Sin dependencias de UI de terceros: menos sorpresas al actualizar." },
  {
    name: "Inés Vidal",
    role: "Dirección técnica",
    text: "Los manifiestos hacen que los agentes generen interfaces que pasan la auditoría.",
  },
];

function TestimonialsDemo() {
  return (
    <>
      <Carousel
        ariaLabel="Testimonios"
        layout="uncontained"
        effect="none"
        autoplay={7000}
        indicators="progress"
        slideWidth="min(80cqi, 22rem)"
        gap={16}
        labels={LABELS}
        items={QUOTES}
        getKey={(q) => q.name}
        renderItem={(q) => (
          <figure className="zd-quote">
            <blockquote className="zd-quote__text">{q.text}</blockquote>
            <figcaption className="zd-quote__author">
              <Avatar name={q.name} size="sm" />
              <span>
                <strong>{q.name}</strong>
                <span className="zd-quote__role">{q.role}</span>
              </span>
            </figcaption>
          </figure>
        )}
      />
      <pre className="zd-gallery__snippet zd-gallery__snippet--wrap">
        <code>
          {'<Carousel layout="uncontained" autoplay={7000} indicators="progress" items={quotes} renderItem={(q) => <Quote {...q} />} />'}
        </code>
      </pre>
    </>
  );
}

const SECTIONS = [
  {
    id: "prisma",
    title: "Prisma",
    api: "carousel",
    text: "El carrusel de la marca: coverflow de cristal con profundidad. El slide central queda nítido y con el anillo del acento; los laterales giran, retroceden y se esmerilan. Con pase automático, el punto actual se llena mientras corre.",
    demo: <PrismDemo />,
  },
  {
    id: "material",
    title: "Layouts de Material 3",
    api: "carousel",
    text: "Multi-browse y hero recortan cada slide con máscaras que crecen y encogen al desplazar (keylines); uncontained deja que el último se corte en el borde.",
    demo: <MaterialDemo />,
  },
  {
    id: "pantalla-completa",
    title: "Pantalla completa",
    api: "carousel",
    text: "Un slide por vista, a sangre. Con parallax la imagen va más lenta que el slide; con fundido los slides se superponen y la imagen activa se acerca despacio.",
    demo: <FullscreenDemo />,
  },
  {
    id: "mazo",
    title: "Mazo",
    api: "carousel",
    text: "Tarjetas apiladas que se descartan arrastrando o con las flechas. Solo la de arriba es interactiva.",
    demo: <StackDemo />,
  },
  {
    id: "rueda",
    title: "Rueda",
    api: "carousel",
    text: "Un cilindro vertical para elegir un valor, como los selectores de hora de los móviles.",
    demo: <WheelDemo />,
  },
  {
    id: "historias",
    title: "Historias",
    api: "stories",
    text: "Toca a la derecha para avanzar y a la izquierda para volver; mantén pulsado para pausar. Con movimiento reducido no avanzan solas.",
    demo: <StoriesDemo />,
  },
  {
    id: "galeria",
    title: "Galería y visor",
    api: "gallery",
    text: "Miniaturas sincronizadas y un visor a pantalla completa con zoom (botones, + y −, doble clic) que devuelve el foco al cerrar.",
    demo: <GalleryDemo />,
  },
  {
    id: "logos",
    title: "Receta: logos en marquesina",
    api: null,
    text: "Marquee con fundido en los bordes, pausa al pasar el puntero y botón de pausa. Los logos van en escala de grises y recuperan el color al pasar por encima.",
    demo: <LogoCloudDemo />,
  },
  {
    id: "testimonios",
    title: "Receta: testimonios",
    api: null,
    text: "Carousel uncontained con tarjetas de cita, pase automático y progreso visible.",
    demo: <TestimonialsDemo />,
  },
];

export default function Carousels() {
  return (
    <Layout title="Carruseles" description="Prisma, layouts de Material 3, mazo, rueda, historias, galería y recetas, en vivo.">
      <DocsShell>
        <PageGrid>
          <Crumbs items={[{ label: "Referencia" }, { label: "Carruseles" }]} />
          <div className="zd-markdown">
            <h1>Carruseles</h1>
            <p className="zd-lead">
              Todos salen del mismo <Link to="/components/carousel/carousel">Carousel</Link>, con dos ejes: <code>layout</code> reparte el
              espacio y <code>effect</code> transforma cada slide según su distancia al centro. Debajo hay desplazamiento nativo con
              scroll-snap, el bucle no clona slides y, con movimiento reducido, todo queda plano y quieto. Las imágenes son ilustraciones
              propias del sitio.
            </p>
            {SECTIONS.map((s) => (
              <section key={s.id} className="zd-section" aria-labelledby={s.id}>
                <h2 id={s.id}>{s.title}</h2>
                <p>
                  {s.text}
                  {s.api ? (
                    <>
                      {" "}
                      <Link to={`/components/carousel/${s.api}`}>
                        API de {s.api === "carousel" ? "Carousel" : s.api === "stories" ? "Stories" : "Gallery"}
                      </Link>
                      .
                    </>
                  ) : null}
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
