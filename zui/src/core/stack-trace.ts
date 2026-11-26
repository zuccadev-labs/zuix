// Traza de error (StackTrace): lectura de las pilas de V8 (Chrome, Node, Edge), SpiderMonkey (Firefox) y JavaScriptCore
// (Safari) a marcos { función, archivo, línea, columna }, qué marcos son de la aplicación y cuáles de terceros, y su
// agrupación: los de terceros seguidos se pliegan en un grupo. Puro.

export interface StackFrame {
  /** Función, o "" si es anónima. */
  fn: string;
  file: string;
  line?: number;
  column?: number;
  /** La línea tal como venía. */
  raw: string;
  /** De la aplicación (no de una dependencia ni del motor). */
  app: boolean;
}

export interface ParsedError {
  /** `TypeError`, `Error`… o "" si la traza no lo dice. */
  name: string;
  message: string;
  frames: StackFrame[];
}

/** Lo que marca un marco como de terceros, si su archivo lo contiene. */
export const LIBRARY_PATTERNS: readonly string[] = [
  "node_modules",
  "node:",
  "internal/",
  "webpack/bootstrap",
  "/@vite/",
  "/.vite/deps/",
  "chrome-extension://",
  "moz-extension://",
  "<anonymous>",
  "native",
];

const LOCATION = /^(.*?):(\d+)(?::(\d+))?$/;

function location(text: string): { file: string; line?: number; column?: number } {
  const clean = text.trim().replace(/^\(|\)$/g, "");
  const m = LOCATION.exec(clean);
  if (!m) return { file: clean };
  return { file: m[1]!, line: Number(m[2]), column: m[3] ? Number(m[3]) : undefined };
}

/** Un marco de una línea de pila, o `null` si la línea no lo es. */
export function parseFrame(line: string, library: readonly string[] = LIBRARY_PATTERNS): StackFrame | null {
  const raw = line.replace(/\s+$/, "");
  const text = raw.trim();
  if (!text) return null;
  let fn = "";
  let where: { file: string; line?: number; column?: number } | null = null;
  // V8: «at fn (file:1:2)», «at file:1:2», «at async fn (…)», «at new Foo (…)».
  const v8 = /^at\s+(?:async\s+)?(.*?)(?:\s+\((.*)\))?$/.exec(text);
  if (v8) {
    if (v8[2] !== undefined) {
      fn = v8[1]!.replace(/^new\s+/, "new ");
      where = location(v8[2]);
    } else {
      where = location(v8[1]!);
    }
  } else {
    // SpiderMonkey y JavaScriptCore: «fn@file:1:2», «@file:1:2», «fn@[native code]».
    // El primer «@»: una URL puede llevar otro (`/@vite/client`).
    const at = text.indexOf("@");
    if (at < 0 || /\s/.test(text.slice(0, at).trim().replace(/<.*?>/g, ""))) return null;
    fn = text.slice(0, at);
    where = location(text.slice(at + 1));
  }
  if (!where || (!where.file && where.line === undefined)) return null;
  const file = where.file;
  const app = !!file && !library.some((p) => p && file.includes(p)) && !/^\[native code\]$/.test(file);
  return { fn: fn.trim(), file, line: where.line, column: where.column, raw: text, app };
}

/**
 * Error de una pila en texto (`error.stack`) o de un objeto `Error`. La cabecera es lo que precede al primer marco;
 * en Firefox y Safari la pila no la trae, y entonces sale de `name` y `message` del objeto.
 */
export function parseStack(input: string | { name?: string; message?: string; stack?: string } | null | undefined, library?: readonly string[]): ParsedError {
  const obj = typeof input === "object" && input ? input : null;
  const text = typeof input === "string" ? input : (obj?.stack ?? "");
  const lines = text.split(/\r?\n/);
  const frames: StackFrame[] = [];
  const head: string[] = [];
  for (const line of lines) {
    const frame = parseFrame(line, library);
    if (frame) frames.push(frame);
    else if (!frames.length && line.trim()) head.push(line.trim());
  }
  let name = obj?.name ?? "";
  let message = obj?.message ?? "";
  if (head.length && !obj?.message) {
    const first = head.join("\n");
    const m = /^([A-Za-z_$][\w$.]*(?:Error|Exception|Warning)?):\s?([\s\S]*)$/.exec(first);
    if (m && /^[A-Z]/.test(m[1]!)) {
      name = m[1]!;
      message = m[2]!;
    } else message = first;
  }
  return { name, message, frames };
}

export type FrameGroup = { kind: "app"; frame: StackFrame; index: number } | { kind: "library"; frames: StackFrame[]; start: number };

/** Marcos agrupados: los de la aplicación sueltos y los de terceros seguidos en un grupo. */
export function groupFrames(frames: readonly StackFrame[]): FrameGroup[] {
  const out: FrameGroup[] = [];
  frames.forEach((frame, index) => {
    if (frame.app) {
      out.push({ kind: "app", frame, index });
      return;
    }
    const last = out[out.length - 1];
    if (last?.kind === "library") last.frames.push(frame);
    else out.push({ kind: "library", frames: [frame], start: index });
  });
  return out;
}

/** Archivo corto para mostrar: sin origen ni consulta, con las dos últimas partes de la ruta. */
export function shortFile(file: string): string {
  const noQuery = file.replace(/[?#].*$/, "");
  const path = noQuery.replace(/^[a-z][\w+.-]*:\/\/[^/]*/i, "");
  const parts = path.split("/").filter(Boolean);
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : parts.join("/") || noQuery;
}

/** «file:line:column» de un marco. */
export const frameLocation = (f: Pick<StackFrame, "file" | "line" | "column">, short = false) =>
  `${short ? shortFile(f.file) : f.file}${f.line !== undefined ? `:${f.line}` : ""}${f.column !== undefined ? `:${f.column}` : ""}`;

/** Texto para copiar: cabecera y un marco por línea, en el formato de V8. */
export function stackText(e: ParsedError): string {
  const head = e.name ? `${e.name}${e.message ? `: ${e.message}` : ""}` : e.message;
  const body = e.frames.map((f) => `    at ${f.fn ? `${f.fn} (${frameLocation(f)})` : frameLocation(f)}`);
  return [head, ...body].filter(Boolean).join("\n");
}
