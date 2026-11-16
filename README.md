# zuix

Suite de UI/UX con un solo estándar: tokens de diseño, iconos, componentes, layouts y documentación.
El estándar es HTML, CSS y tokens. Sirve con cualquier framework o sin ninguno, y trae un binding de React.
Una marca replica el sistema cambiando un archivo.

## Las tres capas

| Capa | Qué es | Depende de |
|---|---|---|
| Contrato | Tokens `--z-*`, clases `z-*`, atributos de estado (`data-state`, `data-size`, `aria-*`) e iconos | Nada: CSS y SVG |
| Comportamiento | `@zuccadev-labs/zuix-zui/dom` y `@zuccadev-labs/zuix-zout/dom`: diálogos, menús, popovers, pestañas, paneles, controles | El navegador (`<dialog>`, `popover`) |
| Binding | `@zuccadev-labs/zuix-zui` y `@zuccadev-labs/zuix-zout` para React | React 19 y Radix |

El marcado de cada componente está en `zui/html.json` y `zout/html.json`, generado a partir del binding de
React. Un binding para otro framework solo tiene que producir ese marcado; la apariencia no se reescribe.

## Paquetes

| Paquete | Carpeta | Qué es | Se publica |
|---|---|---|---|
| `@zuccadev-labs/zuix` | [`suite/`](./suite/README.md) | Paraguas: instala los cuatro siguientes y los reexporta bajo subrutas | Sí |
| `@zuccadev-labs/zuix-tokens` | [`tokens/`](./tokens/README.md) | Fuente única de valores de diseño. Una marca es un archivo | Sí |
| `@zuccadev-labs/zuix-zicon` | [`zicon/`](./zicon/README.md) | 346 iconos en `outline` y `solid`, elemento `<z-icon>` y componente de React | Sí |
| `@zuccadev-labs/zuix-zui` | [`zui/`](./zui/README.md) | 64 componentes accesibles que solo leen tokens | Sí |
| `@zuccadev-labs/zuix-zout` | [`zout/`](./zout/README.md) | 10 layouts: shell, paneles divididos, pestañas de trabajo, rejillas | Sí |
| `@zuccadev-labs/zuix-zudocs` | `zudocs/` | Estándar de documentación y plantilla Docusaurus | No |

Los cinco paquetes publicables comparten versión y se instalan y actualizan juntos.

## Instalación

```
pnpm add @zuccadev-labs/zuix                 # la suite completa
pnpm add react react-dom                     # solo para el binding de React
```

O paquete a paquete: `pnpm add @zuccadev-labs/zuix-zui @zuccadev-labs/zuix-zicon @zuccadev-labs/zuix-tokens`
(y `@zuccadev-labs/zuix-zout` para los layouts). `@zuccadev-labs/zuix-zicon` es un peer de `zui` y `zout`: la
aplicación lo instala siempre.

## Inicio rápido

### HTML plano

En una copia del repositorio, `pnpm dist` genera los archivos listos para enlazar:

```html
<html data-theme="dark" data-brand="dazlabs">
<head>
  <link rel="stylesheet" href="tokens/dist/tokens.css">
  <link rel="stylesheet" href="zui/dist/zui.css">
  <link rel="stylesheet" href="zout/dist/zout.css">
</head>
<body class="z-root z-canvas" data-z-dom>
  <button type="button" class="z-btn z-btn--primary" data-size="md">
    <z-icon name="plus" size="16"></z-icon>
    New project
  </button>

  <script type="module">
    import "./zicon/dist/zicon.element.js";          // define <z-icon>
    import { init } from "./zui/dist/zui.dom.js";    // comportamiento
    init();
  </script>
</body>
</html>
```

El ejemplo completo, con todos los componentes, es `examples/html/index.html`.

Con un bundler (Vue, Svelte, Angular, Astro) se importan las mismas piezas desde los paquetes:

```js
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/element";
import { init } from "@zuccadev-labs/zuix-zui/dom";

init();
```

### React

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";   // o @zuccadev-labs/zuix-tokens/css/<marca>.css
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all";           // registra los iconos

import { Button } from "@zuccadev-labs/zuix-zui";

<Button variant="primary" icon="plus">New project</Button>
```

Con el paraguas, las mismas piezas salen de un solo paquete:

```tsx
import "@zuccadev-labs/zuix/styles.css";          // tokens + componentes + layouts
import "@zuccadev-labs/zuix/zicon/all";           // registra los iconos
import { Button } from "@zuccadev-labs/zuix/zui";
import { Stack } from "@zuccadev-labs/zuix/zout";
```

El tema se elige con `data-theme="dark"` o `"light"` en `<html>`; la marca, importando su CSS o con
`data-brand`. El binding requiere React 19.

## Desarrollo

Requisitos: Node 20.19 o superior (22.12 o superior en la rama 22) y pnpm 12 (`packageManager` fija la versión; `corepack enable` la instala).

```
pnpm install
pnpm check                          # tokens, iconos, auditoría de estilo, manifiestos, contrato HTML, tipos
pnpm --filter @zuccadev-labs/zuix-zudocs start    # sitio de documentación con el catálogo en vivo
```

| Comando | Qué hace |
|---|---|
| `pnpm check` | Regenera y valida tokens, iconos, manifiestos y contrato HTML; audita estilos; comprueba tipos |
| `pnpm --filter @zuccadev-labs/zuix-zudocs build` | Compila el sitio de documentación y falla con enlaces rotos |
| `pnpm test:html` | Contrato HTML y `@zuccadev-labs/zuix-zui/dom` en navegador, sin React |
| `pnpm test:browser` | Aplicación de ejemplo de React en navegador |
| `pnpm build` | Genera `dist/` de publicación de `zicon`, `zui` y `zout` y comprueba el paraguas |
| `pnpm test:pack` | Empaqueta los cinco paquetes y los consume fuera del workspace |
| `pnpm verify` | Todo lo anterior en orden, en Chromium. Puerta previa a una release |
| `pnpm bump check` | Comprueba versión única y entradas de `CHANGELOG.md` |

Las suites de navegador usan el Chrome del sistema. Para Firefox y WebKit: `pnpm test:html:all` y
`pnpm test:browser:all`.

## Documentación

| Área | Para quién |
|---|---|
| [`docs/users/`](./docs/users/README.md) | Quien usa la suite |
| [`docs/agents/`](./docs/agents/README.md) | Agentes de IA que montan pantallas o extienden la suite |
| [`docs/package/`](./docs/package/README.md) | Quien versiona y publica |
| [`docs/investigations/`](./docs/investigations/README.md) | Análisis y decisiones previas a la construcción |

Para contribuir: [`CONTRIBUTING.md`](./CONTRIBUTING.md). Para reportar una vulnerabilidad:
[`SECURITY.md`](./SECURITY.md).

## Estado

Versión `0.1.0`, la primera, publicada en npmjs.com bajo la organización `@zuccadev-labs`
([`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix)). Mientras la versión sea
`0.x`, una subida de `MENOR` puede traer cambios incompatibles ([Versionado](./docs/package/01-versionado.md)).
Las versiones se publican solas cuando una subida de versión llega a `main`
([Publicación](./docs/package/02-publicacion.md)).

## Licencia

[MIT](./LICENSE).
