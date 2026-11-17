# Cambios de @zuccadev-labs/zuix-zout

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

### Añadido

- `Shell`: `skipLinkLabel` (enlace «saltar al contenido», WCAG 2.4.1), `mainAs` (`main`, `div` o `section`, para
  shells anidados o varios en una página) y `resizeLabel` en cada panel.
- `ResizeHandle`: lados lógicos `start` y `end`, que siguen la dirección de escritura, y `controls`
  (`aria-controls`). En HTML: `data-side="start|end"`.
- `SplitPane`: Inicio y Fin llevan el divisor a su mínimo y a su máximo; doble clic reparte a partes iguales los
  dos paneles; cada divisor lleva `aria-controls`.
- `TabStrip`: `controls` en cada pestaña (`aria-controls` del panel).
- `TitleBar`: prop `as` (`header` o `div`). `PageHeader` y `PageSection`: `headingLevel`.
- `@zuccadev-labs/zuix-zout/dom`: `dispose(root)` suelta los observadores de un bloque de marcado; `hydrate()`
  completa un `.z-resize` escrito solo con su clase (rol, orientación, límites).
- Colores forzados (alto contraste de Windows): foco, elemento activo del rail, pestaña seleccionada, divisores y
  cajones se distinguen con contornos y colores del sistema.

### Cambiado

- `TitleBar` es un `<header>` (región `banner`) en lugar de un `<div>`. Las clases no cambian.
- El tirador de los paneles del `Shell` usa `data-side="end"` (sidebar) y `"start"` (inspector) en lugar de
  `right` y `left`.
- El botón de cierre de una pestaña mide 24 × 24 px (antes 18): mínimo de WCAG 2.5.8.
- Antes de medirse (HTML de servidor, o antes de `init()`), un panel `auto` del `Shell` que no cabe no se
  muestra: una ventana estrecha ya no enseña un instante los paneles acoplados. `.z-shell` es un contenedor
  de consultas (`container: z-shell / inline-size`).
- El eyebrow de `PageHeader` usa `--z-accent-text` y el contador del rail `--z-danger-solid` (4.5:1).

### Corregido

- RTL: los cajones, el tirador, el arrastre y las flechas de `SplitPane`, y las flechas de `TabStrip` siguen la
  dirección de escritura; la hoja usa propiedades lógicas.
- `Shell` (React): Escape no cierra el cajón si lo gestiona un `<dialog>` o un popover abierto por encima.
- `ResizeHandle` y `SplitPane` (React): solo arrastra el botón principal; el arrastre termina si se pierde la
  captura del puntero.
- `@zuccadev-labs/zuix-zout/dom`: un selector inválido en `data-z-shell` o `data-z-resize` ya no lanza una
  excepción; un shell retirado del documento deja de observarse; los iconos se crean con el DOM (compatible con
  Trusted Types); `data-z-shell="#id"` manda sobre el shell que contiene al botón.
- El foco de los controles de layout sigue visible con colores forzados (contorno transparente además del anillo).

## [0.1.0] - 2026-11-14

Primera versión publicada.

### Añadido

- 10 layouts: `Shell`, `Rail`, `SidePanel`, `Sidebar`, `SplitPane`, `TabStrip`, `TitleBar`, `ResizeHandle`,
  `Page` (con `PageHeader`, `PageSection`, `Container`, `Stack`, `Inline`) y `Grid`. La lista con props, tokens
  y clases está en `manifest.json`.
- Contrato HTML de cada layout en `html.json` y estilos en `@zuccadev-labs/zuix-zout/styles.css` (capa `zout`; requiere
  antes los tokens y `@zuccadev-labs/zuix-zui/styles.css`).
- `@zuccadev-labs/zuix-zout/dom`: `Shell` responsive, `ResizeHandle`, `SplitPane`, `TabStrip` y secciones de `Sidebar` sin
  framework.
- `@zuccadev-labs/zuix-zout`: binding de React 19. React es un peer opcional.
- `@zuccadev-labs/zuix-zicon` es `peerDependency`: la aplicación lo instala junto a este paquete y hay una sola copia
  del registro de iconos.
- `dist/zout.css` y `dist/zout.dom.js`: listos para enlazar sin bundler.
- Salida de publicación: ESM compilado módulo a módulo con declaraciones en `dist/esm/`, y `"use client"`
  en los módulos con estado o eventos.
- `README.md` en el paquete publicado.

### Táctil

- Con puntero principal grueso (`@media (pointer: coarse)`), la zona de agarre de `ResizeHandle` y de los divisores
  de `SplitPane` crece hasta `--z-touch-target` (40 px) sin cambiar la línea dibujada, y las pestañas de
  `TabStrip` y su botón de alta llegan a ese alto. Los botones de `TitleBar`, `Rail` y `Sidebar` crecen con los
  tokens de control.
- Todas las reglas `:hover` van dentro de `@media (hover: hover)`: sin hover pegajoso en pantallas táctiles.
