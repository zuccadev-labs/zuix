# @zuccadev-labs/zuix-tokens

Fuente única de los valores de diseño de la suite zuix: color, material, tipografía, espaciado, forma,
elevación, movimiento, capas y medidas de layout. Iconos, componentes y layouts leen de aquí. Una marca
es un archivo JSON; cambiar de marca no toca ningún componente.

No tiene dependencias ni JavaScript de ejecución: publica CSS y JSON.

## Instalación

```
pnpm add @zuccadev-labs/zuix-tokens
```

También viene dentro de la suite completa, [`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix).

## Uso

Con un bundler (Vite, webpack, Next.js…), en la hoja de estilos de la aplicación o desde JavaScript:

```css
@import "@zuccadev-labs/zuix-tokens/tokens.css";          /* todas las marcas */
```

```js
import "@zuccadev-labs/zuix-tokens/tokens.css";
```

Para cargar una sola marca en `:root`, se importa `@zuccadev-labs/zuix-tokens/css/dazlabs.css` en lugar de
`tokens.css`. Sin bundler se enlaza `node_modules/@zuccadev-labs/zuix-tokens/dist/tokens.css` con un `<link>`.

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

- `data-theme` es `dark` o `light`. Sin el atributo se sigue la preferencia del sistema.
- `data-brand` elige la marca cuando se importa `tokens.css`. La marca por defecto va en `:root`.

## Entradas

| Entrada | Contenido |
|---|---|
| `@zuccadev-labs/zuix-tokens/tokens.css` | Todas las marcas: la de por defecto en `:root`, las demás con `data-brand` |
| `@zuccadev-labs/zuix-tokens/css/<marca>.css` | Una sola marca en `:root` |
| `@zuccadev-labs/zuix-tokens/tailwind.css` | Puente a utilidades de Tailwind v4 (`@theme inline`) |
| `@zuccadev-labs/zuix-tokens/docusaurus.css` | Mapa a las variables del tema clásico de Docusaurus |
| `@zuccadev-labs/zuix-tokens/tokens.json` | Todo el contrato, para herramientas y agentes |
| `@zuccadev-labs/zuix-tokens/dtcg/<marca>.<tema>.tokens.json` | Formato Design Tokens (DTCG 2025.10), por marca y tema |
| `@zuccadev-labs/zuix-tokens/brands/<marca>.json` | Definición de cada marca |
| `@zuccadev-labs/zuix-tokens/schema/brand.schema.json` | Esquema JSON de una marca |
| `@zuccadev-labs/zuix-tokens/compat/<proyecto>.css` | Capa de compatibilidad: variables antiguas de un proyecto como alias de tokens |

## Niveles

| Nivel | Variable | Quién lo edita |
|---|---|---|
| Primitivo | `--zp-red-500` | La marca |
| Semántico | `--z-accent`, `--z-surface`, `--z-fg` | La marca, al asignar primitivos |
| Componente | `--z-card-bg`, `--z-button-radius` | El sistema |

Una aplicación lee tokens semánticos y de componente, nunca primitivos.

## Marcas incluidas

`dazlabs` (por defecto), `zutool` y `zenith`, cada una en tema oscuro y claro. La generación valida, por
marca y tema, el esquema, los tokens obligatorios y el contraste WCAG 2.2 de cada token de texto sobre cada
superficie (4.5:1), de los pares que usan las hojas de componentes y de los bordes de control y el foco (3:1).

## Documentación

- [Guía de tokens y creación de marcas](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/01-tokens.md)
- [Migración desde variables CSS propias](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/07-migracion.md)
- [Cambios](https://github.com/zuccadev-labs/zuix/blob/main/tokens/CHANGELOG.md)

## Licencia

[MIT](https://github.com/zuccadev-labs/zuix/blob/main/LICENSE).
