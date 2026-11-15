// Elemento <z-icon name="plus" variant="solid" size="20" label="Add">: iconos en HTML, Vue, Svelte, Angular o Astro.
// Dibuja en el DOM normal (sin shadow) para que el CSS de la suite y `currentColor` funcionen igual que con <Icon>.
import { iconSvg } from "./svg";
import type { IconVariant } from "./types";

/** Registra el elemento personalizado. Idempotente; no hace nada fuera del navegador. */
export function defineIconElement(tag = "z-icon"): void {
  if (typeof customElements === "undefined" || customElements.get(tag)) return;

  class ZIconElement extends HTMLElement {
    static observedAttributes = ["name", "variant", "size", "label"];
    connectedCallback() {
      // `display: contents`: el SVG interior se comporta como hijo directo del contenedor.
      this.style.display = "contents";
      this.render();
    }
    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }
    private render() {
      const name = this.getAttribute("name") ?? "";
      const variant: IconVariant = this.getAttribute("variant") === "solid" ? "solid" : "outline";
      this.innerHTML = iconSvg(name, { variant, size: this.getAttribute("size") ?? 16, label: this.getAttribute("label") ?? undefined });
    }
  }
  customElements.define(tag, ZIconElement);
}
