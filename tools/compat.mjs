#!/usr/bin/env node
// Modo compat: hojas CSS alternativas para navegadores por debajo del suelo de la suite. Objetivo: Chromium 109,
// Safari 15.4 y Firefox 115. Lo ejecuta tools/dist.mjs después de empaquetar las hojas normales; escribe:
//   tokens/dist/tokens.compat.css           todas las marcas          tokens/dist/brands/<marca>.compat.css
//   zui/dist/zui.compat.css                 componentes               zout/dist/zout.compat.css   layouts
// Qué cambia respecto a la hoja normal:
//   - color-mix() desaparece. En los tokens se calcula para cada marca, tema y preferencia (@media) y se escribe
//     el color resultante. En los componentes cada mezcla pasa a ser una variable `--z-compat-<hash>` que los
//     tokens compat definen ya resuelta; una mezcla sobre una variable local (el tono de un Chip, el color de un
//     evento) se resuelve para cada valor que el CSS le asigna, al lado de la asignación. Si la variable llega de
//     otro sitio (un estilo en línea), queda la aproximación del `var(…, respaldo)`: el color dominante de la mezcla.
//   - @layer se aplana en el orden de las capas (las subcapas antes que las reglas propias de la capa, las reglas
//     sin capa al final) y las declaraciones !important se reordenan al revés, como las trata la cascada.
//   - lightningcss resuelve el anidado y baja lo demás que el objetivo no entiende (consultas de rango,
//     oklch(), round()…).
//   - :popover-open admite también la clase `.\:popover-open` que pone @oddbird/popover-polyfill, y sin Popover API
//     una capa cerrada se oculta (no tiene el estilo del navegador que lo hace); :dir(rtl) pasa
//     a [dir="rtl"]; cada @property deja su valor inicial en una regla normal (Firefox 115 y Safari 15.4 no lo
//     registran).
//   - Sin :has() (Firefox 115), los anillos de foco que dependen de él se dibujan con :focus-within.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Features, transform } from "lightningcss";
import { splitTop } from "../tokens/src/color.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Navegadores objetivo del modo compat (formato de lightningcss: versión mayor y menor en un entero). */
export const TARGET = { chrome: "109", edge: "109", firefox: "115", safari: "15.4", ios_saf: "15.4" };
const encode = (v) => {
  const [major, minor = 0] = v.split(".").map(Number);
  return (major << 16) | (minor << 8);
};
export const targets = Object.fromEntries(Object.entries(TARGET).map(([k, v]) => [k, encode(v)]));

const PREFIX = "--z-compat-";
const hash = (text) => createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 8);
const fail = (msg) => {
  throw new Error(`compat: ${msg}`);
};

// ── Texto CSS ────────────────────────────────────────────────────────────────────────────────────────────

/** Cierre del paréntesis que abre en `open` (índice del "("). */
function closing(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  fail(`paréntesis sin cerrar: ${text.slice(open, open + 80)}`);
}

/** Llamadas de primer nivel a `name(` en `text`: [{ start, end, text }] (`end` excluido). */
export function calls(text, name) {
  const out = [];
  const re = new RegExp(`(?<![\\w-])${name}\\(`, "gi");
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const end = closing(text, m.index + name.length) + 1;
    out.push({ start: m.index, end, text: text.slice(m.index, end) });
    re.lastIndex = end;
  }
  return out;
}

/** Sustituye cada llamada de primer nivel a `name(` por `fn(texto)`. */
const replaceCalls = (text, name, fn) => {
  let out = "";
  let last = 0;
  for (const c of calls(text, name)) {
    out += text.slice(last, c.start) + fn(c.text);
    last = c.end;
  }
  return out + text.slice(last);
};

/** Variables a las que se refiere un valor (también dentro de respaldos). */
export const varRefs = (text) => [...new Set([...text.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]))];

/**
 * Sustituye cada `var(--x, respaldo)` por `lookup("--x")` o, si no está, por el respaldo. Recursivo: el valor de
 * una variable puede referirse a otras. Lanza si una variable no tiene valor ni respaldo.
 */
export function substitute(text, lookup, seen = new Set()) {
  return replaceCalls(text, "var", (call) => {
    const [name, ...rest] = splitTop(call.slice(4, -1));
    const value = seen.has(name) ? undefined : lookup(name);
    if (value !== undefined) return substitute(value, lookup, new Set([...seen, name]));
    if (rest.length) return substitute(rest.join(","), lookup, seen);
    fail(`${name} no tiene valor en este contexto (${call})`);
  });
}

/** `calc()` solo con números y porcentajes (`calc(8% * 0.55)`) → `4.4%`. Lo demás queda igual. */
export function foldCalc(text) {
  return replaceCalls(text, "calc", (call) => {
    const body = call.slice(5, -1);
    if (!/^[\d.\s%*/+\-()]+$/.test(body)) return call;
    const percent = body.includes("%");
    const tokens = body.match(/\d*\.?\d+%?|[*/+\-()]/g) ?? [];
    let i = 0;
    const atom = () => {
      const t = tokens[i++];
      if (t === "(") {
        const v = sum();
        i++;
        return v;
      }
      if (t === "-") return -atom();
      return parseFloat(t);
    };
    const product = () => {
      let v = atom();
      while (tokens[i] === "*" || tokens[i] === "/") v = tokens[i++] === "*" ? v * atom() : v / atom();
      return v;
    };
    const sum = () => {
      let v = product();
      while (tokens[i] === "+" || tokens[i] === "-") v = tokens[i++] === "+" ? v + product() : v - product();
      return v;
    };
    const value = sum();
    if (!Number.isFinite(value) || i !== tokens.length) return call;
    return `${Number(value.toFixed(4))}${percent ? "%" : ""}`;
  });
}

/** Partes de `color-mix(in <espacio>, A [p%], B [q%])`: { space, sides: [{ color, pct }] }. */
function mixParts(call) {
  const [space, ...sides] = splitTop(call.slice("color-mix(".length, -1));
  return {
    space,
    // El porcentaje puede ser un calc(): entonces no se sabe cuánto pesa (`pct: null`).
    sides: sides.map((s) => {
      const m = s.match(/^(.*?)\s+(-?[\d.]+%|calc\(.*\))$/s);
      if (!m) return { color: s.trim(), pct: null };
      return { color: m[1].trim(), pct: m[2].endsWith("%") ? parseFloat(m[2]) : null };
    }),
  };
}

/**
 * Aproximación de una mezcla que no se puede calcular de antemano: el color que más pesa (el primero si empatan).
 * `rgb(var(--v)) p%` con `transparent` se escribe como `rgb(var(--v) / p%)`, que es exacto.
 */
export function approximate(call) {
  const { sides } = mixParts(call);
  const [a, b] = sides;
  if (!a || !b) return call;
  const triplet = (side, other) =>
    /^rgb\(\s*var\(--[\w-]+\)\s*\)$/.test(side.color) && other.color === "transparent" && side.pct !== null
      ? `${side.color.slice(0, -1)} / ${side.pct}%)`
      : null;
  const exact = triplet(a, b) ?? triplet(b, a);
  if (exact) return exact;
  const pa = a.pct ?? (b.pct === null ? 50 : 100 - b.pct);
  const pb = b.pct ?? 100 - pa;
  const pick = (pa >= pb ? a : b).color;
  return /color-mix\(/i.test(pick) ? replaceCalls(pick, "color-mix", approximate) : pick;
}

// ── Evaluación de color-mix() con valores estáticos ─────────────────────────────────────────────────────

const evaluated = new Map();
/** Color estático de una mezcla sin variables, calculado por lightningcss para el objetivo (sRGB, con alfa). */
export function evaluateMix(expr) {
  const key = foldCalc(expr);
  if (evaluated.has(key)) return evaluated.get(key);
  const out = transform({ filename: "mix.css", code: Buffer.from(`a{color:${key}}`), targets, minify: true }).code.toString();
  const value = out.match(/^a\{color:([^;}]+)/)?.[1];
  if (!value || /color-mix\(/i.test(value)) fail(`no se puede calcular de antemano: ${expr}`);
  evaluated.set(key, value);
  return value;
}

/** Sustituye en `value` cada color-mix() por su color estático, con las variables resueltas por `lookup`. */
const staticValue = (value, lookup) => replaceCalls(value, "color-mix", (call) => evaluateMix(substitute(call, lookup)));

// ── Hojas de tokens ──────────────────────────────────────────────────────────────────────────────────────

/** Hoja de tokens (generada, plana): [{ media, selectors, decls: [{ prop, value }] }]. */
export function parseTokens(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const block = (from, media) => {
    let i = from;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      const close = text.indexOf("}", i);
      if (close !== -1 && (open === -1 || close < open)) return close + 1;
      if (open === -1) return text.length;
      const head = text.slice(i, open).trim();
      if (head.startsWith("@media")) {
        if (media) fail(`@media anidado: ${head}`);
        i = block(open + 1, head.slice(6).trim());
        continue;
      }
      if (head.startsWith("@")) fail(`regla no admitida en una hoja de tokens: ${head}`);
      const end = text.indexOf("}", open);
      const decls = text
        .slice(open + 1, end)
        .split(";")
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => {
          const colon = d.indexOf(":");
          return { prop: d.slice(0, colon).trim(), value: d.slice(colon + 1).trim() };
        });
      rules.push({ media, selectors: splitTop(head), decls });
      i = end + 1;
    }
    return i;
  };
  block(0, null);
  return rules;
}

/** ¿El selector compuesto (`:root`, `[a]`, `[a="v"]`, `:not(…)`) coincide con un :root con esos atributos? */
export function matchRoot(selector, attrs) {
  let rest = selector.trim();
  if (!rest.startsWith(":root")) fail(`selector de tokens fuera de :root: ${selector}`);
  while (rest) {
    let m = rest.match(/^:root/) ?? rest.match(/^\[([\w-]+)(?:="([^"]*)")?\]/);
    if (m?.[1]) {
      if (!Object.hasOwn(attrs, m[1]) || (m[2] !== undefined && attrs[m[1]] !== m[2])) return false;
    } else if (!m && rest.startsWith(":not(")) {
      const end = closing(rest, 4);
      if (matchRoot(`:root${rest.slice(5, end)}`, attrs)) return false;
      m = [rest.slice(0, end + 1)];
    } else if (!m) fail(`selector de tokens no admitido: ${selector}`);
    rest = rest.slice(m[0].length);
  }
  return true;
}

/** Especificidad de un selector de :root: todo lo que admite matchRoot pesa como una clase. */
export const rootSpecificity = (selector) => (selector.match(/:root|\[[^\]]+\]/g) ?? []).length;

/**
 * Versión compat de una hoja de tokens. `extra` son variables más que definir en :root (las mezclas de los
 * componentes), como { nombre: valor }. Devuelve el CSS.
 */
export function compatTokens(css, extra = {}) {
  const rules = parseTokens(css);
  const decls = [];
  for (const [r, rule] of rules.entries()) for (const d of rule.decls) decls.push({ ...d, rule: r, order: decls.length });
  const brands = [...new Set([...css.matchAll(/\[data-brand="([^"]+)"\]/g)].map((m) => m[1]))];
  const themes = [...new Set([...css.matchAll(/\[data-theme="([^"]+)"\]/g)].map((m) => m[1]))];
  const flags = [...new Set(rules.map((r) => r.media).filter(Boolean))];
  for (const f of flags) if (!/^\([\w-]+:\s*[\w-]+\)$/.test(f)) fail(`condición @media compuesta: ${f}`);
  const OTHER = "zz-compat";

  // Contexto: atributos de :root y condiciones @media que se cumplen. Ganador por propiedad: especificidad y orden.
  const winners = (brand, theme, on) => {
    const attrs = {};
    if (brand) attrs["data-brand"] = brand;
    if (theme) attrs["data-theme"] = theme;
    const win = new Map();
    for (const d of decls) {
      const rule = rules[d.rule];
      if (rule.media && !on.has(rule.media)) continue;
      const spec = Math.max(-1, ...rule.selectors.filter((s) => matchRoot(s, attrs)).map(rootSpecificity));
      if (spec < 0) continue;
      const prev = win.get(d.prop);
      if (!prev || spec > prev.spec || (spec === prev.spec && d.order > prev.order)) win.set(d.prop, { ...d, spec });
    }
    for (const [prop, value] of Object.entries(extra)) win.set(prop, { prop, value, spec: 0, order: -1 });
    return win;
  };
  const mixed = new Set([...decls.filter((d) => /color-mix\(/i.test(d.value)).map((d) => d.prop), ...Object.keys(extra)]);
  /** Valor de cada propiedad afectada en un contexto: la mezcla calculada, o el valor declarado si no es una mezcla. */
  const resolveAll = (brand, theme, on) => {
    const win = winners(brand, theme, on);
    const lookup = (name) => win.get(name)?.value;
    const out = new Map();
    for (const prop of mixed) {
      const w = win.get(prop);
      if (w) out.set(prop, /color-mix\(/i.test(w.value) ? staticValue(w.value, lookup) : w.value);
    }
    return out;
  };

  const combos = flags
    .reduce((acc, f) => acc.flatMap((c) => [c, [...c, f]]), [[]])
    .sort((a, b) => a.length - b.length || flags.indexOf(a[0]) - flags.indexOf(b[0]));
  const brandList = [undefined, ...brands];
  // Un valor de data-theme que la hoja no nombra es un contexto más (va al lado del de sin atributo, que suele dar
  // lo mismo: lightningcss junta las reglas iguales y contiguas).
  const themeList = [undefined, OTHER, ...themes];
  const brandSel = (b) => (b ? `[data-brand="${b}"]` : brands.map((x) => `:not([data-brand="${x}"])`).join(""));
  const themeSel = (t) =>
    t === undefined
      ? ":not([data-theme])"
      : t === OTHER
        ? `[data-theme]${themes.map((x) => `:not([data-theme="${x}"])`).join("")}`
        : `[data-theme="${t}"]`;
  const selectors = [];
  for (const b of brandList) for (const t of themeList) selectors.push({ b, t, sel: `:root${brandSel(b)}${themeSel(t)}` });
  const top = Math.max(...selectors.map((s) => rootSpecificity(s.sel)), ...rules.flatMap((r) => r.selectors.map(rootSpecificity)));
  for (const s of selectors) s.sel += ":root".repeat(top - rootSpecificity(s.sel));

  // Reglas añadidas, de menos a más condiciones: cada una escribe solo lo que no daban ya las anteriores que le aplican.
  const emitted = [];
  for (const combo of combos) {
    for (const { b, t, sel } of selectors) {
      const target = resolveAll(b, t, new Set(combo));
      const current = new Map();
      for (const e of emitted)
        if (e.b === b && e.t === t && e.combo.every((f) => combo.includes(f))) for (const [k, v] of e.values) current.set(k, v);
      const values = new Map([...target].filter(([k, v]) => current.get(k) !== v));
      if (values.size) emitted.push({ b, t, combo, sel, values });
    }
  }

  const body = (ds) => ds.map((d) => `  ${d.prop}: ${d.value};`).join("\n");
  let out = "";
  for (const rule of rules) {
    const ds = rule.decls.filter((d) => !/color-mix\(/i.test(d.value));
    if (!ds.length) continue;
    const r = `${rule.selectors.join(",\n")} {\n${body(ds)}\n}\n`;
    out += rule.media ? `@media ${rule.media} {\n${r}}\n` : r;
  }
  out += "/* Mezclas de color resueltas para cada marca, tema y preferencia */\n";
  for (const e of emitted) {
    const r = `${e.sel} {\n${body([...e.values].map(([prop, value]) => ({ prop, value })))}\n}\n`;
    out += e.combo.length ? `@media ${e.combo.join(" and ")} {\n${r}}\n` : r;
  }
  return out;
}

// ── Hojas de componentes ─────────────────────────────────────────────────────────────────────────────────

/** Propiedades personalizadas que declara una hoja. */
export const declaredProps = (css) => new Set([...css.matchAll(/(?<![\w-])(--[\w-]+)\s*:/g)].map((m) => m[1]));

/**
 * Saca de una hoja de componentes cada color-mix(). `globals` son las variables de los tokens y `locals` las
 * que declara el CSS de componentes (tono de un Chip, color de un evento…). Devuelve { css, mixes }: `mixes`
 * son las variables `--z-compat-*` que los tokens compat deben definir en :root ({ nombre: mezcla }).
 */
export function hoistMixes(css, globals, locals) {
  const mixes = {};
  const isGlobal = (expr) =>
    !/currentcolor/i.test(expr) && varRefs(expr).every((r) => (globals.has(r) && !locals.has(r)) || r.startsWith(PREFIX));
  const hoist = (expr) => {
    const name = `${PREFIX}${hash(expr)}`;
    mixes[name] = expr.replace(/\s+/g, " ");
    return name;
  };
  // Asignaciones `--local: valor` de la hoja, para resolver las mezclas sobre variables locales junto a ellas.
  const assignments = new Map();
  for (const m of css.matchAll(/(?<=[{;\s])(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    if (!locals.has(m[1])) continue;
    if (!assignments.has(m[1])) assignments.set(m[1], new Set());
    assignments.get(m[1]).add(m[2].trim());
  }
  const siblings = new Map(); // variable local → [[nombre compat, valor]] que se declaran a su lado

  const replaced = replaceCalls(css, "color-mix", (call) => {
    if (isGlobal(call)) return `var(${hoist(call)}, ${approximate(call)})`;
    const local = varRefs(call).filter((r) => !(globals.has(r) && !locals.has(r)));
    if (local.length !== 1 || /currentcolor/i.test(call)) return approximate(call);
    const [name] = local;
    const own = `${PREFIX}${hash(call)}`;
    for (const value of assignments.get(name) ?? []) {
      // `--z-chip-tone: var(--z-danger)` → al lado, `--z-compat-<mezcla>: <la mezcla con ese tono>`.
      const expr = replaceCalls(call, "var", (v) => (splitTop(v.slice(4, -1))[0] === name ? value : v));
      // Un valor que no se puede resolver corta la herencia (`initial`): sin eso, el elemento usaría la mezcla de un
      // ancestro con otro tono en vez del respaldo del `var()`.
      const resolved = !varRefs(expr).length ? evaluateMix(expr) : isGlobal(expr) ? `var(${hoist(expr)})` : "initial";
      if (!siblings.has(name)) siblings.set(name, new Map());
      siblings.get(name).set(`${value}\u0000${own}`, [own, resolved]);
    }
    return `var(${own}, ${approximate(call)})`;
  });

  // Las declaraciones hermanas van detrás de cada asignación, en la misma regla.
  const out = replaced.replace(/(?<=[{;\s])(--[\w-]+)\s*:\s*([^;{}]+);/g, (all, name, value) => {
    const list = siblings.get(name);
    if (!list) return all;
    const extra = [...list]
      .filter(([key]) => key.startsWith(`${value.trim()}\u0000`))
      .map(([, [own, resolved]]) => ` ${own}: ${resolved};`)
      .join("");
    return all + extra;
  });
  return { css: out, mixes };
}

/** Selectores que el objetivo no entiende, reescritos a algo que sí. */
export function rewriteSelectors(css) {
  return css
    .replace(/(?<!\\):popover-open\b/g, ":is(:popover-open, .\\:popover-open)")
    .replace(/:dir\(rtl\)/g, ':is([dir="rtl"], [dir="rtl"] *)')
    .replace(/:dir\(ltr\)/g, ':not(:is([dir="rtl"], [dir="rtl"] *))');
}

/** Valor inicial de cada @property como declaración normal (sin registro, la variable no tendría valor). */
export function propertyDefaults(css) {
  const inherit = [];
  const own = [];
  for (const m of css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)) {
    const initial = m[2].match(/initial-value:\s*([^;]+)/)?.[1]?.trim();
    if (initial === undefined) continue;
    (/inherits:\s*true/.test(m[2]) ? inherit : own).push(`  ${m[1]}: ${initial};`);
  }
  let out = "";
  if (inherit.length) out += `:root {\n${inherit.join("\n")}\n}\n`;
  if (own.length) out += `*, ::before, ::after {\n${own.join("\n")}\n}\n`;
  return out;
}

/**
 * Sin Popover API, una capa `[popover]` cerrada no tiene el estilo del navegador que la oculta: el menú aparecería en
 * el flujo de la página. Con @oddbird/popover-polyfill, oculta también mientras el polyfill carga.
 */
export const POPOVER_HIDDEN = "@supports not selector(:popover-open) {\n  [popover]:not(.\\:popover-open) {\n    display: none;\n  }\n}\n";

/**
 * Sin :has() (Firefox 115) el contenedor no dibuja el anillo de foco de su enlace o control interior. Este
 * respaldo lo dibuja con :focus-within, también cuando el foco llega con el ratón.
 */
export function hasFallback(css) {
  const rules = [];
  for (const m of css.matchAll(/([^{};]+):has\(([^(){}]*):focus-visible\)\s*\{([^}]*)\}/g)) {
    if (!/(^|[;\s])outline:/.test(m[3])) continue;
    const host = m[1].trim();
    if (/:has\(/.test(host)) continue;
    rules.push(`  ${host}:focus-within {${m[3].trimEnd()}\n  }`);
  }
  return rules.length ? `@supports not selector(:has(a)) {\n${[...new Set(rules)].join("\n")}\n}\n` : "";
}

/**
 * lightningcss 1.33 no vuelve a leer un `null` de su propio AST en un campo opcional (`var(--x)` lleva
 * `from: null`): «expected an object-like struct named Specifier, found ()». Sin la clave, lo lee como ausente.
 */
const dropNulls = (o) => {
  if (Array.isArray(o)) for (const x of o) dropNulls(x);
  else if (o && typeof o === "object")
    for (const k of Object.keys(o)) {
      if (o[k] === null) delete o[k];
      else dropNulls(o[k]);
    }
  return o;
};

/**
 * Aplana @layer: cada regla va al grupo de su capa, los grupos en el orden de la cascada (subcapas antes que las
 * reglas propias de la capa; lo que no tiene capa, al final) y las declaraciones !important, en otra copia de la
 * regla, en orden inverso de capas al final de la hoja.
 */
export function flattenLayers(code) {
  const tree = { name: "", children: new Map(), rules: [] };
  const node = (path) => {
    let n = tree;
    for (const part of path) {
      if (!n.children.has(part)) n.children.set(part, { name: part, children: new Map(), rules: [] });
      n = n.children.get(part);
    }
    return n;
  };
  const wrap = (wrappers, rule) => wrappers.reduceRight((inner, w) => ({ ...w, value: { ...w.value, rules: [inner] } }), rule);
  const hasLayer = (rules) => rules.some((r) => r.type === "layer-block" || r.type === "layer-statement" || hasLayer(r.value?.rules ?? []));
  const collect = (rules, path, wrappers) => {
    for (const rule of rules) {
      if (rule.type === "layer-statement") {
        for (const name of rule.value.names) node([...path, ...name]);
      } else if (rule.type === "layer-block") {
        const name = rule.value.name ?? [`anonymous-${Math.random()}`];
        node([...path, ...name]);
        collect(rule.value.rules, [...path, ...name], wrappers);
      } else if (Array.isArray(rule.value?.rules) && rule.type !== "style" && hasLayer(rule.value.rules)) {
        collect(rule.value.rules, path, [...wrappers, rule]);
      } else node(path).rules.push(wrap(wrappers, rule));
    }
  };
  const groups = [];
  const order = (n) => {
    for (const child of n.children.values()) order(child);
    groups.push(n);
  };
  // Con `targets`, que también decide cómo se escribe (sin ellos saldrían consultas de rango), pero sin volver a
  // añadir prefijos: la hoja ya viene bajada y se duplicarían en los valores con var().
  return transform({
    filename: "compat.css",
    code: Buffer.from(code),
    targets,
    exclude: Features.VendorPrefixes,
    visitor: {
      StyleSheetExit(sheet) {
        collect(sheet.rules, [], []);
        order(tree);
        const split = (rule, important) => {
          if (rule.type === "style") {
            const d = rule.value.declarations ?? { declarations: [], importantDeclarations: [] };
            const keep = important ? d.importantDeclarations : d.declarations;
            if (!keep?.length && !(rule.value.rules ?? []).length) return null;
            return {
              ...rule,
              value: {
                ...rule.value,
                declarations: important
                  ? { declarations: [], importantDeclarations: keep }
                  : { declarations: keep, importantDeclarations: [] },
              },
            };
          }
          if (Array.isArray(rule.value?.rules) && rule.type !== "keyframes") {
            const inner = rule.value.rules.map((r) => split(r, important)).filter(Boolean);
            return inner.length ? { ...rule, value: { ...rule.value, rules: inner } } : null;
          }
          return important ? null : rule;
        };
        const normal = groups.flatMap((g) => g.rules.map((r) => split(r, false)).filter(Boolean));
        const important = [...groups].reverse().flatMap((g) => g.rules.map((r) => split(r, true)).filter(Boolean));
        return dropNulls({ ...sheet, rules: [...normal, ...important] });
      },
    },
  }).code.toString();
}

/** Baja una hoja al objetivo con lightningcss (anidado, consultas de rango, colores…). Lanza ante un aviso. */
export function lower(code, filename) {
  const r = transform({ filename, code: Buffer.from(code), targets, exclude: Features.DirSelector, errorRecovery: true });
  if (r.warnings.length) fail(`${filename}: ${r.warnings.map((w) => w.message).join("; ")}`);
  return r.code.toString();
}

/** Versión compat de una hoja de componentes ya empaquetada (sin @import). */
export function compatComponents(css, globals, locals, filename) {
  const { css: hoisted, mixes } = hoistMixes(css, globals, locals);
  const lowered = lower(rewriteSelectors(hoisted), filename);
  const flat = flattenLayers(lowered);
  const popover = /\[popover\]|popover-open/.test(css) ? POPOVER_HIDDEN : "";
  // Lo que se añade ya está escrito para el objetivo: no se vuelve a bajar.
  return { css: `${propertyDefaults(css)}${popover}${flat}${hasFallback(css)}`, mixes };
}

// ── Build ────────────────────────────────────────────────────────────────────────────────────────────────

const HEADER =
  "/* GENERADO por tools/compat.mjs (modo compat: Chromium 109, Safari 15.4, Firefox 115). No editar. Ver docs/users/10-compatibilidad.md */\n";
export const SHEETS = {
  components: [
    ["zui/dist/zui.css", "zui/dist/zui.compat.css"],
    ["zout/dist/zout.css", "zout/dist/zout.compat.css"],
  ],
  tokens: [
    ["tokens/dist/tokens.css", "tokens/dist/tokens.compat.css"],
    ["tokens/dist/brands/dazlabs.css", "tokens/dist/brands/dazlabs.compat.css"],
    ["tokens/dist/brands/zenith.css", "tokens/dist/brands/zenith.compat.css"],
    ["tokens/dist/brands/zutool.css", "tokens/dist/brands/zutool.compat.css"],
  ],
};

/**
 * Hojas compat a partir de las normales: `sheets` es { ruta de la hoja normal: CSS } con las de SHEETS (los
 * componentes ya empaquetados). Devuelve { ruta de la hoja compat: CSS } y cuántas mezclas de componentes resolvió.
 */
export function compatSheets(sheets) {
  const globals = declaredProps(sheets["tokens/dist/tokens.css"]);
  const locals = new Set();
  for (const [from] of SHEETS.components) for (const p of declaredProps(sheets[from])) if (!globals.has(p)) locals.add(p);
  // Un token que un componente vuelve a declarar (el alto de la hora de la agenda) también es local para él.
  for (const [from] of SHEETS.components)
    for (const m of sheets[from].matchAll(/(?<=[{;\s])(--[\w-]+)\s*:/g)) if (globals.has(m[1])) locals.add(m[1]);
  const mixes = {};
  const out = {};
  for (const [from, to] of SHEETS.components) {
    const r = compatComponents(sheets[from], globals, locals, to);
    Object.assign(mixes, r.mixes);
    out[to] = HEADER + r.css;
  }
  for (const [from, to] of SHEETS.tokens) out[to] = HEADER + lower(compatTokens(sheets[from], mixes), to);
  return { sheets: out, mixes: Object.keys(mixes).length };
}

/** Lee las hojas normales de dist/, escribe las compat y devuelve las rutas escritas. */
export function buildCompat() {
  const input = Object.fromEntries(
    [...SHEETS.components, ...SHEETS.tokens].map(([from]) => [from, readFileSync(join(root, from), "utf8")]),
  );
  const { sheets, mixes } = compatSheets(input);
  for (const [to, css] of Object.entries(sheets)) writeFileSync(join(root, to), css);
  return { written: Object.keys(sheets), mixes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { written, mixes } = buildCompat();
  for (const f of written) console.log(`✓ ${f}`);
  console.log(`  ${mixes} mezclas de componentes resueltas en los tokens`);
}
