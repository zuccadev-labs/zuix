# @zuccadev-labs/zuix

La suite zuix completa en una sola dependencia: tokens de diseño, iconos, componentes y layouts.
El estándar es HTML + CSS + tokens; sirve con cualquier framework y trae un binding de React.

```
pnpm add @zuccadev-labs/zuix
```

Con npm, `npm install @zuccadev-labs/zuix`. Para el binding de React hacen falta además `react` y
`react-dom` 19 (`pnpm add react react-dom`). Las subrutas sin framework no los importan.

## Con React

```tsx
import "@zuccadev-labs/zuix/styles.css";          // tokens + componentes + layouts
import "@zuccadev-labs/zuix/zicon/all";           // registra los iconos
import { createRoot } from "react-dom/client";
import { Button } from "@zuccadev-labs/zuix/zui";
import { Stack } from "@zuccadev-labs/zuix/zout";

createRoot(document.getElementById("root")!).render(
  <Stack gap={2}>
    <Button variant="primary" icon="plus">New project</Button>
  </Stack>,
);
```

```html
<html data-theme="dark">
  <body class="z-root z-canvas">
    <div id="root"></div>
  </body>
</html>
```

`data-theme` es `dark` o `light`. `z-root` aplica tipografía y foco; `z-canvas` pinta el fondo.

## Sin framework

```js
import "@zuccadev-labs/zuix/styles.css";
import "@zuccadev-labs/zuix/zicon/element";      // define <z-icon>
import { init } from "@zuccadev-labs/zuix/zui/dom";
import { init as initLayouts } from "@zuccadev-labs/zuix/zout/dom";

init();
initLayouts();
```

```html
<body class="z-root z-canvas" data-z-dom>
  <button type="button" class="z-btn z-btn--primary" data-size="md">
    <z-icon name="plus" size="16"></z-icon>
    New project
  </button>
</body>
```

Estas subrutas no importan React.

## Subrutas

| Subruta | Equivale a |
|---|---|
| `@zuccadev-labs/zuix/styles.css` | Tokens (todas las marcas) + estilos de componentes y layouts |
| `@zuccadev-labs/zuix/tokens.css` | `@zuccadev-labs/zuix-tokens/tokens.css` |
| `@zuccadev-labs/zuix/zui`, `/zui/dom` | `@zuccadev-labs/zuix-zui` y su comportamiento sin framework |
| `@zuccadev-labs/zuix/zout`, `/zout/dom` | `@zuccadev-labs/zuix-zout` y su comportamiento sin framework |
| `@zuccadev-labs/zuix/zicon`, `/zicon/core`, `/zicon/dom`, `/zicon/element`, `/zicon/all` | Las entradas de `@zuccadev-labs/zuix-zicon` |
| `@zuccadev-labs/zuix` | Espacios de nombres `zui`, `zout` y `zicon` (requiere React) |

Las hojas `.css` de este paquete usan `@import` de paquetes: necesitan un bundler (Vite, webpack,
Next.js…). Sin bundler se enlazan los archivos `dist/` de cada paquete.

## Lo que no está en el paraguas

Manifiestos, contrato HTML (`html.json`), iconos sueltos (`icons/<nombre>`), una marca por separado
y los bundles de navegador (`dist/…`) se importan del paquete correspondiente. Para eso se añade ese
paquete a las dependencias del proyecto, en la misma versión que el paraguas:

```
pnpm add @zuccadev-labs/zuix-zicon
```

Los cinco paquetes comparten versión y se actualizan juntos (`pnpm up "@zuccadev-labs/*"`). Si en un
proyecto quedan dos versiones distintas de `@zuccadev-labs/zuix-zicon`, los iconos registrados en una
no se ven desde la otra y salen vacíos.

## Paquetes

| Paquete | Contenido |
|---|---|
| [`@zuccadev-labs/zuix-tokens`](https://www.npmjs.com/package/@zuccadev-labs/zuix-tokens) | Tokens de diseño; una marca es un archivo |
| [`@zuccadev-labs/zuix-zicon`](https://www.npmjs.com/package/@zuccadev-labs/zuix-zicon) | 346 iconos en outline y solid |
| [`@zuccadev-labs/zuix-zui`](https://www.npmjs.com/package/@zuccadev-labs/zuix-zui) | 64 componentes |
| [`@zuccadev-labs/zuix-zout`](https://www.npmjs.com/package/@zuccadev-labs/zuix-zout) | 10 layouts |

## Documentación

- [Guía de uso](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/README.md)
- [Uso con otros frameworks o sin ninguno](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/06-frameworks.md)
- [Cambios](https://github.com/zuccadev-labs/zuix/blob/main/suite/CHANGELOG.md)

## Licencia

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
