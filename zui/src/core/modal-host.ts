// Dónde debe vivir una capa que tiene que seguir activa con un diálogo modal abierto (la región de avisos).
// Con un `<dialog>` abierto con `showModal()`, el navegador deja inerte todo lo que queda fuera de él, también lo
// que está en la capa superior: un aviso montado en `<body>` se vería pero no se podría enfocar, pulsar ni leer.
// La región se muda al diálogo modal de arriba y vuelve a `<body>` cuando no queda ninguno.

const modals = (doc: Document) => [...doc.querySelectorAll<HTMLElement>("dialog:modal")];

/** Diálogo modal abierto más reciente según el orden del documento, o `<body>` si no hay ninguno. */
export const modalHost = (doc: Document = document): HTMLElement => modals(doc).pop() ?? doc.body;

/**
 * Avisa con el anfitrión vigente cada vez que cambia: se abre un diálogo modal (pasa a ser el anfitrión), se cierra
 * o se retira del documento (lo es el anterior, o `<body>`). Lleva la cuenta del orden de apertura, que es el orden
 * de la capa superior. No llama al empezar. Devuelve la función que deja de vigilar.
 */
export function followModalHost(onChange: (host: HTMLElement) => void, doc: Document = document): () => void {
  let order = modals(doc);
  let current: HTMLElement = order[order.length - 1] ?? doc.body;
  const check = () => {
    const open = modals(doc);
    order = order.filter((dialog) => open.includes(dialog));
    for (const dialog of open) if (!order.includes(dialog)) order.push(dialog);
    const next = order[order.length - 1] ?? doc.body;
    if (next === current) return;
    current = next;
    onChange(next);
  };
  // `showModal()` y `close()` cambian el atributo `open`; un diálogo que se desmonta abierto sale por `childList`.
  const observer = new MutationObserver(check);
  observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
  return () => observer.disconnect();
}

/** Lleva `el` a `host` si no está ya en él. */
export function moveToHost(el: HTMLElement, host: HTMLElement): void {
  if (el.parentElement !== host || !el.isConnected) host.append(el);
}

/**
 * Tras reinsertar o volver a mostrar `root`: un nodo que reaparece repite sus animaciones CSS. Las de los elementos
 * `selector` que ya se habían mostrado (`seen`) se dan por terminadas, para que no vuelvan a «entrar»; los nuevos
 * se anotan y animan con normalidad.
 */
export function settleShown(root: Element, selector: string, seen: WeakSet<Element>): void {
  for (const el of root.querySelectorAll(selector)) {
    if (!seen.has(el)) {
      seen.add(el);
      continue;
    }
    for (const animation of el.getAnimations?.({ subtree: true }) ?? []) {
      try {
        animation.finish();
      } catch {
        // Animación infinita: no tiene final al que saltar.
      }
    }
  }
}
