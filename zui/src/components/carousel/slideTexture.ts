/**
 * Normaliza la fuente ráster que entrega el consumidor (imagen, lienzo, bitmap o URL) a un lienzo
 * del tamaño del slide, listo para subirse como textura WebGL. Aquí no se dibuja ningún diseño:
 * el aspecto del slide lo aporta siempre quien usa el carrusel.
 */

/** Fuente ráster de un slide: cualquier imagen dibujable o la URL de una imagen. */
export type CarouselRasterSource = CanvasImageSource | string;

export interface CarouselRasterSize {
  /** Ancho del slide en px CSS. */
  width: number;
  /** Alto del slide en px CSS. */
  height: number;
  /** Densidad recomendada: la textura ideal mide width*scale × height*scale. */
  scale: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = src;
  return image.decode().then(() => image);
}

function sourceSize(source: CanvasImageSource): [number, number] {
  if (source instanceof HTMLImageElement) return [source.naturalWidth, source.naturalHeight];
  if (source instanceof HTMLVideoElement) return [source.videoWidth, source.videoHeight];
  if (source instanceof SVGImageElement) return [source.width.baseVal.value, source.height.baseVal.value];
  if ("displayWidth" in source) return [source.displayWidth, source.displayHeight];
  return [source.width, source.height];
}

/** Lienzo del tamaño del slide con la fuente ajustada en modo "cover". Lanza si la fuente no sirve. */
export async function toSlideTexture(
  source: CarouselRasterSource,
  size: CarouselRasterSize,
  maxTextureSize: number,
): Promise<HTMLCanvasElement> {
  const drawable = typeof source === "string" ? await loadImage(source) : source;
  const [sw, sh] = sourceSize(drawable);
  if (!(sw > 0) || !(sh > 0) || !(size.width > 0) || !(size.height > 0)) throw new Error("Fuente ráster vacía");

  const limit = Math.min(size.scale, maxTextureSize / size.width, maxTextureSize / size.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(size.width * limit));
  canvas.height = Math.max(1, Math.round(size.height * limit));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Lienzo 2D no disponible");

  const fit = Math.max(canvas.width / sw, canvas.height / sh);
  const w = sw * fit;
  const h = sh * fit;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(drawable, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  return canvas;
}
