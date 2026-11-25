// Listbox en línea y TagsInput sin framework.
//
// Listbox    .z-listbox[data-inline] > [role=listbox].z-listbox__viewport > .z-listbox__option[role=option][data-value]
//            (también dentro de .z-listbox__group). data-multiple en .z-listbox para varias. Una parada de Tab;
//            flechas, Inicio, Fin y búsqueda por letra; en single la selección sigue al foco; en multiple Espacio
//            marca, Mayús+flecha extiende y Ctrl/⌘+A marca todas. Campos ocultos con data-name="…" en .z-listbox.
//            z:change { value } (cadena o lista). setListboxValue().
// TagsInput  .z-input.z-tags > .z-tags__tag* + input.z-tags__input + [role=status]. En .z-tags: data-max,
//            data-max-length, data-delimiters (",;"), data-name (campos ocultos), data-allow-duplicates.
//            z:change { value: string[] }, z:reject { rejected }. setTagsValue().
// Editable   .z-editable[data-value] > button.z-editable__preview > .z-editable__text + .z-editable__input[hidden] (input o
//            textarea) + .z-editable__controls opcional ([data-action=edit|save|cancel]). data-activation="click|focus|
//            dblclick|none", data-multiline, data-keep (salir descarta), data-required. z:change { value } al guardar.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { logicalKey } from "../core/dir";
import { move } from "../core/roving";
import { addTags, splitTags } from "../core/tags";
import { createTypeahead, isPrintable } from "../core/typeahead";
import { createAsyncOptions, type AsyncLoader, type AsyncOptions } from "../core/async-options";
import { all, emit, flag, inDom } from "./forms-popup";
import { buildOption, deferLongList, paintAsyncStatus, type AsyncLoaderOptions, type ComboboxOption } from "./forms-listbox";
import { setMarkup, type Listen } from "./shared";

registerIcons([xMark]);

/* ---------- Listbox ---------- */

const LISTBOX = ".z-listbox[data-inline]";
const optionsOf = (box: Element) => [...box.querySelectorAll<HTMLElement>(".z-listbox__option")];
const usable = (option: HTMLElement) => !option.hasAttribute("data-disabled") && option.getAttribute("aria-disabled") !== "true";
const optionValue = (option: HTMLElement) => option.dataset.value ?? option.textContent?.trim() ?? "";
const labelOf = (option: HTMLElement) => option.dataset.label ?? option.querySelector(".z-listbox__text")?.textContent?.trim() ?? "";
const isMultiple = (box: HTMLElement) => box.hasAttribute("data-multiple");
const on = (option: Element) => option.getAttribute("aria-selected") === "true";
const search = createTypeahead();

function listValue(box: HTMLElement): string | string[] {
  const values = optionsOf(box).filter(on).map(optionValue);
  return isMultiple(box) ? values : (values[0] ?? "");
}

function paintList(box: HTMLElement, values: ReadonlyArray<string>, focus?: HTMLElement): void {
  const options = optionsOf(box);
  for (const option of options) {
    const selected = values.includes(optionValue(option));
    option.setAttribute("aria-selected", String(selected));
    option.dataset.state = selected ? "checked" : "unchecked";
  }
  const live = options.filter(usable);
  const stop = (focus && live.includes(focus) ? focus : undefined) ?? live.find(on) ?? live[0];
  for (const option of options) option.tabIndex = option === stop ? 0 : -1;
  const name = box.dataset.name;
  if (name) {
    for (const old of box.querySelectorAll(':scope > input[type="hidden"]')) old.remove();
    for (const value of values) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      box.append(input);
    }
  }
}

function commitList(box: HTMLElement, values: ReadonlyArray<string>, focus?: HTMLElement): void {
  const before = JSON.stringify(listValue(box));
  paintList(box, values, focus);
  const after = listValue(box);
  if (JSON.stringify(after) !== before) emit(box, "change", { value: after });
}

/** Fija la selección de un Listbox (cadena o lista). Emite z:change si cambia. */
export function setListboxValue(box: HTMLElement, value: string | ReadonlyArray<string>): void {
  commitList(box, typeof value === "string" ? (value ? [value] : []) : value);
}

function chooseOption(box: HTMLElement, option: HTMLElement, mode: "toggle" | "add" = "toggle"): void {
  if (!usable(option) || box.hasAttribute("data-disabled")) return;
  const value = optionValue(option);
  if (!isMultiple(box)) {
    commitList(box, [value], option);
    return;
  }
  const current = listValue(box) as string[];
  const next = current.includes(value) ? (mode === "add" ? current : current.filter((v) => v !== value)) : [...current, value];
  commitList(box, next, option);
}

function onListKey(box: HTMLElement, option: HTMLElement, event: KeyboardEvent): void {
  const live = optionsOf(box).filter(usable);
  const vertical = box.dataset.orientation !== "horizontal";
  const next = move(live, option, vertical ? event.key : logicalKey(event.key, box), vertical, false);
  if (next && next === live[live.length - 1]) listLoaders.get(box)?.more();
  if (next) {
    event.preventDefault();
    next.focus();
    if (!isMultiple(box)) chooseOption(box, next);
    else if (event.shiftKey) chooseOption(box, next, "add");
    else paintList(box, listValue(box) as string[], next);
    return;
  }
  if (isMultiple(box) && (event.key === "a" || event.key === "A") && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    const values = live.map(optionValue);
    const current = listValue(box) as string[];
    commitList(box, values.every((v) => current.includes(v)) ? [] : values, option);
    return;
  }
  if ((event.key === " " && !search.pending()) || event.key === "Enter") {
    event.preventDefault();
    chooseOption(box, option);
    return;
  }
  if (isPrintable(event)) {
    const hit = live[search(live.map(labelOf), event.key, live.indexOf(option))];
    if (!hit) return;
    event.preventDefault();
    hit.focus();
    if (!isMultiple(box)) chooseOption(box, hit);
    else paintList(box, listValue(box) as string[], hit);
  }
}

/* ---------- Listbox con opciones del servidor ---------- */

const listLoaders = new WeakMap<HTMLElement, AsyncOptions<ComboboxOption>>();

/**
 * Opciones del servidor para un Listbox en línea: la primera página se pide al llamar y las siguientes al llegar al
 * final de la lista (si la respuesta trae `hasMore`). Mientras carga, aria-busy y el texto `data-loading-text`; si
 * falla, `data-error-text` con un botón para reintentar. Conserva la selección.
 */
export function setListboxLoader(box: HTMLElement, load: AsyncLoader<ComboboxOption>, options: AsyncLoaderOptions = {}): void {
  const viewport = box.querySelector<HTMLElement>(":scope > .z-listbox__viewport");
  if (!viewport) return;
  listLoaders.get(box)?.abort();
  const sizes: Record<string, number> = { sm: 14, md: 16, lg: 18 };
  const engine = createAsyncOptions<ComboboxOption>({
    load,
    debounce: options.debounce,
    onChange(state) {
      flag(viewport, "aria-busy", state.status === "loading" || state.loadingMore, "true");
      if (state.status === "ready") {
        const values = listValue(box);
        viewport.replaceChildren(...state.options.map((option) => buildOption(option, sizes[box.dataset.size ?? "md"] ?? 16)));
        paintList(box, typeof values === "string" ? (values ? [values] : []) : values);
        deferLongList(viewport, box);
      }
      let first = box.querySelector<HTMLElement>(":scope > .z-listbox__empty:not([data-async])");
      const loadingFirst = state.status === "loading" && state.options.length === 0;
      if (loadingFirst && !first) {
        first = document.createElement("div");
        first.className = "z-listbox__empty";
        first.setAttribute("role", "status");
        first.setAttribute("data-loading", "");
        box.append(first);
      }
      if (loadingFirst && first) first.textContent = box.dataset.loadingText ?? "Loading";
      else if (state.status !== "loading") first?.remove();
      paintAsyncStatus(box, state, box);
    },
  });
  listLoaders.set(box, engine);
  viewport.addEventListener(
    "scroll",
    () => {
      if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 48) engine.more();
    },
    { passive: true },
  );
  box.addEventListener("click", (event) => {
    if ((event.target as Element).closest("[data-retry]")) engine.retry();
  });
  engine.search("", true);
}

/* ---------- TagsInput ---------- */

const tagsOf = (box: Element) => [...box.querySelectorAll<HTMLElement>(":scope > .z-tags__tag")];
const tagValue = (tag: HTMLElement) => tag.dataset.value ?? tag.querySelector(".z-tags__text")?.textContent ?? "";
const tagsInput = (box: Element) => box.querySelector<HTMLInputElement>(".z-tags__input");
const delimitersOf = (box: HTMLElement) => [...(box.dataset.delimiters ?? ",")];

function announce(box: HTMLElement, text: string): void {
  const status = box.querySelector<HTMLElement>(':scope > [role="status"]');
  if (status) status.textContent = text;
}

function buildTag(box: HTMLElement, value: string): HTMLElement {
  const tag = document.createElement("span");
  tag.className = "z-tags__tag";
  tag.tabIndex = -1;
  tag.dataset.value = value;
  const text = document.createElement("span");
  text.className = "z-tags__text";
  text.textContent = value;
  tag.append(text);
  const input = tagsInput(box);
  if (!input?.disabled && !box.hasAttribute("data-readonly")) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "z-tags__remove";
    remove.tabIndex = -1;
    const label = (box.dataset.removeLabel ?? "Remove {tag}").replace("{tag}", value);
    remove.setAttribute("aria-label", label);
    remove.title = label;
    setMarkup(remove, iconSvg("x-mark", { size: box.dataset.size === "sm" ? 12 : 14 }));
    tag.append(remove);
  }
  return tag;
}

function writeTags(box: HTMLElement, values: ReadonlyArray<string>): void {
  const input = tagsInput(box);
  for (const tag of tagsOf(box)) tag.remove();
  for (const value of values) box.insertBefore(buildTag(box, value), input);
  const name = box.dataset.name;
  for (const old of box.querySelectorAll(':scope > input[type="hidden"]')) old.remove();
  if (name)
    for (const value of values) {
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = name;
      hidden.value = value;
      box.append(hidden);
    }
  const max = Number(box.dataset.max);
  if (input) input.readOnly = Boolean(max && values.length >= max) || box.hasAttribute("data-readonly");
}

/** Fija las etiquetas de un TagsInput. Emite z:change si cambian. */
export function setTagsValue(box: HTMLElement, values: ReadonlyArray<string>): void {
  const before = tagsOf(box).map(tagValue);
  writeTags(box, values);
  if (JSON.stringify(before) !== JSON.stringify(values)) emit(box, "change", { value: [...values] });
}

function addFromText(box: HTMLElement, text: string): void {
  const input = tagsInput(box);
  const current = tagsOf(box).map(tagValue);
  const result = addTags(current, splitTags(text, delimitersOf(box)), {
    max: Number(box.dataset.max) || undefined,
    maxLength: Number(box.dataset.maxLength) || undefined,
    allowDuplicates: box.hasAttribute("data-allow-duplicates"),
  });
  const real = result.rejected.filter((r) => r.reason !== "empty");
  flag(box, "data-invalid", real.length > 0, "true");
  if (input) {
    flag(input, "aria-invalid", real.length > 0, "true");
    input.value = real.map((r) => r.tag).join(delimitersOf(box)[0] ?? ",");
  }
  if (result.added.length) {
    setTagsValue(box, result.value);
    announce(box, result.added.map((tag) => (box.dataset.addedMessage ?? "{tag} added").replace("{tag}", tag)).join(". "));
  }
  if (real.length) emit(box, "reject", { rejected: real });
}

function removeTag(box: HTMLElement, index: number): void {
  const values = tagsOf(box).map(tagValue);
  const tag = values[index];
  if (tag === undefined || tagsInput(box)?.disabled || box.hasAttribute("data-readonly")) return;
  setTagsValue(
    box,
    values.filter((_, i) => i !== index),
  );
  announce(box, (box.dataset.removedMessage ?? "{tag} removed").replace("{tag}", tag));
}

function onTagsInputKey(box: HTMLElement, input: HTMLInputElement, event: KeyboardEvent): void {
  if (event.isComposing) return;
  const tags = tagsOf(box);
  if ((event.key === "Enter" && input.value.trim()) || delimitersOf(box).includes(event.key)) {
    event.preventDefault();
    addFromText(box, input.value);
  } else if (
    tags.length &&
    ((event.key === "Backspace" && input.value === "") ||
      (logicalKey(event.key, box) === "ArrowLeft" && input.selectionStart === 0 && input.selectionEnd === 0))
  ) {
    event.preventDefault();
    tags[tags.length - 1]?.focus();
  }
}

function onTagKey(box: HTMLElement, tag: HTMLElement, event: KeyboardEvent): void {
  const tags = tagsOf(box);
  const index = tags.indexOf(tag);
  const key = logicalKey(event.key, box);
  const input = tagsInput(box);
  if (key === "ArrowLeft") {
    event.preventDefault();
    tags[Math.max(0, index - 1)]?.focus();
  } else if (key === "ArrowRight") {
    event.preventDefault();
    (tags[index + 1] ?? input)?.focus();
  } else if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    removeTag(box, index);
    const left = tagsOf(box);
    if (!left.length) input?.focus();
    else (event.key === "Backspace" ? left[Math.max(0, index - 1)] : (left[index] ?? input))?.focus();
  } else if (event.key === "Escape" || event.key === "End") {
    event.preventDefault();
    input?.focus();
  } else if (event.key === "Home") {
    event.preventDefault();
    tags[0]?.focus();
  }
}

/* ---------- Editable ---------- */

const editParts = (box: Element) => ({
  preview: box.querySelector<HTMLButtonElement>(".z-editable__preview"),
  field: box.querySelector<HTMLInputElement | HTMLTextAreaElement>(".z-editable__input"),
  text: box.querySelector<HTMLElement>(".z-editable__text"),
  hidden: box.querySelector<HTMLInputElement>(':scope > input[type="hidden"]'),
});
const returning = new WeakSet<Element>();

function startEdit(box: HTMLElement): void {
  const { preview, field } = editParts(box);
  if (!preview || !field || box.hasAttribute("data-disabled") || box.dataset.state === "edit") return;
  field.value = box.dataset.value ?? "";
  box.dataset.state = "edit";
  preview.hidden = true;
  field.hidden = false;
  field.focus();
  field.select();
}

function finishEdit(box: HTMLElement, save: boolean): void {
  const { preview, field, text, hidden } = editParts(box);
  if (!preview || !field || box.dataset.state !== "edit") return;
  const next = field.value;
  if (save && box.hasAttribute("data-required") && !next.trim()) return;
  const before = box.dataset.value ?? "";
  box.dataset.state = "preview";
  field.hidden = true;
  preview.hidden = false;
  if (save) {
    box.dataset.value = next;
    if (text) text.textContent = next || (box.dataset.placeholder ?? "");
    flag(preview, "data-placeholder", !next);
    if (hidden) hidden.value = next;
  }
  returning.add(box);
  preview.focus();
  returning.delete(box);
  if (save && next !== before) emit(box, "change", { value: next });
}

/* ---------- Delegación ---------- */

export function setup(on: Listen): void {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !inDom(target)) return;
    const option = target.closest<HTMLElement>(`${LISTBOX} .z-listbox__option`);
    if (option) {
      chooseOption(option.closest<HTMLElement>(LISTBOX)!, option);
      return;
    }
    const remove = target.closest<HTMLElement>(".z-tags__remove");
    if (remove) {
      const box = remove.closest<HTMLElement>(".z-tags")!;
      removeTag(box, tagsOf(box).indexOf(remove.closest<HTMLElement>(".z-tags__tag")!));
      tagsInput(box)?.focus();
      return;
    }
    const box = target.closest<HTMLElement>(".z-tags");
    if (box && target === box) tagsInput(box)?.focus();
    const editable = target.closest<HTMLElement>(".z-editable");
    if (!editable) return;
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (action === "edit") startEdit(editable);
    else if (action === "save") finishEdit(editable, true);
    else if (action === "cancel") finishEdit(editable, false);
    else if (target.closest(".z-editable__preview") && (editable.dataset.activation ?? "click") === "click") startEdit(editable);
  });
  on(document, "dblclick", (event) => {
    const editable = (event.target as Element).closest?.<HTMLElement>(".z-editable[data-activation='dblclick']");
    if (editable && inDom(editable) && (event.target as Element).closest(".z-editable__preview")) startEdit(editable);
  });
  on(document, "focusin", (event) => {
    const preview = (event.target as Element).closest?.<HTMLElement>(".z-editable[data-activation='focus'] .z-editable__preview");
    const editable = preview?.closest<HTMLElement>(".z-editable");
    if (editable && inDom(editable) && !returning.has(editable)) startEdit(editable);
  });
  on(document, "focusout", (event) => {
    const field = event.target as Element;
    const editable = field.matches?.(".z-editable__input") ? field.closest<HTMLElement>(".z-editable") : null;
    if (!editable || !inDom(editable)) return;
    const next = event.relatedTarget as Node | null;
    if (next && editable.contains(next)) return;
    finishEdit(editable, !editable.hasAttribute("data-keep"));
  });
  on(document, "keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || event.defaultPrevented || typeof event.key !== "string" || !inDom(target)) return;
    const option = target.closest<HTMLElement>(`${LISTBOX} .z-listbox__option`);
    if (option) {
      onListKey(option.closest<HTMLElement>(LISTBOX)!, option, event);
      return;
    }
    const editable = target.closest<HTMLElement>(".z-editable");
    if (editable) {
      if (target.matches(".z-editable__input") && !event.isComposing) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          finishEdit(editable, false);
        } else if (event.key === "Enter" && (!editable.hasAttribute("data-multiline") || event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          finishEdit(editable, true);
        }
      } else if (
        target.matches(".z-editable__preview") &&
        (event.key === "Enter" || event.key === "F2") &&
        editable.dataset.activation !== "none"
      ) {
        event.preventDefault();
        startEdit(editable);
      }
      return;
    }
    const box = target.closest<HTMLElement>(".z-tags");
    if (!box) return;
    if (target.matches(".z-tags__input")) onTagsInputKey(box, target as HTMLInputElement, event);
    else if (target.matches(".z-tags__tag")) onTagKey(box, target, event);
  });
  on(document, "paste", (event) => {
    const input = event.target as HTMLElement;
    const box = input.matches?.(".z-tags__input") ? input.closest<HTMLElement>(".z-tags") : null;
    if (!box || !inDom(box) || box.hasAttribute("data-no-paste")) return;
    const text = event.clipboardData?.getData("text") ?? "";
    if (splitTags(text, delimitersOf(box)).length < 2) return;
    event.preventDefault();
    addFromText(box, text);
  });
  on(document, "focusout", (event) => {
    const input = event.target as HTMLElement;
    const box = input.matches?.(".z-tags__input") ? input.closest<HTMLElement>(".z-tags") : null;
    if (box && inDom(box) && !box.hasAttribute("data-no-blur") && (input as HTMLInputElement).value.trim())
      addFromText(box, (input as HTMLInputElement).value);
  });
  on(document, "input", (event) => {
    const input = event.target as HTMLElement;
    const box = input.matches?.(".z-tags__input") ? input.closest<HTMLElement>(".z-tags") : null;
    if (box && inDom(box)) {
      box.removeAttribute("data-invalid");
      input.removeAttribute("aria-invalid");
    }
  });
}

export function hydrate(root: ParentNode): void {
  for (const box of all(root, LISTBOX)) {
    paintList(box, optionsOf(box).filter(on).map(optionValue));
    // Lista larga del servidor: las opciones fuera de la vista no se pintan (siguen en el documento).
    if (box.dataset.orientation !== "horizontal") deferLongList(box.querySelector<HTMLElement>(":scope > .z-listbox__viewport"), box);
  }
  for (const box of all(root, ".z-tags")) writeTags(box, tagsOf(box).map(tagValue));
}
