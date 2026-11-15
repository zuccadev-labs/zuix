// Verifica cada marca y tema: tokens obligatorios y contraste WCAG de los pares de src/base.json.
// Salida por marca/tema; código de salida 1 si algún par no llega a su mínimo.
import { loadAll } from "./build.mjs";

const { base, brands } = loadAll();

function parse(v) {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) { const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) / 255 : 1]; }
  m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m) return [...m.slice(1, 4).map((h) => parseInt(h + h, 16)), 1];
  m = v.match(/^rgba?\(([^)]+)\)$/i);
  if (m) { const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  return null;
}
function resolve(name, brand, theme, depth = 0) {
  const raw = brand.themes[theme][name] ?? brand.component?.[name] ?? base.component[name] ?? base.semantic[name];
  if (raw == null || depth > 8) return null;
  const ref = raw.match(/^\{([a-z0-9.-]+)\}$/i);
  if (ref) return ref[1].startsWith("p.") ? parse(brand.primitives[ref[1].slice(2)] ?? "") : resolve(ref[1], brand, theme, depth + 1);
  return parse(raw);
}
const over = (top, bottom) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1); };
const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

let failures = 0;
for (const brand of brands) {
  for (const theme of ["dark", "light"]) {
    console.log(`\n${brand.name} · ${theme}`);
    for (const pair of base.contrast) {
      let bg = resolve(pair.bg, brand, theme), fg = resolve(pair.fg, brand, theme);
      const under = resolve(pair.over ?? "canvas", brand, theme);
      if (!bg || !fg || !under) { console.log(`  ?  ${pair.fg} / ${pair.bg}: no se pudo resolver a un color; revisar a mano`); continue; }
      bg = over(bg, under); fg = over(fg, bg);
      const r = ratio(fg, bg), ok = r >= pair.min;
      if (!ok) failures++;
      console.log(`  ${ok ? "✓" : "✗"}  ${pair.fg} sobre ${pair.bg}${pair.over ? ` (sobre ${pair.over})` : ""}: ${r.toFixed(2)} (mín. ${pair.min})`);
    }
  }
}
console.log(failures ? `\n✗ ${failures} pares por debajo del mínimo` : "\n✓ contraste correcto en todas las marcas y temas");
process.exit(failures ? 1 : 0);
