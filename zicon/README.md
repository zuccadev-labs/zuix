# @zuccadev-labs/zuix-zicon

The icon standard of the zuix suite: 346 icons in two variants (`outline` and `solid`), on a 24 × 24 box,
with categories and keywords in Spanish and English. They are used by name from React, as a `<z-icon>`
element, as an SVG node or string, from a sprite, or as single files.

## Install

```
pnpm add @zuccadev-labs/zuix-zicon
```

React 19 is an optional peer: only the `Icon` component needs it. The package also comes inside the full
suite, [`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix).

## Without React

With a bundler, `import "@zuccadev-labs/zuix-zicon/element"` defines the `<z-icon>` element with the full
set:

```js
import "@zuccadev-labs/zuix-zicon/element";
```

```html
<z-icon name="magnifying-glass"></z-icon>
<z-icon name="trash" size="20" label="Delete"></z-icon>
<z-icon name="bookmark" variant="solid"></z-icon>
```

| Form | Usage |
|---|---|
| Element | `<z-icon name="bell" variant="solid" size="20" label="Alerts"></z-icon>` |
| Node | `iconElement("bell", { size: 20 })` from `@zuccadev-labs/zuix-zicon/dom`: an `<svg>` built with the DOM |
| String | `iconSvg("bell", { size: 20 })` from `@zuccadev-labs/zuix-zicon/dom` |
| Sprite | `<svg class="z-icon" width="16" height="16"><use href="sprite.svg#bell"/></svg>` (`#bell-solid` for the solid variant) |
| File | `@zuccadev-labs/zuix-zicon/svg/outline/bell.svg` |

`<z-icon>` and `iconElement()` never use `innerHTML`: they work on pages with Trusted Types enabled.
`iconSvg()` returns a string with every interpolated value escaped.

## With React

```tsx
import { Icon } from "@zuccadev-labs/zuix-zicon";

export function Toolbar() {
  return (
    <>
      <Icon name="magnifying-glass" />                 {/* 16 px, decorative */}
      <Icon name="trash" size={20} label="Delete" />   {/* with an accessible name */}
      <Icon name="bookmark" variant="solid" />
    </>
  );
}
```

| Prop or attribute | Values | Default |
|---|---|---|
| `name` | A name from `manifest.json`; in TypeScript, one that does not exist does not compile | — |
| `variant` | `outline`, `solid` | `outline` |
| `size` | Number (px) or CSS length | `16` |
| `label` | Accessible name. Without it the icon is decorative | — |

The color is inherited from the surrounding text.

## Shipping only some icons

`@zuccadev-labs/zuix-zicon`, `/all` and `/element` register the full set (about 580 kB of path data,
uncompressed). To register only what you use:

```tsx
import { Icon, registerIcons } from "@zuccadev-labs/zuix-zicon/core";
import { trash } from "@zuccadev-labs/zuix-zicon/icons/trash";

registerIcons([trash]);
```

`@zuccadev-labs/zuix-zicon/dom` ships no data either: it offers `iconSvg`, `iconElement` and
`registerIcons` without React.

## Entry points

| Entry | Contents |
|---|---|
| `@zuccadev-labs/zuix-zicon` | React `Icon` with the full set registered |
| `@zuccadev-labs/zuix-zicon/core` | `Icon`, `registerIcons` and `onIconsRegistered`, without data |
| `@zuccadev-labs/zuix-zicon/all` | Registers the full set on import |
| `@zuccadev-labs/zuix-zicon/dom` | `iconSvg`, `iconElement`, `iconPaths` and `registerIcons`, without React and without data |
| `@zuccadev-labs/zuix-zicon/element` | Defines `<z-icon>` with the full set |
| `@zuccadev-labs/zuix-zicon/icons/<name>` | One icon per module |
| `@zuccadev-labs/zuix-zicon/manifest.json` | Names, categories and keywords |
| `@zuccadev-labs/zuix-zicon/sprite.svg`, `@zuccadev-labs/zuix-zicon/svg/*` | Sprite and single SVG files |
| `@zuccadev-labs/zuix-zicon/dist/zicon.element.js` | Self-contained `<z-icon>` to link without a bundler |

## A single registry

Icons are registered in a map inside the package. If a project installs two copies of
`@zuccadev-labs/zuix-zicon`, icons registered in one are not visible from the other: they render empty and
the console warns. That is why `@zuccadev-labs/zuix-zui` and `@zuccadev-labs/zuix-zout` declare it as a
`peerDependency` and use the application's copy. The suite packages are installed and upgraded together, at
the same version.

## Known limits

- The `outline` variant is drawn as a filled shape: stroke width cannot be adjusted.
- There is a single 24 px box.
- 101 of the 346 icons are identical in `outline` and `solid`: the source drawing does not distinguish them.
- `<use>` pointing at an external `sprite.svg` only works when the sprite is served from the same origin as
  the page.

## Documentation

The guides are written in Spanish.

- [Icons guide](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/02-zicon.md)
- [Changelog](https://github.com/zuccadev-labs/zuix/blob/main/zicon/CHANGELOG.md)
- Rules for AI agents: `AGENTS.md`, included in the package.

## Español

Estándar iconográfico de la suite zuix: 346 iconos en `outline` y `solid`. La guía está en español en
[`docs/users/02-zicon.md`](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/02-zicon.md).

## License

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
