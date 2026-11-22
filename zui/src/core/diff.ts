// Diferencias de texto: diff de líneas de Myers (O(ND)), bloques (hunks) con contexto y regiones sin cambios
// plegables, diff de palabras dentro de una línea cambiada, filas lado a lado y lector de parches unificados
// (`diff -u`, `git diff`). Puro y sin documento.

export type DiffKind = "equal" | "insert" | "delete";

export interface DiffOp<T = string> {
  kind: DiffKind;
  value: T;
  /** Posición en el antiguo (equal, delete) y en el nuevo (equal, insert), desde 0. */
  a?: number;
  b?: number;
}

/**
 * Secuencia mínima de operaciones que convierte `a` en `b` (algoritmo de Myers con camino hacia atrás). `limit` corta
 * el trabajo en entradas muy distintas: pasado ese número de diferencias, el resto se da como borrado e inserción.
 */
export function diffSequence<T>(a: readonly T[], b: readonly T[], equals: (x: T, y: T) => boolean = Object.is, limit = 4000): DiffOp<T>[] {
  // Prefijo y sufijo comunes fuera: lo habitual es un cambio pequeño en un archivo grande.
  let start = 0;
  while (start < a.length && start < b.length && equals(a[start]!, b[start]!)) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && equals(a[endA - 1]!, b[endB - 1]!)) {
    endA--;
    endB--;
  }
  const head: DiffOp<T>[] = [];
  for (let i = 0; i < start; i++) head.push({ kind: "equal", value: a[i]!, a: i, b: i });
  const tail: DiffOp<T>[] = [];
  for (let i = 0; i < a.length - endA; i++) tail.push({ kind: "equal", value: a[endA + i]!, a: endA + i, b: endB + i });

  const n = endA - start;
  const m = endB - start;
  const max = n + m;
  const middle: DiffOp<T>[] = [];
  if (n === 0 || m === 0) {
    for (let i = 0; i < n; i++) middle.push({ kind: "delete", value: a[start + i]!, a: start + i });
    for (let j = 0; j < m; j++) middle.push({ kind: "insert", value: b[start + j]!, b: start + j });
    return [...head, ...middle, ...tail];
  }
  const offset = max;
  const v = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];
  let found = -1;
  const cap = Math.min(max, Math.max(0, limit));
  for (let d = 0; d <= cap; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? v[offset + k + 1]! : v[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && equals(a[start + x]!, b[start + y]!)) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }
  if (found < 0) {
    // Demasiado distintos: todo lo de en medio, borrado e insertado.
    for (let i = 0; i < n; i++) middle.push({ kind: "delete", value: a[start + i]!, a: start + i });
    for (let j = 0; j < m; j++) middle.push({ kind: "insert", value: b[start + j]!, b: start + j });
    return [...head, ...middle, ...tail];
  }
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const prev = trace[d]!;
    const k = x - y;
    const down = k === -d || (k !== d && prev[offset + k - 1]! < prev[offset + k + 1]!);
    const pk = down ? k + 1 : k - 1;
    const px = prev[offset + pk]!;
    const py = px - pk;
    while (x > px && y > py) {
      x--;
      y--;
      middle.push({ kind: "equal", value: a[start + x]!, a: start + x, b: start + y });
    }
    if (down) {
      y--;
      middle.push({ kind: "insert", value: b[start + y]!, b: start + y });
    } else {
      x--;
      middle.push({ kind: "delete", value: a[start + x]!, a: start + x });
    }
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    middle.push({ kind: "equal", value: a[start + x]!, a: start + x, b: start + y });
  }
  middle.reverse();
  return [...head, ...middle, ...tail];
}

/** Líneas de un texto (sin el salto final, que no es una línea vacía de más). */
export const splitLines = (text: string) => {
  if (!text) return [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
};

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** Número de línea en el antiguo y en el nuevo (desde 1). */
  old?: number;
  new?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Texto tras `@@ … @@` (la función o sección, en un parche). */
  header?: string;
  lines: DiffLine[];
}

/** Diff de líneas de dos textos. */
export function diffLines(before: string, after: string): DiffLine[] {
  return diffSequence(splitLines(before), splitLines(after)).map((op) => ({
    kind: op.kind,
    text: op.value,
    old: op.a === undefined ? undefined : op.a + 1,
    new: op.b === undefined ? undefined : op.b + 1,
  }));
}

/** Bloques con `context` líneas iguales alrededor de cada cambio; las iguales lejos de un cambio quedan fuera. */
export function toHunks(lines: readonly DiffLine[], context = 3): DiffHunk[] {
  const ctx = Math.max(0, Math.floor(context));
  const changed = lines.map((l) => l.kind !== "equal");
  const keep = lines.map((_, i) => {
    for (let j = Math.max(0, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) if (changed[j]) return true;
    return false;
  });
  const hunks: DiffHunk[] = [];
  let current: DiffLine[] = [];
  const close = () => {
    if (!current.length) return;
    const first = current[0]!;
    const olds = current.filter((l) => l.kind !== "insert");
    const news = current.filter((l) => l.kind !== "delete");
    const before = lines.slice(0, lines.indexOf(first));
    const oldStart = olds[0]?.old ?? before.filter((l) => l.kind !== "insert").length;
    const newStart = news[0]?.new ?? before.filter((l) => l.kind !== "delete").length;
    hunks.push({ oldStart, oldLines: olds.length, newStart, newLines: news.length, lines: current });
    current = [];
  };
  lines.forEach((line, i) => {
    if (keep[i]) current.push(line);
    else close();
  });
  close();
  return hunks;
}

/** Cabecera de un bloque: `@@ -12,7 +12,8 @@`. */
export const hunkHeader = (h: Pick<DiffHunk, "oldStart" | "oldLines" | "newStart" | "newLines">) =>
  `@@ -${h.oldStart}${h.oldLines === 1 ? "" : `,${h.oldLines}`} +${h.newStart}${h.newLines === 1 ? "" : `,${h.newLines}`} @@`;

export interface DiffFile {
  oldName: string;
  newName: string;
  hunks: DiffHunk[];
  added: number;
  removed: number;
  /** Archivo binario (sin líneas). */
  binary?: boolean;
}

const stripPrefix = (name: string) => name.replace(/^[ab]\//, "").replace(/\t.*$/, "");

/** Lee un parche unificado (`diff -u` o `git diff`) con uno o varios archivos. Lo que no entiende lo ignora. */
export function parsePatch(patch: string): DiffFile[] {
  const files: DiffFile[] = [];
  const st: { file: DiffFile | null; hunk: DiffHunk | null; oldNo: number; newNo: number } = { file: null, hunk: null, oldNo: 0, newNo: 0 };
  const begin = (oldName = "", newName = ""): DiffFile => {
    const file: DiffFile = { oldName, newName, hunks: [], added: 0, removed: 0 };
    files.push(file);
    st.file = file;
    st.hunk = null;
    return file;
  };
  // Un bloque está completo cuando ya tiene las líneas que anunció su cabecera.
  const open = () => {
    const h = st.hunk;
    if (!h) return false;
    let olds = 0;
    let news = 0;
    for (const l of h.lines) {
      if (l.kind !== "insert") olds++;
      if (l.kind !== "delete") news++;
    }
    return olds < h.oldLines || news < h.newLines;
  };
  for (const raw of patch.replace(/\r\n?/g, "\n").split("\n")) {
    const git = /^diff --git a\/(.+) b\/(.+)$/.exec(raw);
    if (git) {
      begin(git[1], git[2]);
      continue;
    }
    if (raw.startsWith("--- ") && !open()) {
      const name = raw.slice(4).trim();
      const file = st.file && !st.file.hunks.length ? st.file : begin();
      file.oldName = name === "/dev/null" ? "" : stripPrefix(name);
      st.hunk = null;
      continue;
    }
    if (raw.startsWith("+++ ") && st.file && !st.hunk) {
      const name = raw.slice(4).trim();
      st.file.newName = name === "/dev/null" ? "" : stripPrefix(name);
      continue;
    }
    if (/^Binary files /.test(raw) && st.file) {
      st.file.binary = true;
      continue;
    }
    const head = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/.exec(raw);
    if (head) {
      const file = st.file ?? begin();
      st.oldNo = Number(head[1]);
      st.newNo = Number(head[3]);
      st.hunk = {
        oldStart: st.oldNo,
        oldLines: head[2] === undefined ? 1 : Number(head[2]),
        newStart: st.newNo,
        newLines: head[4] === undefined ? 1 : Number(head[4]),
        header: head[5] || undefined,
        lines: [],
      };
      file.hunks.push(st.hunk);
      continue;
    }
    const { hunk, file } = st;
    if (!hunk || !file || !open()) continue;
    const mark = raw[0];
    const text = raw.slice(1);
    if (mark === "+") {
      hunk.lines.push({ kind: "insert", text, new: st.newNo++ });
      file.added++;
    } else if (mark === "-") {
      hunk.lines.push({ kind: "delete", text, old: st.oldNo++ });
      file.removed++;
    } else if (mark === " " || raw === "") {
      // Una línea vacía de contexto llega a veces sin el espacio inicial.
      hunk.lines.push({ kind: "equal", text, old: st.oldNo++, new: st.newNo++ });
    }
  }
  for (const f of files) if (!f.newName) f.newName = f.oldName;
  return files.filter((f) => f.hunks.length || f.binary || f.oldName || f.newName);
}

/** Totales de líneas añadidas y quitadas. */
export function diffStats(lines: readonly DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.kind === "insert") added++;
    else if (l.kind === "delete") removed++;
  }
  return { added, removed };
}

export interface WordPart {
  text: string;
  changed: boolean;
}

/** Palabras, espacios y signos sueltos: la unidad del diff dentro de una línea. */
export const wordTokens = (text: string) => text.match(/\w+|\s+|[^\w\s]/gu) ?? [];

/**
 * Diff de palabras entre una línea quitada y su sustituta: qué partes cambiaron en cada lado. Si cambian casi todas
 * (más del 60 %), se marca la línea entera: resaltar palabra a palabra no ayudaría.
 */
export function wordDiff(before: string, after: string): { before: WordPart[]; after: WordPart[] } {
  const ops = diffSequence(wordTokens(before), wordTokens(after), Object.is, 400);
  const left: WordPart[] = [];
  const right: WordPart[] = [];
  const push = (list: WordPart[], text: string, changed: boolean) => {
    const last = list[list.length - 1];
    if (last && last.changed === changed) last.text += text;
    else list.push({ text, changed });
  };
  let changedChars = 0;
  for (const op of ops) {
    if (op.kind === "equal") {
      push(left, op.value, false);
      push(right, op.value, false);
    } else if (op.kind === "delete") {
      push(left, op.value, true);
      if (op.value.trim()) changedChars += op.value.length;
    } else {
      push(right, op.value, true);
      if (op.value.trim()) changedChars += op.value.length;
    }
  }
  const total = before.replace(/\s/g, "").length + after.replace(/\s/g, "").length;
  if (total && changedChars / total > 0.6) return { before: [{ text: before, changed: true }], after: [{ text: after, changed: true }] };
  return { before: left, after: right };
}

export interface SplitRow {
  left?: DiffLine;
  right?: DiffLine;
}

/** Filas lado a lado: las iguales en las dos columnas; cada grupo de quitadas se empareja con las añadidas que siguen. */
export function splitRows(lines: readonly DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.kind === "equal") {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }
    const deletes: DiffLine[] = [];
    const inserts: DiffLine[] = [];
    while (i < lines.length && lines[i]!.kind === "delete") deletes.push(lines[i++]!);
    while (i < lines.length && lines[i]!.kind === "insert") inserts.push(lines[i++]!);
    for (let k = 0; k < Math.max(deletes.length, inserts.length); k++) rows.push({ left: deletes[k], right: inserts[k] });
  }
  return rows;
}

/** Pares quitada → añadida de un bloque (para el diff de palabras en la vista unificada). */
export function changePairs(lines: readonly DiffLine[]): Map<DiffLine, DiffLine> {
  const pairs = new Map<DiffLine, DiffLine>();
  for (const row of splitRows(lines))
    if (row.left?.kind === "delete" && row.right?.kind === "insert") {
      pairs.set(row.left, row.right);
      pairs.set(row.right, row.left);
    }
  return pairs;
}
