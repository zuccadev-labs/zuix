// Dibuja la portada de un proyecto en un lienzo usando solo los tokens activos (tema y marca).
// La misma imagen se muestra en el slide y se entrega a `rasterize` del Carousel (modo gl).
import type { Project } from "./data";

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const COVER_WIDTH = 640;
export const COVER_HEIGHT = 400;

export function drawCover(project: Project, index: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const surface = token("--z-reading-bg") || token("--z-canvas");
  const accent = token("--z-accent");
  const fg = token("--z-fg");
  const muted = token("--z-fg-muted");
  const line = token("--z-line-strong");
  const sans = token("--z-font-sans") || "sans-serif";

  ctx.fillStyle = surface;
  ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);

  // Franjas de acento con distinta opacidad: cada portada tiene un patrón propio.
  ctx.fillStyle = accent;
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = 0.1 + ((i + index) % 4) * 0.12;
    const x = 40 + i * 96;
    const h = 60 + (((i + 1) * (index + 3) * 37) % 170);
    ctx.fillRect(x, COVER_HEIGHT - 48 - h, 64, h);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, COVER_WIDTH - 2, COVER_HEIGHT - 2);

  ctx.fillStyle = fg;
  ctx.font = `700 56px ${sans}`;
  ctx.textBaseline = "top";
  ctx.fillText(project.name, 40, 36);
  ctx.fillStyle = muted;
  ctx.font = `500 26px ${sans}`;
  ctx.fillText(`${project.owner} · ${project.progress}%`, 40, 104);
  return canvas;
}
