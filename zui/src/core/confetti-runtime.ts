// `confetti()`: lanza una ráfaga de confeti en un lienzo fijo sobre la página (sin capturar el puntero ni el foco),
// con los colores de la marca (`--z-chart-1…8`). Con movimiento reducido no anima nada. Se detiene sola al acabar
// o con la pestaña oculta. Toca el documento solo al llamarse.

import { burst, step, type ConfettiParticle } from "./confetti";

export interface ConfettiOptions {
  /** Origen: un elemento (su centro) o un punto en fracciones de la ventana ({ x: 0.5, y: 0.6 }). */
  origin?: Element | { x: number; y: number };
  count?: number;
  /** Dirección media en grados (−90 hacia arriba). */
  angle?: number;
  spread?: number;
  velocity?: number;
  /** Colores CSS propios; por defecto, los tokens de gráfico de la marca. */
  colors?: readonly string[];
  /** Duración aproximada en milisegundos (por defecto 3000). */
  duration?: number;
  /** Anima aunque la persona pida movimiento reducido (no recomendable). */
  ignoreReducedMotion?: boolean;
}

function brandColors(doc: Document): string[] {
  const style = getComputedStyle(doc.documentElement);
  const list = Array.from({ length: 8 }, (_, i) => style.getPropertyValue(`--z-chart-${i + 1}`).trim()).filter(Boolean);
  if (list.length) return list;
  const accent = style.getPropertyValue("--z-accent").trim();
  return accent ? [accent] : ["currentColor"];
}

/** Lanza confeti. La promesa se resuelve cuando termina (o al momento, con movimiento reducido). */
export function confetti(options: ConfettiOptions = {}, doc: Document = document): Promise<void> {
  const win = doc.defaultView;
  if (!win) return Promise.resolve();
  if (!options.ignoreReducedMotion && win.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  const vw = doc.documentElement.clientWidth;
  const vh = doc.documentElement.clientHeight;
  let x = vw / 2;
  let y = vh * 0.6;
  if (options.origin instanceof win.Element) {
    const r = options.origin.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else if (options.origin) {
    x = options.origin.x * vw;
    y = options.origin.y * vh;
  }
  const colors = options.colors?.length ? [...options.colors] : brandColors(doc);
  const ticks = Math.max(30, Math.round((options.duration ?? 3000) / 16.67));
  const particles: ConfettiParticle[] = burst({
    x,
    y,
    count: options.count,
    angle: options.angle,
    spread: options.spread,
    velocity: options.velocity,
    colors: colors.length,
  });
  const canvas = doc.createElement("canvas");
  canvas.className = "z-confetti";
  canvas.setAttribute("aria-hidden", "true");
  const dpr = win.devicePixelRatio || 1;
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  doc.body.append(canvas);
  const ctx = canvas.getContext("2d");
  return new Promise((resolve) => {
    let last = win.performance.now();
    let frame = 0;
    const finish = () => {
      win.cancelAnimationFrame(frame);
      doc.removeEventListener("visibilitychange", onHidden);
      canvas.remove();
      resolve();
    };
    const onHidden = () => {
      if (doc.visibilityState === "hidden") finish();
    };
    doc.addEventListener("visibilitychange", onHidden);
    const draw = (now: number) => {
      const dt = (now - last) / 16.67;
      last = now;
      const alive = step(particles, { dt, ticks });
      if (!ctx || alive === 0) return finish();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, vw, vh);
      for (const p of particles) {
        if (p.life <= 0 || p.y > vh + 40) continue;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.fillStyle = colors[p.color % colors.length]!;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      frame = win.requestAnimationFrame(draw);
    };
    frame = win.requestAnimationFrame(draw);
  });
}
