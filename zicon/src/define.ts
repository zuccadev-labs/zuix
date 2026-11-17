// Elemento <z-icon name="plus" variant="solid" size="20" label="Add">: iconos en HTML, Vue, Svelte, Angular o Astro.
// Dibuja en el DOM normal (sin shadow) para que el CSS de la suite y `currentColor` funcionen igual que con <Icon>.
import { getIcon, onIconsRegistered } from "./registry";
import { iconElement } from "./svg";
import type { IconVariant } from "./types";

/** Registra el elemento personalizado. Idempotente; no hace nada fuera del navegador. */
export function defineIconElement(tag = "z-icon"): void {
  if (typeof customElements === "undefined" || customElements.get(tag)) return;

  // Elementos conectados cuyo icono aún no está registrado: se dibujan en cuanto se registre.
  const pending = new Set<ZIconElement>();

  class ZIconElement extends HTMLElement {
    static observedAttributes = ["name", "variant", "size", "label", "hidden"];
    connectedCallback() {
      this.render();
    }
    disconnectedCallback() {
      pending.delete(this);
    }
    attributeChangedCallback(_name: string, before: string | null, after: string | null) {
      if (this.isConnected && before !== after) this.render();
    }
    render() {
      // `display: contents`: el SVG interior se comporta como hijo directo del contenedor. Con `hidden` se oculta de forma explícita,
      // porque `display: contents` (aquí o en la hoja) ganaría a la regla del navegador para `hidden`.
      this.style.display = this.hasAttribute("hidden") ? "none" : "contents";
      const name = this.getAttribute("name") ?? "";
      const variant: IconVariant = this.getAttribute("variant") === "solid" ? "solid" : "outline";
      if (name && !getIcon(name)) pending.add(this); else pending.delete(this);
      // Con el DOM, no con `innerHTML`: funciona bajo Trusted Types y ningún atributo se interpreta como marcado.
      this.replaceChildren(iconElement(name, { variant, size: this.getAttribute("size") || 16, label: this.getAttribute("label") || undefined }));
    }
  }
  onIconsRegistered(() => {
    for (const el of [...pending]) if (getIcon(el.getAttribute("name") ?? "")) el.render();
  });
  customElements.define(tag, ZIconElement);
}
