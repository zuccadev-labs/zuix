# zuix

[![npm](https://img.shields.io/npm/v/%40zuccadev-labs%2Fzuix?label=npm)](https://www.npmjs.com/package/@zuccadev-labs/zuix)
[![ci](https://github.com/zuccadev-labs/zuix/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/zuccadev-labs/zuix/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/zuccadev-labs/zuix/badge)](https://scorecard.dev/viewer/?uri=github.com/zuccadev-labs/zuix)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/16943/badge)](https://www.bestpractices.dev/projects/16943)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[English](./README.md) | **Español**

zuix es una suite de UI con un solo estándar: tokens de diseño, iconos, componentes, layouts y una plantilla
de documentación. El estándar es HTML, CSS y tokens. Sirve con cualquier framework o sin ninguno, y trae un
binding de React. Una marca replica el sistema entero cambiando un archivo.

Lo mantengo yo solo, en la organización `zuccadev-labs`. La documentación detallada está en español; este
archivo tiene su versión en inglés y los README de los paquetes están en inglés.

## Las tres capas

| Capa | Qué es | Depende de |
|---|---|---|
| Contrato | Tokens `--z-*`, clases `z-*`, atributos de estado (`data-state`, `data-size`, `aria-*`) e iconos | Nada: CSS y SVG |
| Comportamiento | `@zuccadev-labs/zuix-zui/dom` y `@zuccadev-labs/zuix-zout/dom`: diálogos, menús, popovers, pestañas, paneles, controles | El navegador (`<dialog>`, Popover API) |
| Binding | `@zuccadev-labs/zuix-zui` y `@zuccadev-labs/zuix-zout` para React | React 18.2 o posterior, o React 19 |

El marcado de cada componente está en `zui/html.json` y `zout/html.json`, generado al renderizar el binding
de React. Un binding para otro framework solo tiene que producir ese marcado; la apariencia no se reescribe.

Debajo no hay ninguna biblioteca de UI de terceros. Los diálogos son un `<dialog>` nativo abierto con
`showModal()`, las capas flotantes usan la Popover API, y el teclado y el foco siguen las
[WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/). La misma lógica mueve el binding de React
y el modo sin framework.

## Paquetes

| Paquete | Carpeta | Qué es | Se publica |
|---|---|---|---|
| `@zuccadev-labs/zuix` | [`suite/`](./suite/README.md) | Paraguas: instala los cuatro siguientes y los reexporta bajo subrutas | Sí |
| `@zuccadev-labs/zuix-tokens` | [`tokens/`](./tokens/README.md) | Fuente única de valores de diseño. Una marca es un archivo | Sí |
| `@zuccadev-labs/zuix-zicon` | [`zicon/`](./zicon/README.md) | 366 iconos en `outline` y `solid`, elemento `<z-icon>` y componente de React | Sí |
| `@zuccadev-labs/zuix-zui` | [`zui/`](./zui/README.md) | 224 componentes accesibles que solo leen tokens | Sí |
| `@zuccadev-labs/zuix-zout` | [`zout/`](./zout/README.md) | 30 layouts: shell, paneles divididos, pestañas de trabajo, rejillas, layouts de página | Sí |
| `@zuccadev-labs/zuix-zudocs` | `zudocs/` | Estándar de documentación y plantilla Docusaurus | No |

Los cinco paquetes publicados comparten número de versión y se instalan y actualizan juntos.

## Instalación

```
pnpm add @zuccadev-labs/zuix                 # la suite completa
pnpm add react react-dom                     # solo para el binding de React
```

O paquete a paquete: `pnpm add @zuccadev-labs/zuix-zui @zuccadev-labs/zuix-zicon @zuccadev-labs/zuix-tokens`
(y `@zuccadev-labs/zuix-zout` para los layouts). `@zuccadev-labs/zuix-zicon` es un peer de `zui` y `zout`: la
aplicación lo instala siempre. `zui` tiene una sola dependencia en ejecución, `@zuccadev-labs/zuix-tokens`.

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
`data-brand`. El binding funciona con React 18.2 o posterior y con React 19; paso la suite de navegador con
los dos en cada cambio ([Compatibilidad](./docs/users/10-compatibilidad.md#react)).

## Con qué se puede contar

| Área | Estado |
|---|---|
| Accesibilidad | WCAG 2.2 AA se mide, no se supone: la generación de tokens comprueba cada par de texto y superficie que las hojas usan de verdad (4.5:1) y el contraste de lo que no es texto (3:1). Se atienden `forced-colors`, `prefers-contrast`, `prefers-reduced-motion` y `prefers-reduced-transparency`, la escritura de derecha a izquierda funciona con propiedades lógicas y los objetivos táctiles crecen a 40 px con puntero grueso |
| Navegadores | Chrome y Edge 116, Firefox 125, Safari 17, Safari de iOS 18.3. El mínimo lo marca la Popover API |
| Entorno | Node 22.12 o posterior para los paquetes; React y React DOM 18.2 o posterior, o 19, como peers opcionales |
| Seguridad | El código sin framework escribe texto con `textContent`, funciona con Trusted Types y con una política de seguridad de contenido estricta, y `<z-icon>` no usa `innerHTML`. Las versiones se publican desde CI con publicación de confianza de npm y procedencia |

El detalle, los límites y lo que no he podido probar (Safari real, dispositivos táctiles reales, lectores de
pantalla) está en [Accesibilidad](./docs/users/09-accesibilidad.md) y
[Compatibilidad](./docs/users/10-compatibilidad.md).

## Desarrollo

Requisitos: Node 22.12 o posterior (desarrollo, ejecuto la CI y publico con Node 26) y pnpm 12.
`packageManager` fija la versión exacta de pnpm; `corepack enable` la instala.

```
pnpm install
pnpm check                                        # tokens, iconos, auditoría de estilo, manifiestos, contrato HTML, tipos
pnpm --filter @zuccadev-labs/zuix-zudocs start    # sitio de documentación con el catálogo en vivo
```

| Comando | Qué hace |
|---|---|
| `pnpm check` | Regenera y valida tokens, iconos, manifiestos y contrato HTML; audita estilos; comprueba tipos |
| `pnpm --filter @zuccadev-labs/zuix-zudocs build` | Compila el sitio de documentación y falla con enlaces o anclas rotos |
| `pnpm lint` | Biome (TypeScript, React, accesibilidad, CSS y JSON) y la regla de `"use client"` |
| `pnpm format` / `pnpm format:check` | Aplica o comprueba el formato |
| `pnpm test:unit` | Pruebas unitarias de la lógica pura con umbral de cobertura (`node:test`) |
| `pnpm test:html` | Contrato HTML y `@zuccadev-labs/zuix-zui/dom` en navegador, sin React |
| `pnpm test:browser` | Aplicación de ejemplo de React en navegador |
| `pnpm test:site` | El sitio de documentación compilado: enlaces, consola, accesibilidad |
| `pnpm build` | Genera el `dist/` de publicación de `zicon`, `zui` y `zout` y comprueba el paraguas |
| `pnpm test:pack` | Empaqueta los cinco paquetes y los consume fuera del workspace |
| `pnpm verify` | Todo lo anterior en orden, en Chromium. Puerta previa a una versión |
| `pnpm bump check` | Comprueba la versión única y las entradas de `CHANGELOG.md` |

Las suites de navegador usan el Chrome instalado en el sistema. Para Firefox y WebKit: `pnpm test:html:all`,
`pnpm test:browser:all` y `pnpm test:site:all`.

## Documentación

El sitio se publica en <https://zuccadev-labs.github.io/zuix/> y sus fuentes están en `docs/`.

| Área | Para quién |
|---|---|
| [`docs/users/`](./docs/users/README.md) | Quien usa la suite |
| [`docs/agents/`](./docs/agents/README.md) | Agentes de IA que montan pantallas o extienden la suite |
| [`docs/development/`](./docs/development/README.md) | Quien la mantiene: arquitectura, pruebas, CI |
| [`docs/package/`](./docs/package/README.md) | Versionado, empaquetado y publicación |
| [`docs/investigations/`](./docs/investigations/README.md) | Mis notas de investigación y las decisiones que explican el diseño |

Para actualizar desde la 0.1: [guía de actualización](./docs/users/08-actualizar-de-0-1-a-0-2.md). Para
contribuir: [`CONTRIBUTING.md`](./CONTRIBUTING.md). Para reportar una vulnerabilidad:
[`SECURITY.md`](./SECURITY.md). Código de conducta: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## Estado

La suite está en npm bajo la organización `@zuccadev-labs`
([`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix)). La versión actual es la
`0.3.0`: el catálogo pasa a 144 componentes y 19 layouts y todos los componentes estrenan base visual. No
retiré ningún token, clase ni exportación, pero casi todos los componentes se ven distintos. La que rompió
fue la `0.2.0`: quité la biblioteca de UI de terceros sobre la que estaba hecho el binding de React, pasé
los diálogos al `<dialog>` nativo y subí la versión mínima de Node. Mientras la versión sea `0.x`, una
subida de `MENOR` puede romper ([Versionado](./docs/package/01-versionado.md)). Las versiones se publican solas cuando una subida de versión
llega a `main` ([Publicación](./docs/package/02-publicacion.md)).

## Licencia

[MIT](./LICENSE).
