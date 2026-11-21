# Zout

`@zuccadev-labs/zuix-zout` es el paquete de layouts y ventanas dinámicas. Resuelve la estructura de la
pantalla; no dibuja contenido. Usa los tokens para medidas y material, y depende de
`@zuccadev-labs/zuix-zui` para los estilos base.

## Piezas

| Pieza | Qué hace | Origen |
|---|---|---|
| `Shell` | Estructura general: barra de título, rail, sidebar, área principal, inspector | AppShell de zutool |
| `Rail`, `RailItem` | Barra estrecha de navegación principal | zutool |
| `Sidebar`, `SidebarSection`, `SidebarItem`, `SidebarTrigger` | Navegación secundaria en acordeón, plegable a iconos, con items que llevan contador, acción y submenú | zutool |
| `SidePanel` | Andamiaje de panel: título, cuerpo con desplazamiento, pie | zutool |
| `SplitPane`, `Pane` | Paneles divididos con divisores arrastrables | zutool |
| `TabStrip` | Pestañas de trabajo con cierre y alta, grupos de color, indicadores y reordenación | zutool |
| `PaneHeader` | Cabecera de panel: icono, título, línea secundaria y acciones en una barra de herramientas | Propio |
| `PaneLayout` | Mosaico de paneles redimensionables: dividir, mover, cerrar y arrastrar un panel al borde de otro | Propio |
| `FloatingPanel` | Ventana flotante no modal que se arrastra y se redimensiona con puntero o teclado | Propio |
| `TitleBar` | Cabecera para ventanas sin marco. Es un `<header>` | zutool |
| `ResizeHandle` | Tirador de redimensionado | zutool |
| `Page`, `PageHeader`, `PageSection`, `Container` | Página con cabecera y secciones | El design system de un proyecto privado anterior |
| `Grid`, `Stack`, `Inline` | Rejilla intrínseca, pila y fila | `ui-glass` |
| `Float` | Insignia, punto o contador sobre la esquina o el borde de otro elemento. Solo CSS | Propio |
| `Navbar`, `NavigationMenu` | Barra de navegación de un sitio (flotante, `dock` o de borde a borde) y menús con paneles. Sin punto de corte fijo: si la fila no cabe, los enlaces pasan a un cajón | Propio |
| `BottomNavigation` | Navegación de móvil: de tres a cinco destinos con icono y etiqueta | Propio |
| `SiteFooter` | Pie de un sitio: marca, columnas de enlaces, redes y franja legal | Propio |
| `SkipLink` | Enlace para saltar al contenido; lleva el foco al destino aunque no sea enfocable | Propio |

## Uso

```tsx
import "@zuccadev-labs/zuix-zout/styles.css";
import { Shell, Sidebar, SidebarSection, Page, PageHeader, Grid } from "@zuccadev-labs/zuix-zout";

<Shell
  skipLinkLabel="Skip to content"
  sidebar={{ label: "Navigation", content: <Sidebar>…</Sidebar> }}
  onCloseOverlay={closePanels}
>
  <Page header={<PageHeader title="Overview" />}>
    <Grid min={200}>…</Grid>
  </Page>
</Shell>
```

El `Shell` necesita un contenedor con alto definido. Patrones completos en
[Montar una pantalla](../agents/02-pantallas.md).

## Principios

1. **Diseño intrínseco.** Los layouts se adaptan a su contenedor, no al tamaño de la pantalla. `Grid`
   calcula sus columnas a partir de un ancho mínimo de celda, y `.z-shell` es un contenedor de consultas.
2. **Medidas por token.** Anchos de rail, sidebar e inspector, alto de cabecera y separación son
   tokens. Una marca puede cambiarlos.
3. **Material en el marco.** El cristal va en rail, sidebar, cabeceras y cajones. Para texto denso,
   `surface="solid"` o un `Pane`.
4. **Paneles con foco visible.** El panel activo se marca con borde de acento; los demás se atenúan.

## Regiones y encabezados

| Qué | Cómo |
|---|---|
| Cabecera de la aplicación | `TitleBar` es un `<header>` (región `banner`). `as="div"` lo evita cuando ya hay otro |
| Contenido principal | El `Shell` pinta un `<main>`. Con shells anidados o varios en la página, `mainAs="div"` o `"section"` en los que no son el principal |
| Saltar al contenido | `skipLinkLabel` añade un enlace que aparece al enfocarlo y lleva al área principal (WCAG 2.4.1). Es opcional: sin la prop no hay enlace |
| Jerarquía de títulos | `PageHeader` usa `h1` y `PageSection` `h2`; `headingLevel` los cambia cuando la página vive dentro de otra |

## Comportamiento responsive

Con `mode: "auto"` (por defecto) el `Shell` mide su propio ancho:

| Ancho del shell | Sidebar | Inspector |
|---|---|---|
| 1180 px o más | Acoplada | Acoplado |
| De 880 a 1179 px | Acoplada | Cajón |
| Menos de 880 px | Cajón | Cajón |

Los cortes se cambian con `sidebarBreakpoint` e `inspectorBreakpoint`. En modo cajón el resto de la
pantalla queda inerte y Escape o el velo lo cierran. Escape no cierra el cajón si hay un `<dialog>` o un
popover abierto por encima: lo gestiona esa capa.

Antes de medirse (HTML de servidor, o antes de `init()`), un panel `auto` que no cabe no se muestra: una
ventana estrecha no enseña un instante los paneles acoplados.

## Teclado y puntero

- Los divisores de `SplitPane` y los `ResizeHandle` se enfocan y se mueven con las flechas; Inicio y Fin los
  llevan a su mínimo y a su máximo. Cada uno declara con `aria-controls` el panel que redimensiona.
- Doble clic en un `ResizeHandle` lo devuelve a su tamaño por defecto; en un divisor de `SplitPane`, reparte
  a partes iguales los dos paneles vecinos. Es la alternativa de un solo toque al arrastre (WCAG 2.5.7); un
  tamaño arbitrario sigue pidiendo arrastre o teclado.
- `TabStrip` cambia de pestaña con flechas, Inicio y Fin, y cierra la pestaña activa con Supr. El botón de
  cierre mide 24 × 24 px y es una ayuda de puntero: no entra en el orden de tabulación, porque un `tablist`
  solo admite pestañas. Un lector de pantalla táctil no puede cerrar pestañas desde la tira; si tu aplicación
  lo necesita, ofrece el cierre también dentro del panel.
- Solo arrastra el botón principal del ratón.
- Con `dir="rtl"` los cajones, los tiradores y las flechas siguen la dirección de escritura. Los lados de un
  tirador se nombran `start` y `end`.
- Con puntero grueso la zona de agarre de tiradores y divisores crece a 40 px sin cambiar la línea dibujada.

## Reglas de uso

1. Una pantalla usa un `Shell` principal. Si anida otro, el interior lleva `mainAs`.
2. Las pantallas no definen anchos fijos para las zonas del `Shell`.
3. La separación se pide por paso de la escala (`gap={4}`).

## Relación con zudocs

El sitio de documentación no usa `Shell`: aplica el mismo material y las mismas medidas como estilo
sobre la estructura del tema de Docusaurus. Dentro de las páginas sí se usan `Grid`, `Stack` e `Inline`.

## Sin React: `@zuccadev-labs/zuix-zout/dom`

El mismo marcado que produce el binding (`zout/html.json`) funciona en HTML plano o en cualquier
framework con `@zuccadev-labs/zuix-zout/dom`. Los cálculos (modos, límites, reparto) salen de `zout/src/logic.ts`,
que usan también los componentes de React.

```html
<body class="z-root z-canvas" data-z-dom>
  <div class="z-shell z-canvas z-root" id="app">…</div>
  <script type="module">
    import { init } from "@zuccadev-labs/zuix-zui/dom";
    import { init as initLayouts } from "@zuccadev-labs/zuix-zout/dom";   // sin bundler: zout/dist/zout.dom.js
    init();
    initLayouts();
  </script>
</body>
```

Solo actúa dentro de un contenedor `[data-z-dom]`. Aplicación completa de ejemplo:
`examples/html/shell.html`.

### Marcado y atributos

| Pieza | Marcado | Atributos |
|---|---|---|
| `Shell` | `.z-shell >` `header.z-titlebar` (opcional) y `.z-shell__body >` `.z-shell__rail`, `aside.z-shell__side`, `main.z-shell__main`, `aside.z-shell__inspector` | En `.z-shell`: `data-sidebar-breakpoint`, `data-inspector-breakpoint` (880 y 1180), `data-close-label`. En cada `<aside>`: `hidden` (cerrado), `data-panel-mode="auto\|docked\|overlay"` |
| Abrir y cerrar | Cualquier botón | `data-z-shell-toggle="sidebar\|inspector"` (más `data-z-shell="#id"` si está fuera del shell); `data-z-close` dentro de un panel lo cierra solo cuando es cajón |
| `ResizeHandle` | `.z-resize[role=separator][data-side]`, hijo del panel | `data-side="start\|end"` (sigue la dirección de escritura) o `top`, `bottom`; `aria-valuemin`, `aria-valuemax`, `aria-controls`, `data-default-size`, `data-step`; `data-z-resize="#id"` si el panel no es su padre; `data-var="--x"` para escribir una variable. `hydrate()` completa un `.z-resize` escrito solo con su clase |
| `SplitPane` | `.z-split[data-direction] >` `.z-split__pane` (con `flex-grow`) y `.z-split__divider` | `data-min-fraction` (0.1) |
| `TabStrip` | `.z-tabstrip > .z-tabstrip__list > .z-tabstrip__tab >` `.z-tabstrip__select[data-tab-id]` y `.z-tabstrip__close`; `.z-tabstrip__add` | `aria-controls="id"` en la pestaña muestra y oculta su panel; `data-new-title="Untitled"` en el botón de alta crea pestañas sin código |
| `SidebarSection` | `.z-sidebar__section > .z-sidebar__head > .z-sidebar__fold` y `.z-sidebar__body` | `data-open`, `aria-expanded`, `hidden` |
| `Sidebar` plegable | `.z-sidebar[data-collapsed]` y un botón `.z-sidebar__trigger[aria-controls]` | `data-shortcut` (Ctrl/⌘+B). Plegada, usa el tooltip y el popover de `@zuccadev-labs/zuix-zui/dom`: hay que cargarlo también |
| `TabStrip` reordenable | `.z-tabstrip[data-reorderable]`, `.z-tabstrip__status[role=status]`, `.z-tabstrip__chip` por grupo | `data-moved-label` con `{title}`, `{position}` y `{total}` |
| `FloatingPanel` | `.z-floatpanel[role=dialog]` con `.z-floatpanel__header`, `__handle`, `__resize` y `__close` | `data-strategy="absolute"` lo acota a su contenedor; `data-min-width`, `data-min-height`; `data-z-panel="#id"` en un botón lo abre |
| `PaneLayout` | `.z-panelayout` con `.z-split` anidados y `.z-panelayout__pane[data-pane-id]` | `data-pane-action="move-left\|move-right\|move-up\|move-down\|close\|split-right\|split-down"` en los items de su menú |
| Navegación de sitio | `.z-navbar`, `.z-navmenu`, `.z-skiplink`, `.z-bottomnav` | Los mismos atributos que produce el binding (`zout/html.json`) |

El módulo escribe el mismo estado que React: `data-mode`, clase `z-shell__drawer`, `role="dialog"`,
`aria-modal`, `inert` en lo que queda bajo el velo, `button.z-shell__scrim`, `--z-shell-panel-width`,
`flex-grow` y `aria-valuenow`, `data-selected` y `aria-selected`. La diferencia: un panel cerrado no se
retira del documento, queda con `hidden`.

Un panel que pasa a cajón se cierra, y al volver a caber recupera cómo estaba acoplado. Abrir un panel
cierra el otro si está en cajón. Escape, el velo y `data-z-close` cierran el cajón; el foco entra en él
al abrirse y vuelve al botón que lo abrió.

### Funciones

```js
import {
  init, hydrate, dispose,
  setPanelOpen, togglePanel, closeDrawers, getShellModes,
  resizeTo, getSplitSizes, setSplitSizes,
  selectWorkTab, closeWorkTab, addWorkTab, moveWorkTab, setTabGroupCollapsed, setSectionOpen,
  setSidebarCollapsed, setSidebarItemOpen,
  openFloatingPanel, closeFloatingPanel, setFloatingPanelRect,
  getPaneLayout, setPaneLayout, splitLayoutPane,
} from "@zuccadev-labs/zuix-zout/dom";

setPanelOpen(shell, "inspector", true);
getShellModes(shell);                        // { sidebar: "docked", inspector: "overlay" }
setSplitSizes(split, [0.3, 0.7]);
addWorkTab(strip, { id: "notes", title: "Notes", icon: "document-text", controls: "screen-notes" });
hydrate(container);                          // tras insertar marcado nuevo o cambiar `hidden` a mano
dispose(container);                          // antes de retirar un bloque: suelta sus observadores
```

### Eventos

Burbujean y se pueden cancelar con `preventDefault()`; cancelado, el módulo no toca el DOM y decide la
aplicación.

| Evento | Dónde | `detail` | Si se cancela |
|---|---|---|---|
| `z:modechange` | `.z-shell` | `{ sidebar, inspector }`, cada uno `docked` u `overlay` | Los paneles no se cierran ni se recuperan solos |
| `z:open`, `z:close` | El `<aside>` | | (informativos) |
| `z:resize` | `.z-resize` | `{ size }` en px | No se escribe el tamaño |
| `z:resize` | `.z-split` | `{ sizes, index }` | No se mueve el divisor |
| `z:select` | `.z-tabstrip` | `{ id }` | No cambia la pestaña |
| `z:close` | `.z-tabstrip` | `{ id }` | No se retira; por defecto se retira la pestaña, se oculta su panel y se activa la vecina |
| `z:add` | `.z-tabstrip` | | No se crea la pestaña de `data-new-title` |
| `z:change` | `.z-sidebar__section` | `{ open }` | (informativo) |
| `z:change` | `.z-sidebar` | `{ collapsed }` | (informativo) |
| `z:reorder` | `.z-tabstrip` | `{ ids }` | No cambia el orden |
| `z:grouptoggle` | `.z-tabstrip` | `{ id, collapsed }` | (informativo) |
| `z:change` | `.z-floatpanel` | `{ x, y, width, height }` | (informativo) |
| `z:close` | `.z-floatpanel` | | (informativo) |
| `z:layout` | `.z-panelayout` | `{ layout }` | (informativo) |
| `z:split` | `.z-panelayout` | `{ id, direction }` | La aplicación llama a `splitLayoutPane` con el panel nuevo |
| `z:close` | `.z-panelayout` | `{ id }` | No se cierra el panel |
| `z:select` | `.z-bottomnav` | `{ value }` | No se mueve `aria-current` |

`z:modechange` se emite al medir por primera vez, dentro de `init()`: quien quiera el primer aviso se
suscribe antes, o lee `getShellModes(shell)`. Los `z:resize` de un `SplitPane` anidado llegan también
al exterior: se distinguen con `event.target`.

## Lo que no he comprobado

- Safari real, pantallas táctiles reales y lectores de pantalla. Las suites corren en el Chrome del sistema
  y en los motores Firefox y WebKit de Playwright, con táctil emulado.
- En `zout/dom`: tiradores en los bordes `top` y `bottom`, y más de un shell en la misma página.
