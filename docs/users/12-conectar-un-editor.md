# Conectar un editor visual

Cómo un editor de páginas por bloques usa zuix: qué bloques hay y cómo se editan, en qué formato se guarda una
página, cómo se pinta en un lienzo dentro de un iframe y cómo se exporta. Es el lado de zuix de esa conexión;
el adaptador de cada editor es una capa fina encima.

Todo sale de `@zuccadev-labs/zuix-zui/editor` (o `@zuccadev-labs/zuix/editor` con el paraguas). No depende de
React: React solo entra por `@zuccadev-labs/zuix-zui/editor/react`.

## Las piezas

| Pieza | Dónde | Qué es |
|---|---|---|
| Catálogo | `@zuccadev-labs/zuix-zui/editor/catalog.json` (`@zuccadev-labs/zuix/editor/catalog` como módulo) | Todos los componentes y layouts de zui y zout, más los bloques propios del conector, con sus props como JSON Schema, huecos, reglas de anidado, presets, eventos y accesibilidad. También los tokens editables y el contraste |
| Esquemas | `/editor/catalog.schema.json`, `/editor/document.schema.json` | JSON Schema 2020-12 del catálogo y del documento |
| Documento | El JSON que guarda el editor | Árbol de nodos con `id`, `type`, `props`, `children`, `slots`, `style` (solo tokens) y `adaptive` |
| Salidas | `toHTML`, `toTrustedHTML`, `renderToDOM`, `toReact` | El marcado de `html.json`, el mismo en el DOM con comportamiento, y elementos de React |
| Puente | `createCanvas` (dentro del iframe), `connectCanvas` (en el editor) | Protocolo sobre `postMessage` con un `MessagePort` |
| Marca | `createBrandEditor` | Leer y escribir tokens con su tipo y rango, aplicarlos en vivo, medir el contraste y exportar el archivo de marca |

## Versiones

Tres números, cada uno en su sitio. Ninguno cambia con la versión de zuix salvo que cambie su forma.

| Versión | Dónde | Cuándo sube |
|---|---|---|
| `schemaVersion` del catálogo | `catalog.json`, `CATALOG_SCHEMA_VERSION` | Cambia la forma del catálogo (no cuando se añaden bloques) |
| `schemaVersion` del documento | cada documento, `DOCUMENT_SCHEMA_VERSION` | Cambia la forma del documento. Un documento anterior se sube con `migrateDocument` |
| `PROTOCOL_VERSION` | cada mensaje del puente | Cambia un mensaje de forma incompatible. Añadir un mensaje o un campo opcional no la sube |

El catálogo dice además con qué zuix se generó (`zuix`). Un documento guardado nunca se rompe al actualizar: se
migra. Una versión posterior a la que conoce el paquete se rechaza con un error que pide actualizarlo.

## El catálogo

```ts
import catalog from "@zuccadev-labs/zuix/editor/catalog";   // o fetch del JSON
```

Cada bloque trae:

| Campo | Qué es |
|---|---|
| `type`, `package`, `group`, `title`, `description`, `icon` | Identidad y paleta. `icon` es un nombre de zicon |
| `html` | `template`: el conector lo serializa desde sus props. `preset`: solo con uno de sus presets, cuyo marcado sale de `html.json` (sus props no se editan). `none`: solo existe en React |
| `behavior` | `none` (solo CSS) o `dom` (necesita `@zuccadev-labs/zuix-zui/dom`) |
| `layout` | Contenedor de maquetación: zona de soltar |
| `props` | JSON Schema del objeto de props, con `default` y el control sugerido en `x-control`: `text`, `number`, `select`, `token-color`, `icon`, `switch`, `image`, `link` o `json` |
| `children`, `slots` | Qué admite cada hueco: categorías (`flow`, `phrasing`, `interactive`, `heading`, `sectioning`), tipos, texto y máximo |
| `parents` | Dentro de qué tipos puede ir (`ListItem` solo en `List`) |
| `variants`, `presets` | Variantes de sus props de intención y presets sacados de los ejemplos del manifiesto, ya como nodos |
| `events` | Props de evento del binding y su evento `z:*` del modo DOM cuando lo hay |
| `a11y` | Reglas: un `IconButton` exige `label`, una imagen exige `alt`, un título exige texto |
| `adaptive` | Variantes por clase de tamaño y, en un layout adaptativo, sus plantillas por defecto |

Hoy son 294 bloques: 36 se serializan desde sus props (los del conector, los de contenido de zui y los de
maquetación de zout), 234 por preset y 24 solo en React. `pnpm check` genera el catálogo y comprueba que cada
ejemplo de un bloque `template` que se puede expresar como documento da exactamente el marcado de `html.json`.

### Bloques del conector

Además de los componentes, una página necesita títulos, párrafos e imágenes. El conector trae `Heading`,
`Paragraph`, `InlineText` (`strong`, `em`, `code`, `kbd`, `mark`…), `Anchor`, `Image`, `List`, `ListItem`,
`Quote`, `Section` (`section`, `header`, `main`, `nav`…) e `Icon`.

## El documento

```json
{
  "format": "zuix.page",
  "schemaVersion": 1,
  "lang": "en",
  "body": [
    {
      "id": "cta",
      "type": "Button",
      "props": { "variant": "primary", "icon": "plus" },
      "style": { "marginBlock": "space-4" },
      "children": [{ "id": "cta-t", "type": "#text", "text": "Get started" }]
    },
    {
      "id": "note",
      "type": "Callout",
      "props": { "tone": "info" },
      "slots": { "title": [{ "id": "note-t", "type": "#text", "text": "Tip" }] },
      "children": [{ "id": "note-b", "type": "#text", "text": "Press Ctrl K." }]
    }
  ]
}
```

- El texto es un nodo `#text`. Un prop de tipo `ReactNode` del componente (un título, unas acciones) es un hueco
  en `slots`.
- `style` solo admite nombres de token, por propiedad: `padding`, `margin`, `gap` (`space-*`), `background`
  (superficies), `color` (tokens de texto), `radius`, `maxWidth` y `textAlign`. Sale como `var(--z-…)`.
- Un bloque `preset` lleva `preset` con el id del preset y no lleva props.
- Las operaciones (`insertNode`, `moveNode`, `removeNode`, `updateProps`, `updateStyle`, `updateText`,
  `updateAdaptive`) son inmutables: comparten los nodos que no cambian, así que un historial de deshacer guarda
  instantáneas sin copiar el árbol.

### Validar

```ts
const { valid, errors, warnings } = validateDocument(doc, catalog);
// errors[0] → { code: "a11y.name", message: "IconButton «b» (en s): un botón de icono necesita `label`…",
//               nodeId: "b", path: ["s", "b"], pointer: "/body/0/children/0" }
```

Cada incidencia trae un `code` estable para que el editor la traduzca o la agrupe, el nodo, su ruta de ids y un
puntero JSON. Se comprueban la forma, los ids, los tipos, las props contra su esquema, los iconos, el anidado
(también un control dentro de otro), el estilo, la accesibilidad y lo adaptativo. El orden de los títulos y un
segundo `h1` son avisos.

### Migrar

`migrateDocument(entrada)` sube un documento a la versión actual y dice qué pasos aplicó. La versión 0 es la
forma suelta que escribe una persona o un adaptador antes de tener ids: un nodo o una lista de nodos con el texto
como cadenas.

```ts
migrateDocument([{ type: "Heading", props: { level: 1 }, children: ["Hola"] }]).document;
```

## Adaptativo

zuix es adaptativo, no solo responsive: en cada clase de tamaño una pieza puede cambiar de orden, de área, de
variante o de props, o esconderse. Las clases son las de `AdaptiveLayout` de zout:

| Clase | Ancho |
|---|---|
| `compact` | menos de 600 px |
| `medium` | 600–839 px |
| `expanded` | 840–1199 px |
| `large` | 1200–1599 px |
| `xlarge` | 1600 px o más |

Se miden sobre el contenedor. Lo que se declara en una clase vale hasta que una mayor lo sobrescribe:

```json
{
  "id": "aside",
  "type": "Section",
  "adaptive": {
    "compact": { "area": "aside", "order": 2 },
    "large": { "order": 0 }
  }
}
```

- `area` tiene que existir en la plantilla del `AdaptiveLayout` padre para esa clase. Una plantilla es la de
  `grid-template-areas`, por clase: `{ "compact": { "areas": ["main", "aside"] }, "expanded": { "areas": ["main aside"], "columns": "1fr 18rem" } }`, y sus áreas deben ser rectángulos.
- `variant` es una de las que declara el bloque en `adaptive.variants`: `AdaptiveTabs` (`tabs`, `select`,
  `bottom-nav`), `AdaptiveTable` (`table`, `cards`) y `AdaptiveToolbar` (`bar`, `menu`: todas las acciones al menú
  «más»). Se aceptan los alias `bottom-navigation`, `sidebar` (= `docked`, la variante de los paneles del `Shell`),
  `toolbar` y `overflow`; se guardan con el nombre canónico. Con `toReact`, la variante llega a la prop `adaptive`
  del componente.
- `props` cambia props en esa clase y se valida con el esquema del bloque.

La resolución es la de los layouts adaptativos de zout, que viven en `@zuccadev-labs/zuix-zui/adaptive`
(`resolveAdaptive`, `resolveTemplate`, `sizeClassFor`, `templateVars`, `nodeStyle`), y el marcado, el de
`AdaptiveLayout` ([Layouts adaptativos](./13-layouts-adaptativos.md)): `.z-adaptive > .z-adaptive__grid` con las
plantillas de las cinco clases en variables, y cada hijo como `.z-adaptive__item` con `data-item`,
`--z-place-<clase>`, `--z-order-<clase>` y `data-hidden-in`. La especificación del nodo va además en
`data-z-adaptive`. El lienzo coloca con la hoja de zout; para que el orden del DOM siga al visual, hidrata también
con `@zuccadev-labs/zuix-zout/dom`.

## Las salidas

```ts
import { toHTML, toTrustedHTML, renderToDOM } from "@zuccadev-labs/zuix-zui/editor";
import { toReact } from "@zuccadev-labs/zuix-zui/editor/react";

toHTML(doc, { catalog });                    // cadena con el marcado de html.json
el.innerHTML = toTrustedHTML(doc, { catalog });  // bajo require-trusted-types-for 'script'
const view = renderToDOM(doc, container, { catalog });  // construye el DOM e hidrata con zui/dom
toReact(doc, { catalog, components: { ...zui, ...zout } });
```

- **Escapado.** El texto y los valores de atributo se escapan al escribir; las etiquetas y los nombres de atributo
  son fijos; los valores de enumeración se reducen a los admitidos aunque el documento no se haya validado; y las
  URL de `href` y `src` pasan por `safeUrl`, que solo deja rutas relativas, `http(s)`, `mailto`, `tel` y, en
  imágenes, `data:` de mapa de bits. Escapar entidades no neutraliza un `javascript:`; filtrarlo, sí.
- **CSP.** `toTrustedHTML` pasa por la política `zuix-zui`. `renderToDOM` no la necesita: construye los nodos con
  la API del DOM y escribe los estilos con la API de estilos, así que tampoco pide `style-src-attr`. Solo el
  marcado de un bloque `preset`, que es del paquete, entra por la política.
- **Sin configuración regional.** Ningún bloque formatea con `Intl`: la salida es la misma con cualquier idioma y
  zona horaria. Hay una prueba que lo compara entre `en-US`/UTC y `de-DE`/Asia/Tokyo.
- **Comportamiento.** `renderToDOM` llama a `init()` y `hydrate()` de `zui/dom`. Para los layouts de zout con
  comportamiento: `hydrate: [defaultHydrator, () => zoutInit()]`.
- **React.** Sin `components`, los bloques `template` salen con el mismo árbol que `toHTML`. Con ellos, cada
  bloque sale con su componente del binding. `toReact` no usa hooks: sirve en un Server Component.

`fromHTML(html)` hace el camino contrario para los bloques del conector: importa texto pegado o una página
sencilla y lista lo que no reconoce en lugar de inventarlo.

## El puente

El lienzo es un documento dentro de un iframe que pinta la página; el editor es la página que lo contiene.

```ts
// Dentro del iframe (canvas.html).
import { createCanvas } from "@zuccadev-labs/zuix-zui/editor";
createCanvas({ container: document.querySelector("#page"), catalog, allowedOrigins: ["https://editor.example.com"] });

// En el editor.
import { connectCanvas } from "@zuccadev-labs/zuix-zui/editor";
const frame = document.querySelector("iframe");   // <iframe sandbox="allow-scripts" src="https://…/canvas.html">
const canvas = await connectCanvas(frame, { origin: "null" });
canvas.on("changed", ({ document, canUndo, warnings }) => save(document));
await canvas.request("load", { document: doc });
```

### Seguridad

1. El editor crea un `MessageChannel` y envía el saludo (`hello`) con un puerto a `iframe.contentWindow`.
2. El lienzo solo lo acepta si viene de `window.parent` y de un origen de `allowedOrigins`. La comparación es
   exacta (con la API `Origin` donde existe, con `URL` si no): ni prefijos, ni comodines, ni el origen opaco
   `"null"`, que comparten todos los iframes con sandbox.
3. Todo lo demás viaja por el puerto, que solo tienen las dos partes. Un mensaje con otra forma o con otra
   versión se descarta y se cuenta (`canvas.rejected`), sin respuesta.

Recomiendo el lienzo con `sandbox="allow-scripts"` y sin `allow-same-origin`: el código de la página no puede
leer el editor ni sus credenciales. Con origen opaco el editor no puede fijar el destino del saludo, que sale con
`"*"`; por eso lleva solo el puerto y la versión. `allowedOrigins` va fijo en el código del lienzo: quien carga el
iframe no debe poder elegir a quién obedece. Con origen opaco las fuentes y los módulos se piden con CORS: el
lienzo de la demostración usa scripts clásicos y no carga `fonts.css`.

### Mensajes

Cada mensaje es `{ protocol: "zuix-editor", version: 1, type, id?, replyTo?, payload }`. `request()` numera la
petición y espera la respuesta con su `replyTo`; un `error` la rechaza con su `code`, su texto y sus incidencias.

| Del editor al lienzo | Carga | Respuesta |
|---|---|---|
| `hello` | `{ zuix, protocolVersion }` y el puerto | `ready` |
| `load` | `{ document }` (se migra si es anterior) | `changed` |
| `insert`, `move` | `{ node, at }`, `{ id, at }` con `at = { parent, slot?, index }` | `changed` |
| `remove` | `{ id }` | `changed` |
| `update` | `{ id, props?, style?, text? }` (`null` quita) | `changed` |
| `adapt` | `{ id, sizeClass, patch: { order?, hidden?, area?, span?, variant?, props? } }` | `changed` |
| `select`, `hover` | `{ id }` o `{ id: null }` | `selected`, `hovered` |
| `undo`, `redo` | `{}` | `changed` o `error` |
| `theme` | `{ brand?, theme?, tokens? }` | `themed` |
| `viewport` | `{ sizeClass?, width?, pointer? }` (`null` vuelve a medir) | `viewportChanged` |
| `measure` | `{ parent?, slot? }` | `dropTargets` |
| `measureAreas` | `{ parent? }` | `areaTargets` |

| Del lienzo al editor | Carga |
|---|---|
| `ready` | Versiones de zuix, protocolo, documento y catálogo |
| `selected` | `{ id, path, type, rect }`: el clic en el lienzo también selecciona |
| `hovered` | `{ id, type, rect }` |
| `changed` | `{ document, reason, canUndo, canRedo, warnings }` |
| `error` | `{ code, message, issues? }` |
| `dropTargets` | Puntos de anclaje para soltar: hueco, índice, orientación y línea |
| `areaTargets` | Áreas de cada layout adaptativo en la clase actual, con su caja |
| `themed`, `viewportChanged` | Lo que quedó aplicado |

- El lienzo guarda el documento y su historial (`core/undo`, con fusión de los cambios seguidos de una misma prop).
  Un cambio que deja el documento inválido se rechaza; los avisos de accesibilidad no lo impiden y llegan en
  `warnings`.
- Las capas de selección y de paso del puntero viven fuera del contenedor, en la capa superior, inertes. El
  documento pintado solo lleva `data-z-node` en la raíz de cada bloque; `toHTML` no lo escribe.
- En el lienzo, arrastrar una pieza de un `AdaptiveLayout` y soltarla sobre otra área la mueve a esa área en la
  clase de vista previa.

## Marca

```ts
const brand = createBrandEditor(catalog.tokens, "dazlabs");
brand.set("accent", "#1d4ed8", "light");     // [] o los problemas: tipo, rango, caracteres
canvas.request("theme", { tokens: brand.cssVariables("light") });
brand.contrast();                             // { ok, failures, pending } con las reglas de pnpm tokens
download(brand.export());                     // archivo de marca validado con brand.schema.json
```

Cada token del catálogo trae su tipo (color, longitud, duración, número, fuente, sombra, curva…), su ámbito (de
tema, de escala o de componente) y, si es una medida, su rango. La medida de contraste es la de `pnpm tokens`
sobre los mismos datos: la matriz de texto sobre superficies, los pares declarados, el no texto y los usos reales
de las hojas de zui y zout. `pnpm check` comprueba que da las mismas 1362 medidas que tokens.

## Escribir un adaptador

Un adaptador traduce entre el modelo del editor y este. Lo que tiene que hacer:

1. **Paleta.** Leer `catalog.blocks` y ofrecer los que tengan presets. Insertar es `withNewIds(preset.node)`.
2. **Inspector.** Generar los controles de `props.properties` por `x-control`, con `default` y `enum`; los huecos
   de `slots` como zonas; `style` con las listas de `catalog.style`; lo adaptativo por clase.
3. **Lienzo.** Servir una página con `createCanvas` y conectarla con `connectCanvas`. Las cajas que devuelve el
   lienzo son coordenadas del iframe: se suman a su posición.
4. **Guardar.** El documento que llega en `changed`. Al abrir, `migrateDocument` y `validateDocument`.
5. **Publicar.** `toHTML` para HTML estático, `renderToDOM` para una página sin framework, `toReact` para React.

El ejemplo [`examples/editor-canvas`](https://github.com/zuccadev-labs/zuix/tree/main/examples/editor-canvas) hace
todo esto en unas 370 líneas, sin estilo de producto: `node examples/editor-canvas/build.mjs` y abrir su
`index.html` desde un servidor.

## Lo que no he comprobado

- Un editor real encima: el adaptador está por escribir y puede pedir mensajes que aquí no están.
- El puente fuera de Chromium.
- Las áreas como zonas de soltar se miden sobre las pistas resueltas de la rejilla (`gridTemplateColumns` y
  `gridTemplateRows` calculados); con `measure: "viewport"` la vista previa por clase no cambia el ancho de la
  ventana del lienzo, solo el del contenedor, y ese layout sigue a la ventana.
