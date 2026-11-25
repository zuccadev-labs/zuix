// Conexión de una máscara (./mask) a un `<input>`: la usan el binding de React (MaskedInput) y el modo DOM, con la
// misma lógica. `beforeinput` cancelable (teclear, pegar, borrar, cortar) se resuelve aquí y el cursor queda donde
// toca; lo que no se puede cancelar (la composición de un IME, el autocompletado, algunos teclados de móvil) se deja
// hacer y se reformatea en `input` y `compositionend`. Sin documento al importar: solo toca el campo que recibe.
import { applyMask, editFor, editMask, extractRaw, reformat, type MaskSpec } from "./mask";

export interface MaskChange {
  raw: string;
  value: string;
  complete: boolean;
}

export interface MaskControl {
  /** Escribe un crudo (controlado, `form.reset()`): formatea y no emite. */
  set(raw: string): void;
  destroy(): void;
}

export interface MaskControlOptions {
  spec: () => MaskSpec | null;
  onChange: (change: MaskChange) => void;
  /** Mensaje de validez con el valor a medias (`setCustomValidity`). Vacío: sin mensaje propio. */
  incompleteMessage?: () => string;
}

/** Conecta la máscara al campo. Devuelve cómo escribir el crudo y cómo desconectar. */
export function attachMask(input: HTMLInputElement, options: MaskControlOptions): MaskControl {
  let composing = false;
  let last = input.value;
  const validity = (complete: boolean, raw: string) => {
    const message = options.incompleteMessage?.() ?? "";
    input.setCustomValidity(raw && !complete && message ? message : "");
  };
  const write = (value: string, caret: number | null) => {
    if (input.value !== value) input.value = value;
    if (caret !== null && input.ownerDocument.activeElement === input) input.setSelectionRange(caret, caret);
  };
  const publish = (inputType: string) => {
    const spec = options.spec();
    if (!spec) return;
    const masked = applyMask(spec, extractRaw(spec, input.value));
    validity(masked.complete, masked.raw);
    if (input.value === last) return;
    last = input.value;
    options.onChange({ raw: masked.raw, value: masked.value, complete: masked.complete });
    // Lo cancelado no llega como `input`: se emite uno, como lo haría el navegador, para la validación del Field y
    // para quien escuche el campo.
    if (inputType) input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType }));
  };
  let ours = false;
  const onBeforeInput = (event: InputEvent) => {
    const spec = options.spec();
    if (!spec || composing || event.isComposing || !event.cancelable) return;
    const edit = editFor(event.inputType, event.data ?? event.dataTransfer?.getData("text/plain") ?? null);
    if (!edit) return;
    event.preventDefault();
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    // Cortar: el texto seleccionado va al portapapeles antes de quitarlo (lo hace el navegador en `cut`).
    const result = editMask(spec, input.value, start, end, edit);
    if (result.rejected) return;
    write(result.value, result.caret);
    ours = true;
    publish(event.inputType);
    ours = false;
  };
  const onInput = () => {
    if (ours || composing) return;
    const spec = options.spec();
    if (!spec) return;
    const caret = input.selectionStart ?? input.value.length;
    const result = reformat(spec, input.value, caret);
    write(result.value, result.caret);
    publish("");
  };
  const onCompositionStart = () => {
    composing = true;
  };
  const onCompositionEnd = () => {
    composing = false;
    onInput();
  };
  input.addEventListener("beforeinput", onBeforeInput);
  input.addEventListener("input", onInput);
  input.addEventListener("compositionstart", onCompositionStart);
  input.addEventListener("compositionend", onCompositionEnd);
  const set = (raw: string) => {
    const spec = options.spec();
    if (!spec) return;
    const masked = applyMask(spec, raw);
    write(masked.value, null);
    last = masked.value;
    validity(masked.complete, masked.raw);
  };
  // Un valor escrito en el marcado se formatea al conectar.
  set(options.spec() ? extractRaw(options.spec()!, input.value) : input.value);
  return {
    set,
    destroy() {
      input.removeEventListener("beforeinput", onBeforeInput);
      input.removeEventListener("input", onInput);
      input.removeEventListener("compositionstart", onCompositionStart);
      input.removeEventListener("compositionend", onCompositionEnd);
    },
  };
}
