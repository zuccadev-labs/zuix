// DiffViewer como pieza (core/widget): diferencias de dos textos (core/diff, Myers) o de un parche unificado, en
// vista unificada o lado a lado, con las palabras cambiadas marcadas y las regiones sin cambios plegadas (se
// despliegan con un botón). Cada línea dice su tipo en texto oculto («added», «removed»), no solo con color ni con el
// signo. Una tabla con cabeceras por archivo. El texto se pinta como nodos, nunca como marcado.

import {
  changePairs,
  diffLines,
  diffStats,
  hunkHeader,
  parsePatch,
  splitRows,
  toHunks,
  wordDiff,
  type DiffLine,
  type WordPart,
} from "./diff";
import { fill, h, icon, type VNode } from "./vnode";
import { num, type Widget, type WidgetHost } from "./widget";

export interface DiffViewerLabels {
  diff: string;
  added: string;
  removed: string;
  unchanged: string;
  /** «Show {n} unchanged lines». */
  expand: string;
  /** Conmutador de la vista lado a lado. */
  split: string;
  /** «{n} additions» y «{n} deletions» (texto oculto de las cifras). */
  additions: string;
  deletions: string;
  oldLine: string;
  newLine: string;
  code: string;
  noChanges: string;
  binary: string;
}

export const DIFF_VIEWER_LABELS: DiffViewerLabels = {
  diff: "Diff",
  added: "added",
  removed: "removed",
  unchanged: "unchanged",
  expand: "Show {n} unchanged lines",
  split: "Split view",
  additions: "{n} additions",
  deletions: "{n} deletions",
  oldLine: "Old line",
  newLine: "New line",
  code: "Code",
  noChanges: "No changes",
  binary: "Binary file",
};

export interface DiffViewerProps {
  before?: string;
  after?: string;
  /** Parche unificado (`git diff`), en lugar de `before` y `after`. Puede traer varios archivos. */
  patch?: string;
  mode?: "unified" | "split";
  defaultMode?: "unified" | "split";
  /** Líneas iguales alrededor de cada cambio. */
  context?: number;
  /** Marca las palabras cambiadas dentro de una línea. */
  wordDiff?: boolean;
  fileName?: string;
  /** Sin el selector de vista. */
  hideModeToggle?: boolean;
  labels?: Partial<DiffViewerLabels>;
}

interface Segment {
  kind: "lines" | "gap" | "hunk";
  id: string;
  lines: DiffLine[];
  /** Hueco desplegable (con `before`/`after`); en un parche, la cabecera del bloque. */
  expandable?: boolean;
  header?: string;
}

interface ViewFile {
  name: string;
  added: number;
  removed: number;
  binary: boolean;
  segments: Segment[];
}

interface Config {
  files: ViewFile[];
  mode: "unified" | "split" | null;
  defaultMode: "unified" | "split";
  words: boolean;
  toggle: boolean;
  labels: DiffViewerLabels;
}

interface State {
  mode: "unified" | "split";
  expanded: string[];
}

type Host = WidgetHost<Config, State>;

/** Segmentos de un diff de dos textos: lo que cambia (con contexto) y los huecos plegados entre medias. */
function segmentsOf(all: DiffLine[], context: number, prefix: string): Segment[] {
  const kept = new Set(toHunks(all, context).flatMap((hunk) => hunk.lines));
  const out: Segment[] = [];
  let run: DiffLine[] = [];
  let inGap = false;
  const flush = () => {
    if (!run.length) return;
    out.push(
      inGap
        ? { kind: "gap", id: `${prefix}g${out.length}`, lines: run, expandable: true }
        : { kind: "lines", id: `${prefix}l${out.length}`, lines: run },
    );
    run = [];
  };
  for (const line of all) {
    const gap = !kept.has(line);
    if (gap !== inGap) {
      flush();
      inGap = gap;
    }
    run.push(line);
  }
  flush();
  return out;
}

const filesCache = new Map<string, ViewFile[]>();
function buildFiles(p: DiffViewerProps, context: number): ViewFile[] {
  const key = `${context}\u0000${p.fileName ?? ""}\u0000${p.patch ?? ""}\u0000${p.before ?? ""}\u0000${p.after ?? ""}`;
  const hit = filesCache.get(key);
  if (hit) return hit;
  let files: ViewFile[];
  if (p.patch) {
    files = parsePatch(p.patch).map((f, fi) => ({
      name: f.newName || f.oldName || p.fileName || "",
      added: f.added,
      removed: f.removed,
      binary: Boolean(f.binary),
      segments: f.hunks.flatMap((hunk, hi) => [
        { kind: "hunk" as const, id: `f${fi}h${hi}`, lines: [], header: `${hunkHeader(hunk)}${hunk.header ? ` ${hunk.header}` : ""}` },
        { kind: "lines" as const, id: `f${fi}l${hi}`, lines: hunk.lines },
      ]),
    }));
  } else {
    const all = diffLines(p.before ?? "", p.after ?? "");
    const { added, removed } = diffStats(all);
    files = [{ name: p.fileName ?? "", added, removed, binary: false, segments: segmentsOf(all, context, "f0") }];
  }
  if (filesCache.size > 32) filesCache.clear();
  filesCache.set(key, files);
  return files;
}

const SIGN = { equal: " ", insert: "+", delete: "−" } as const;

function codeCell(line: DiffLine | undefined, parts: WordPart[] | null, labels: DiffViewerLabels, cls = "z-diff__code"): VNode {
  if (!line) return h("td", { class: `${cls} z-diff__empty` });
  const kind = line.kind === "insert" ? labels.added : line.kind === "delete" ? labels.removed : "";
  const content = parts ? parts.map((part) => (part.changed ? h("span", { class: "z-diff__word" }, part.text) : part.text)) : [line.text];
  return h("td", { class: cls }, kind ? h("span", { class: "z-sr-only" }, `${kind}: `) : null, ...content);
}

function attach(root: HTMLElement, host: Host): () => void {
  const click = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const mode = target?.closest?.<HTMLButtonElement>(".z-diff__mode");
    if (mode && root.contains(mode)) {
      // Un conmutador: pulsado, lado a lado; sin pulsar, unificado.
      const next = host.state().mode === "split" ? "unified" : "split";
      host.update({ mode: next });
      host.emit("mode-change", { mode: next });
      return;
    }
    const expand = target?.closest?.<HTMLButtonElement>(".z-diff__expand");
    if (expand && root.contains(expand)) {
      const id = expand.dataset.gap ?? "";
      // El foco pasa a la primera línea desplegada: el botón desaparece.
      host.update({ expanded: [...host.state().expanded, id] });
      requestAnimationFrame(() => root.querySelector<HTMLElement>(`[data-gap-start="${CSS.escape(id)}"]`)?.focus());
    }
  };
  root.addEventListener("click", click);
  return () => root.removeEventListener("click", click);
}

export const diffViewerWidget: Widget<DiffViewerProps, Config, State> = {
  root: "z-diff",
  configure: (p) => {
    const context = Math.max(0, Math.floor(Number(p.context ?? 3)));
    return {
      files: buildFiles(p, Number.isFinite(context) ? context : 3),
      mode: p.mode === "split" || p.mode === "unified" ? p.mode : null,
      defaultMode: p.defaultMode === "split" ? "split" : "unified",
      words: p.wordDiff !== false,
      toggle: !p.hideModeToggle,
      labels: { ...DIFF_VIEWER_LABELS, ...p.labels },
    };
  },
  initial: (c) => ({ mode: c.mode ?? c.defaultMode, expanded: [] }),
  control: (c, s) => (c.mode && c.mode !== s.mode ? { ...s, mode: c.mode } : s),
  tree(c, s, uid) {
    const { labels } = c;
    const split = s.mode === "split";
    const cols = 4;
    const totals = c.files.reduce((t, f) => ({ added: t.added + f.added, removed: t.removed + f.removed }), { added: 0, removed: 0 });
    const stats = (added: number, removed: number) =>
      h(
        "span",
        { class: "z-diff__stats" },
        h("span", { class: "z-diff__added", "aria-hidden": "true" }, `+${added}`),
        h("span", { class: "z-diff__removed", "aria-hidden": "true" }, `−${removed}`),
        h("span", { class: "z-sr-only" }, `${fill(labels.additions, { n: added })}, ${fill(labels.deletions, { n: removed })}`),
      );
    const fileTable = (file: ViewFile, fi: number) => {
      const rows: VNode[] = [];
      for (const seg of file.segments) {
        if (seg.kind === "hunk") {
          rows.push(h("tr", { class: "z-diff__hunk", key: seg.id }, h("td", { colspan: cols }, seg.header ?? "")));
          continue;
        }
        if (seg.kind === "gap" && !s.expanded.includes(seg.id)) {
          rows.push(
            h(
              "tr",
              { class: "z-diff__gap", key: seg.id },
              h(
                "td",
                { colspan: cols },
                h(
                  "button",
                  { type: "button", class: "z-btn z-btn--ghost z-diff__expand", "data-size": "sm", "data-gap": seg.id },
                  icon("chevron-up-down", 14),
                  fill(labels.expand, { n: seg.lines.length }),
                ),
              ),
            ),
          );
          continue;
        }
        const pairs = c.words ? changePairs(seg.lines) : new Map<DiffLine, DiffLine>();
        const parts = (line: DiffLine | undefined): WordPart[] | null => {
          const other = line ? pairs.get(line) : undefined;
          if (!line || !other) return null;
          const wd = line.kind === "delete" ? wordDiff(line.text, other.text) : wordDiff(other.text, line.text);
          return line.kind === "delete" ? wd.before : wd.after;
        };
        const first = seg.kind === "gap" ? seg.id : undefined;
        if (split) {
          splitRows(seg.lines).forEach((row, ri) => {
            rows.push(
              h(
                "tr",
                {
                  class: "z-diff__row",
                  key: `${seg.id}-${ri}`,
                  "data-left": row.left?.kind,
                  "data-right": row.right?.kind,
                  "data-gap-start": ri === 0 ? first : undefined,
                  tabindex: ri === 0 && first ? -1 : undefined,
                },
                h("td", { class: "z-diff__num", "data-kind": row.left?.kind }, row.left?.old !== undefined ? String(row.left.old) : ""),
                codeCell(row.left, parts(row.left), labels, "z-diff__code z-diff__code--old"),
                h("td", { class: "z-diff__num", "data-kind": row.right?.kind }, row.right?.new !== undefined ? String(row.right.new) : ""),
                codeCell(row.right, parts(row.right), labels, "z-diff__code z-diff__code--new"),
              ),
            );
          });
        } else {
          seg.lines.forEach((line, li) => {
            rows.push(
              h(
                "tr",
                {
                  class: "z-diff__row",
                  key: `${seg.id}-${li}`,
                  "data-kind": line.kind,
                  "data-gap-start": li === 0 ? first : undefined,
                  tabindex: li === 0 && first ? -1 : undefined,
                },
                h("td", { class: "z-diff__num" }, line.old !== undefined ? String(line.old) : ""),
                h("td", { class: "z-diff__num" }, line.new !== undefined ? String(line.new) : ""),
                h("td", { class: "z-diff__sign", "aria-hidden": "true" }, SIGN[line.kind]),
                codeCell(line, parts(line), labels),
              ),
            );
          });
        }
      }
      const head = split ? [labels.oldLine, labels.code, labels.newLine, labels.code] : [labels.oldLine, labels.newLine, "", labels.code];
      const name = file.name || labels.diff;
      return h(
        "div",
        { class: "z-diff__file", key: `file-${fi}` },
        h(
          "div",
          { class: "z-diff__file-head" },
          h("span", { class: "z-diff__icon", "aria-hidden": "true" }, icon("document-text", 16)),
          h("span", { class: "z-diff__name", id: `${uid}-f${fi}` }, name),
          stats(file.added, file.removed),
        ),
        file.binary
          ? h("p", { class: "z-diff__note" }, labels.binary)
          : !file.added && !file.removed
            ? h("p", { class: "z-diff__note" }, labels.noChanges)
            : h(
                "div",
                { class: "z-diff__scroll", tabindex: 0, role: "region", "aria-labelledby": `${uid}-f${fi}` },
                h(
                  "table",
                  { class: "z-diff__table", "data-mode": s.mode },
                  h(
                    "thead",
                    { class: "z-sr-only" },
                    h("tr", null, ...head.map((label, i) => h("th", { scope: "col", key: String(i) }, label))),
                  ),
                  h("tbody", null, ...rows),
                ),
              ),
      );
    };
    return h(
      "div",
      { class: "z-diff", "data-mode": s.mode },
      c.toggle || c.files.length > 1
        ? h(
            "div",
            { class: "z-diff__bar" },
            c.files.length > 1 ? stats(totals.added, totals.removed) : null,
            c.toggle
              ? h(
                  "button",
                  {
                    type: "button",
                    class: "z-btn z-btn--ghost z-diff__mode",
                    "data-size": "sm",
                    "aria-pressed": split ? "true" : "false",
                  },
                  icon("view-columns", 14),
                  labels.split,
                )
              : null,
          )
        : null,
      ...c.files.map(fileTable),
    );
  },
  attach,
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    const read = (sel: string) => el.querySelector<HTMLTemplateElement>(`:scope > template[${sel}]`)?.content.textContent ?? undefined;
    return {
      before: (json.before as string | undefined) ?? read("data-before"),
      after: (json.after as string | undefined) ?? read("data-after"),
      patch: (json.patch as string | undefined) ?? read("data-patch"),
      defaultMode: d.mode === "split" ? "split" : undefined,
      context: d.context !== undefined ? num(d.context, 3) : undefined,
      wordDiff: d.wordDiff === undefined ? undefined : d.wordDiff !== "false",
      fileName: d.fileName,
      hideModeToggle: d.hideModeToggle !== undefined && d.hideModeToggle !== "false",
      labels: json.labels as Partial<DiffViewerLabels> | undefined,
    };
  },
};
