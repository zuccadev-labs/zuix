// Datos y piezas comunes de las demos de ejemplo: las ilustraciones del sitio (static/img/carousel) hacen de fotos,
// y un marco de tamaño fijo da a los layouts (Shell, SplitPane) una ventana en la que medirse.
import useBaseUrl from "@docusaurus/useBaseUrl";
import type { ComponentType, ReactNode } from "react";

/** Demos de los ejemplos de una página: título del ejemplo → componente que lo pinta. */
export type ExampleDemos = Record<string, ComponentType>;

const SCENES = [
  { id: "aurora", title: "Aurora", text: "Winter sky over the ridge" },
  { id: "dunes", title: "Dunes", text: "Last light on the sand" },
  { id: "glacier", title: "Glacier", text: "Blue ice at first light" },
  { id: "forest", title: "Forest", text: "Fog between the pines" },
  { id: "city", title: "City", text: "The skyline at dusk" },
  { id: "reef", title: "Reef", text: "Clear water off the coast" },
  { id: "volcano", title: "Volcano", text: "Embers under a moonless sky" },
  { id: "mist", title: "Mist", text: "Lavender hills at dawn" },
] as const;

export interface Photo {
  id: string;
  title: string;
  text: string;
  src: string;
  alt: string;
}

/** Fotos de ejemplo: las ilustraciones del sitio, con su texto alternativo. */
export function usePhotos(): Photo[] {
  const base = useBaseUrl("/img/carousel/");
  return SCENES.map((s) => ({ ...s, src: `${base}${s.id}.svg`, alt: `${s.title}: ${s.text.toLowerCase()}` }));
}

/** Las mismas fotos por nombre (`photo.city`), para cuando el ejemplo usa una sola. */
export function usePhoto(): Record<(typeof SCENES)[number]["id"], Photo> {
  const photos = usePhotos();
  return Object.fromEntries(photos.map((p) => [p.id, p])) as Record<(typeof SCENES)[number]["id"], Photo>;
}

/** Ventana de tamaño fijo para lo que ocupa el alto de su contenedor (Shell, SplitPane, lienzos). */
export function Frame({ children, size = "md" }: { children: ReactNode; size?: "sm" | "md" | "lg" }) {
  return (
    <div className="zd-frame" data-size={size}>
      {children}
    </div>
  );
}

/** Espera simulada: lo que en una aplicación sería una petición. */
export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
