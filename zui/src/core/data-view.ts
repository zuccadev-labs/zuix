// DataView: la misma colección como lista o como rejilla, con un conmutador (SegmentedControl, patrón APG
// «radiogroup») y la elección guardada en `localStorage` si se pide. La disposición es CSS (`data-layout` en la raíz);
// aquí, la lectura y escritura tolerante del almacenamiento (puede no existir o lanzar: ventana privada, datos
// bloqueados) y la conexión del modo DOM. Solo toca el documento al llamarse.

export type DataViewLayout = "list" | "grid";

export const isLayout = (v: unknown): v is DataViewLayout => v === "list" || v === "grid";

/** Almacén mínimo (el `localStorage` de la ventana o uno de prueba). */
export interface LayoutStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Disposición guardada en `key`, o `fallback` si no hay, no es válida o el almacén falla. */
export function readLayout(store: LayoutStore | null | undefined, key: string | undefined, fallback: DataViewLayout): DataViewLayout {
  if (!store || !key) return fallback;
  try {
    const v = store.getItem(key);
    return isLayout(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/** Guarda la disposición; devuelve si se pudo. */
export function writeLayout(store: LayoutStore | null | undefined, key: string | undefined, layout: DataViewLayout): boolean {
  if (!store || !key) return false;
  try {
    store.setItem(key, layout);
    return true;
  } catch {
    return false;
  }
}

/** El `localStorage` de la ventana, si se deja leer. */
export function windowStore(view: Window | null | undefined): LayoutStore | null {
  try {
    return view?.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Marca el conmutador con la disposición elegida (modo DOM). */
function paintSwitch(root: HTMLElement, layout: DataViewLayout): void {
  for (const radio of root.querySelectorAll<HTMLElement>(':scope > .z-dataview__bar [role="radio"]')) {
    const checked = (radio.getAttribute("value") ?? radio.dataset.value) === layout;
    radio.setAttribute("aria-checked", String(checked));
    radio.dataset.state = checked ? "on" : "off";
    radio.tabIndex = checked ? 0 : -1;
  }
}

/**
 * Conecta un `.z-dataview` del modo DOM: el conmutador cambia `data-layout` y, con `data-persist="clave"`, se guarda
 * y se recupera al montar. Avisa con `z:layoutchange { layout }`.
 */
export function attachDataView(root: HTMLElement): () => void {
  const store = windowStore(root.ownerDocument.defaultView);
  const key = root.dataset.persist || undefined;
  const initial = readLayout(store, key, isLayout(root.dataset.layout) ? root.dataset.layout : "list");
  root.dataset.layout = initial;
  paintSwitch(root, initial);
  const onChange = (event: Event) => {
    const group = (event.target as Element).closest?.(".z-dataview__switch");
    if (!group || group.closest(".z-dataview") !== root) return;
    const value = (event as CustomEvent<{ value?: string }>).detail?.value;
    if (!isLayout(value) || value === root.dataset.layout) return;
    root.dataset.layout = value;
    writeLayout(store, key, value);
    root.dispatchEvent(new CustomEvent("z:layoutchange", { bubbles: true, detail: { layout: value } }));
  };
  root.addEventListener("z:change", onChange);
  return () => root.removeEventListener("z:change", onChange);
}
