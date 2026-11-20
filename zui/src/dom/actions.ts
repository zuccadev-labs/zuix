// Comportamiento sin framework del grupo actions: ToggleGroup y CopyButton. `setup()` conecta los listeners
// delegados una vez; `hydrate(root)` prepara marcado nuevo. Todo se activa dentro de `[data-z-dom]`.
//
// ToggleGroup  .z-toggle-group[role=group] > button.z-toggle[aria-pressed][value]. data-type="single|multiple"
//              (single por defecto), data-required (single: siempre una activada), data-orientation="vertical".
//              Una sola parada de Tab; las flechas mueven el foco. z:change { value } en el grupo: la cadena
//              activada ("" si ninguna) en single, la lista en multiple.
// Toolbar      .z-toolbar[role=toolbar][aria-label] con controles, .z-toolbar__group[role=group] y
//              .z-toolbar__separator[role=separator]. Una sola parada de Tab para todos los controles (también los de un
//              ToggleGroup anidado); flechas del eje (aria-orientation) con vuelta, Inicio y Fin. Recuerda el último.
// CopyButton   .z-copy > button.z-copy__button + .z-copy__status[role=status]. El texto sale de data-value o del
//              elemento de commandfor="id" (su valor si es un campo). data-copied-label, data-failed-label y
//              data-timeout (ms) en el botón. z:copy { text } o z:copyerror en el botón.
import { announceText, copyableText, copyText } from "../core/clipboard";
import { logicalKey } from "../core/dir";
import { move } from "../core/roving";
import { setToolbarStop, toolbarTarget } from "../core/toolbar";
import { all, emit, inDom } from "./forms-popup";
import type { Listen } from "./shared";

/* ---------- ToggleGroup ---------- */

const groupItems = (group: Element) =>
  [...group.querySelectorAll<HTMLButtonElement>(":scope > .z-toggle")].filter(
    (item) => !item.disabled && !item.hasAttribute("data-disabled"),
  );
const isOn = (item: Element) => item.getAttribute("aria-pressed") === "true";

function setPressed(item: HTMLElement, on: boolean): void {
  item.setAttribute("aria-pressed", String(on));
  item.dataset.state = on ? "on" : "off";
}

function groupValue(group: HTMLElement): string | string[] {
  const values = [...group.querySelectorAll<HTMLButtonElement>(":scope > .z-toggle")].filter(isOn).map((item) => item.value);
  return group.dataset.type === "multiple" ? values : (values[0] ?? "");
}

/** Parada de tabulación: `prefer`, la primera activada o la primera habilitada. */
function rove(group: HTMLElement, prefer?: HTMLElement): void {
  const items = groupItems(group);
  const stop = (prefer && items.includes(prefer as HTMLButtonElement) ? prefer : undefined) ?? items.find(isOn) ?? items[0];
  for (const item of group.querySelectorAll<HTMLElement>(":scope > .z-toggle")) item.tabIndex = item === stop ? 0 : -1;
}

function pressGroupItem(group: HTMLElement, item: HTMLButtonElement): void {
  if (item.disabled || item.hasAttribute("data-disabled")) return;
  const before = JSON.stringify(groupValue(group));
  const on = !isOn(item);
  if (group.dataset.type === "multiple") setPressed(item, on);
  else if (on) for (const other of group.querySelectorAll<HTMLElement>(":scope > .z-toggle")) setPressed(other, other === item);
  else if (!group.hasAttribute("data-required")) setPressed(item, false);
  const bar = toolbarOf(group);
  if (bar) setToolbarStop(bar, item);
  else rove(group, item);
  const value = groupValue(group);
  if (JSON.stringify(value) !== before) emit(group, "change", { value });
}

/* ---------- CopyButton ---------- */

const copyTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function report(button: HTMLElement, ok: boolean): void {
  const status = button.parentElement?.querySelector<HTMLElement>(":scope > .z-copy__status");
  clearTimeout(copyTimers.get(button));
  button.removeAttribute("data-copied");
  button.removeAttribute("data-failed");
  if (status) {
    status.textContent = "";
    status.dataset.state = ok ? "copied" : "failed";
  }
  button.setAttribute(ok ? "data-copied" : "data-failed", "");
  const message = ok ? (button.dataset.copiedLabel ?? "Copied") : (button.dataset.failedLabel ?? "Copy failed");
  requestAnimationFrame(() => {
    if (status) status.textContent = announceText(message);
  });
  const timeout = Number(button.dataset.timeout) || 2000;
  copyTimers.set(
    button,
    setTimeout(() => {
      button.removeAttribute("data-copied");
      button.removeAttribute("data-failed");
      if (status) {
        status.textContent = "";
        status.dataset.state = "idle";
      }
    }, timeout),
  );
}

async function copyFrom(button: HTMLButtonElement): Promise<void> {
  const target = button.getAttribute("commandfor");
  const text = button.dataset.value ?? copyableText(target ? document.getElementById(target) : null);
  const ok = await copyText(text);
  report(button, ok);
  emit(button, ok ? "copy" : "copyerror", ok ? { text } : undefined);
}

/* ---------- Delegación ---------- */

/* ---------- Toolbar ---------- */

const toolbarOf = (el: Element) => el.closest<HTMLElement>('.z-toolbar[role="toolbar"]');

export function setup(on: Listen): void {
  on(document, "focusin", (event) => {
    const target = event.target;
    const bar = target instanceof Element ? toolbarOf(target) : null;
    if (bar && target !== bar && inDom(bar)) setToolbarStop(bar, target as Element);
  });
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !inDom(target)) return;
    const copy = target.closest<HTMLButtonElement>(".z-copy__button");
    if (copy) {
      void copyFrom(copy);
      return;
    }
    const item = target.closest<HTMLButtonElement>(".z-toggle-group > .z-toggle");
    if (item) pressGroupItem(item.parentElement!, item);
  });
  on(document, "keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || event.defaultPrevented || typeof event.key !== "string") return;
    const bar = toolbarOf(target);
    if (bar && inDom(bar)) {
      const next = toolbarTarget(bar, target, event.key);
      if (!next) return;
      event.preventDefault();
      setToolbarStop(bar, next);
      next.focus();
      return;
    }
    const item = target.closest<HTMLButtonElement>(".z-toggle-group > .z-toggle");
    if (!item || !inDom(item)) return;
    const group = item.parentElement!;
    const vertical = group.dataset.orientation === "vertical";
    const next = move(groupItems(group), item, vertical ? event.key : logicalKey(event.key, item), vertical);
    if (!next) return;
    event.preventDefault();
    rove(group, next);
    next.focus();
  });
}

export function hydrate(root: ParentNode): void {
  // Un ToggleGroup dentro de una barra deja la parada de tabulación a la barra.
  for (const group of all(root, ".z-toggle-group")) if (!toolbarOf(group)) rove(group);
  for (const bar of all(root, '.z-toolbar[role="toolbar"]')) setToolbarStop(bar);
}
