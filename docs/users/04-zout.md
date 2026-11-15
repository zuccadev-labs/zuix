# Zout

`@zuccadev-labs/zuix-zout` es el paquete de layouts y ventanas dinámicas. Resuelve la estructura de la pantalla; no
dibuja contenido. Usa los tokens para medidas y material.

## Piezas

| Pieza | Qué hace | Origen |
|---|---|---|
| `Shell` | Estructura general: barra de título, rail, sidebar, área principal, inspector | AppShell de zutool |
| `Rail`, `RailItem` | Barra estrecha de navegación principal | zutool |
| `Sidebar`, `SidebarSection` | Navegación secundaria en acordeón | zutool |
| `SidePanel` | Andamiaje de panel: título, cuerpo con desplazamiento, pie | zutool |
| `SplitPane`, `Pane` | Paneles divididos con divisores arrastrables | zutool |
| `TabStrip` | Pestañas de trabajo con cierre y alta | zutool |
| `TitleBar` | Cabecera para ventanas sin marco | zutool |
| `ResizeHandle` | Tirador de redimensionado | zutool |
| `Page`, `PageHeader`, `PageSection`, `Container` | Página con cabecera y secciones | Design system base |
| `Grid`, `Stack`, `Inline` | Rejilla intrínseca, pila y fila | `ui-glass` |

## Uso

```tsx
import "@zuccadev-labs/zuix-zout/styles.css";
import { Shell, Sidebar, SidebarSection, Page, PageHeader, Grid } from "@zuccadev-labs/zuix-zout";

<Shell sidebar={{ label: "Navigation", content: <Sidebar>…</Sidebar> }} onCloseOverlay={closePanels}>
  <Page header={<PageHeader title="Overview" />}>
    <Grid min={200}>…</Grid>
  </Page>
</Shell>
```

El `Shell` necesita un contenedor con alto definido. Patrones completos en
[Montar una pantalla](../agents/02-pantallas.md).

## Principios

1. **Diseño intrínseco.** Los layouts se adaptan a su contenedor, no al tamaño de la pantalla. `Grid`
   calcula sus columnas a partir de un ancho mínimo de celda.
2. **Medidas por token.** Anchos de rail, sidebar e inspector, alto de cabecera y separación son
   tokens. Una marca puede cambiarlos.
3. **Material en el marco.** El cristal va en rail, sidebar, cabeceras y cajones. Para texto denso,
   `surface="solid"` o un `Pane`.
4. **Paneles con foco visible.** El panel activo se marca con borde de acento; los demás se atenúan.

## Comportamiento responsive

Con `mode: "auto"` (por defecto) el `Shell` mide su propio ancho:

| Ancho del shell | Sidebar | Inspector |
|---|---|---|
| 1180 px o más | Acoplada | Acoplado |
| De 880 a 1179 px | Acoplada | Cajón |
| Menos de 880 px | Cajón | Cajón |

Los cortes se cambian con `sidebarBreakpoint` e `inspectorBreakpoint`. En modo cajón el resto de la
pantalla queda inerte y Escape o el velo lo cierran.

## Teclado

- Los divisores de `SplitPane` y los `ResizeHandle` se enfocan y se mueven con las flechas.
- `TabStrip` cambia de pestaña con flechas, Inicio y Fin, y cierra la pestaña activa con Supr. El botón
  de cierre es una ayuda de puntero: no entra en el orden de tabulación.

## Reglas de uso

1. Una pantalla usa un solo `Shell`.
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
| `Shell` | `.z-shell > .z-shell__body >` `.z-shell__rail`, `aside.z-shell__side`, `main.z-shell__main`, `aside.z-shell__inspector` | En `.z-shell`: `data-sidebar-breakpoint`, `data-inspector-breakpoint` (880 y 1180), `data-close-label`. En cada `<aside>`: `hidden` (cerrado), `data-panel-mode="auto\|docked\|overlay"` |
| Abrir y cerrar | Cualquier botón | `data-z-shell-toggle="sidebar\|inspector"` (más `data-z-shell="#id"` si está fuera del shell); `data-z-close` dentro de un panel lo cierra solo cuando es cajón |
| `ResizeHandle` | `.z-resize[role=separator][data-side]`, hijo del panel | `aria-valuemin`, `aria-valuemax`, `data-default-size`, `data-step`; `data-z-resize="#id"` si el panel no es su padre; `data-var="--x"` para escribir una variable |
| `SplitPane` | `.z-split[data-direction] >` `.z-split__pane` (con `flex-grow`) y `.z-split__divider` | `data-min-fraction` (0.1) |
| `TabStrip` | `.z-tabstrip > .z-tabstrip__list > .z-tabstrip__tab >` `.z-tabstrip__select[data-tab-id]` y `.z-tabstrip__close`; `.z-tabstrip__add` | `aria-controls="id"` en la pestaña muestra y oculta su panel; `data-new-title="Untitled"` en el botón de alta crea pestañas sin código |
| `SidebarSection` | `.z-sidebar__section > .z-sidebar__head > .z-sidebar__fold` y `.z-sidebar__body` | `data-open`, `aria-expanded`, `hidden` |

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
  init, hydrate,
  setPanelOpen, togglePanel, closeDrawers, getShellModes,
  resizeTo, getSplitSizes, setSplitSizes,
  selectWorkTab, closeWorkTab, addWorkTab, setSectionOpen,
} from "@zuccadev-labs/zuix-zout/dom";

setPanelOpen(shell, "inspector", true);
getShellModes(shell);                        // { sidebar: "docked", inspector: "overlay" }
setSplitSizes(split, [0.3, 0.7]);
addWorkTab(strip, { id: "notes", title: "Notes", icon: "document-text", controls: "screen-notes" });
hydrate(container);                          // tras insertar marcado nuevo o cambiar `hidden` a mano
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

`z:modechange` se emite al medir por primera vez, dentro de `init()`: quien quiera el primer aviso se
suscribe antes, o lee `getShellModes(shell)`. Los `z:resize` de un `SplitPane` anidado llegan también
al exterior: se distinguen con `event.target`.

## Verificado y sin verificar

`pnpm test:browser` ejercita la aplicación de `examples/app` (en Chrome, Firefox y WebKit con
`BROWSER=all`): `Shell` a 1440, 1000 y 700 px
(acoplado y cajón, foco, Escape, velo), `ResizeHandle`, `SplitPane` con arrastre y flechas, `TabStrip`
y móvil a 390 px sin desbordamiento.

`pnpm test:html layouts` repite esos casos sin React sobre `examples/html/shell.html` y las tarjetas del
catálogo `examples/html/index.html` (`tests/html/cases/04-layouts.mjs`). Pasan en Chrome y, con
`BROWSER=firefox,webkit`, en los motores Firefox y WebKit de Playwright.

Táctil emulado (teléfono a 390 px y tableta, en ambas suites): cajones del `Shell` con toques y cierre tocando
el velo, y `ResizeHandle` y `SplitPane` arrastrados con el dedo, también agarrando por la zona ampliada de
40 px. En Chrome con gestos reales; en Firefox y WebKit con toques reales y arrastres sintéticos. Hacia fuera
del panel, la zona ampliada de un tirador acoplado acaba donde empieza el panel vecino.

Sin verificar: Safari real, pantallas táctiles reales y lectores de pantalla. En `zout/dom`, además: tiradores en los bordes `top` y `bottom`, más de un shell en la misma
página y shells anidados.
