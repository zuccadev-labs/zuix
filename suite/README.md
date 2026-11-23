# @zuccadev-labs/zuix

The whole zuix suite in one dependency: design tokens, icons, components and layouts. The standard is HTML,
CSS and tokens; it works with any framework and ships a React binding.

```
pnpm add @zuccadev-labs/zuix
```

With npm, `npm install @zuccadev-labs/zuix`. The React binding also needs `react` and `react-dom`, 18.2 or
later or 19 (`pnpm add react react-dom`). The framework-free subpaths do not import them. Requires Node 22.12 or later.

## With React

```tsx
import "@zuccadev-labs/zuix/styles.css";          // tokens + components + layouts
import "@zuccadev-labs/zuix/zicon/all";           // registers the icons
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

`data-theme` is `dark` or `light`. `z-root` applies typography and focus; `z-canvas` paints the background.

## Without a framework

```js
import "@zuccadev-labs/zuix/styles.css";
import "@zuccadev-labs/zuix/zicon/element";      // defines <z-icon>
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

These subpaths do not import React, and a project that only uses them does not install it.

## Subpaths

| Subpath | Equivalent to |
|---|---|
| `@zuccadev-labs/zuix/styles.css` | Tokens (all brands) + component and layout styles |
| `@zuccadev-labs/zuix/tokens.css` | `@zuccadev-labs/zuix-tokens/tokens.css` |
| `@zuccadev-labs/zuix/tokens/dazlabs.css`, `/tokens/zutool.css`, `/tokens/zenith.css` | A single brand on `:root` |
| `@zuccadev-labs/zuix/tailwind.css`, `/docusaurus.css` | Token bridges to Tailwind 4 and Docusaurus |
| `@zuccadev-labs/zuix/zui`, `/zui/dom`, `/zui/dom/carousel-gl` | `@zuccadev-labs/zuix-zui`, its framework-free behavior and the WebGL carousel mode |
| `@zuccadev-labs/zuix/zui/dom/core`, `/zui/dom/dates`, `/zui/dom/data`, `/zui/dom/content`, `/zui/dom/agenda`, `/zui/dom/charts`, `/zui/dom/color`, `/zui/dom/media`, `/zui/dom/effects`, `/zui/dom/time`, `/zui/dom/terminal`, `/zui/dom/chat`, `/zui/dom/ai`, `/zui/dom/dashboard`, `/zui/dom/people`, `/zui/dom/nodes` | The framework-free behavior of `@zuccadev-labs/zuix-zui` split by family |
| `@zuccadev-labs/zuix/zout`, `/zout/dom` | `@zuccadev-labs/zuix-zout` and its framework-free behavior |
| `@zuccadev-labs/zuix/zicon`, `/zicon/core`, `/zicon/dom`, `/zicon/element`, `/zicon/all` | The entry points of `@zuccadev-labs/zuix-zicon` |
| `@zuccadev-labs/zuix` | The `zui`, `zout` and `zicon` namespaces (requires React) |

The `.css` files in this package use `@import` of packages: they need a bundler (Vite, webpack,
Next.js…). Without a bundler, link the `dist/` files of each package.

Prefer the subpaths over the root entry in an application: a namespace import pulls the whole package into
the bundle.

## What the umbrella does not re-export

Manifests, the HTML contract (`html.json`), `tokens.json`, the sprite, single icons (`icons/<name>`) and the
browser bundles (`dist/…`) are imported from their own package. Add that package to your dependencies, at
the same version as the umbrella:

```
pnpm add @zuccadev-labs/zuix-zicon
```

The five packages share one version and are upgraded together (`pnpm up "@zuccadev-labs/*"`). If a project
ends up with two different versions of `@zuccadev-labs/zuix-zicon`, icons registered in one are not visible
from the other and render empty.

## Packages

| Package | Contents |
|---|---|
| [`@zuccadev-labs/zuix-tokens`](https://www.npmjs.com/package/@zuccadev-labs/zuix-tokens) | Design tokens; a brand is one file |
| [`@zuccadev-labs/zuix-zicon`](https://www.npmjs.com/package/@zuccadev-labs/zuix-zicon) | 366 icons in outline and solid |
| [`@zuccadev-labs/zuix-zui`](https://www.npmjs.com/package/@zuccadev-labs/zuix-zui) | 224 components |
| [`@zuccadev-labs/zuix-zout`](https://www.npmjs.com/package/@zuccadev-labs/zuix-zout) | 30 layouts |

## Documentation

The guides are written in Spanish.

- [User guide](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/README.md)
- [Using zuix with other frameworks, or with none](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/06-frameworks.md)
- [Upgrading from 0.1 to 0.2](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/08-actualizar-de-0-1-a-0-2.md)
- [Changelog](https://github.com/zuccadev-labs/zuix/blob/main/suite/CHANGELOG.md)

## Español

La suite zuix completa en una sola dependencia: tokens, iconos, componentes y layouts. La documentación está
en español en [`docs/users`](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/README.md), y el resumen del proyecto en
[`README.es.md`](https://github.com/zuccadev-labs/zuix/blob/main/README.es.md).

## License

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
