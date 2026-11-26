# @zuccadev-labs/zuix-zui

The component system of the zuix suite: 254 accessible components in 19 groups. Each component is an HTML and
CSS contract on top of tokens; the framework-free behavior lives in `@zuccadev-labs/zuix-zui/dom` and the
React binding in the main entry.

| Layer | Entry | Depends on |
|---|---|---|
| Contract | `@zuccadev-labs/zuix-zui/styles.css`, `@zuccadev-labs/zuix-zui/html.json` | `@zuccadev-labs/zuix-tokens` |
| Behavior | `@zuccadev-labs/zuix-zui/dom` | The browser (`<dialog>`, Popover API) |
| React binding | `@zuccadev-labs/zuix-zui` | React 18.2 or later, or React 19 |

There is no third-party UI library underneath. Dialogs are a native `<dialog>` opened with `showModal()`,
floating layers are `popover` elements, and the keyboard and focus logic follows the
[WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/). React and the framework-free mode share
one implementation of that logic, and React emits exactly the markup of the contract.

## Install

```
pnpm add @zuccadev-labs/zuix-zui @zuccadev-labs/zuix-tokens @zuccadev-labs/zuix-zicon
```

`@zuccadev-labs/zuix-zicon` is a required peer (components draw their icons with the application's copy).
`react` and `react-dom` are optional peers, 18.2 or later or 19: only the binding needs them
(`pnpm add react react-dom`). The only runtime dependency is `@zuccadev-labs/zuix-tokens`. The suite packages
are installed and upgraded together, at the same version. Requires Node 22.12 or later.

To install everything with a single dependency: [`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix).

## Without React

With a bundler:

```js
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zicon/element";            // <z-icon>
import { init, toast } from "@zuccadev-labs/zuix-zui/dom";

init();
toast({ title: "Ready", intent: "success" });
```

`@zuccadev-labs/zuix-zui/dom` has no import-time side effects, so a bundler drops what you don't use (only
`toast()` is about 11 kB), but its `init()` wires every family. To load less, start from the core and add the
families the page needs:

```js
import { init } from "@zuccadev-labs/zuix-zui/dom/core";        // dialogs, popovers, menus, toast, basic forms…
import { datesModule } from "@zuccadev-labs/zuix-zui/dom/dates"; // Calendar, DatePicker, DateField…

init(datesModule); // later: use(agendaModule) from "@zuccadev-labs/zuix-zui/dom/agenda"
```

Families: `dates`, `data`, `content`, `agenda`, `charts`, `color`, `media`, `effects`, `time`, `terminal`, `chat`,
`ai`, `dashboard`, `people`. Which one covers what, and the sizes, in the [frameworks guide](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/06-frameworks.md).

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

- `z-root` applies typography and focus; `z-canvas` paints the background.
- `data-z-dom` enables tabs, accordion and form controls inside that container.
- The markup of every component is in `@zuccadev-labs/zuix-zui/html.json`. Each component declares its
  `behavior`: `none` (CSS only) or `dom` (needs `@zuccadev-labs/zuix-zui/dom`).
- `init()` returns a `destroy` function that removes every listener.

Without a bundler, link `dist/zui.css` and `dist/zui.dom.js`, both included in the package.

## With React

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zicon/all";           // registers the icons

import { Button } from "@zuccadev-labs/zuix-zui";

export function NewProject() {
  return <Button variant="primary" icon="plus">New project</Button>;
}
```

Put `data-theme="dark"` or `"light"` on `<html>`, and `class="z-root z-canvas"` on the application
container.

Modules with hooks, context or their own event handlers declare `"use client"`. Those that only produce
markup (`Button`, `Badge`, `Card`…) do not, so they render as Server Components.

## Accessibility and security

- WCAG 2.2 AA contrast is measured on every change: the token build reads the color pairs these stylesheets
  use and fails below 4.5:1 for text or 3:1 for non-text.
- Right-to-left works through logical properties and a mirrored keyboard, with the direction read from the
  DOM. `forced-colors`, `prefers-contrast`, `prefers-reduced-motion` and `prefers-reduced-transparency`
  are handled. Controls grow to 40 px with a coarse pointer.
- The framework-free mode writes application text with `textContent`, and works under a strict Content
  Security Policy with Trusted Types (policy name: `zuix-zui`).
- Browsers: Chrome and Edge 116, Firefox 125, Safari 17, iOS Safari 18.3.

## Entry points

| Entry | Contents |
|---|---|
| `@zuccadev-labs/zuix-zui` | React components and their `*Props` types |
| `@zuccadev-labs/zuix-zui/dom` | Framework-free behavior, everything: `init`, `destroy`, `hydrate`, `toast`, `confirm`… |
| `@zuccadev-labs/zuix-zui/dom/core` | Framework-free core (`init`, `use`, dialogs, popovers, menus, `toast`, basic forms), extended per family |
| `@zuccadev-labs/zuix-zui/dom/dates`, `/dom/data`, `/dom/content`, `/dom/agenda`, `/dom/charts`, `/dom/color`, `/dom/media`, `/dom/effects`, `/dom/time`, `/dom/terminal`, `/dom/chat`, `/dom/ai`, `/dom/dashboard`, `/dom/people`, `/dom/nodes`, `/dom/page` | One behavior family each, registered with `init(module)` or `use(module)` |
| `@zuccadev-labs/zuix-zui/dom/carousel-gl` | WebGL mode of the carousel, loaded on demand |
| `@zuccadev-labs/zuix-zui/styles.css` | All the styles |
| `@zuccadev-labs/zuix-zui/styles.compat.css` | The same styles for Chromium 109, Firefox 115 and Safari 15.4, with `tokens.compat.css` ([compat mode](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/10-compatibilidad.md#modo-compat)) |
| `@zuccadev-labs/zuix-zui/styles/*` | Single stylesheets per group |
| `@zuccadev-labs/zuix-zui/manifest.json` | Components, props, classes and examples, for tools and agents |
| `@zuccadev-labs/zuix-zui/html.json` | The markup of every example |
| `@zuccadev-labs/zuix-zui/dist/zui.css`, `@zuccadev-labs/zuix-zui/dist/zui.dom.js` | Bundles to link without a bundler |

## Rules

1. Components only read tokens: no literal colors, radii or shadows.
2. Icons are requested by name; emojis are not used as icons.
3. If a variant, a token or an icon is missing, it is added to the system.

## Documentation

The guides are written in Spanish.

- [Components guide](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/03-zui.md)
- [Using zuix with other frameworks, or with none](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/06-frameworks.md)
- [Upgrading from 0.1 to 0.2](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/08-actualizar-de-0-1-a-0-2.md)
- [Accessibility](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/09-accesibilidad.md) and [CSP and Trusted Types](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/11-csp-y-trusted-types.md)
- [Public contract](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/03-contrato-publico.md): what counts as public surface
- [Changelog](https://github.com/zuccadev-labs/zuix/blob/main/zui/CHANGELOG.md)
- Rules for AI agents: `AGENTS.md`, included in the package. Third-party notices: `THIRD_PARTY_NOTICES.md`.

## Español

Sistema de componentes de la suite zuix: 254 componentes sobre un contrato de HTML y CSS, sin bibliotecas de
UI de terceros. La guía está en español en [`docs/users/03-zui.md`](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/03-zui.md).

## License

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
