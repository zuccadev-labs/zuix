// Texto que llega a trozos (la respuesta de un modelo): acumular sin partir un par sustituto entre dos trozos, y
// preparar lo recibido para pintarlo mientras sigue llegando, cerrando a título provisional un bloque de código o un
// énfasis que aún no se cerró (para que el resto del mensaje no se pinte como código). Puro: quien pinta limita el
// repintado a un fotograma.

export interface TextStream {
  /** Añade un trozo. Un sustituto alto suelto al final se guarda hasta el trozo siguiente. */
  push(chunk: string): void;
  /** Lo recibido completo (sin el sustituto pendiente). */
  text(): string;
  /** Cierra el flujo: lo pendiente se añade tal cual. */
  end(): string;
  reset(text?: string): void;
}

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;

export function createTextStream(initial = ""): TextStream {
  let done = initial;
  let pending = "";
  return {
    push(chunk) {
      if (!chunk) return;
      const all = pending + chunk;
      const last = all.charCodeAt(all.length - 1);
      if (isHigh(last)) {
        done += all.slice(0, -1);
        pending = all.slice(-1);
      } else {
        done += all;
        pending = "";
      }
    },
    text: () => done,
    end() {
      done += pending;
      pending = "";
      return done;
    },
    reset(text = "") {
      done = text;
      pending = "";
    },
  };
}

/**
 * Texto listo para pintar mientras llega: si hay una valla de código abierta se cierra; en el último párrafo, un `**`,
 * `~~` o `` ` `` sin pareja se cierra también. Lo que ya está cerrado no cambia.
 */
export function provisional(text: string): string {
  const lines = text.split("\n");
  let fence: string | null = null;
  for (const line of lines) {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (!m) continue;
    if (fence === null) fence = m[1]!;
    else if (m[1]!.startsWith(fence[0]!) && m[1]!.length >= fence.length) fence = null;
  }
  if (fence !== null) return `${text}${text.endsWith("\n") ? "" : "\n"}${fence}`;
  // Último párrafo: desde la última línea en blanco.
  const cut = text.lastIndexOf("\n\n");
  const tail = cut < 0 ? text : text.slice(cut + 2);
  let close = "";
  const codeTicks = (tail.match(/`/g) ?? []).length;
  if (codeTicks % 2) close = "`";
  else {
    const outside = tail.replace(/`[^`]*`/g, "");
    if ((outside.match(/\*\*/g) ?? []).length % 2) close += "**";
    if ((outside.match(/~~/g) ?? []).length % 2) close += "~~";
  }
  return text + close;
}

/** Primera frase de un texto (para un anuncio de resumen), sin marcas de Markdown y recortada. */
export function firstSentence(text: string, max = 140): string {
  const plain = text
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/[*_~`#>]+/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(plain);
  const s = m ? m[1]! : plain;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
