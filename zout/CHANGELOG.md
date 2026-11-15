# Cambios de @zuccadev-labs/zuix-zout

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

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
