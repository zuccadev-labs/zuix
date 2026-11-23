// Carousel, Gallery, Lightbox y Stories: los ejemplos de sus manifiestos con las ilustraciones del sitio.
import { Badge, Card, CardHeader, Carousel, Gallery, Lightbox, Stories } from "@zuccadev-labs/zuix-zui";
import { useState } from "react";
import { type ExampleDemos, usePhoto, usePhotos } from "./shared";

const PROJECTS = [
  { id: "atlas", title: "Atlas", subtitle: "Maps and routing", status: "Live" },
  { id: "beacon", title: "Beacon", subtitle: "Status pages", status: "Beta" },
  { id: "cinder", title: "Cinder", subtitle: "Build cache", status: "Live" },
  { id: "drift", title: "Drift", subtitle: "Schema migrations", status: "Draft" },
  { id: "ember", title: "Ember", subtitle: "Realtime sync", status: "Live" },
];

const ProjectCard = ({ p }: { p: (typeof PROJECTS)[number] }) => (
  <Card>
    <CardHeader title={p.title} subtitle={p.subtitle} />
  </Card>
);

const STEPS = [
  { title: "Pick a brand", text: "One tokens file sets color, material and type." },
  { title: "Build the screen", text: "zui components on top of zout layouts." },
  { title: "Ship without React", text: "The same markup runs with zui/dom." },
  { title: "Check it", text: "Style audit, contrast and browser tests." },
];

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

export const carousel: Record<string, ExampleDemos> = {
  Carousel: {
    "Tarjetas con lente": () => (
      <Carousel
        ariaLabel="Featured projects"
        items={PROJECTS}
        getKey={(p) => p.id}
        renderItem={(p, _i, { active }) => (
          <Card>
            <CardHeader title={p.title} subtitle={p.subtitle} action={active ? <Badge tone="success">{p.status}</Badge> : undefined} />
          </Card>
        )}
      />
    ),
    "Plano, sin bucle y con textos propios": () => {
      const photos = usePhotos();
      return (
        <Carousel
          ariaLabel="Galería"
          effect="none"
          loop={false}
          slideWidth={320}
          gap={16}
          items={photos}
          getKey={(p) => p.id}
          renderItem={(photo) => <img className="z-carousel__media" src={photo.src} alt={photo.alt} />}
          labels={{ previous: "Anterior", next: "Siguiente", slide: (i, n) => `Foto ${i + 1} de ${n}` }}
        />
      );
    },
    "Zonas curvas en WebGL": () => {
      const photos = usePhotos();
      return (
        <Carousel
          ariaLabel="Gallery"
          items={photos}
          getKey={(p) => p.id}
          renderItem={(photo) => <img className="z-carousel__media" src={photo.src} alt={photo.alt} crossOrigin="anonymous" />}
          rasterize={(photo) => photo.src}
        />
      );
    },
    "Reproducción automática con puntos": () => (
      <Carousel
        ariaLabel="Highlights"
        effect="none"
        autoplay={6000}
        indicators="dots"
        items={PROJECTS}
        getKey={(p) => p.id}
        renderItem={(p) => <ProjectCard p={p} />}
      />
    ),
    "Tres por página con barra": () => (
      <Carousel
        ariaLabel="Projects"
        slidesPerPage={3}
        indicators="bar"
        loop={false}
        items={PROJECTS}
        getKey={(p) => p.id}
        renderItem={(p) => <ProjectCard p={p} />}
      />
    ),
    Vertical: () => (
      <Carousel
        ariaLabel="Release notes"
        orientation="vertical"
        height={280}
        slidesPerPage={2}
        indicators="dots"
        items={PROJECTS}
        getKey={(p) => p.id}
        renderItem={(p) => <ProjectCard p={p} />}
      />
    ),
    Miniaturas: () => {
      const photos = usePhotos();
      return (
        <Carousel
          ariaLabel="Photos"
          effect="none"
          indicators="thumbnails"
          items={photos}
          getKey={(p) => p.id}
          renderItem={(p) => <img className="z-carousel__media" src={p.src} alt={p.alt} />}
          renderThumbnail={(p) => <img src={p.src} alt="" />}
        />
      );
    },
    "Prisma: coverflow de cristal con progreso": () => {
      const places = usePhotos();
      return (
        <Carousel
          ariaLabel="Destinations"
          effect="prism"
          autoplay={5000}
          indicators="progress"
          items={places}
          getKey={(p) => p.id}
          renderItem={(p) => (
            <>
              <img className="z-carousel__media" src={p.src} alt={p.alt} />
              <div className="z-carousel__caption zd-carousel-caption">
                <strong>{p.title}</strong>
                <span>{p.text}</span>
              </div>
            </>
          )}
        />
      );
    },
    "Multi-browse de Material 3": () => {
      const albums = usePhotos();
      return (
        <Carousel
          ariaLabel="Albums"
          layout="multi-browse"
          effect="none"
          items={albums}
          getKey={(a) => a.id}
          renderItem={(a) => <img className="z-carousel__media" src={a.src} alt={a.title} />}
        />
      );
    },
    "Pantalla completa con fundido": () => {
      const photos = usePhotos();
      return (
        <Carousel
          ariaLabel="Stories of the week"
          layout="fullscreen"
          effect="fade"
          kenBurns
          autoplay
          indicators="dots"
          items={photos}
          getKey={(p) => p.id}
          renderItem={(p) => <img className="z-carousel__media" src={p.src} alt={p.alt} />}
        />
      );
    },
    "Mazo de tarjetas": () => (
      <div className="zd-carousel-narrow">
        <Carousel
          ariaLabel="Onboarding"
          layout="stack"
          items={STEPS}
          getKey={(s) => s.title}
          renderItem={(s) => (
            <Card>
              <CardHeader title={s.title} subtitle={s.text} />
            </Card>
          )}
        />
      </div>
    ),
    Rueda: () => {
      const [hour, setHour] = useState(9);
      return (
        <div className="zd-carousel-wheel">
          <Carousel
            ariaLabel="Hour"
            effect="wheel"
            loop={false}
            indicators="none"
            defaultIndex={9}
            onIndexChange={setHour}
            labels={{ slide: (i) => HOURS[i] ?? "" }}
            items={HOURS}
            renderItem={(h) => <span className="zd-wheel-item">{h}</span>}
          />
          <p className="zd-wheel-value">
            Selected: <strong>{HOURS[hour]}</strong>
          </p>
        </div>
      );
    },
  },
  Gallery: {
    "Con miniaturas al lado": () => {
      const photos = usePhotos();
      return (
        <div className="zd-demo-wide">
          <Gallery
            ariaLabel="Trip photos"
            thumbnails="side"
            items={photos.map((p) => ({ src: p.src, alt: p.alt, caption: p.title, width: 1600, height: 1000 }))}
          />
        </div>
      );
    },
  },
  Lightbox: {
    Controlado: () => {
      const photos = usePhotos().slice(0, 4);
      const [open, setOpen] = useState(false);
      const [index, setIndex] = useState(0);
      return (
        <ul className="zd-thumbs" aria-label="Trip photos">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className="zd-thumbs__button"
                onClick={() => {
                  setIndex(i);
                  setOpen(true);
                }}
              >
                <img src={p.src} alt={`Open ${p.title}`} />
              </button>
            </li>
          ))}
          <Lightbox
            items={photos.map((p) => ({ src: p.src, alt: p.alt, caption: p.title, width: 1600, height: 1000 }))}
            open={open}
            onOpenChange={setOpen}
            index={index}
            onIndexChange={setIndex}
          />
        </ul>
      );
    },
  },
  Stories: {
    "Dos personas": () => {
      const { aurora, glacier, forest, reef } = usePhoto();
      return (
        <Stories
          ariaLabel="Team stories"
          groups={[
            {
              id: "ana",
              author: { name: "Ana", avatar: aurora.src },
              items: [
                { id: "1", media: aurora.src, alt: aurora.alt, caption: aurora.text },
                { id: "2", media: glacier.src, alt: glacier.alt, caption: glacier.text },
              ],
            },
            {
              id: "leo",
              author: { name: "Leo" },
              items: [
                { id: "3", media: forest.src, alt: forest.alt, caption: forest.text, duration: 8000 },
                { id: "4", media: reef.src, alt: reef.alt },
              ],
            },
          ]}
        />
      );
    },
  },
};
