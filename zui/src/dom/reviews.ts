// ReviewCard sin framework: «Read more» despliega y pliega el resto del texto, la búsqueda en la página lo abre
// (`beforematch` de `hidden="until-found"`) y una foto que es botón avisa con `z:photoselect { index }`. ReviewSummary
// es solo marcado.
//
// ReviewCard  article.z-review-card[data-state] > p.z-review-card__text > span.z-review-card__rest[hidden=until-found]
//             + button.z-review-card__more[aria-expanded][aria-controls]. Etiquetas: data-read-more y data-read-less
//             en el artículo (por defecto, «Read more» y «Show less»). z:change { open } al desplegar o plegar.
import { foldedValue } from "../core/reviews";
import { all, emit, inDom } from "./forms-popup";
import type { DomPart, Listen } from "./shared";

const card = (el: Element | null) => {
  const found = el?.closest<HTMLElement>(".z-review-card") ?? null;
  return found && inDom(found) ? found : null;
};

/** Despliega o pliega el texto de un `.z-review-card`. Emite `z:change { open }` si cambia. */
export function setReviewExpanded(root: HTMLElement, open: boolean): void {
  const rest = root.querySelector<HTMLElement>(".z-review-card__rest");
  const button = root.querySelector<HTMLButtonElement>(".z-review-card__more");
  if (!rest || !button || (root.dataset.state === "open") === open) return;
  root.dataset.state = open ? "open" : "closed";
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? (root.dataset.readLess ?? "Show less") : (root.dataset.readMore ?? "Read more");
  if (open) rest.removeAttribute("hidden");
  else rest.setAttribute("hidden", foldedValue());
  root.querySelector<HTMLElement>(".z-review-card__ellipsis")?.toggleAttribute("hidden", open);
  emit(root, "change", { open });
}

function hydrate(root: ParentNode): void {
  // El marcado de servidor puede traer `hidden` a secas: plegado pasa a `until-found`.
  for (const el of all(root, ".z-review-card[data-state='closed']"))
    el.querySelector<HTMLElement>(".z-review-card__rest[hidden]")?.setAttribute("hidden", foldedValue());
}

function setup(on: Listen): void {
  on(document, "click", (event) => {
    const target = event.target as Element | null;
    const more = target?.closest?.<HTMLElement>(".z-review-card__more");
    const root = card(more ?? null);
    if (more && root) {
      setReviewExpanded(root, root.dataset.state !== "open");
      return;
    }
    const photo = target?.closest?.<HTMLElement>("button.z-review-card__photo[data-index]");
    const owner = card(photo ?? null);
    if (photo && owner) emit(owner, "photoselect", { index: Number(photo.dataset.index) });
  });
  // `beforematch` burbujea: un solo listener abre la tarjeta cuyo resto contiene lo que se buscó.
  on(document, "beforematch", (event) => {
    const root = card(event.target as Element);
    if (root && (event.target as Element).matches(".z-review-card__rest")) setReviewExpanded(root, true);
  });
}

export const reviewsPart: DomPart = { rank: 52, setup, hydrate };
