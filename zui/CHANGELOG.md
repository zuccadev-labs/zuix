# Cambios de @zuccadev-labs/zuix-zui

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

## [0.1.0] - 2026-11-14

Primera versión publicada.

### Añadido

- 64 componentes en 8 grupos: acciones (5), formularios (17), datos (11), estado (7), contenido (7),
  capas (9), navegación (7) y Carousel. La lista con props, tokens y clases está en `manifest.json`.
- Contrato HTML: clases `z-*`, atributos de estado (`data-state`, `data-size`, `aria-*`) y el marcado de cada
  ejemplo en `html.json`, generado desde el binding de React.
- Estilos sobre tokens `--z-*`: `@zuccadev-labs/zuix-zui/styles.css` (todo) y `@zuccadev-labs/zuix-zui/styles/<grupo>.css`. Material
  liquid glass (`.z-liquid`, `.z-solid`).
- `@zuccadev-labs/zuix-zui/dom`: comportamiento sin framework. Diálogos, popovers, menús, menú contextual, tooltips,
  avisos, confirmación, pestañas, acordeón, controles de formulario, Select, Combobox, Calendar,
  DatePicker, Slider, OTPInput, FileUpload, CommandPalette, Tree, orden de DataTable, Pagination y
  Carousel. Eventos `z:open`, `z:close`, `z:change`, `z:select` y `z:sort`.
- `@zuccadev-labs/zuix-zui`: binding de React 19 sobre Radix. React es un peer opcional: el contrato y `dom` no lo usan.
- `@zuccadev-labs/zuix-zicon` es `peerDependency`: la aplicación lo instala junto a este paquete y hay una sola copia
  del registro de iconos.
- `dist/zui.css` y `dist/zui.dom.js`: listos para enlazar sin bundler.
- Salida de publicación: ESM compilado módulo a módulo con declaraciones en `dist/esm/`, y `"use client"`
  en los módulos con estado, eventos o Radix.
- Carousel sin React en modo `gl`: las zonas curvas se dibujan en WebGL2 cuando cada slide declara su imagen
  (`data-raster`, `data-raster="#selector"`, `data-raster-src`) o con `carousel(el, { rasterize })`. Cae a
  `css` sin WebGL2 o si falta una imagen. `carousel(el).refresh()` rehace réplicas y texturas.
- `@zuccadev-labs/zuix-zui/dom/carousel-gl` y `dist/zui.dom.carousel-gl.js`: los shaders, que `@zuccadev-labs/zuix-zui/dom` carga bajo
  demanda. `zui.dom.js` no los incluye.
- `README.md` en el paquete publicado.

### Táctil

- **Objetivo táctil de 40 px.** Con puntero principal grueso (`@media (pointer: coarse)`) los controles `sm` y `md`
  crecen hasta `--z-touch-target` (40 px; token de `@zuccadev-labs/zuix-tokens`): botones, campos, Select, pestañas,
  filas de árbol y de menú, opciones de lista. Checkbox, Radio y Switch ganan aire vertical, el Slider crece en
  su eje corto, y los botones de cierre (`.z-overlay-close`, `.z-alert__dismiss`), el botón del campo y las
  opciones de SegmentedControl amplían su zona de pulsación sin cambiar el dibujo. Con ratón nada cambia.
  `--z-touch-target: 0px` lo desactiva.
- **Sin hover pegajoso.** Todas las reglas `:hover` van dentro de `@media (hover: hover)`: en una pantalla táctil
  el último control tocado no se queda con el estilo de hover.
- `@zuccadev-labs/zuix-zui/dom`: los avisos (`toast()`) se descartan deslizando, con dedo, lápiz o ratón, igual que el Toast de
  React (a la derecha, o hacia el borde en las posiciones centradas). `.z-toast` declara `touch-action`. Al
  descartarlo, el aviso conserva el desplazamiento mientras se desvanece.
- `@zuccadev-labs/zuix-zui/dom`: el menú contextual (`data-z-context`) se abre con una pulsación larga de 600 ms con dedo o
  lápiz. iOS no emite `contextmenu`, y un Chromium de escritorio con pantalla táctil tampoco. El menú sigue
  abierto al levantar el dedo.
- ContextMenu de React en ventanas estrechas: si el menú no cabe a ningún lado del puntero, se estrecha hasta
  el hueco disponible en lugar de salirse de la ventana.
