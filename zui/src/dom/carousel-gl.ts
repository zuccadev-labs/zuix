// Parte WebGL del Carousel sin framework (@zuccadev-labs/zuix-zui/dom/carousel-gl): los shaders de la lente y la
// normalización de la fuente ráster de cada slide. `@zuccadev-labs/zuix-zui/dom` lo importa bajo demanda, solo cuando un
// carrusel pide el modo gl (slides con data-raster / data-raster-src, o carousel(el, { rasterize })).
// Sin bundler es un archivo aparte: zui/dist/zui.dom.carousel-gl.js, junto a zui.dom.js.
import { LensRenderer } from "../components/carousel/lensRenderer";

export { toSlideTexture, type CarouselRasterSize, type CarouselRasterSource } from "../components/carousel/slideTexture";

/** Crea el dibujo WebGL2 sobre el lienzo; null si el navegador no da WebGL2 o los shaders no compilan. */
export const createRenderer = (canvas: HTMLCanvasElement, onLost: () => void) => LensRenderer.create(canvas, onLost);
