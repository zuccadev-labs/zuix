# @zuccadev-labs/zuix-zout

Layouts y ventanas dinámicas de la suite zuix. Resuelve la estructura de la pantalla (shell, paneles,
pestañas de trabajo, rejillas) y no dibuja contenido. Las medidas y el material salen de los tokens.

## Instalación

```
pnpm add @zuccadev-labs/zuix-zout @zuccadev-labs/zuix-zui @zuccadev-labs/zuix-tokens @zuccadev-labs/zuix-zicon
```

`@zuccadev-labs/zuix-zicon` es un peer obligatorio. `react` y `react-dom` 19 son peers opcionales: solo los
necesita el binding (`pnpm add react react-dom`). Los paquetes de la suite se instalan y se actualizan
juntos, en la misma versión.

Para instalarlo todo con una sola dependencia: [`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix).

## Piezas

| Pieza | Qué hace |
|---|---|
| `Shell` | Estructura general: barra de título, rail, sidebar, área principal, inspector |
| `Rail`, `RailItem` | Barra estrecha de navegación principal |
| `Sidebar`, `SidebarSection` | Navegación secundaria en acordeón |
| `SidePanel` | Panel con título, cuerpo con desplazamiento y pie |
| `SplitPane`, `Pane` | Paneles divididos con divisores arrastrables |
| `TabStrip` | Pestañas de trabajo con cierre y alta |
| `TitleBar` | Cabecera para ventanas sin marco |
| `ResizeHandle` | Tirador de redimensionado |
| `Page`, `PageHeader`, `PageSection`, `Container` | Página con cabecera y secciones |
| `Grid`, `Stack`, `Inline` | Rejilla intrínseca, pila y fila |

## Uso con React

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all";           // registra los iconos
import { useState } from "react";
import { Shell, Sidebar, SidebarSection, Page, PageHeader, Grid } from "@zuccadev-labs/zuix-zout";

export function App() {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ height: "100vh" }}>
      <Shell
        sidebar={{ label: "Navigation", open, content: <Sidebar><SidebarSection title="Projects">…</SidebarSection></Sidebar> }}
        onCloseOverlay={() => setOpen(false)}
      >
        <Page header={<PageHeader title="Overview" />}>
          <Grid min={200}>…</Grid>
        </Page>
      </Shell>
    </div>
  );
}
```

El `Shell` necesita un contenedor con alto definido.

## Uso sin React

El marcado de cada layout está en `@zuccadev-labs/zuix-zout/html.json`. El comportamiento (cajones del shell,
divisores, pestañas de trabajo) lo pone `@zuccadev-labs/zuix-zout/dom`:

```js
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import { init } from "@zuccadev-labs/zuix-zout/dom";

init();
```

Sin bundler se enlazan `dist/zout.css` y `dist/zout.dom.js`, incluidos en el paquete.

## Comportamiento responsive

El `Shell` mide su propio ancho, no el de la pantalla:

| Ancho del shell | Sidebar | Inspector |
|---|---|---|
| 1180 px o más | Acoplada | Acoplado |
| De 880 a 1179 px | Acoplada | Cajón |
| Menos de 880 px | Cajón | Cajón |

Los divisores de `SplitPane` y los `ResizeHandle` se mueven con las flechas; `TabStrip` cambia de
pestaña con flechas, Inicio y Fin.

## Entradas

| Entrada | Contenido |
|---|---|
| `@zuccadev-labs/zuix-zout` | Layouts de React y sus tipos |
| `@zuccadev-labs/zuix-zout/dom` | Comportamiento sin framework: `init`, `hydrate`, `setPanelOpen`, `setSplitSizes`, `addWorkTab`… |
| `@zuccadev-labs/zuix-zout/styles.css` | Estilos |
| `@zuccadev-labs/zuix-zout/manifest.json`, `@zuccadev-labs/zuix-zout/html.json` | Props, clases y marcado, para herramientas y agentes |
| `@zuccadev-labs/zuix-zout/dist/zout.css`, `@zuccadev-labs/zuix-zout/dist/zout.dom.js` | Bundles para enlazar sin bundler |

## Documentación

- [Guía de layouts](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/04-zout.md)
- [Uso con otros frameworks o sin ninguno](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/06-frameworks.md)
- [Cambios](https://github.com/zuccadev-labs/zuix/blob/main/zout/CHANGELOG.md)

## Licencia

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
