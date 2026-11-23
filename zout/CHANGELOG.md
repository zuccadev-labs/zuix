# Cambios de @zuccadev-labs/zuix-zout

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

### Añadido

- Modo compat: `styles.compat.css` (`dist/zout.compat.css`), la hoja de layouts para Chromium 109, Firefox 115 y
  Safari 15.4. Va con `tokens.compat.css` y `zui.compat.css`
  ([Compatibilidad](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/10-compatibilidad.md#modo-compat)).
- `Container`: tamaños `sm`, `md`, `lg` y `xl` (tokens `container-*`) y `gutter` (`fluid`, `stage` o `none`). El
  margen fluido crece con el ancho del contenedor de consulta entre 16 y 40 px; el ancho máximo suma los dos
  márgenes, así que la columna de texto mide lo mismo con cualquiera. El marcado sin `data-gutter` se ve como antes.
  Tiene manifiesto propio (antes iba dentro del de `Page`). `Stack`, `Inline` (con `wrap` y `gap`) y `Grid` cubren
  el resto de la maquetación, así que no añado un `Flex` aparte.
- `Shell`: `railBreakpoint` (600 px por defecto; `data-rail-breakpoint` en `/dom`). Por debajo, con la sidebar en
  cajón, el rail deja su columna y se muestra dentro del cajón, a su lado. En un teléfono una columna de iconos fija
  se comía una quinta parte del ancho.
- `ChatLayout`: lista de conversaciones, conversación y detalles. Tres columnas en pantalla ancha, detalles encima en
  media y una pila (lista → conversación → detalles) en estrecha, decidido por consultas de contenedor sobre el propio
  layout. Con `history`, la pila se sincroniza con el historial del navegador; F6 salta entre paneles; `variant="widget"`
  es un asistente flotante (botón y panel de cristal). En `/dom`: `data-view`, `[data-z-chat-view]`, `data-history`,
  `setChatView` y `setChatWidgetOpen`.
- `AppBar`: barra de aplicación superior pequeña, mediana o grande; la grande pliega el título a la fila superior al
  desplazar (animación ligada al desplazamiento, con respaldo en `/dom` y en React donde no la hay) y gana sombra con
  algo desplazado.
- Layouts de página, todos con consultas de contenedor (responden a su hueco, no al viewport):
  - `DashboardLayout`: cabecera, barra de filtros fija, contenido y panel lateral; navegación propia opcional.
  - `SettingsLayout`: navegación con anclas, secciones y barra de guardar fija cuando hay cambios sin guardar.
  - `AuthLayout`: acceso en una tarjeta de cristal centrada o dividido con un lado de imagen.
  - `ProfileLayout`: cabecera de perfil, pestañas, contenido y columna lateral.
  - `DocsLayout`: navegación, artículo, índice con la sección que se lee marcada (`aria-current`) y paginación;
    en estrecho el índice es un `<details>` sobre el artículo.
  - `LandingLayout` con `LandingHero` y `LandingSection` (rejilla de funciones, banda de llamada y bloque tenue).
  - `KanbanLayout` y `MailLayout` (carpetas, lista y lectura; en estrecho, una sola vista según `view`).
- `appBarProgress` y `activeSection` en la lógica compartida; en `/dom`, `.z-appbar[data-collapse]` y
  `.z-docs-layout__toc` se conectan solos.

### Corregido

- `/dom` sin Popover API: Escape en un cajón y el submenú plegado de la Sidebar lanzaban (`:popover-open` no es un
  selector válido ahí). Ahora comprueba antes.
- `Navbar`: plegada y aun así sin sitio (una columna estrecha), las acciones bajan a otra línea en vez de salirse de la
  cabecera.
- `SettingsLayout`: en estrecho, la tira de secciones difumina el borde con secciones ocultas (`data-scroll-edges`,
  también en `/dom`) en lugar de cortar la última en seco.
- `Sidebar`: una lista más alta que la barra difumina el borde con filas ocultas (arriba, abajo o los dos) en vez de
  cortar la última fila a media altura, donde parecía un elemento roto. Solo con algo por ese lado; en un navegador sin
  animaciones ligadas al desplazamiento, la lista se corta como antes.

## [0.3.0] - 2026-11-21

### Añadido

- Navegación de sitio (React y `/dom`, con el mismo comportamiento en `src/site.ts`):
  - `Navbar`: flotante (dos barras de cristal), `dock` (una barra compacta centrada) o `bar` (de borde a borde);
    pegajosa, fija o en su sitio. Sin punto de corte fijo: mide si la fila cabe y, si no, los enlaces pasan a un
    cajón de cristal (popover nativo, también sin JavaScript) con el `NavigationMenu` en vertical.
  - `NavigationMenu`: menús de sitio con paneles (patrón disclosure de navegación, no menú de aplicación):
    tarjetas con icono y descripción en 1–3 columnas, pie opcional, previsualización al pasar el puntero, Escape y
    cierre al salir el foco; vertical, los grupos se despliegan en su sitio.
  - `BottomNavigation`: navegación de móvil con icono, etiqueta (siempre, solo la actual o ninguna), insignia,
    enlaces o botones (`onValueChange`; en `/dom`, `z:select`), flotante o de borde a borde, con zona segura.
  - `SiteFooter`: marca, columnas de enlaces, redes, franja legal; en columnas, centrado o mínimo; cristal,
    sólido o sin fondo.
  - `SkipLink`: enlace de salto al contenido que lleva el foco al destino aunque no sea enfocable.
- Navegación y paneles de aplicación:
  - `Sidebar` plegable a iconos (`collapsed`) con `SidebarItem` (icono, contador, acción, `aria-current`,
    submenú en disclosure) y `SidebarTrigger` (aria-expanded, aria-controls, atajo Ctrl/⌘+B opcional). Plegada,
    cada item muestra su nombre en un tooltip y el submenú se abre en un panel flotante. En `/dom`,
    `setSidebarCollapsed()` y `setSidebarItemOpen()` (usa el tooltip y el popover de `@zuccadev-labs/zuix-zui/dom`).
  - `TabStrip` con grupos de color (`groups`, `tab.groupId`, chip que pliega el grupo con `onGroupToggle`),
    indicadores `modified` y `busy`, y reordenación con `onReorder`: arrastre con marca de soltar (el orden cambia
    al soltar) y Ctrl+Mayús+flechas, Inicio o Fin con anuncio en una región `status`. En `/dom`,
    `data-reorderable`, `moveWorkTab()`, `setTabGroupCollapsed()` y los eventos `z:reorder` y `z:grouptoggle`.
  - `PaneHeader`: cabecera de panel con icono, título, línea secundaria y acciones en una `Toolbar` (una sola
    parada de Tab) con menú opcional; `focused` y `titleId`. Dentro de `Pane.header` ocupa toda la franja.
  - `FloatingPanel`: ventana flotante no modal (`role="dialog"` nombrado por su título) que se arrastra por la
    cabecera o con las flechas en su asa, y se redimensiona desde la esquina final (en RTL, la izquierda) con puntero
    o flechas; Mayús multiplica el paso; nunca sale de la ventana (`fixed`) o de su contenedor (`absolute`); Escape
    y el botón de cierre con `onClose`; posición y tamaño controlados o no. En `/dom`, `.z-floatpanel`,
    `data-z-panel`, `openFloatingPanel()`, `closeFloatingPanel()` y `setFloatingPanelRect()`.
  - `PaneLayout`: mosaico de paneles redimensionables sobre un árbol de divisiones (`layout`, `panes`), con
    cabecera (`PaneHeader`) y menú por panel para dividir (`onSplit`), mover junto al vecino de cada lado y cerrar;
    arrastrar la cabecera sobre otro panel muestra la zona de soltar (borde o intercambio en el centro) y aplica el
    cambio al soltar; los movimientos se anuncian. En `/dom`, `.z-panelayout` con `getPaneLayout()`,
    `setPaneLayout()`, `splitLayoutPane()`, acciones `data-pane-action` en los menús de zui y los eventos
    `z:layout`, `z:split` y `z:close`.
  - `Float`: un elemento (insignia, contador) centrado sobre la esquina o el borde de otro, en lógicas (RTL), con
    `offset` para formas circulares. Solo CSS.
  - Lógica pura nueva en `logic.ts`: `reorder`, `dropIndex`, `finalIndex`, `tabMoveIndex`, `moveBefore`,
    `beforeFor`, `clampRect`, `moveDelta`, `resizeDelta`, `resizeRect`, y el árbol de paneles (`PaneNode`,
    `paneIds`, `setSizesAt`, `splitPane`, `removePane`, `swapPanes`, `movePane`, `dropEdge`, `neighborPane`).

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

- `TabStrip`: el lado de la tira con pestañas ocultas se difumina en vez de mostrar un icono cortado (sin
  transparencia o con colores forzados, un canto normal), y la pestaña activa se deja entera a la vista fuera del
  difuminado, también cuando cambia su ancho al cargar la fuente. Igual en React y en `/dom`.
- `RailItem` sin el relleno por defecto del navegador. Los ejemplos de `TitleBar` y `Rail` traen su marca y sus
  pestañas (el contrato HTML los pintaba vacíos).
- `TabStrip`: cada pestaña mide su contenido (hasta 220 px) mientras hay sitio; si no caben todas, ceden primero
  las inactivas (hasta su icono) y la activa conserva su nombre entero si cabe en la tira; la elipsis solo aparece
  cuando ni sola cabe. El botón de cerrar se dibuja a 24 px y con puntero grueso amplía su objetivo a 40 con
  `::before` (antes ocupaba 40 de ancho y dejaba el título en «Fo…»). El chip de grupo mide `control-height-xs`
  (24; 40 con puntero grueso; medía 22).
- Ejemplos de `Sidebar` con alto mínimo en vez de fijo: con puntero grueso el último item quedaba cortado.
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
