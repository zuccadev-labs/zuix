// Color para la validación: lee los valores CSS que usan los tokens (hex, rgb(), color-mix() en sRGB, palabras
// clave), los compone por capas y mide el contraste WCAG 2.x. Sin dependencias.
// Un color es [r, g, b, a] con r, g, b en 0–255 y a en 0–1.

const NAMED = { transparent: [0, 0, 0, 0], white: [255, 255, 255, 1], black: [0, 0, 0, 1] };

/** Parte `text` por las comas de primer nivel (fuera de paréntesis). */
export function splitTop(text, separator = ",") {
  const parts = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim());
}

const channel = (v) => (v.endsWith("%") ? (parseFloat(v) / 100) * 255 : parseFloat(v));
const alpha = (v) => (v === undefined ? 1 : v.endsWith("%") ? parseFloat(v) / 100 : parseFloat(v));

/**
 * Color de un valor CSS, o `null` si no es un color que esta validación sepa leer. Un valor con forma de color
 * y un número que no lo es (`rgb(0 0 1e999)`, `color-mix(in srgb, white ..%, black)`) también es `null`: un
 * canal `NaN` o infinito daría un contraste `NaN`, que no es menor que ningún umbral y pasaría la validación.
 */
export function parseColor(value) {
  const color = readColor(value);
  return color?.every(Number.isFinite) ? color : null;
}

function readColor(value) {
  const v = String(value).trim().toLowerCase();
  // `in` encontraría también lo heredado de Object.prototype (`constructor`, `__proto__`).
  if (Object.hasOwn(NAMED, v)) return [...NAMED[v]];
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m && [3, 4, 6, 8].includes(m[1].length)) {
    const h = m[1].length <= 4 ? [...m[1]].map((c) => c + c).join("") : m[1];
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = v.match(/^rgba?\((.*)\)$/);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean);
    if (p.length < 3 || p.some((x) => Number.isNaN(parseFloat(x)))) return null;
    return [channel(p[0]), channel(p[1]), channel(p[2]), alpha(p[3])];
  }
  m = v.match(/^color-mix\((.*)\)$/);
  if (m) {
    const [space, a, b] = splitTop(m[1]);
    if (!/^in\s+srgb$/.test(space ?? "") || a === undefined || b === undefined) return null;
    const side = (text) => {
      const pct = text.match(/\s(-?[\d.]+)%$/);
      return { color: readColor(pct ? text.slice(0, pct.index) : text), pct: pct ? parseFloat(pct[1]) : null };
    };
    const [x, y] = [side(a), side(b)];
    if (!x.color || !y.color) return null;
    // CSS Color 5, § 3.1: porcentajes omitidos, normalización y multiplicador de alfa si suman menos de 100.
    let [p1, p2] = [x.pct, y.pct];
    if (p1 === null && p2 === null) p1 = p2 = 50;
    else if (p1 === null) p1 = 100 - p2;
    else if (p2 === null) p2 = 100 - p1;
    const sum = p1 + p2;
    if (sum <= 0) return null;
    const scale = sum < 100 ? sum / 100 : 1;
    [p1, p2] = [p1 / sum, p2 / sum];
    const a2 = x.color[3] * p1 + y.color[3] * p2;
    const mix = (i) => (a2 === 0 ? 0 : (x.color[i] * x.color[3] * p1 + y.color[i] * y.color[3] * p2) / a2);
    return [mix(0), mix(1), mix(2), a2 * scale];
  }
  return null;
}

/** `top` pintado sobre `bottom` (composición normal). */
export function over(top, bottom) {
  const a = top[3] + bottom[3] * (1 - top[3]);
  if (a === 0) return [0, 0, 0, 0];
  const c = (i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a;
  return [c(0), c(1), c(2), a];
}

/** Compone una pila de capas, de abajo arriba. La primera debe ser opaca para que el resultado lo sea. */
export const flatten = (layers) => layers.reduce((acc, layer) => over(layer, acc));

/** Luminancia relativa (WCAG 2.2, «relative luminance»). */
export function luminance(c) {
  const f = (x) => {
    x /= 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

/** Razón de contraste WCAG 2.x entre dos colores opacos. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const toHex = (c) =>
  `#${[0, 1, 2]
    .map((i) =>
      Math.round(Math.max(0, Math.min(255, c[i])))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

/**
 * Colores opacos que puede tener el fondo de aplicación: el color plano y los extremos del degradado
 * (cada parada del degradado lineal y cada mancha radial pintada sobre ellas). Es una cota conservadora:
 * el desenfoque del cristal promedia el fondo, así que el contraste real queda entre estos extremos.
 */
export function canvasCandidates(flat, gradient) {
  const out = flat ? [flat] : [];
  const layers = gradient ? splitTop(gradient) : [];
  const stops = (layer) =>
    splitTop(layer.replace(/^[a-z-]+\(/, "").replace(/\)$/, ""))
      .map((s) => parseColor(s.replace(/\s+-?[\d.]+%$/, "")))
      .filter(Boolean);
  const linear = layers
    .filter((l) => l.startsWith("linear-gradient("))
    .flatMap(stops)
    .filter((c) => c[3] === 1);
  const spots = layers
    .filter((l) => l.startsWith("radial-gradient("))
    .flatMap(stops)
    .filter((c) => c[3] > 0);
  const bases = linear.length ? linear : out;
  out.push(...linear);
  for (const base of bases) for (const spot of spots) out.push(over(spot, base));
  return out;
}
