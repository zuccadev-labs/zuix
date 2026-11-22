// Resaltado mínimo de código sin dependencias: un tokenizador de expresiones regulares para unos pocos lenguajes
// (JavaScript y TypeScript con JSX, JSON, CSS, HTML y XML, shell y Python). No es un analizador: colorea comentarios,
// cadenas, números, palabras clave, funciones, tipos, propiedades y etiquetas, y deja el resto como texto. Un
// lenguaje que no conoce va como texto plano. Devuelve tokens por línea; quien pinta crea nodos. Puro y sin documento.

export type TokenType =
  | "plain"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "literal"
  | "function"
  | "type"
  | "property"
  | "tag"
  | "attr"
  | "punctuation"
  | "variable";

export interface CodeToken {
  type: TokenType;
  text: string;
}

type Rule = [TokenType, RegExp];

const JS_KEYWORDS =
  "abstract|as|async|await|break|case|catch|class|const|continue|debugger|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|keyof|let|namespace|new|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield";
const PY_KEYWORDS =
  "and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|match|case|nonlocal|not|or|pass|raise|return|try|while|with|yield";
const SH_KEYWORDS = "if|then|else|elif|fi|for|while|until|do|done|case|esac|in|function|return|export|local|readonly|select|time|exit";

const sticky = (source: string, flags = "") => new RegExp(source, `y${flags}`);

const JS: Rule[] = [
  ["comment", sticky(String.raw`\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`)],
  ["string", sticky(String.raw`"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|` + "`(?:\\\\[\\s\\S]|[^`\\\\])*`?")],
  ["number", sticky(String.raw`\b(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:e[+-]?\d+)?n?)\b`, "i")],
  ["keyword", sticky(`\\b(?:${JS_KEYWORDS})\\b`)],
  ["literal", sticky(String.raw`\b(?:true|false|null|undefined|NaN|Infinity)\b`)],
  ["function", sticky(String.raw`[A-Za-z_$][\w$]*(?=\s*\()`)],
  ["type", sticky(String.raw`[A-Z][\w$]*\b`)],
  ["plain", sticky(String.raw`[A-Za-z_$][\w$]*|\s+`)],
  ["punctuation", sticky(String.raw`[{}()[\];,.<>/=+\-*%!&|^~?:@#]+`)],
];

// Con JSX, además, las etiquetas (sin ellas, `Array<string>` no se toma por una etiqueta).
const JSX: Rule[] = [JS[0]!, JS[1]!, ["tag", sticky(String.raw`<\/?[A-Za-z][\w.:-]*|\/>`)], ...JS.slice(2)];

const JSON_RULES: Rule[] = [
  ["property", sticky(String.raw`"(?:\\.|[^"\\\n])*"(?=\s*:)`)],
  ["string", sticky(String.raw`"(?:\\.|[^"\\\n])*"?`)],
  ["number", sticky(String.raw`-?\d+(?:\.\d+)?(?:e[+-]?\d+)?`, "i")],
  ["literal", sticky(String.raw`\b(?:true|false|null)\b`)],
  ["punctuation", sticky(String.raw`[{}[\],:]`)],
  ["plain", sticky(String.raw`\s+`)],
];

const CSS: Rule[] = [
  ["comment", sticky(String.raw`\/\*[\s\S]*?(?:\*\/|$)`)],
  ["string", sticky(String.raw`"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?`)],
  ["keyword", sticky(String.raw`@[\w-]+|!important\b`)],
  ["property", sticky(String.raw`--?[\w-]+(?=\s*:)|[a-z][\w-]*(?=\s*:(?!:))`, "i")],
  ["number", sticky(String.raw`#[\da-f]{3,8}\b|-?\d*\.?\d+(?:%|[a-z]+)?`, "i")],
  ["function", sticky(String.raw`[\w-]+(?=\()`)],
  ["plain", sticky(String.raw`[\w-]+|\s+`)],
  ["punctuation", sticky(String.raw`[{}()[\];,.:>+~*=|^$&]+`)],
];

const HTML: Rule[] = [
  ["comment", sticky(String.raw`<!--[\s\S]*?(?:-->|$)`)],
  ["tag", sticky(String.raw`<\/?[A-Za-z][\w:-]*|\/?>|<!doctype[^>]*>`, "i")],
  ["attr", sticky(String.raw`[\w:@.-]+(?==)`)],
  ["string", sticky(String.raw`"[^"]*"?|'[^']*'?`)],
  ["plain", sticky(String.raw`[^<"'=\s]+|\s+`)],
  ["punctuation", sticky(String.raw`=`)],
];

const SHELL: Rule[] = [
  ["comment", sticky(String.raw`(?<![\w$])#[^\n]*`)],
  ["string", sticky(String.raw`"(?:\\.|[^"\\])*"?|'[^']*'?`)],
  ["variable", sticky(String.raw`\$\{[^}\n]*\}?|\$[A-Za-z_]\w*|\$[\d@#?*!$-]`)],
  ["keyword", sticky(`\\b(?:${SH_KEYWORDS})\\b`)],
  ["attr", sticky(String.raw`(?<![\w-])--?[\w][\w-]*`)],
  ["number", sticky(String.raw`\b\d+\b`)],
  ["plain", sticky(String.raw`[\w./~-]+|\s+`)],
  ["punctuation", sticky(String.raw`[|&;<>()[\]{}=\\]+`)],
];

const PYTHON: Rule[] = [
  ["comment", sticky(String.raw`#[^\n]*`)],
  ["string", sticky(String.raw`[rRbBfFuU]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)`)],
  ["attr", sticky(String.raw`@[\w.]+`)],
  ["number", sticky(String.raw`\b(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:e[+-]?\d+)?j?)\b`, "i")],
  ["keyword", sticky(`\\b(?:${PY_KEYWORDS})\\b`)],
  ["literal", sticky(String.raw`\b(?:True|False|None|self|cls)\b`)],
  ["function", sticky(String.raw`[A-Za-z_]\w*(?=\s*\()`)],
  ["type", sticky(String.raw`[A-Z]\w*\b`)],
  ["plain", sticky(String.raw`[A-Za-z_]\w*|\s+`)],
  ["punctuation", sticky(String.raw`[{}()[\];,.<>/=+\-*%!&|^~:]+`)],
];

const LANGUAGES: Record<string, Rule[]> = {
  js: JS,
  jsx: JSX,
  ts: JS,
  tsx: JSX,
  javascript: JS,
  typescript: JS,
  mjs: JS,
  cjs: JS,
  json: JSON_RULES,
  jsonc: JS,
  css: CSS,
  html: HTML,
  xml: HTML,
  svg: HTML,
  sh: SHELL,
  bash: SHELL,
  shell: SHELL,
  zsh: SHELL,
  console: SHELL,
  py: PYTHON,
  python: PYTHON,
};

/** Lenguajes que el tokenizador conoce (alias incluidos). */
export const CODE_LANGUAGES = Object.keys(LANGUAGES);

/** ¿Conoce el tokenizador este lenguaje? */
export const knownLanguage = (language: string | undefined) => Boolean(language && LANGUAGES[language.toLowerCase()]);

/** Lenguaje por la extensión de un nombre de archivo (`app.tsx` → `tsx`). */
export function languageOf(fileName: string | undefined): string | undefined {
  const ext = /\.([\w]+)$/.exec(fileName ?? "")?.[1]?.toLowerCase();
  return ext && LANGUAGES[ext] ? ext : undefined;
}

/** Tokens de un código entero (los que cruzan líneas, como un comentario de bloque, van enteros). */
export function tokenize(code: string, language?: string): CodeToken[] {
  const rules = language ? LANGUAGES[language.toLowerCase()] : undefined;
  if (!rules) return code ? [{ type: "plain", text: code }] : [];
  const out: CodeToken[] = [];
  let at = 0;
  const push = (type: TokenType, text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type && (type === "plain" || type === "punctuation")) last.text += text;
    else out.push({ type, text });
  };
  while (at < code.length) {
    let matched = false;
    for (const [type, re] of rules) {
      re.lastIndex = at;
      const m = re.exec(code);
      if (m?.[0].length) {
        push(type, m[0]);
        at += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      push("plain", code[at]!);
      at++;
    }
  }
  return out;
}

/** Tokens por línea: los que cruzan un salto se parten (cada línea se pinta sola). */
export function tokenizeLines(code: string, language?: string): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  for (const token of tokenize(code.replace(/\r\n?/g, "\n"), language)) {
    const pieces = token.text.split("\n");
    pieces.forEach((piece, i) => {
      if (i > 0) lines.push([]);
      if (piece) lines[lines.length - 1]!.push({ type: token.type, text: piece });
    });
  }
  if (lines.length > 1 && !lines[lines.length - 1]!.length && code.endsWith("\n")) lines.pop();
  return lines;
}

/** Líneas de `"3-5,9"` (o de una lista de números): un conjunto de números de línea. */
export function parseLineRanges(spec: string | readonly number[] | null | undefined): Set<number> {
  const out = new Set<number>();
  if (!spec) return out;
  if (typeof spec !== "string") {
    for (const n of spec) if (Number.isInteger(n) && n > 0) out.add(n);
    return out;
  }
  for (const part of spec.split(/[\s,]+/)) {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    const [from, to] = a <= b ? [a, b] : [b, a];
    for (let n = Math.max(1, from); n <= Math.min(to, from + 100_000); n++) out.add(n);
  }
  return out;
}
