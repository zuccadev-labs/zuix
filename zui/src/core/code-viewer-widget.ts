// CodeViewer como pieza (core/widget): CodeBlock ampliado con números de línea, líneas resaltadas, pestañas de
// archivos, copiar y un resaltado mínimo propio (core/code-tokens) o el que dé la aplicación (`highlight`). Los números
// no se leen ni se copian; una línea resaltada lleva además una barra en el borde, no solo color. El código se pinta
// como nodos de texto, nunca como marcado.
import { localize } from "./locale";

import { languageOf, parseLineRanges, tokenizeLines, type CodeToken } from "./code-tokens";
import { logicalKey } from "./dir";
import { copyControl, copyFromButton, tokenNodes, type CopyLabels, type CopyState } from "./terminal-shared";
import { h, on } from "./vnode";
import { num, yes, type Widget, type WidgetHost } from "./widget";

export interface CodeViewerLabels extends CopyLabels {
  /** Nombre de la región de código (con un solo archivo y sin título). */
  code: string;
  /** Nombre de la lista de archivos. */
  files: string;
}

export const CODE_VIEWER_LABELS: CodeViewerLabels = {
  code: "Code",
  files: "Files",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed",
};

export interface CodeFile {
  name: string;
  code: string;
  language?: string;
}

export interface CodeViewerProps {
  code?: string;
  /** Varios archivos, en pestañas. */
  files?: readonly CodeFile[];
  language?: string;
  /** Título de la barra (con un solo archivo; por defecto, su nombre). */
  title?: string;
  lineNumbers?: boolean;
  /** Líneas resaltadas: `"3-5,9"` o `[3, 4, 5, 9]`. */
  highlightLines?: string | readonly number[];
  /** Número de la primera línea. */
  startLine?: number;
  wrap?: boolean;
  /** Alto máximo (longitud CSS); a partir de ahí desplaza. */
  maxHeight?: string;
  /** Resaltado propio: tokens por línea. Sin él, el tokenizador de la suite (o texto plano). */
  highlight?: (code: string, language: string | undefined) => CodeToken[][];
  /** Archivo abierto al empezar. */
  defaultFile?: number;
  labels?: Partial<CodeViewerLabels>;
}

interface Config {
  files: CodeFile[];
  title: string;
  lineNumbers: boolean;
  marked: Set<number>;
  startLine: number;
  wrap: boolean;
  maxHeight: string;
  highlight?: CodeViewerProps["highlight"];
  defaultFile: number;
  labels: CodeViewerLabels;
}

interface State {
  file: number;
  copied: CopyState;
}

type Host = WidgetHost<Config, State>;

// Tokens por código y lenguaje: volver a pintar (copiar, cambiar de pestaña) no vuelve a tokenizar.
const tokenCache = new Map<string, CodeToken[][]>();
function tokensOf(c: Config, file: CodeFile): CodeToken[][] {
  if (c.highlight) return c.highlight(file.code, file.language);
  const key = `${file.language ?? ""}\u0000${file.code}`;
  let hit = tokenCache.get(key);
  if (!hit) {
    hit = tokenizeLines(file.code, file.language);
    if (tokenCache.size > 64) tokenCache.clear();
    tokenCache.set(key, hit);
  }
  return hit;
}

function attach(root: HTMLElement, host: Host): () => void {
  const click = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const tab = target?.closest?.<HTMLButtonElement>(".z-code-viewer__tab");
    if (tab && root.contains(tab)) {
      const file = Number(tab.dataset.index);
      if (file !== host.state().file) {
        host.update({ file }, true);
        host.emit("file-change", { index: file, name: host.config().files[file]?.name });
      }
      return;
    }
    const copy = target?.closest?.<HTMLButtonElement>(".z-code-viewer__copy");
    if (copy && root.contains(copy)) {
      const file = host.config().files[host.state().file];
      if (file) void copyFromButton(copy, file.code, host.config().labels, (copied) => host.update({ copied }));
    }
  };
  // Pestañas: flechas, Inicio y Fin, con activación automática (patrón APG de pestañas).
  const keydown = (event: KeyboardEvent) => {
    const tab = (event.target as Element | null)?.closest?.<HTMLButtonElement>(".z-code-viewer__tab");
    if (!tab || !root.contains(tab)) return;
    const count = host.config().files.length;
    const key = logicalKey(event.key, tab);
    const at = host.state().file;
    const next =
      key === "ArrowRight"
        ? (at + 1) % count
        : key === "ArrowLeft"
          ? (at - 1 + count) % count
          : key === "Home"
            ? 0
            : key === "End"
              ? count - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    host.update({ file: next }, true);
    host.emit("file-change", { index: next, name: host.config().files[next]?.name });
  };
  root.addEventListener("click", click);
  root.addEventListener("keydown", keydown);
  return () => {
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", keydown);
  };
}

// El `<pre>` del marcado se lee una vez: al montar, el árbol lo sustituye.
const markupCode = new WeakMap<HTMLElement, string>();

export const codeViewerWidget: Widget<CodeViewerProps, Config, State> = {
  root: "z-code-viewer",
  configure: (p) => {
    const files = p.files?.length
      ? p.files.map((f) => ({ ...f, language: f.language ?? languageOf(f.name) }))
      : [{ name: p.title ?? "", code: p.code ?? "", language: p.language }];
    return {
      files,
      title: p.title ?? files[0]?.name ?? "",
      lineNumbers: p.lineNumbers !== false,
      marked: parseLineRanges(p.highlightLines),
      startLine: Math.max(1, Math.floor(Number(p.startLine) || 1)),
      wrap: Boolean(p.wrap),
      maxHeight: p.maxHeight ?? "",
      highlight: p.highlight,
      defaultFile: Math.max(0, Math.min(files.length - 1, Math.floor(Number(p.defaultFile) || 0))),
      labels: { ...localize("codeViewer", CODE_VIEWER_LABELS), ...p.labels },
    };
  },
  initial: (c) => ({ file: c.defaultFile, copied: "idle" }),
  control: (c, s) => (s.file >= c.files.length ? { ...s, file: 0 } : s),
  tree(c, s, uid) {
    const { labels } = c;
    const file = c.files[s.file] ?? c.files[0]!;
    const tabs = c.files.length > 1;
    const tokens = tokensOf(c, file);
    const width = String(c.startLine + tokens.length - 1).length;
    const lines = tokens.map((line, i) => {
      const n = c.startLine + i;
      return h(
        "span",
        { class: "z-code-viewer__line", key: String(i), "data-highlighted": on(c.marked.has(n)) },
        c.lineNumbers ? h("span", { class: "z-code-viewer__number", "aria-hidden": "true" }, String(n)) : null,
        h("span", { class: "z-code-viewer__text" }, ...tokenNodes(line), "\n"),
      );
    });
    const language = file.language;
    return h(
      "div",
      {
        class: "z-code-viewer",
        "data-wrap": on(c.wrap),
        "data-numbers": on(c.lineNumbers),
        "data-language": language,
        s: { "--z-code-viewer-digits": width, ...(c.maxHeight ? { "--z-code-viewer-max": c.maxHeight } : {}) },
      },
      h(
        "div",
        { class: "z-code-viewer__bar" },
        tabs
          ? h(
              "div",
              { class: "z-code-viewer__tabs", role: "tablist", "aria-label": labels.files },
              ...c.files.map((f, i) =>
                h(
                  "button",
                  {
                    type: "button",
                    key: `${i}-${f.name}`,
                    class: "z-code-viewer__tab",
                    role: "tab",
                    id: `${uid}-tab-${i}`,
                    "data-index": i,
                    "aria-selected": i === s.file ? "true" : "false",
                    "aria-controls": `${uid}-panel`,
                    tabindex: i === s.file ? 0 : -1,
                  },
                  f.name,
                ),
              ),
            )
          : c.title
            ? h("span", { class: "z-code-viewer__title" }, c.title)
            : null,
        language ? h("span", { class: "z-code-viewer__language" }, language) : null,
        h("span", { class: "z-code-viewer__actions" }, ...copyControl("z-code-viewer__copy", labels, s.copied)),
      ),
      h(
        "div",
        {
          class: "z-code-viewer__body",
          id: `${uid}-panel`,
          role: tabs ? "tabpanel" : "region",
          "aria-labelledby": tabs ? `${uid}-tab-${s.file}` : undefined,
          "aria-label": tabs ? undefined : c.title || labels.code,
          tabindex: 0,
        },
        h("pre", { class: "z-code-viewer__pre" }, h("code", { class: "z-code-viewer__code" }, ...lines)),
      ),
    );
  },
  attach,
  after(root, _host, focus) {
    if (!focus) return;
    const tab = root.querySelector<HTMLElement>('.z-code-viewer__tab[aria-selected="true"]');
    if (tab && tab !== root.ownerDocument.activeElement) tab.focus();
  },
  fromDom(el, json) {
    const d = el.dataset;
    // El código del marcado: un `<pre><code>` (su texto) o `template[data-file]` por archivo.
    const templates = [...el.querySelectorAll<HTMLTemplateElement>(":scope > template[data-file]")];
    const files =
      (json.files as CodeFile[] | undefined) ??
      templates.map((t) => ({ name: t.dataset.file ?? "", code: t.content.textContent ?? "", language: t.dataset.language }));
    const pre = el.querySelector<HTMLElement>(":scope > pre code, :scope > pre");
    if (pre && !markupCode.has(el)) markupCode.set(el, pre.textContent ?? "");
    return {
      code: (json.code as string | undefined) ?? markupCode.get(el),
      files: files.length ? files : undefined,
      language: d.language,
      title: d.title,
      lineNumbers: d.lineNumbers === undefined ? undefined : yes(d.lineNumbers),
      highlightLines: d.highlightLines,
      startLine: d.startLine ? num(d.startLine, 1) : undefined,
      wrap: yes(d.wrap),
      maxHeight: d.maxHeight,
      labels: json.labels as Partial<CodeViewerLabels> | undefined,
    };
  },
};
