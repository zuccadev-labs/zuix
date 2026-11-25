// Lienzo de la demostración: el documento dentro del iframe, con el puente del conector.
import "@zuccadev-labs/zuix-zicon/element";
import { type Catalog, createCanvas } from "@zuccadev-labs/zuix-zui/editor";
import data from "@zuccadev-labs/zuix-zui/editor/catalog.json";

// En la demostración el origen del editor llega por la URL porque el servidor de pruebas usa un puerto libre. En
// producción va fijo en el código del lienzo: quien carga el iframe no debe poder elegir a quién obedece.
const editor = new URLSearchParams(location.search).get("editor");
const canvas = createCanvas({
  container: document.getElementById("page") as HTMLElement,
  catalog: data as unknown as Catalog,
  allowedOrigins: editor ? [editor] : [],
});
(window as unknown as { zuixCanvas: typeof canvas }).zuixCanvas = canvas;
