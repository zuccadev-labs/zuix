# @zuccadev-labs/zuix-zui

Sistema de componentes de la suite zuix: 64 componentes accesibles en 8 grupos. Cada componente es un
contrato de HTML y CSS sobre tokens; el comportamiento sin framework está en `@zuccadev-labs/zuix-zui/dom` y el
binding de React en la entrada principal.

| Capa | Entrada | Depende de |
|---|---|---|
| Contrato | `@zuccadev-labs/zuix-zui/styles.css`, `@zuccadev-labs/zuix-zui/html.json` | `@zuccadev-labs/zuix-tokens` |
| Comportamiento | `@zuccadev-labs/zuix-zui/dom` | El navegador (`<dialog>`, `popover`) |
| Binding de React | `@zuccadev-labs/zuix-zui` | React 19 y Radix |

## Instalación

```
pnpm add @zuccadev-labs/zuix-zui @zuccadev-labs/zuix-tokens @zuccadev-labs/zuix-zicon
```

`@zuccadev-labs/zuix-zicon` es un peer obligatorio (los componentes dibujan sus iconos con la copia de la
aplicación). `react` y `react-dom` 19 son peers opcionales: solo los necesita el binding
(`pnpm add react react-dom`). Los paquetes de la suite se instalan y se actualizan juntos, en la misma versión.

Para instalarlo todo con una sola dependencia: [`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix).

## Uso sin React

Con un bundler:

```js
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zicon/element";            // <z-icon>
import { init, toast } from "@zuccadev-labs/zuix-zui/dom";

init();
toast({ title: "Ready", intent: "success" });
```

```html
<body class="z-root z-canvas" data-z-dom>
  <button type="button" class="z-btn z-btn--secondary" data-size="md" data-z-open="#edit">Edit profile</button>

  <dialog id="edit" class="z-liquid z-modal" data-size="md" aria-labelledby="edit-title">
    <header class="z-modal__header">
      <div class="z-modal__heading"><h2 id="edit-title" class="z-modal__title">Edit profile</h2></div>
    </header>
    <div class="z-modal__body">…</div>
    <footer class="z-modal__footer">
      <button class="z-dialog-btn" data-variant="primary" data-z-close value="save">Save</button>
    </footer>
  </dialog>
</body>
```

- `z-root` aplica tipografía y foco; `z-canvas` pinta el fondo.
- `data-z-dom` activa pestañas, acordeón y controles dentro de ese contenedor.
- El marcado de cada componente está en `@zuccadev-labs/zuix-zui/html.json`. Cada componente declara su `behavior`:
  `none` (solo CSS), `dom` (necesita `@zuccadev-labs/zuix-zui/dom`) o `react` (hoy solo en el binding de React).

Sin bundler se enlazan `dist/zui.css` y `dist/zui.dom.js`, incluidos en el paquete.

## Uso con React

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zicon/all";           // registra los iconos

import { Button } from "@zuccadev-labs/zuix-zui";

export function NewProject() {
  return <Button variant="primary" icon="plus">New project</Button>;
}
```

En `<html>` va `data-theme="dark"` o `"light"`, y en el contenedor de la aplicación, `class="z-root z-canvas"`.

Los componentes con hooks, contexto o Radix declaran `"use client"`. Los que solo producen marcado
(`Button`, `Badge`, `Card`…) no lo llevan.

## Entradas

| Entrada | Contenido |
|---|---|
| `@zuccadev-labs/zuix-zui` | Componentes de React y sus tipos `*Props` |
| `@zuccadev-labs/zuix-zui/dom` | Comportamiento sin framework: `init`, `hydrate`, `toast`, `confirm`… |
| `@zuccadev-labs/zuix-zui/styles.css` | Todos los estilos |
| `@zuccadev-labs/zuix-zui/styles/*` | Hojas sueltas por grupo |
| `@zuccadev-labs/zuix-zui/manifest.json` | Componentes, props, clases y ejemplos, para herramientas y agentes |
| `@zuccadev-labs/zuix-zui/html.json` | Marcado de cada ejemplo |
| `@zuccadev-labs/zuix-zui/dist/zui.css`, `@zuccadev-labs/zuix-zui/dist/zui.dom.js` | Bundles para enlazar sin bundler |

## Reglas

1. Los componentes solo leen tokens: sin colores, radios ni sombras literales.
2. Los iconos se piden por nombre; no se usan emojis como iconos.
3. Si falta una variante, un token o un icono, se añade al sistema.

## Documentación

- [Guía de componentes](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/03-zui.md)
- [Uso con otros frameworks o sin ninguno](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/06-frameworks.md)
- [Contrato público](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/03-contrato-publico.md): qué es superficie pública
- [Cambios](https://github.com/zuccadev-labs/zuix/blob/main/zui/CHANGELOG.md)
- Reglas para agentes de IA: `AGENTS.md`, incluido en el paquete.

## Licencia

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
