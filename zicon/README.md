# @zuccadev-labs/zuix-zicon

Estándar iconográfico de la suite zuix: 346 iconos en dos variantes (`outline` y `solid`), en caja de
24 × 24, con categorías y palabras clave en español e inglés. Se usan por nombre desde React, como
elemento `<z-icon>`, como cadena SVG, desde un sprite o como archivos sueltos.

## Instalación

```
pnpm add @zuccadev-labs/zuix-zicon
```

React 19 es un peer opcional: solo lo necesita el componente `Icon`. También viene dentro de la suite
completa, [`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix).

## Uso sin React

Con un bundler, `import "@zuccadev-labs/zuix-zicon/element"` define el elemento `<z-icon>` con el set completo:

```js
import "@zuccadev-labs/zuix-zicon/element";
```

```html
<z-icon name="magnifying-glass"></z-icon>
<z-icon name="trash" size="20" label="Delete"></z-icon>
<z-icon name="bookmark" variant="solid"></z-icon>
```

| Forma | Uso |
|---|---|
| Elemento | `<z-icon name="bell" variant="solid" size="20" label="Alerts"></z-icon>` |
| Cadena | `iconSvg("bell", { size: 20 })` desde `@zuccadev-labs/zuix-zicon/dom` |
| Sprite | `<svg class="z-icon" width="16" height="16"><use href="sprite.svg#bell"/></svg>` (`#bell-solid` para la variante sólida) |
| Archivo | `@zuccadev-labs/zuix-zicon/svg/outline/bell.svg` |

## Uso con React

```tsx
import { Icon } from "@zuccadev-labs/zuix-zicon";

export function Toolbar() {
  return (
    <>
      <Icon name="magnifying-glass" />                 {/* 16 px, decorativo */}
      <Icon name="trash" size={20} label="Delete" />   {/* con nombre accesible */}
      <Icon name="bookmark" variant="solid" />
    </>
  );
}
```

| Prop o atributo | Valores | Por defecto |
|---|---|---|
| `name` | Un nombre de `manifest.json`; en TypeScript, uno inexistente no compila | — |
| `variant` | `outline`, `solid` | `outline` |
| `size` | Número (px) o longitud CSS | `16` |
| `label` | Nombre accesible. Sin él, el icono es decorativo | — |

El color se hereda del texto que rodea al icono.

## Incluir solo algunos iconos

`@zuccadev-labs/zuix-zicon`, `@zuccadev-labs/zuix-zicon/all` y `@zuccadev-labs/zuix-zicon/element` registran el set completo (unos 580 kB de
trazados sin comprimir). Para registrar solo los que se usan:

```tsx
import { Icon, registerIcons } from "@zuccadev-labs/zuix-zicon/core";
import { trash } from "@zuccadev-labs/zuix-zicon/icons/trash";

registerIcons([trash]);
```

`@zuccadev-labs/zuix-zicon/dom` tampoco incluye datos: ofrece `iconSvg` y `registerIcons` sin React.

## Entradas

| Entrada | Contenido |
|---|---|
| `@zuccadev-labs/zuix-zicon` | `Icon` de React con el set completo registrado |
| `@zuccadev-labs/zuix-zicon/core` | `Icon` y `registerIcons`, sin datos |
| `@zuccadev-labs/zuix-zicon/all` | Registra el set completo al importarse |
| `@zuccadev-labs/zuix-zicon/dom` | `iconSvg` y `registerIcons`, sin React y sin datos |
| `@zuccadev-labs/zuix-zicon/element` | Define `<z-icon>` con el set completo |
| `@zuccadev-labs/zuix-zicon/icons/<nombre>` | Un icono por módulo |
| `@zuccadev-labs/zuix-zicon/manifest.json` | Nombres, categorías y palabras clave |
| `@zuccadev-labs/zuix-zicon/sprite.svg`, `@zuccadev-labs/zuix-zicon/svg/*` | Sprite y archivos SVG sueltos |
| `@zuccadev-labs/zuix-zicon/dist/zicon.element.js` | `<z-icon>` autocontenido para enlazar sin bundler |

## Un solo registro

Los iconos se registran en un mapa dentro del paquete. Si un proyecto instala dos copias de
`@zuccadev-labs/zuix-zicon`, los iconos registrados en una no se ven desde la otra: salen vacíos y la consola
avisa. Por eso `@zuccadev-labs/zuix-zui` y `@zuccadev-labs/zuix-zout` lo declaran como `peerDependency` y usan la
copia de la aplicación. Los paquetes de la suite se instalan y se actualizan juntos, en la misma versión.

## Limitaciones

- La variante `outline` está dibujada como forma rellena: el grosor del trazo no se ajusta.
- Hay una sola caja de 24 px.

## Documentación

- [Guía de iconos](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/02-zicon.md)
- [Cambios](https://github.com/zuccadev-labs/zuix/blob/main/zicon/CHANGELOG.md)
- Reglas para agentes de IA: `AGENTS.md`, incluido en el paquete.

## Licencia

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
