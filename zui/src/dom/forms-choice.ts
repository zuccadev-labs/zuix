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
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { logicalKey } from "../core/dir";
import { move } from "../core/roving";
import { addTags, splitTags } from "../core/tags";
import { createTypeahead, isPrintable } from "../core/typeahead";
import { all, emit, flag, inDom } from "./forms-popup";
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
  });
  on(document, "keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || event.defaultPrevented || typeof event.key !== "string" || !inDom(target)) return;
    const option = target.closest<HTMLElement>(`${LISTBOX} .z-listbox__option`);
    if (option) {
      onListKey(option.closest<HTMLElement>(LISTBOX)!, option, event);
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
  for (const box of all(root, LISTBOX)) paintList(box, optionsOf(box).filter(on).map(optionValue));
  for (const box of all(root, ".z-tags")) writeTags(box, tagsOf(box).map(tagValue));
}
