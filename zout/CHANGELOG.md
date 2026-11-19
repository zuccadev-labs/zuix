# Cambios de @zuccadev-labs/zuix-zout

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

### Cambiado

- Estándar liquid glass: nada en píldora. El rail es un panel de cromo con radio 20, concéntrico con sus items
  (`control-radius-lg`); el enlace «saltar al contenido» es transparente hasta recibir el foco; las pestañas de trabajo (`TabStrip`) son rectángulos de radio 8, la activa
  levantada con canto, brillo y sombra corta; los tiradores y divisores dibujan su línea con `radius-xs`.
  `radius-full` queda para el contador del rail.
- Foco por contorno (`focus-width`, `accent-ring`) en el rail, la barra lateral, las pestañas de trabajo y el
  enlace «saltar al contenido», en lugar de la sombra `focus-ring`.
- Cajón del shell en cristal elevado (`popup-blur`, `popup-shadow`) y entrada de 320 ms; velo con
  `blur(6px)`. Panel dividido con radio 16 y cabecera de 34 px; el panel enfocado se marca con contorno.
- Tipografía: título de `PageHeader` con `weight-display` y `tracking-display`, entradilla en `text-lead`
  (máx. 62ch), eyebrow sin mayúsculas; secciones y cabecera de `SidePanel` con peso de display e interletrado
  `snug`; grupos de `Sidebar` de 34 px en 13/500 sin mayúsculas.

### Corregido

- `Page` es una región desplazable enfocable con teclado (`role="region"`, `tabindex="0"`) con nombre
  accesible: la prop nueva `label` (por defecto, "Page content"). Antes, una página sin controles no se podía
  desplazar con el teclado (axe `scrollable-region-focusable`).

## [0.2.0] - 2026-11-18

Qué hay que tocar en una aplicación está en la [guía de actualización](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/08-actualizar-de-0-1-a-0-2.md).

### Cambios incompatibles

- Node 22.12 o posterior (antes, 20). Node 20 terminó su soporte el 2026-04-30.
- `TitleBar` es un `<header>` (región `banner`) en lugar de un `<div>`. Las clases no cambian; `as="div"`
  recupera el elemento anterior.
- El tirador de los paneles del `Shell` usa `data-side="end"` (sidebar) y `"start"` (inspector) en lugar de
  `right` y `left`. Afecta a quien escribió el marcado a mano o tiene selectores sobre ese atributo.
- `.z-shell` es un contenedor de consultas (`container: z-shell / inline-size`). Antes de medirse (HTML de
  servidor, o antes de `init()`), un panel `auto` que no cabe no se muestra: una ventana estrecha ya no
  enseña un instante los paneles acoplados.
- El botón de cierre de una pestaña mide 24 × 24 px (antes 18): el mínimo de WCAG 2.5.8.
- El eyebrow de `PageHeader` usa `--z-accent-text` y el contador del rail `--z-danger-solid`, para llegar a
  4.5:1. Cambia su tono.

### Añadido

- `Shell`: `skipLinkLabel` (enlace para saltar al contenido, WCAG 2.4.1), `mainAs` (`main`, `div` o
  `section`, para shells anidados o varios en una página) y `resizeLabel` en cada panel.
- `ResizeHandle`: lados lógicos `start` y `end`, que siguen la dirección de escritura, y `controls`
  (`aria-controls`). En HTML: `data-side="start|end"`.
- `SplitPane`: Inicio y Fin llevan el divisor a su mínimo y a su máximo; doble clic reparte a partes iguales
  los dos paneles; cada divisor lleva `aria-controls`.
- `TabStrip`: `controls` en cada pestaña (`aria-controls` del panel).
- `TitleBar`: prop `as` (`header` o `div`). `PageHeader` y `PageSection`: `headingLevel`.
- `@zuccadev-labs/zuix-zout/dom`: `dispose(root)` suelta los observadores de un bloque de marcado;
  `hydrate()` completa un `.z-resize` escrito solo con su clase (rol, orientación, límites).
- Colores forzados (contraste alto de Windows): foco, elemento activo del rail, pestaña seleccionada,
  divisores y cajones se distinguen con contornos y colores del sistema.

### Corregido

- RTL: los cajones, el tirador, el arrastre y las flechas de `SplitPane`, y las flechas de `TabStrip`,
  siguen la dirección de escritura; la hoja usa propiedades lógicas.
- `Shell` (React): Escape no cierra el cajón si lo gestiona un `<dialog>` o un popover abierto por encima.
- `ResizeHandle` y `SplitPane` (React): solo arrastra el botón principal; el arrastre termina si se pierde
  la captura del puntero.
- `@zuccadev-labs/zuix-zout/dom`: un selector inválido en `data-z-shell` o `data-z-resize` ya no lanza una
  excepción; un shell retirado del documento deja de observarse; los iconos se crean con el DOM (compatible
  con Trusted Types); `data-z-shell="#id"` manda sobre el shell que contiene al botón.
- El foco de los controles de layout sigue visible con colores forzados.

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
