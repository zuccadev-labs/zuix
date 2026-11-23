# @zuccadev-labs/zuix-zout

Layouts and dynamic windows for the zuix suite. It solves the structure of the screen (shell, panels, work
tabs, grids, site navigation) and draws no content. Measures and material come from the tokens.

## Install

```
pnpm add @zuccadev-labs/zuix-zout @zuccadev-labs/zuix-zui @zuccadev-labs/zuix-tokens @zuccadev-labs/zuix-zicon
```

`@zuccadev-labs/zuix-zicon` is a required peer. `react` and `react-dom` (18.2 or later, or 19) are optional
peers: only the binding needs them (`pnpm add react react-dom`). The suite packages are installed and upgraded
together, at the same version. Requires Node 22.12 or later.

To install everything with a single dependency: [`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix).

## Pieces

| Piece | What it does |
|---|---|
| `Shell` | The overall structure: title bar, rail, sidebar, main area, inspector |
| `Rail`, `RailItem` | Narrow bar for primary navigation |
| `Sidebar`, `SidebarSection`, `SidebarItem`, `SidebarTrigger` | Secondary navigation as an accordion, collapsible to icons, with counters, actions and submenus |
| `SidePanel` | Panel with a title, a scrolling body and a footer |
| `SplitPane`, `Pane` | Split panes with draggable dividers |
| `TabStrip` | Work tabs with close and add, color groups, indicators and reordering |
| `PaneHeader` | Pane header: icon, title, secondary line and actions in a toolbar |
| `PaneLayout` | Tiled resizable panes: split, move, close, and drag a pane onto the edge of another |
| `FloatingPanel` | Non-modal floating window, moved and resized with pointer or keyboard |
| `TitleBar` | Header for frameless windows. It is a `<header>` |
| `ResizeHandle` | Resize handle |
| `Page`, `PageHeader`, `PageSection`, `Container` | Page with a header and sections |
| `Grid`, `Stack`, `Inline` | Intrinsic grid, stack and row |
| `Float` | Badge, dot or counter on the corner or edge of another element. CSS only |
| `Navbar`, `NavigationMenu` | Site navigation bar (floating, `dock` or edge to edge) and menus with panels; links move to a drawer when the row does not fit |
| `BottomNavigation` | Mobile navigation: three to five destinations with icon and label |
| `SiteFooter` | Site footer: brand, link columns, social links and legal strip |
| `SkipLink` | Skip-to-content link that moves focus to the target even if it is not focusable |
| `AppBar` | Top app bar (small, medium, large); the large title folds into the top row on scroll |
| `DashboardLayout`, `SettingsLayout`, `ProfileLayout`, `KanbanLayout` | Page layouts for a dashboard (sticky filters), settings (anchored navigation and a save bar), a profile and a board |
| `AuthLayout` | Sign-in page: a glass card on the canvas, or split with an image side |
| `DocsLayout` | Documentation page: navigation, article, table of contents that tracks the section being read, pager |
| `LandingLayout`, `LandingHero`, `LandingSection` | Landing page with a hero, feature grid, call to action and footer |
| `MailLayout` | Folders, message list and reader; one view at a time on narrow screens |

## With React

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all";           // registers the icons
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

The `Shell` needs a container with a defined height. `skipLinkLabel` adds a "skip to content" link, and
`mainAs` lets a nested shell avoid a second `<main>`.

## Without React

The markup of every layout is in `@zuccadev-labs/zuix-zout/html.json`. The behavior (shell drawers, dividers,
work tabs) comes from `@zuccadev-labs/zuix-zout/dom`:

```js
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import { init } from "@zuccadev-labs/zuix-zout/dom";

init();
```

Without a bundler, link `dist/zout.css` and `dist/zout.dom.js`, both included in the package.

## Responsive behavior

The `Shell` measures its own width, not the screen:

| Shell width | Sidebar | Inspector |
|---|---|---|
| 1180 px or more | Docked | Docked |
| 880 to 1179 px | Docked | Drawer |
| Less than 880 px | Drawer | Drawer |

## Keyboard, pointer and direction

- `SplitPane` dividers and `ResizeHandle` move with the arrow keys; Home and End take them to their minimum
  and maximum. Double-click resets a handle or splits two panes evenly.
- `TabStrip` switches tabs with the arrow keys, Home and End, and closes the active tab with Delete.
- With `dir="rtl"`, drawers, handles and arrow keys follow the writing direction. Handle sides are named
  `start` and `end`.
- With a coarse pointer, the grab area of handles and dividers grows to 40 px.

## Entry points

| Entry | Contents |
|---|---|
| `@zuccadev-labs/zuix-zout` | React layouts and their types |
| `@zuccadev-labs/zuix-zout/dom` | Framework-free behavior: `init`, `hydrate`, `dispose`, `setPanelOpen`, `setSplitSizes`, `addWorkTab`… |
| `@zuccadev-labs/zuix-zout/styles.css` | Styles |
| `@zuccadev-labs/zuix-zout/manifest.json`, `@zuccadev-labs/zuix-zout/html.json` | Props, classes and markup, for tools and agents |
| `@zuccadev-labs/zuix-zout/dist/zout.css`, `@zuccadev-labs/zuix-zout/dist/zout.dom.js` | Bundles to link without a bundler |

## Documentation

The guides are written in Spanish.

- [Layouts guide](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/04-zout.md)
- [Using zuix with other frameworks, or with none](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/06-frameworks.md)
- [Upgrading from 0.1 to 0.2](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/08-actualizar-de-0-1-a-0-2.md)
- [Changelog](https://github.com/zuccadev-labs/zuix/blob/main/zout/CHANGELOG.md)

## Español

Layouts y ventanas dinámicas de la suite zuix. La guía está en español en
[`docs/users/04-zout.md`](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/04-zout.md).

## License

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
