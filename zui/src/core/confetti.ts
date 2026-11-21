// Confetti: física ligera de partículas (posición, velocidad, gravedad, rozamiento, giro y vaivén) para el lienzo de
// `confetti()`. Determinista con la semilla dada. Sin documento.

export interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Ángulo y velocidad de giro (radianes). */
  rot: number;
  spin: number;
  /** Fase del vaivén (el papel que cae oscilando). */
  wobble: number;
  size: number;
  /** Índice del color (0 … colores − 1). */
  color: number;
  shape: "rect" | "circle";
  /** Vida restante de 1 a 0. */
  life: number;
}

export interface BurstOptions {
  /** Partículas (1–400). */
  count?: number;
  /** Origen en píxeles de la ventana. */
  x: number;
  y: number;
  /** Dirección media en grados (0 a la derecha, −90 hacia arriba). */
  angle?: number;
  /** Apertura en grados. */
  spread?: number;
  /** Velocidad inicial en px por fotograma de 16 ms. */
  velocity?: number;
  /** Número de colores para repartir. */
  colors?: number;
  /** Semilla del generador (para pruebas y reproducibilidad). */
  seed?: number;
}

/** Generador pseudoaleatorio determinista (mulberry32). */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function burst(o: BurstOptions): ConfettiParticle[] {
  const rand = random(o.seed ?? Date.now());
  const count = Math.max(1, Math.min(400, Math.round(o.count ?? 120)));
  const angle = ((o.angle ?? -90) * Math.PI) / 180;
  const spread = ((o.spread ?? 70) * Math.PI) / 180;
  const velocity = o.velocity ?? 12;
  const colors = Math.max(1, Math.round(o.colors ?? 6));
  return Array.from({ length: count }, (_, i) => {
    const a = angle + (rand() - 0.5) * spread;
    const v = velocity * (0.55 + rand() * 0.6);
    return {
      x: o.x,
      y: o.y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      rot: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 0.4,
      wobble: rand() * Math.PI * 2,
      size: 5 + rand() * 6,
      color: i % colors,
      shape: rand() < 0.3 ? "circle" : "rect",
      life: 1,
    };
  });
}

export interface StepOptions {
  /** Fotogramas de 16 ms transcurridos (1 a 60 fps). */
  dt?: number;
  gravity?: number;
  drag?: number;
  /** Fotogramas de vida (por defecto 180, unos 3 s). */
  ticks?: number;
}

/** Avanza la simulación en el sitio. Devuelve cuántas partículas siguen vivas. */
export function step(particles: ConfettiParticle[], o: StepOptions = {}): number {
  const dt = Math.min(4, Math.max(0, o.dt ?? 1));
  const gravity = o.gravity ?? 0.35;
  const drag = Math.pow(o.drag ?? 0.985, dt);
  const decay = dt / (o.ticks ?? 180);
  let alive = 0;
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.vx *= drag;
    p.vy = p.vy * drag + gravity * dt;
    p.wobble += 0.12 * dt;
    p.x += (p.vx + Math.cos(p.wobble) * 0.6) * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    p.life = Math.max(0, p.life - decay);
    if (p.life > 0) alive++;
  }
  return alive;
}
