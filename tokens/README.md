# @zuccadev-labs/zuix-tokens

The single source of design values for the zuix suite: color, material, typography, spacing, shape,
elevation, motion, layers and layout measures. Icons, components and layouts read from here. A brand is one
JSON file; switching brands does not touch any component.

It has no dependencies and no runtime JavaScript: it publishes CSS and JSON.

## Install

```
pnpm add @zuccadev-labs/zuix-tokens
```

It also comes inside the full suite, [`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix).

## Usage

With a bundler (Vite, webpack, Next.js…), from the application stylesheet or from JavaScript:

```css
@import "@zuccadev-labs/zuix-tokens/tokens.css";          /* all brands */
```

```js
import "@zuccadev-labs/zuix-tokens/tokens.css";
```

To load a single brand on `:root`, import `@zuccadev-labs/zuix-tokens/css/dazlabs.css` instead of
`tokens.css`. Without a bundler, link `node_modules/@zuccadev-labs/zuix-tokens/dist/tokens.css`.

```html
<html data-theme="dark" data-brand="dazlabs">
```

```css
.card {
  background: var(--z-surface);
  color: var(--z-fg);
  border-radius: var(--z-radius-md);
  padding: var(--z-space-4);
}
```

- `data-theme` is `dark` or `light`. Without the attribute the system preference is followed.
- `data-brand` picks the brand when `tokens.css` is imported. The default brand lives on `:root`.

## One token per use of a color

Brand and status colors come in three flavors. Mixing them up is the usual way to lose contrast.

| Use | Token | Contrast it guarantees |
|---|---|---|
| Fill, border, icon, indicator | `--z-accent`, `--z-success`, `--z-warning`, `--z-danger`, `--z-info` | 3:1 against the surrounding surface |
| Colored text and links | `--z-accent-text`, `--z-success-text`, `--z-warning-text`, `--z-danger-text`, `--z-info-text` | 4.5:1 on every surface and on its own `-soft` background |
| Background with text on top | `--z-accent-solid`, `--z-success-solid`, `--z-warning-solid`, `--z-danger-solid`, `--z-info-solid` | 4.5:1 with `--z-fg-on-accent` in both themes |

## Entry points

| Entry | Contents |
|---|---|
| `@zuccadev-labs/zuix-tokens/tokens.css` | All brands: the default one on `:root`, the others under `data-brand` |
| `@zuccadev-labs/zuix-tokens/css/<brand>.css` | A single brand on `:root` |
| `@zuccadev-labs/zuix-tokens/tailwind.css` | Bridge to Tailwind 4 utilities (`@theme inline`) |
| `@zuccadev-labs/zuix-tokens/docusaurus.css` | Map to the variables of the Docusaurus classic theme |
| `@zuccadev-labs/zuix-tokens/tokens.json` | The whole contract, for tools and agents |
| `@zuccadev-labs/zuix-tokens/dtcg/<brand>.<theme>.tokens.json` | Design Tokens format (DTCG 2025.10), one self-contained file per brand and theme |
| `@zuccadev-labs/zuix-tokens/brands/<brand>.json` | The definition of each brand |
| `@zuccadev-labs/zuix-tokens/schema/brand.schema.json` | JSON schema of a brand |
| `@zuccadev-labs/zuix-tokens/compat/<project>.css` | Compatibility layer: a project's old variables as aliases of tokens |

## Levels

| Level | Variable | Who edits it |
|---|---|---|
| Primitive | `--zp-red-500` | The brand |
| Semantic | `--z-accent`, `--z-surface`, `--z-fg` | The brand, by assigning primitives |
| Component | `--z-card-bg`, `--z-button-radius` | The system |

An application reads semantic and component tokens, never primitives.

## Brands and validation

`dazlabs` (default), `zutool` and `zenith`, each in a dark and a light theme. The build validates every
brand and theme: the schema, the required tokens, and WCAG 2.2 contrast — every text token on every surface
(4.5:1), the color pairs the component stylesheets actually use, and control borders and the focus ring
(3:1). A pair below its minimum fails the build.

The tokens also react to system preferences: `pointer: coarse` raises the touch target to 40 px,
`prefers-contrast: more` makes glass opaque and strengthens borders, and `forced-colors` removes the
gradient and the specular highlight.

## Documentation

The guides are written in Spanish.

- [Tokens guide](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/01-tokens.md)
- [Creating a brand](https://github.com/zuccadev-labs/zuix/blob/main/docs/agents/01-marca.md)
- [Migrating a project that has its own CSS variables](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/07-migracion.md)
- [Changelog](https://github.com/zuccadev-labs/zuix/blob/main/tokens/CHANGELOG.md)

## Español

Fuente única de los valores de diseño de la suite zuix. Una marca es un archivo JSON. La guía está en
español en [`docs/users/01-tokens.md`](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/01-tokens.md).

## License

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
