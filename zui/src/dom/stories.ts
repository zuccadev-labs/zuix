// Stories, Lightbox y Gallery sin framework. El comportamiento es el de core/stories-runtime y core/lightbox-runtime
// (los mismos del binding de React); aquí se completa el marcado mínimo con el del contrato.
//
// Stories:   <div class="z-stories" data-z-stories aria-label="…">
//              <article class="z-stories__group" data-author="Ana" data-avatar="ana.jpg">
//                <figure class="z-stories__item" data-duration="6000"><img src="…" alt="…"></figure> …
//              </article> …
//            </div>
//            Atributos: data-duration (ms por defecto), data-start (grupo inicial), data-label-previous,
//            data-label-next, data-label-pause, data-label-previous-group, data-label-next-group,
//            data-label-position ("Story {index} of {count}, {author}"). Eventos: z:change (detail.group, item), z:complete.
// Lightbox:  <dialog class="z-lightbox" data-z-lightbox aria-label="…"><figure class="z-lightbox__item"><img …></figure> …</dialog>
//            openLightbox(dialog, índice). Atributos: data-no-zoom, data-label-close, data-label-previous,
//            data-label-next, data-label-zoom-in, data-label-zoom-out, data-label-image ("Image {index} of {count}").
// Gallery:   <div class="z-gallery" data-z-gallery> carrusel [data-z-carousel] + dialog.z-lightbox </div>: el botón
//            .z-gallery__expand (se crea si falta) abre el visor en el slide actual.
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowsPointingOut } from "@zuccadev-labs/zuix-zicon/icons/arrows-pointing-out";
import { chevronDoubleLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-double-left";
import { chevronDoubleRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-double-right";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { magnifyingGlassMinus } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass-minus";
import { magnifyingGlassPlus } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass-plus";
import { pause } from "@zuccadev-labs/zuix-zicon/icons/pause";
import { play } from "@zuccadev-labs/zuix-zicon/icons/play";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { bindLightbox, type LightboxHandle } from "../core/lightbox-runtime";
import { storyText } from "../core/stories";
import { bindStories, type StoriesHandle } from "../core/stories-runtime";
import { carousel } from "./carousel";
import { openDialog } from "./core";
import { setMarkup, type Listen } from "./shared";

registerIcons([
  arrowsPointingOut,
  chevronDoubleLeft,
  chevronDoubleRight,
  chevronLeft,
  chevronRight,
  magnifyingGlassMinus,
  magnifyingGlassPlus,
  pause,
  play,
  xMark,
]);

const stories = new WeakMap<HTMLElement, StoriesHandle>();
const lightboxes = new WeakMap<HTMLElement, LightboxHandle>();

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
const button = (className: string, label: string, attrs: Record<string, string>, icon?: string, size = 16) => {
  const b = el("button", className, { type: "button", "aria-label": label, ...attrs });
  if (icon) setMarkup(b, iconSvg(icon, { size }));
  return b;
};

/** Activa unas historias. Idempotente. */
export function storiesWidget(root: HTMLElement): StoriesHandle {
  const known = stories.get(root);
  if (known) return known;
  const d = root.dataset;
  const label = {
    previous: d.labelPrevious ?? "Previous story",
    next: d.labelNext ?? "Next story",
    pause: d.labelPause ?? "Pause stories",
    previousGroup: d.labelPreviousGroup ?? "Previous person",
    nextGroup: d.labelNextGroup ?? "Next person",
    position: d.labelPosition ?? "Story {index} of {count}, {author}",
  };
  if (!root.hasAttribute("aria-roledescription")) root.setAttribute("aria-roledescription", "stories");
  let viewer = root.querySelector<HTMLElement>(":scope > .z-stories__viewer");
  if (!viewer) {
    viewer = el("div", "z-stories__viewer");
    viewer.append(...root.querySelectorAll(":scope > .z-stories__group"));
    root.prepend(viewer);
  }
  for (const group of viewer.querySelectorAll<HTMLElement>(":scope > .z-stories__group")) {
    const author = group.dataset.author ?? "";
    if (!group.hasAttribute("aria-label") && author) group.setAttribute("aria-label", author);
    const items = [...group.querySelectorAll<HTMLElement>(":scope > .z-stories__item")];
    items.forEach((item, i) => {
      item.setAttribute("role", "group");
      if (!item.hasAttribute("aria-roledescription")) item.setAttribute("aria-roledescription", "story");
      if (!item.hasAttribute("aria-label")) item.setAttribute("aria-label", storyText(label.position, i, items.length, author));
    });
    if (!group.querySelector(":scope > .z-stories__bars")) {
      const bars = el("div", "z-stories__bars", { "aria-hidden": "true" });
      for (const _ of items) {
        const bar = el("span", "z-stories__bar");
        bar.append(el("span", "z-stories__fill"));
        bars.append(bar);
      }
      group.prepend(bars);
    }
    if (!group.querySelector(":scope > .z-stories__head")) {
      const head = el("header", "z-stories__head");
      if (group.dataset.avatar) {
        const img = el("img", "z-stories__avatar", { alt: "" });
        img.src = group.dataset.avatar;
        head.append(img);
      }
      const name = el("span", "z-stories__author");
      name.textContent = author;
      head.append(name);
      group.querySelector(":scope > .z-stories__bars")?.after(head);
    }
  }
  if (!viewer.querySelector(":scope > .z-stories__nav")) {
    viewer.append(
      button("z-stories__nav", label.previous, { "data-dir": "prev", "data-stories-action": "prev" }),
      button("z-stories__nav", label.next, { "data-dir": "next", "data-stories-action": "next" }),
    );
  }
  if (!root.querySelector(":scope > .z-stories__controls")) {
    const controls = el("div", "z-stories__controls");
    const toggle = button("z-stories__control", label.pause, { "data-stories-action": "pause", "aria-pressed": "false" });
    setMarkup(
      toggle,
      `${iconSvg("pause", { size: 16, className: "z-stories__icon-pause" })}${iconSvg("play", { size: 16, className: "z-stories__icon-play" })}`,
    );
    controls.append(
      button("z-stories__control", label.previousGroup, { "data-stories-action": "prev-group" }, "chevron-double-left"),
      toggle,
      button("z-stories__control", label.nextGroup, { "data-stories-action": "next-group" }, "chevron-double-right"),
    );
    root.append(controls);
  }
  const handle = bindStories(root, {
    duration: Number(d.duration) || undefined,
    initialGroup: Number(d.start) || 0,
    storyLabel: label.position,
    onChange: (state, event) => {
      if (event) root.dispatchEvent(new CustomEvent("z:change", { bubbles: true, detail: { group: state.group, item: state.item } }));
    },
    onComplete: () => root.dispatchEvent(new CustomEvent("z:complete", { bubbles: true })),
  });
  stories.set(root, handle);
  return handle;
}

/** Completa y conecta un visor. Idempotente. */
export function lightbox(dialog: HTMLElement): LightboxHandle {
  const known = lightboxes.get(dialog);
  if (known) return known;
  const d = dialog.dataset;
  const zoom = !dialog.hasAttribute("data-no-zoom");
  if (!dialog.querySelector(":scope > .z-lightbox__stage")) {
    const stage = el("div", "z-lightbox__stage");
    stage.append(...dialog.querySelectorAll(":scope > .z-lightbox__item"));
    dialog.append(stage);
  }
  if (!dialog.querySelector(":scope > .z-lightbox__bar")) {
    const bar = el("div", "z-lightbox__bar");
    bar.append(el("span", "z-lightbox__counter", { "aria-hidden": "true" }));
    if (zoom)
      bar.append(
        button("z-lightbox__button", d.labelZoomOut ?? "Zoom out", { "data-lightbox-action": "zoom-out" }, "magnifying-glass-minus", 18),
        button("z-lightbox__button", d.labelZoomIn ?? "Zoom in", { "data-lightbox-action": "zoom-in" }, "magnifying-glass-plus", 18),
      );
    bar.append(button("z-lightbox__button", d.labelClose ?? "Close", { "data-z-close": "" }, "x-mark", 18));
    dialog.prepend(bar);
  }
  const count = dialog.querySelectorAll(".z-lightbox__item").length;
  if (count > 1 && !dialog.querySelector(":scope > .z-lightbox__nav")) {
    dialog.append(
      button(
        "z-lightbox__button z-lightbox__nav",
        d.labelPrevious ?? "Previous image",
        { "data-dir": "prev", "data-lightbox-action": "prev" },
        "chevron-left",
        20,
      ),
      button(
        "z-lightbox__button z-lightbox__nav",
        d.labelNext ?? "Next image",
        { "data-dir": "next", "data-lightbox-action": "next" },
        "chevron-right",
        20,
      ),
    );
  }
  const handle = bindLightbox(dialog, {
    zoom,
    imageLabel: d.labelImage,
    onIndex: (index) => dialog.dispatchEvent(new CustomEvent("z:change", { bubbles: true, detail: { index } })),
  });
  lightboxes.set(dialog, handle);
  return handle;
}

/** Abre el visor en la imagen `index`. */
export function openLightbox(dialog: HTMLDialogElement, index = 0): void {
  const handle = lightbox(dialog);
  handle.goTo(index, false);
  openDialog(dialog);
}

function gallery(root: HTMLElement): void {
  if (root.dataset.zGalleryReady !== undefined) return;
  root.dataset.zGalleryReady = "";
  const strip = root.querySelector<HTMLElement>("[data-z-carousel]");
  const dialog = root.querySelector<HTMLDialogElement>("dialog.z-lightbox");
  if (!strip || !dialog) return;
  const handle = carousel(strip);
  lightbox(dialog);
  let expand = root.querySelector<HTMLButtonElement>(":scope > .z-gallery__expand");
  if (!expand) {
    expand = button(
      "z-gallery__expand",
      root.dataset.labelExpand ?? "View full screen",
      {},
      "arrows-pointing-out",
      18,
    ) as HTMLButtonElement;
    root.append(expand);
  }
  expand.addEventListener("click", () => openLightbox(dialog, handle.index));
}

export function setup(_on: Listen): void {}

export function hydrate(root: ParentNode): void {
  const all = (selector: string) => [
    ...(root instanceof HTMLElement && root.matches(selector) ? [root] : []),
    ...root.querySelectorAll<HTMLElement>(selector),
  ];
  for (const node of all("[data-z-stories]")) storiesWidget(node);
  for (const node of all("dialog[data-z-lightbox]")) lightbox(node);
  for (const node of all("[data-z-gallery]")) gallery(node);
}
