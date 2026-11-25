# El conector de editores visuales

Noviembre de 2026, para la `0.5`. Tengo un editor visual de páginas por bloques, aparte de zuix, que llegará más
adelante. No conozco todavía su API, así que no la he inventado: construí el lado de zuix, un contrato que
cualquier editor de bloques puede consumir, y dejé el adaptador para cuando el editor exista. La guía de uso está
en [Conectar un editor visual](../users/12-conectar-un-editor.md).

## Qué decidí

### El catálogo sale de los manifiestos, no se escribe

Los 254 manifiestos de zui y zout ya describen cada componente: props con tipo y valor por defecto, ejemplos,
clases y accesibilidad. `tools/editor-catalog.mjs` los convierte en `editor/catalog.json` en cada `pnpm check`.
Escribirlo a mano lo habría desfasado en la primera versión.

Lo que el manifiesto no dice lo dicen las definiciones de bloque de `zui/src/editor/blocks/`: qué admite cada
hueco, qué es un contenedor, qué reglas de accesibilidad comprueba el validador y cómo se serializa. Hay 36: las
que una página necesita para empezar (texto, botones, enlaces, avisos, tarjetas, paneles, maquetación y las
secciones de una página de presentación). El resto entra por preset con el marcado de `html.json`.

### La serialización se comprueba contra html.json

Cada bloque `template` reproduce el árbol de su componente sin React. La duda era cómo evitar que se separen.
El generador convierte los ejemplos JSX de cada manifiesto en documentos (los que solo usan props JSON y bloques
conocidos), los pasa por `toHTML` y compara con el marcado que `pnpm html` sacó de React, normalizando espacios,
orden de atributos y entidades. Hoy coinciden los 33 ejemplos que se pueden expresar. Si alguien cambia un
componente y no su bloque, `pnpm check` lo dice con las dos versiones del marcado.

### JSON Schema 2020-12 para las props

Un editor necesita saber qué control pintar y qué valores admitir, y lo necesita sin TypeScript (el editor puede
no estar escrito en él, y el catálogo se lee en ejecución). JSON Schema es el formato que cualquier lenguaje sabe
validar y que los generadores de formularios ya entienden. Añadí dos anotaciones propias, `x-control` y `x-token`,
que un validador estándar ignora. El documento de página también tiene su esquema.

Escribí un validador del subconjunto que uso en lugar de añadir Ajv: los paquetes publicados no tienen
dependencias de terceros. Ese validador comprueba también el propio catálogo contra `catalog.schema.json`.

### Un documento propio, no el del editor

El documento es un árbol plano de nodos con `id`, `type`, `props`, `children` y `slots`, más `style` limitado a
tokens y `adaptive`. Es deliberadamente aburrido: se serializa con `JSON.stringify`, se compara con `deepEqual` y
cualquier editor de bloques (Gutenberg, Editor.js, el mío) tiene un modelo parecido que se traduce en un
adaptador. Versionado con `schemaVersion` y una cadena de migraciones: la 0 es la forma suelta sin ids.

### postMessage con un MessagePort

El lienzo tiene que vivir en un iframe para que el CSS de la página no se mezcle con el del editor y para medir
las clases de tamaño sobre un contenedor real. Para hablar con un iframe la plataforma tiene `postMessage`;
`BroadcastChannel` no cruza orígenes y un servidor intermedio sobra.

Apliqué las guías de seguridad de `modern-web-guidance` (`validate-origins`, `security`, `trusted-types`):

- El lienzo comprueba el emisor (`event.source === window.parent`) y el origen con comparación exacta, nunca por
  prefijo, y rechaza siempre `"null"`: dos iframes con sandbox distintos comparten ese origen serializado.
- Tras el saludo todo va por un `MessagePort` transferido. Es el mecanismo que la guía propone para un iframe con
  sandbox, cuyo origen no se puede fijar como destino: el puerto solo lo tienen las dos partes.
- `toHTML` es seguro por construcción y puede pasar por la política `zuix-zui`, pero filtra el esquema de las URL:
  el escapado de entidades no neutraliza un `javascript:`.

Recomiendo el lienzo con `sandbox="allow-scripts"`, sin `allow-same-origin`. Tiene un coste que descubrí en la
prueba: con origen opaco las fuentes y los módulos se piden con CORS. La demostración usa scripts clásicos y deja
las fuentes fuera; un despliegue real las sirve con `Access-Control-Allow-Origin`.

### El historial en el lienzo

El lienzo guarda el documento y el historial (`core/undo`, que ya existía para el editor de nodos): deshacer es
un mensaje, y el editor no necesita llevar otra copia. Las operaciones del árbol son inmutables y comparten los
nodos que no cambian, así que cada paso es una referencia. La prueba de navegador encontró aquí un error: una
inserción en el cuerpo mutaba la lista original y el historial perdía el estado anterior. Hay una propiedad con
fast-check que lo vigila.

### La medida de contraste, la misma

La edición de marca tenía que validar el contraste con la validación que ya existe. No podía importar
`tokens/src/validate.mjs` (no se publica y lee las hojas del disco), así que el catálogo copia sus datos
(superficies, pares, no texto y los usos reales que extrae de las hojas) y `contrast.ts` repite el cálculo.
`pnpm check` compara las 1362 medidas de las tres marcas con las de tokens, una a una.

### No hay entrada /editor en zout ni en tokens

El conector conoce el marcado de los layouts de zout por su contrato HTML, no por su código, así que zui no
importa zout. `renderToDOM` y `toReact` aceptan el comportamiento y los componentes de zout como opciones. Los
tokens no tienen JavaScript; lo que el editor necesita de ellos viaja en el catálogo.

### Adaptativo

`AdaptiveLayout` lo construye otra rama. Del contrato acordado tomé las clases (`compact` a `xlarge`), el campo
`adaptive` de cada nodo y las plantillas por clase, y escribí un resolvedor mínimo con la misma semántica para
validar áreas y mover piezas en el lienzo. Lo marqué provisional, como el marcado que emite, para sustituirlo al
integrar sin tocar el documento.

## Qué dejé para cuando llegue el editor

- El adaptador. Sabré qué falta cuando lo escriba: probablemente mensajes de edición de texto en línea y de
  portapapeles.
- Arrastrar desde la paleta al lienzo. El lienzo devuelve los puntos de anclaje (`measure`) y las áreas
  (`measureAreas`); el gesto lo pinta el editor, que es quien sabe cómo se ve.
- Más bloques con serialización propia. Los de formularios, gráficos y datos los están cambiando otras ramas;
  entran por preset hasta que se asienten.
- Repintar solo lo que cambia. El lienzo vuelve a pintar el documento entero en cada cambio; con páginas de
  cientos de bloques habrá que medirlo.
