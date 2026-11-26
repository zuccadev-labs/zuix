// Mentions: menciones con `@` y `#` (o los disparadores que se pidan) sobre cualquier `<textarea>` o `<input>` del
// contenedor `.z-mentions`. Patrón APG «combobox» con lista emergente: el campo conserva el foco y lleva
// `aria-controls`, `aria-autocomplete="list"` y `aria-activedescendant`; ↑/↓ mueven la opción activa, Intro o Tab
// eligen, Escape cierra. La lista se ancla al cursor. Las opciones salen de una lista fija (filtrada sin acentos) o de
// una carga asíncrona con antirrebote y cancelación, la misma de Combobox y Listbox (./async-options). El campo puede
// ser de React (controlado): el texto se escribe con el setter nativo y un evento `input`, como si lo tecleara la
// persona. Solo toca el documento al llamarse.
import { announce } from "./announcer";
import { createAsyncOptions, type AsyncLoader, type AsyncOptions, type AsyncState } from "./async-options";
import { caretBox } from "./caret";
import { filterMentions, findTrigger, insertMention, type MentionItem, type MentionMatch } from "./mentions";
import { place } from "./place";
import { popoverOpen, showPopover } from "./popover";

export interface MentionSource {
  /** Carácter que abre la lista: `@`, `#`… */
  trigger: string;
  /** Candidatos fijos (se filtran sin acentos ni mayúsculas). */
  items?: readonly MentionItem[];
  /** Carga asíncrona: recibe lo escrito tras el disparador y una señal para cancelar. */
  load?: AsyncLoader<MentionItem>;
  /** Nombre de la lista («People», «Channels»). */
  label?: string;
}

export interface MentionsLabels {
  /** Nombre de la lista si la fuente no trae uno. */
  suggestions: string;
  loading: string;
  empty: string;
  error: string;
  /** «{count} suggestions». */
  count: string;
}

export const MENTIONS_LABELS: MentionsLabels = {
  suggestions: "Suggestions",
  loading: "Loading suggestions…",
  empty: "No matches",
  error: "Couldn't load suggestions",
  count: "{count} suggestions",
};

export interface ChosenMention extends MentionItem {
  trigger: string;
}

export interface MentionsHost {
  sources(): readonly MentionSource[];
  labels(): MentionsLabels;
  /** Elegida una mención: la aplicación la guarda para codificar el texto al enviar (`encodeMentions`). */
  select(item: ChosenMention): void;
}

interface Open {
  match: MentionMatch;
  source: MentionSource;
  options: MentionItem[];
  active: number;
  status: "ready" | "loading" | "error";
}

const setNativeValue = (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, value);
};

/** Conecta un contenedor `.z-mentions`; devuelve la función que lo desconecta. */
export function attachMentions(root: HTMLElement, host: MentionsHost): () => void {
  const doc = root.ownerDocument;
  const field = () => root.querySelector<HTMLTextAreaElement | HTMLInputElement>("textarea, input:not([type=hidden])");
  let popup = root.querySelector<HTMLElement>(":scope > .z-mentions__popup");
  if (!popup) {
    popup = doc.createElement("div");
    popup.className = "z-liquid z-listbox z-mentions__popup";
    root.append(popup);
  }
  const list = popup;
  const uid = root.id || `z-mentions-${Math.random().toString(36).slice(2, 8)}`;
  list.id ||= `${uid}-list`;
  list.setAttribute("popover", "manual");
  list.setAttribute("role", "listbox");
  list.dataset.size = "sm";
  let open: Open | null = null;
  const loaders = new Map<string, AsyncOptions<MentionItem>>();
  let wired: HTMLTextAreaElement | HTMLInputElement | null = null;

  const describe = (el: HTMLTextAreaElement | HTMLInputElement) => {
    el.setAttribute("aria-autocomplete", "list");
    el.setAttribute("aria-controls", list.id);
    // Un <input> puede ser combobox; un <textarea> sigue siendo un cuadro de texto con lista asociada.
    if (el instanceof HTMLInputElement) {
      el.setAttribute("role", "combobox");
      el.setAttribute("aria-expanded", String(Boolean(open)));
    }
  };

  const close = () => {
    if (!open) return;
    open = null;
    for (const l of loaders.values()) l.abort();
    if (popoverOpen(list)) list.hidePopover?.();
    list.replaceChildren();
    const el = field();
    el?.removeAttribute("aria-activedescendant");
    if (el instanceof HTMLInputElement) el.setAttribute("aria-expanded", "false");
  };

  const optionId = (i: number) => `${list.id}-${i}`;

  const render = (announceCount: boolean) => {
    const el = field();
    if (!open || !el) return;
    const labels = host.labels();
    const rows: HTMLElement[] = [];
    open.options.forEach((item, i) => {
      const row = doc.createElement("div");
      row.className = "z-listbox__option z-mentions__option";
      row.id = optionId(i);
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(i === open!.active));
      if (i === open!.active) row.dataset.highlighted = "";
      row.dataset.index = String(i);
      const avatar = doc.createElement("span");
      avatar.className = "z-mentions__avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = open!.match.trigger === "@" ? (item.label.trim()[0] ?? "").toUpperCase() : open!.match.trigger;
      const text = doc.createElement("span");
      text.className = "z-listbox__text";
      text.textContent = item.label;
      row.append(avatar, text);
      if (item.description) {
        const desc = doc.createElement("span");
        desc.className = "z-mentions__description";
        desc.textContent = item.description;
        row.append(desc);
      }
      rows.push(row);
    });
    const message = open.status === "loading" ? labels.loading : open.status === "error" ? labels.error : open.options.length ? "" : labels.empty;
    if (message) {
      const status = doc.createElement("div");
      status.className = "z-mentions__status";
      status.dataset.status = open.status === "ready" ? "empty" : open.status;
      status.setAttribute("aria-hidden", "true");
      status.textContent = message;
      rows.push(status);
    }
    list.setAttribute("aria-label", open.source.label ?? labels.suggestions);
    list.setAttribute("aria-busy", String(open.status === "loading"));
    list.replaceChildren(...rows);
    if (!popoverOpen(list)) showPopover(list);
    const caret = caretBox(el, open.match.start);
    place(list, { left: caret.x, top: caret.y, width: 1, height: caret.height }, "bottom-start", 4);
    if (open.options.length) {
      el.setAttribute("aria-activedescendant", optionId(open.active));
      list.querySelector<HTMLElement>("[data-highlighted]")?.scrollIntoView?.({ block: "nearest" });
    } else el.removeAttribute("aria-activedescendant");
    if (el instanceof HTMLInputElement) el.setAttribute("aria-expanded", "true");
    if (announceCount) announce(message || labels.count.replace("{count}", String(open.options.length)), { source: root });
  };

  const loaderFor = (source: MentionSource) => {
    let loader = loaders.get(source.trigger);
    if (!loader && source.load) {
      loader = createAsyncOptions<MentionItem>({
        // La carga se busca en cada petición: la aplicación puede cambiarla (setMentionsLoader).
        load: (q, ctx) => {
          const now = host.sources().find((s) => s.trigger === source.trigger);
          return now?.load ? now.load(q, ctx) : Promise.resolve([]);
        },
        debounce: 200,
        onChange(state: AsyncState<MentionItem>) {
          if (!open || open.source.trigger !== source.trigger) return;
          open = {
            ...open,
            options: state.options.slice(0, 8),
            status: state.status === "error" ? "error" : state.status === "loading" ? "loading" : "ready",
            active: Math.min(open.active, Math.max(0, state.options.length - 1)),
          };
          render(state.status !== "loading");
        },
      });
      loaders.set(source.trigger, loader);
    }
    return loader;
  };

  const refresh = () => {
    const el = field();
    if (!el || el.disabled || el.readOnly) return close();
    const sources = host.sources();
    const triggers = sources.map((s) => s.trigger).filter(Boolean);
    const caret = el.selectionStart ?? el.value.length;
    const match = el.selectionStart === el.selectionEnd ? findTrigger(el.value, caret, triggers) : null;
    const source = match ? sources.find((s) => s.trigger === match.trigger) : undefined;
    if (!match || !source) return close();
    const same = open && open.match.start === match.start && open.source.trigger === source.trigger;
    const changed = !same || open?.match.query !== match.query;
    if (source.load) {
      open = { match, source, options: same ? open!.options : [], active: same ? open!.active : 0, status: same ? open!.status : "loading" };
      if (changed) loaderFor(source)?.search(match.query, !same);
      render(false);
      return;
    }
    const options = filterMentions(source.items ?? [], match.query);
    open = { match, source, options, active: same ? Math.min(open!.active, Math.max(0, options.length - 1)) : 0, status: "ready" };
    render(changed);
  };

  const choose = (index: number) => {
    const el = field();
    if (!open || !el) return;
    const item = open.options[index];
    if (!item) return;
    const next = insertMention(el.value, open.match, item);
    const trigger = open.match.trigger;
    close();
    setNativeValue(el, next.text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.setSelectionRange(next.caret, next.caret);
    el.focus();
    host.select({ ...item, trigger });
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.target !== field() || !open || event.isComposing) return;
    const count = open.options.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!count) return;
      event.preventDefault();
      open = { ...open, active: (open.active + (event.key === "ArrowDown" ? 1 : -1) + count) % count };
      render(false);
    } else if ((event.key === "Enter" || event.key === "Tab") && count && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      choose(open.active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };
  const onInput = (event: Event) => {
    if (event.target === field()) refresh();
  };
  const onCaret = (event: Event) => {
    if (event.target !== field()) return;
    const key = (event as KeyboardEvent).key;
    if (event.type === "keyup" && !["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
    refresh();
  };
  const onBlur = (event: FocusEvent) => {
    if (event.target === field() && !list.contains(event.relatedTarget as Node)) close();
  };
  // La lista no se lleva el foco: se elige con el puntero sin que el campo lo pierda.
  const onListDown = (event: PointerEvent) => event.preventDefault();
  const onListClick = (event: MouseEvent) => {
    const row = (event.target as Element).closest?.<HTMLElement>(".z-mentions__option");
    if (row) choose(Number(row.dataset.index));
  };
  const onListMove = (event: PointerEvent) => {
    const row = (event.target as Element).closest?.<HTMLElement>(".z-mentions__option");
    if (!row || !open || Number(row.dataset.index) === open.active) return;
    open = { ...open, active: Number(row.dataset.index) };
    render(false);
  };
  const wire = () => {
    const el = field();
    if (el === wired) return;
    wired = el;
    if (el) describe(el);
  };
  root.addEventListener("keydown", onKey, true);
  root.addEventListener("input", onInput);
  root.addEventListener("keyup", onCaret);
  root.addEventListener("click", onCaret);
  root.addEventListener("focusout", onBlur);
  list.addEventListener("pointerdown", onListDown);
  list.addEventListener("click", onListClick);
  list.addEventListener("pointermove", onListMove);
  const Observer = doc.defaultView?.MutationObserver;
  const mutations = Observer ? new Observer(wire) : null;
  mutations?.observe(root, { childList: true, subtree: true });
  wire();
  return () => {
    close();
    mutations?.disconnect();
    root.removeEventListener("keydown", onKey, true);
    root.removeEventListener("input", onInput);
    root.removeEventListener("keyup", onCaret);
    root.removeEventListener("click", onCaret);
    root.removeEventListener("focusout", onBlur);
    list.removeEventListener("pointerdown", onListDown);
    list.removeEventListener("click", onListClick);
    list.removeEventListener("pointermove", onListMove);
  };
}
