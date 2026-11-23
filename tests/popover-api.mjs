// Navegadores anteriores a la Popover API (Chromium < 114, Firefox < 125, Safari < 17), simulados en un navegador que
// sí la tiene. Cada función se pasa a `page.addInitScript` antes de cargar la página: corre en la página, así que no
// puede usar nada de fuera de su cuerpo.
//   removePopoverApi: sin `showPopover`, `hidePopover` ni `togglePopover`, y `:popover-open` como selector no válido.
//   fakePopoverPolyfill: lo que hace @oddbird/popover-polyfill sobre un navegador así (va después de removePopoverApi):
//     los métodos vuelven y la capa abierta lleva la clase `:popover-open`; `showPopover` sobre una capa abierta lanza,
//     como el navegador.

export function removePopoverApi() {
  for (const name of ["showPopover", "hidePopover", "togglePopover", "popover"]) delete HTMLElement.prototype[name];
  const invalid = (s) => typeof s === "string" && /(^|[^\\]):popover-open/.test(s);
  for (const [proto, names] of [
    [Element.prototype, ["matches", "closest", "querySelector", "querySelectorAll"]],
    [Document.prototype, ["querySelector", "querySelectorAll"]],
    [DocumentFragment.prototype, ["querySelector", "querySelectorAll"]],
  ])
    for (const name of names) {
      const native = proto[name];
      proto[name] = function (selector, ...rest) {
        if (invalid(selector)) throw new DOMException(`'${selector}' is not a valid selector`, "SyntaxError");
        return native.call(this, selector, ...rest);
      };
    }
}

export function fakePopoverPolyfill() {
  const OPEN = ":popover-open";
  window.__popoverCalls = { show: 0, hide: 0 };
  HTMLElement.prototype.showPopover = function () {
    if (this.classList.contains(OPEN)) throw new DOMException("Already open", "InvalidStateError");
    window.__popoverCalls.show += 1;
    this.classList.add(OPEN);
  };
  HTMLElement.prototype.hidePopover = function () {
    if (!this.classList.contains(OPEN)) throw new DOMException("Not open", "InvalidStateError");
    window.__popoverCalls.hide += 1;
    this.classList.remove(OPEN);
  };
  HTMLElement.prototype.togglePopover = function (force) {
    const open = this.classList.contains(OPEN);
    if (force === undefined ? open : !force) {
      if (open) this.hidePopover();
    } else if (!open) this.showPopover();
    return this.classList.contains(OPEN);
  };
}
