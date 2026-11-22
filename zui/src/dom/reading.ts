// Contenido de lectura sin framework. Todo dentro de `[data-z-dom]`; el texto entra siempre como texto.
//
// Format     <data class="z-format" data-format="number|byte" value="1234" data-locale data-options='{…}'> y
//            <time class="z-format" data-format="date" datetime="…">: el texto se escribe con Intl al hidratar.
//            FormatByte: data-system="decimal|binary", data-unit-display, data-fraction.
// Highlight  <span class="z-highlight" data-query="a\nb"> con el texto: marca las coincidencias con <mark>.
//            data-ignore-case="false", data-ignore-accents, data-whole-word. setHighlightQuery(el, consulta).
// Marquee    .z-marquee > button.z-marquee__control: alterna data-paused y el texto del botón (data-pause-label /
//            data-play-label); emite z:change { paused }.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { pause } from "@zuccadev-labs/zuix-zicon/icons/pause";
import { play } from "@zuccadev-labs/zuix-zicon/icons/play";
import { formatByte, formatDate, formatNumber, highlightParts } from "../core/format";
import { emit, inDom } from "./forms-popup";
import { fragment, type Listen } from "./shared";

registerIcons([pause, play]);

const json = <T>(text: string | undefined): T | undefined => {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
};

function renderFormat(el: HTMLElement): void {
  const d = el.dataset;
  if (d.format === "date") {
    const raw = el.getAttribute("datetime") ?? "";
    const { text } = formatDate(raw, d.locale, json<Intl.DateTimeFormatOptions>(d.options));
    if (text) el.textContent = text;
    return;
  }
  const value = Number(el.getAttribute("value"));
  if (!Number.isFinite(value)) return;
  el.textContent =
    d.format === "byte"
      ? formatByte(value, d.locale, {
          system: d.system === "binary" ? "binary" : "decimal",
          unitDisplay: (d.unitDisplay as "short" | "long" | "narrow") ?? "short",
          maximumFractionDigits: d.fraction !== undefined ? Number(d.fraction) : 1,
        })
      : formatNumber(value, d.locale, json<Intl.NumberFormatOptions>(d.options));
}

const texts = new WeakMap<HTMLElement, string>();

/** Marca en `el` (`.z-highlight`) las coincidencias de su consulta (o de la que se pase). */
export function setHighlightQuery(el: HTMLElement, query?: string | readonly string[]): void {
  if (query !== undefined) el.dataset.query = typeof query === "string" ? query : query.join("\n");
  if (!texts.has(el)) texts.set(el, el.textContent ?? "");
  const text = texts.get(el) ?? "";
  const d = el.dataset;
  const parts = highlightParts(text, (d.query ?? "").split("\n"), {
    ignoreCase: d.ignoreCase !== "false",
    ignoreAccents: d.ignoreAccents !== undefined,
    wholeWord: d.wholeWord !== undefined,
  });
  el.replaceChildren(
    ...parts.map((p) => {
      if (!p.match) return el.ownerDocument.createTextNode(p.text);
      const mark = el.ownerDocument.createElement("mark");
      mark.className = "z-highlight__mark";
      mark.textContent = p.text;
      return mark;
    }),
  );
}

export function setup(on: Listen): void {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLButtonElement>(".z-marquee__control");
    const marquee = control?.closest<HTMLElement>(".z-marquee");
    if (!control || !marquee || !inDom(marquee)) return;
    const paused = !marquee.hasAttribute("data-paused");
    marquee.toggleAttribute("data-paused", paused);
    const label = paused ? (control.dataset.playLabel ?? "Play") : (control.dataset.pauseLabel ?? "Pause");
    const sr = control.querySelector(".z-sr-only");
    if (sr) sr.textContent = label;
    control.querySelector("svg")?.replaceWith(fragment(iconSvg(paused ? "play" : "pause", { size: 14 })));
    emit(marquee, "change", { paused });
  });
}

export function hydrate(root: ParentNode): void {
  const pick = (selector: string) => {
    const list = [...root.querySelectorAll<HTMLElement>(selector)];
    if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root);
    return list.filter(inDom);
  };
  for (const el of pick(".z-format[data-format]")) renderFormat(el);
  for (const el of pick(".z-highlight[data-query]")) setHighlightQuery(el);
}
