// Terminal como pieza (core/widget): pantalla de líneas con colores ANSI (core/ansi) y una línea de entrada con
// prompt, historial (↑/↓), autocompletado con Tab (solo si la aplicación lo ofrece: si no, Tab sale), Ctrl+L para
// limpiar y Ctrl+C para interrumpir (solo sin texto seleccionado; con selección, copia). La salida llega a trozos por
// `write()` o por lo que devuelve `onCommand` (texto, promesa o iterable asíncrono). Intro envía con el envío nativo
// del formulario, que no se dispara mientras un IME compone. La salida es `role="log"` sin anunciar cada línea; al
// terminar una orden se anuncia el final (o el código de salida si no es 0). El texto nunca entra como marcado.
import { localize, formatList } from "./locale";

import { createAnsiScreen, type AnsiLine, type AnsiScreen } from "./ansi";
import { completeInput, createHistory, type CommandHistory } from "./history";
import { ansiSpan, copyControl, copyFromButton, memoLine, type CopyLabels, type CopyState } from "./terminal-shared";
import { fill, h, icon, on, type VEl } from "./vnode";
import { announceIn, num, yes, type Widget, type WidgetHost } from "./widget";

export interface TerminalLabels extends CopyLabels {
  /** Nombre de la pieza. */
  terminal: string;
  /** Nombre de la salida. */
  output: string;
  /** Etiqueta del campo de entrada. */
  input: string;
  clear: string;
  done: string;
  /** «Exit code {code}». */
  failed: string;
  interrupted: string;
  running: string;
  /** «{n} completions: {list}». */
  completions: string;
}

export const TERMINAL_LABELS: TerminalLabels = {
  terminal: "Terminal",
  output: "Terminal output",
  input: "Command",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed",
  clear: "Clear",
  done: "Command finished",
  failed: "Exit code {code}",
  interrupted: "Interrupted",
  running: "Running",
  completions: "{n} completions: {list}",
};

export interface TerminalRun {
  /** Escribe salida mientras la orden corre. */
  write(chunk: string): void;
  /** Se aborta con Ctrl+C. */
  signal: AbortSignal;
}

/** Lo que puede devolver una orden: nada, texto, un código de salida, una promesa de eso o un flujo de trozos. */
// biome-ignore lint/suspicious/noConfusingVoidType: es el valor de retorno de un callback; una orden que no devuelve nada es lo habitual.
export type TerminalResult = void | string | number | Promise<void | string | number> | AsyncIterable<string>;

export interface TerminalProps {
  /** Texto del prompt (`user@host:~$`). */
  prompt?: string;
  /** Salida inicial (admite ANSI). */
  defaultOutput?: string;
  /** Ejecuta una orden. Sin él, la orden solo se anuncia (`command`). */
  onCommand?: (command: string, run: TerminalRun) => TerminalResult;
  /** Opciones de completado para lo escrito (Tab). Sin él, Tab sale de la terminal. */
  onComplete?: (input: string) => readonly string[] | Promise<readonly string[]>;
  /** Historial inicial (de la más antigua a la más reciente). */
  history?: readonly string[];
  /** Líneas que se conservan (las más antiguas se descartan). */
  maxLines?: number;
  /** Sin línea de entrada: solo salida. */
  readOnly?: boolean;
  /** Ocupada desde fuera (una orden que corre en otro sitio). */
  busy?: boolean;
  /** Título de la barra. */
  title?: string;
  /** `glass` (por defecto) o `solid`. */
  theme?: "glass" | "solid";
  /** Qué se anuncia: el final de cada orden (por defecto), cada línea nueva o nada. */
  announce?: "end" | "all" | "none";
  labels?: Partial<TerminalLabels>;
}

interface Config {
  prompt: string;
  defaultOutput: string;
  run?: TerminalProps["onCommand"];
  complete?: TerminalProps["onComplete"];
  history: readonly string[];
  maxLines: number;
  readOnly: boolean;
  busy: boolean;
  title: string;
  theme: "glass" | "solid";
  announce: "end" | "all" | "none";
  labels: TerminalLabels;
}

interface State {
  screen: AnsiScreen;
  history: CommandHistory;
  version: number;
  running: boolean;
  copied: CopyState;
}

type Host = WidgetHost<Config, State>;

/** API imperativa de una terminal montada (React: la `ref`; modo DOM: `terminal(el)`). */
export interface TerminalApi {
  write(chunk: string): void;
  writeln(line?: string): void;
  clear(): void;
  focus(): void;
  /** Texto plano de la salida. */
  text(): string;
}

const apis = new WeakMap<HTMLElement, TerminalApi>();
/** API de una terminal montada, o `null`. */
export const terminalApi = (el: HTMLElement | null | undefined): TerminalApi | null => (el ? (apis.get(el) ?? null) : null);

const lineCache = new WeakMap<AnsiLine, VEl>();
// Lo que la persona escribe no lleva secuencias: se quitan los caracteres de control antes de repetirlo en la salida.
const visible = (text: string) =>
  [...text]
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || (code >= 32 && code !== 127);
    })
    .join("");
const isIterable = (v: unknown): v is AsyncIterable<string> => typeof (v as AsyncIterable<string>)?.[Symbol.asyncIterator] === "function";
const isPromise = (v: unknown): v is Promise<unknown> => typeof (v as Promise<unknown>)?.then === "function";

interface Live {
  stick: boolean;
  frame: number;
  controller: AbortController | null;
}
const live = new WeakMap<HTMLElement, Live>();

function attach(root: HTMLElement, host: Host): () => void {
  const state: Live = { stick: true, frame: 0, controller: null };
  live.set(root, state);
  const screen = () => host.state().screen;
  const input = () => root.querySelector<HTMLInputElement>(".z-terminal__field");
  const out = () => root.querySelector<HTMLElement>(".z-terminal__screen");
  // Varios trozos en el mismo fotograma se pintan una vez.
  const repaint = () => {
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      host.update({ version: host.state().version + 1 });
    });
  };
  const write = (chunk: string) => {
    if (!chunk) return;
    screen().write(chunk);
    repaint();
  };
  const api: TerminalApi = {
    write,
    writeln: (line = "") => write(`${line}\n`),
    clear: () => {
      screen().clear();
      repaint();
    },
    focus: () => (input() ?? out())?.focus(),
    text: () => screen().text(),
  };
  apis.set(root, api);

  const finish = (code: number | null, interrupted = false) => {
    state.controller = null;
    host.update({ running: false });
    const { labels, announce } = host.config();
    if (announce === "none") return;
    announceIn(root, interrupted ? labels.interrupted : code ? fill(labels.failed, { code }) : labels.done, ".z-terminal__live");
  };

  const execute = async (command: string) => {
    const c = host.config();
    write(`\x1b[1;32m${visible(c.prompt)}\x1b[0m ${visible(command)}\n`);
    host.emit("command", { command });
    if (!c.run || !command.trim()) return;
    const controller = new AbortController();
    state.controller = controller;
    host.update({ running: true });
    let code: number | null = null;
    try {
      const result = c.run(command, { write, signal: controller.signal });
      if (isIterable(result)) {
        for await (const chunk of result) {
          if (controller.signal.aborted) break;
          write(chunk);
        }
      } else {
        const value = isPromise(result) ? await result : result;
        if (typeof value === "string") write(value.endsWith("\n") ? value : `${value}\n`);
        else if (typeof value === "number") code = value;
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        write(`\x1b[31m${visible(error instanceof Error ? error.message : String(error))}\x1b[0m\n`);
        code = 1;
      }
    }
    if (state.controller === controller) finish(code, controller.signal.aborted);
  };

  const submit = (event: SubmitEvent) => {
    const form = event.target as HTMLFormElement;
    if (!form.matches?.(".z-terminal__input") || !root.contains(form)) return;
    event.preventDefault();
    const field = input();
    if (!field || host.state().running || host.config().busy) return;
    const command = field.value;
    field.value = "";
    host.state().history.push(command);
    void execute(command);
  };

  const keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.matches?.(".z-terminal__screen") && event.key === "Escape") {
      input()?.focus();
      return;
    }
    if (!target.matches?.(".z-terminal__field")) return;
    const field = target as HTMLInputElement;
    const past = host.state().history;
    const noSelection = field.selectionStart === field.selectionEnd;
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && noSelection && !event.altKey && !event.shiftKey) {
      const next = event.key === "ArrowUp" ? past.previous(field.value) : past.next();
      if (next === null) return;
      event.preventDefault();
      field.value = next;
      field.setSelectionRange(next.length, next.length);
      return;
    }
    if (event.key === "Tab" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const complete = host.config().complete;
      // Sin completado (o sin nada escrito), Tab sale de la terminal: el foco nunca queda atrapado.
      if (!complete || !field.value) return;
      event.preventDefault();
      const typed = field.value;
      void Promise.resolve(complete(typed)).then((options) => {
        if (field.value !== typed) return;
        const { value, list: shown } = completeInput(typed, options);
        field.value = value;
        field.setSelectionRange(value.length, value.length);
        if (shown.length) {
          write(`\x1b[2m${shown.map(visible).join("  ")}\x1b[0m\n`);
          announceIn(root, fill(host.config().labels.completions, { n: shown.length, list: formatList(shown) }), ".z-terminal__live");
        }
      });
      return;
    }
    const ctrl = event.ctrlKey && !event.altKey && !event.metaKey;
    if (ctrl && event.key.toLowerCase() === "l") {
      event.preventDefault();
      api.clear();
      return;
    }
    if (ctrl && event.key.toLowerCase() === "c") {
      // Con texto seleccionado (en el campo o en la página), Ctrl+C copia como siempre.
      const selection = root.ownerDocument.getSelection?.();
      const selected = !noSelection || Boolean(selection?.toString() && selection.anchorNode && root.contains(selection.anchorNode));
      if (selected) return;
      event.preventDefault();
      if (state.controller) {
        state.controller.abort();
        write("^C\n");
        host.emit("interrupt", {});
        finish(130, true);
      } else {
        write(`\x1b[1;32m${visible(host.config().prompt)}\x1b[0m ${visible(field.value)}^C\n`);
        field.value = "";
        host.state().history.reset();
      }
    }
  };

  const click = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const copy = target?.closest?.<HTMLButtonElement>(".z-terminal__copy");
    if (copy && root.contains(copy)) {
      void copyFromButton(copy, screen().text(), host.config().labels, (copied) => host.update({ copied }));
      return;
    }
    const clear = target?.closest?.<HTMLButtonElement>(".z-terminal__clear");
    if (clear && root.contains(clear)) {
      api.clear();
      host.emit("clear", {});
      return;
    }
    // Pulsar en la salida sin seleccionar nada lleva a la entrada (como en una terminal).
    if (target?.closest?.(".z-terminal__screen") && !root.ownerDocument.getSelection?.()?.toString() && !target.closest("a"))
      input()?.focus();
  };

  const scroll = (event: Event) => {
    const el = event.target as HTMLElement;
    if (!el.matches?.(".z-terminal__screen")) return;
    state.stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
  };

  root.addEventListener("submit", submit);
  root.addEventListener("keydown", keydown);
  root.addEventListener("click", click);
  root.addEventListener("scroll", scroll, true);
  return () => {
    root.removeEventListener("submit", submit);
    root.removeEventListener("keydown", keydown);
    root.removeEventListener("click", click);
    root.removeEventListener("scroll", scroll, true);
    cancelAnimationFrame(state.frame);
    state.controller?.abort();
    apis.delete(root);
    live.delete(root);
  };
}

export const terminalWidget: Widget<TerminalProps, Config, State> = {
  root: "z-terminal",
  configure: (p) => ({
    prompt: p.prompt ?? "$",
    defaultOutput: p.defaultOutput ?? "",
    run: p.onCommand,
    complete: p.onComplete,
    history: p.history ?? [],
    maxLines: Math.max(1, Math.floor(Number(p.maxLines) || 5000)),
    readOnly: Boolean(p.readOnly),
    busy: Boolean(p.busy),
    title: p.title ?? "",
    theme: p.theme === "solid" ? "solid" : "glass",
    announce: p.announce === "all" || p.announce === "none" ? p.announce : "end",
    labels: { ...localize("terminal", TERMINAL_LABELS), ...p.labels },
  }),
  initial(c) {
    const screen = createAnsiScreen(c.maxLines);
    if (c.defaultOutput) screen.write(c.defaultOutput);
    return { screen, history: createHistory(c.history), version: 0, running: false, copied: "idle" };
  },
  tree(c, s, uid) {
    const { labels } = c;
    const busy = s.running || c.busy;
    const lines = s.screen
      .lines()
      .map((line) =>
        memoLine(lineCache, line, () =>
          h(
            "div",
            { class: "z-terminal__line", key: String(line.id) },
            ...(line.spans.length ? line.spans.map((sp, i) => ansiSpan(sp, String(i))) : ["​"]),
          ),
        ),
      );
    return h(
      "div",
      { class: "z-terminal", role: "region", "aria-label": c.title || labels.terminal, "data-theme": c.theme, "data-running": on(busy) },
      h(
        "div",
        { class: "z-terminal__bar" },
        h("span", { class: "z-terminal__icon", "aria-hidden": "true" }, icon("command-line", 16)),
        h("span", { class: "z-terminal__title" }, c.title || labels.terminal),
        busy
          ? h("span", { class: "z-terminal__status" }, h("span", { class: "z-terminal__pulse", "aria-hidden": "true" }), labels.running)
          : null,
        h(
          "span",
          { class: "z-terminal__actions" },
          ...copyControl("z-terminal__copy", labels, s.copied),
          h(
            "button",
            {
              type: "button",
              class: "z-btn z-btn--ghost z-btn--icon z-terminal__clear",
              "data-size": "sm",
              "aria-label": labels.clear,
              title: labels.clear,
            },
            icon("trash", 14),
          ),
        ),
      ),
      h(
        "div",
        {
          class: "z-terminal__screen",
          id: `${uid}-screen`,
          role: "log",
          "aria-live": c.announce === "all" ? "polite" : "off",
          "aria-label": labels.output,
          tabindex: 0,
        },
        ...lines,
      ),
      c.readOnly
        ? null
        : h(
            "form",
            { class: "z-terminal__input", "aria-busy": busy ? "true" : undefined },
            h("label", { class: "z-sr-only", for: `${uid}-field` }, labels.input),
            h("span", { class: "z-terminal__prompt", "aria-hidden": "true" }, c.prompt),
            h("input", {
              class: "z-terminal__field",
              id: `${uid}-field`,
              type: "text",
              autocomplete: "off",
              autocapitalize: "off",
              autocorrect: "off",
              spellcheck: "false",
              enterkeyhint: "send",
              "aria-controls": `${uid}-screen`,
            }),
          ),
      h("span", { class: "z-sr-only z-terminal__live", role: "status", "data-live": "" }),
    );
  },
  attach,
  after(root) {
    const state = live.get(root);
    const screen = root.querySelector<HTMLElement>(".z-terminal__screen");
    // Sigue el final mientras la persona no haya subido a leer.
    if (screen && state?.stick !== false) screen.scrollTop = screen.scrollHeight;
  },
  fromDom(el, json) {
    const d = el.dataset;
    const script = el.querySelector<HTMLTemplateElement>(":scope > template[data-output]");
    return {
      prompt: d.prompt,
      defaultOutput: (json.output as string | undefined) ?? script?.content.textContent ?? undefined,
      history: json.history as string[] | undefined,
      maxLines: d.maxLines ? num(d.maxLines, 5000) : undefined,
      readOnly: yes(d.readOnly),
      busy: yes(d.busy),
      title: d.title,
      theme: d.theme === "solid" ? "solid" : undefined,
      announce: d.announce === "all" || d.announce === "none" ? d.announce : undefined,
      labels: json.labels as Partial<TerminalLabels> | undefined,
    };
  },
};
