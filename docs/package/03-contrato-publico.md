# Contrato público

Qué es superficie pública de la suite y qué cuenta como cambio incompatible. Todo lo que no aparece aquí
es interno y puede cambiar en cualquier versión.

Escribí este documento para obligarme: antes de fusionar un cambio miro esta tabla, y si toca una fila de
«Incompatible» va a una versión `MENOR` (mientras sea `0.x`) con su nota de migración.

## Superficie pública

| Superficie | Dónde se define | Ejemplos |
|---|---|---|
| Tokens | `tokens/dist/tokens.json` | `--z-accent`, `--z-space-4`, `--z-panel-radius` |
| Marcas y temas | `tokens/brands/`, `data-brand`, `data-theme` | `dazlabs`, `zutool`, `zenith`; `dark`, `light` |
| Variables que escribe el comportamiento | Las hojas de `zui` y `zout` | `--z-anchor-width`, `--z-available-width`, `--z-available-height`, `--z-accordion-content-height`, `--z-toast-swipe-*` |
| Clases | `classes` de cada componente en `manifest.json` | `z-btn`, `z-btn--primary`, `z-modal__title`, `z-liquid` |
| Atributos de estado | El marcado de `html.json` | `data-state`, `data-size`, `data-variant`, `data-tone`, `aria-*` |
| Atributos de comportamiento | La guía de frameworks y la de zout | `data-z-dom`, `data-z-open`, `data-z-close`, `data-z-context`, `data-z-submenu`, `data-z-tooltip`, `data-z-placement`, `data-z-static`, `data-z-hotkey`, `data-z-carousel`, `data-z-shell-toggle`, `data-z-shell`, `data-z-resize` |
| Marcado | `zui/html.json`, `zout/html.json` | Estructura de elementos de cada ejemplo |
| Eventos | `@zuccadev-labs/zuix-zui/dom`, `@zuccadev-labs/zuix-zout/dom` | `z:open`, `z:close`, `z:change`, `z:select`, `z:sort`, `z:input`, `z:add`, `z:resize`, `z:modechange` y su `detail` |
| Nombres de icono | `zicon/manifest.json`, tipo `IconName` | `bell`, `magnifying-glass`; identificadores del sprite `#bell`, `#bell-solid` |
| Elemento `<z-icon>` | `@zuccadev-labs/zuix-zicon/element` | Atributos `name`, `variant`, `size`, `label` |
| Componentes y props | `props` de cada componente en `manifest.json`, tipos `*Props` | `Button`, `ButtonProps` |
| Funciones | Lo exportado por cada entrada | `init`, `use`, `destroy`, `hydrate`, `toast`, `confirm`, `registerIcons`, `iconSvg`, `iconElement`, `cx`, y los módulos de familia de `zui/dom` (`datesModule`, `agendaModule`…) |
| Política de Trusted Types | `@zuccadev-labs/zuix-zui/dom` | El nombre `zuix-zui` |
| Entradas del paquete | `publishConfig.exports` de cada `package.json` | `@zuccadev-labs/zuix-zui/dom`, `@zuccadev-labs/zuix-zicon/icons/*`, `@zuccadev-labs/zuix-zui/dist/zui.css` |
| Peers y entorno | `peerDependencies`, `engines`, la línea de navegadores | React 18.2 o 19, Node 22.12; Chrome y Edge 116, Firefox 125, Safari 17, Safari de iOS 18.3 |

## Entradas

| Paquete | Entradas |
|---|---|
| `@zuccadev-labs/zuix-tokens` | `./tokens.css`, `./tailwind.css`, `./docusaurus.css`, `./tokens.json`, `./dtcg/*`, `./css/*` (y cada marca incluida, de forma explícita), `./brands/*`, `./schema/*`, `./compat/*` |
| `@zuccadev-labs/zuix-zicon` | `.`, `./core`, `./all`, `./dom`, `./element`, `./icons/*`, `./manifest.json`, `./sprite.svg`, `./svg/*`, `./dist/zicon.element.js` |
| `@zuccadev-labs/zuix-zui` | `.`, `./dom`, `./dom/core`, `./dom/dates`, `./dom/data`, `./dom/content`, `./dom/agenda`, `./dom/charts`, `./dom/color`, `./dom/media`, `./dom/effects`, `./dom/time`, `./dom/terminal`, `./dom/chat`, `./dom/ai`, `./dom/dashboard`, `./dom/people`, `./dom/nodes`, `./styles.css`, `./styles/*`, `./manifest.json`, `./html.json`, `./dom/carousel-gl`, `./dist/zui.css`, `./dist/zui.dom.js`, `./dist/zui.dom.carousel-gl.js` |
| `@zuccadev-labs/zuix-zout` | `.`, `./dom`, `./styles.css`, `./manifest.json`, `./html.json`, `./dist/zout.css`, `./dist/zout.dom.js` |
| `@zuccadev-labs/zuix` (paraguas) | `.`, `./zui`, `./zui/dom`, `./zui/dom/core`, `./zui/dom/dates`, `./zui/dom/data`, `./zui/dom/content`, `./zui/dom/agenda`, `./zui/dom/charts`, `./zui/dom/color`, `./zui/dom/media`, `./zui/dom/effects`, `./zui/dom/time`, `./zui/dom/terminal`, `./zui/dom/chat`, `./zui/dom/ai`, `./zui/dom/dashboard`, `./zui/dom/people`, `./zui/dom/nodes`, `./zui/dom/carousel-gl`, `./zout`, `./zout/dom`, `./zicon`, `./zicon/core`, `./zicon/dom`, `./zicon/all`, `./zicon/element`, `./styles.css`, `./tokens.css`, `./tokens/dazlabs.css`, `./tokens/zutool.css`, `./tokens/zenith.css`, `./tailwind.css`, `./docusaurus.css` |

Todos exponen además `./package.json`. El paraguas no añade superficie: cada entrada reexporta la del paquete
que nombra, y `./styles.css` importa las hojas de `tokens`, `zui` y `zout` en ese orden.

En el paquete publicado `@zuccadev-labs/zuix-zui/styles.css` es `dist/zui.css` (un solo archivo) y `@zuccadev-labs/zuix-zout/styles.css`
es `dist/zout.css`. Dentro del workspace son `src/styles/index.css`. El contenido es el mismo.

## Qué es incompatible

Un cambio es incompatible si una aplicación que usaba la versión anterior según la documentación deja de
compilar, de verse igual o de comportarse igual sin tocar su código.

| Superficie | Incompatible | Compatible |
|---|---|---|
| Tokens | Eliminar o renombrar un `--z-*`; cambiar su tipo (de color a longitud); quitar un token obligatorio de marca | Añadir un token; ajustar el valor de un token dentro de su intención. Un ajuste que cambia de forma visible el aspecto se anota igualmente en el `CHANGELOG.md` |
| Marcas y temas | Eliminar o renombrar una marca o un tema; cambiar `data-brand` o `data-theme` | Añadir una marca |
| Clases | Eliminar o renombrar una clase `z-*`; cambiar a qué elemento se aplica | Añadir una clase o un modificador |
| Atributos | Eliminar o renombrar un `data-*`; quitar o renombrar un valor (`data-size="md"`); cambiar el valor por defecto | Añadir un atributo opcional o un valor nuevo |
| Marcado | Cambiar la estructura que una aplicación sin React tiene que escribir: elemento, anidamiento u orden obligatorios, atributo requerido nuevo | Añadir un elemento opcional; cambiar el marcado que `dom` genera por sí mismo sin alterar clases ni roles |
| Eventos | Eliminar o renombrar un `z:*`; quitar o cambiar un campo de `detail`; cambiar cuándo se emite o si burbujea | Añadir un evento o un campo a `detail` |
| Iconos | Eliminar o renombrar un icono; cambiar lo que representa; cambiar la caja de 24 × 24 | Añadir un icono; corregir un trazo |
| `<z-icon>` | Eliminar o renombrar un atributo; pasar a shadow DOM | Añadir un atributo |
| Props | Eliminar o renombrar una prop; estrechar su tipo; hacerla obligatoria; cambiar su valor por defecto | Añadir una prop opcional; ampliar un tipo |
| Componentes y funciones | Eliminar o renombrar una exportación; cambiar una firma; quitar `"use client"` de un módulo que lo tenía o añadirlo a uno que se usaba desde el servidor | Añadir una exportación |
| Entradas | Eliminar o mover una entrada de `exports`; renombrar un archivo de `dist/` enlazado por URL | Añadir una entrada |
| Peers y entorno | Subir la versión mínima de React, de Node o de un navegador; añadir un peer obligatorio; pasar una dependencia a peer; añadir una dependencia de terceros en ejecución | Ampliar el rango admitido; quitar una dependencia |
| Accesibilidad | Quitar un rol, un nombre accesible o una interacción de teclado documentada | Añadirlos o corregirlos |

Tres casos que parecen menores y no lo son:

- **Cambiar el valor por defecto** de una prop o de un atributo cambia el aspecto de quien no lo declaraba.
- **Renombrar un icono** rompe en compilación con React (`IconName`) y en silencio con `<z-icon>` o el
  sprite: el icono deja de dibujarse.
- **Cambiar el marcado del contrato** no rompe a quien usa React (el binding se actualiza con el paquete) y
  sí a quien escribió el HTML a mano.

## Qué no es contrato

- La estructura interna de `dist/esm/` y cualquier import que no pase por una entrada de `exports`.
- `src/`, que no se publica.
- El campo `file` de los manifiestos (ruta del fuente) y el orden de sus entradas.
- El valor exacto de un token de una marca: una marca puede ajustar su paleta.
- El CSS que no es una clase `z-*` documentada: selectores internos, orden de reglas, nombres de `@layer`
  salvo `zout`.
- El contenido de los bundles minificados, más allá de sus exportaciones.
- `zudocs`, `examples/` y `tools/`.

## Cómo se detecta un cambio incompatible

| Señal | Qué revela |
|---|---|
| `git diff` de `zui/html.json` y `zout/html.json` | Cambios en marcado, clases y atributos |
| `git diff` de `zui/manifest.json`, `zout/manifest.json` | Props, clases y tokens declarados |
| `git diff` de `zicon/manifest.json` | Iconos añadidos, eliminados o renombrados |
| `git diff` de `tokens/dist/tokens.json` | Tokens |
| `pnpm test:html`, `pnpm test:browser` | Comportamiento, eventos y accesibilidad |
| `pnpm test:unit` | La lógica que comparten React y el modo sin framework |
| `pnpm test:pack` | Entradas de `exports`, tipos y marcado renderizado en servidor |

Estos archivos son generados: su diferencia en una revisión es el resumen del cambio de contrato.

## Lo que falta

- No tengo una comprobación automática que compare el contrato con la versión anterior y falle si se rompe.
  La detección depende de leer las diferencias de la tabla en cada revisión.
- El `detail` de cada evento `z:*` no está documentado en un único sitio: los de `zui/dom` están en la guía
  de frameworks y los de `zout/dom` en la de zout.
- Los valores de los tokens no tienen prueba de regresión visual. Lo que sí se mide en cada cambio es su
  contraste.
