// Vista previa de React de los ejemplos que no tienen marcado estático en html.json (necesitan datos, estado o una
// capa que React monta por portal). Clave: nombre del componente y título del ejemplo en su manifiesto.
// Un ejemplo sin html.json ni demo aquí rompe el build del sitio (ver Example.tsx).
import { carousel } from "./carousel";
import { content } from "./content";
import { forms } from "./forms";
import { layout } from "./layout";
import { navigation } from "./navigation";
import { overlay } from "./overlay";
import type { ExampleDemos } from "./shared";

export const EXAMPLE_DEMOS: Record<string, ExampleDemos> = {
  ...carousel,
  ...content,
  ...forms,
  ...layout,
  ...navigation,
  ...overlay,
};
