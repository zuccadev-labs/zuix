// Extrae del CSS de los componentes los usos reales de color: qué token pinta texto, sobre qué fondo, y qué
// tokens dibujan bordes de control. La validación mide el contraste de lo que sale de aquí, no de una lista
// escrita a mano. Sin dependencias: un lector mínimo de reglas CSS (bloques anidados, comentarios, cadenas).

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Reglas de estilo aplanadas: [{ selector, decls: Map<prop, valor>, at: [reglas @ que la envuelven] }]. */
export function parseRules(css, file = "") {
  const text = stripComments(css);
  const rules = [];
  let i = 0;
  function block(at) {
    let buffer = "";
    const decls = new Map();
    const flush = () => {
      const d = buffer.trim();
      buffer = "";
      const colon = d.indexOf(":");
      if (colon > 0) decls.set(d.slice(0, colon).trim(), d.slice(colon + 1).trim());
    };
    while (i < text.length) {
      const ch = text[i++];
      if (ch === '"' || ch === "'") {
        buffer += ch;
        while (i < text.length) { const c = text[i++]; buffer += c; if (c === "\\") buffer += text[i++] ?? ""; else if (c === ch) break; }
      } else if (ch === ";") flush();
      else if (ch === "{") {
        const prelude = buffer.trim().replace(/\s+/g, " ");
        buffer = "";
        if (prelude.startsWith("@")) {
          // @keyframes y @font-face no son reglas de estilo de componente.
          if (/^@(keyframes|font-face|property)/.test(prelude)) { skip(); continue; }
          const inner = block([...at, prelude]);
          if (inner.size) rules.push({ selector: ":scope", decls: inner, at: [...at, prelude], file });
        } else {
          const inner = block(at);
          rules.push({ selector: prelude, decls: inner, at, file });
        }
      } else if (ch === "}") { flush(); return decls; }
      else buffer += ch;
    }
    flush();
    return decls;
  }
  function skip() {
    let depth = 1;
    while (i < text.length && depth > 0) { const ch = text[i++]; if (ch === "{") depth++; else if (ch === "}") depth--; }
  }
  block([]);
  return rules;
}

/** Último `var(--z-nombre)` de un valor si el valor es solo esa referencia (con sus respaldos); si no, null. */
function soleToken(value) {
  const v = value.replace(/\s*!important$/, "").trim();
  if (!/^var\(\s*--z-[a-z0-9-]+\s*(,.*)?\)$/s.test(v)) return null;
  const all = [...v.matchAll(/var\(\s*--z-([a-z0-9-]+)/g)].map((m) => m[1]);
  // var(--z-local, var(--z-token)): el local manda si está definido; se devuelven los dos, el externo primero.
  return all;
}

const DISABLED = /:disabled|\[disabled\]|\[aria-disabled(="true")?\]|\[data-disabled\]|\[inert\]/;
// Selectores que pintan un gráfico (icono, indicador), no texto: su mínimo es el 3:1 de WCAG 1.4.11.
const GRAPHIC = /(icon|chevron|separator|caret|arrow|indicator|toggle|gap|grip|spinner|mark|dot|check|thumb|handle|star)\b/;

/**
 * Usos de color de una lista de reglas.
 *   text:    [{ fg, bg, selector, file, graphic }]   `bg` es null si la regla no declara fondo (hereda el del entorno)
 *   borders: [{ border, bg, selector, file }]         bordes de reglas que usan los tokens de control
 * `known(nombre)` dice si un nombre es un token del contrato; el resto son variables locales del componente,
 * que se resuelven con las reglas que las definen (cada regla que define alguna es una combinación posible).
 */
export function extractUses(rules, known) {
  // Definiciones de variables locales: regla → { local: token }.
  const definers = [];
  for (const rule of rules) {
    const binds = {};
    for (const [prop, value] of rule.decls) {
      if (!prop.startsWith("--z-")) continue;
      const tokens = soleToken(value);
      if (tokens) binds[prop.slice(4)] = tokens[tokens.length - 1];
    }
    if (Object.keys(binds).length) definers.push({ rule, binds });
  }
  const expand = (names) => {
    // names: lista devuelta por soleToken. Devuelve los tokens del contrato a los que puede resolverse.
    const out = new Set();
    const visit = (name, seen) => {
      if (known(name)) return void out.add(name);
      if (seen.has(name)) return;
      seen.add(name);
      for (const d of definers) if (name in d.binds) visit(d.binds[name], seen);
    };
    // El primero es la variable más externa; si es local y nadie la define, vale el respaldo.
    const [first, ...rest] = names;
    visit(first, new Set());
    if (!known(first)) for (const r of rest) visit(r, new Set());
    return [...out];
  };
  /** Combinaciones coherentes de (fg, bg) cuando los dos salen de variables locales definidas en la misma regla. */
  const paired = (fgNames, bgNames) => {
    const [f, b] = [fgNames[0], bgNames[0]];
    if (known(f) || known(b)) return null;
    const combos = definers.filter((d) => f in d.binds && b in d.binds).map((d) => [d.binds[f], d.binds[b]]);
    return combos.length ? combos : null;
  };

  const text = [], borders = [];
  // Un uso por combinación y paquete: el primer selector que la usa sirve de ejemplo.
  const pkg = (file) => file.split("/")[0];
  const push = (list, item) => { if (!list.some((x) => pkg(x.file) === pkg(item.file) && Object.keys(item).every((k) => k === "selector" || k === "file" || x[k] === item[k]))) list.push(item); };
  for (const rule of rules) {
    if (DISABLED.test(rule.selector)) continue;
    // En modo de colores forzados manda el sistema, no los tokens.
    if (rule.at.some((a) => /forced-colors/.test(a))) continue;
    const color = rule.decls.get("color");
    const bg = rule.decls.get("background") ?? rule.decls.get("background-color");
    const border = rule.decls.get("border") ?? rule.decls.get("border-color");
    const fgNames = color ? soleToken(color) : null;
    const bgNames = bg ? soleToken(bg) : null;
    const graphic = GRAPHIC.test(rule.selector.split(/[\s>+~,]/).filter(Boolean).pop() ?? "");
    const meta = { selector: rule.selector, file: rule.file };
    if (fgNames) {
      const combos = bgNames ? paired(fgNames, bgNames) : null;
      if (combos) for (const [fg, b] of combos) { if (known(fg) && known(b)) push(text, { fg, bg: b, graphic, ...meta }); }
      else {
        const bgs = bgNames ? expand(bgNames) : [null];
        for (const fg of expand(fgNames)) for (const b of bgs.length ? bgs : [null]) push(text, { fg, bg: b, graphic, ...meta });
      }
    }
    const borderToken = border ? [...border.matchAll(/var\(\s*--z-([a-z0-9-]+)/g)].map((m) => m[1]).pop() : null;
    if (borderToken && /^control-border/.test(borderToken)) {
      const bgs = bgNames ? expand(bgNames) : [null];
      for (const b of bgs.length ? bgs : [null]) push(borders, { border: borderToken, bg: b, ...meta });
    }
  }
  return { text, borders };
}
