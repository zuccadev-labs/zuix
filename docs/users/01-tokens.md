# Tokens

`@zuccadev-labs/zuix-tokens` es la fuente única de los valores de diseño. Iconos, componentes, layouts y
documentación leen de aquí. Cambiar de marca es añadir o editar un archivo en `tokens/brands/`.

## Tres niveles

| Nivel | Qué contiene | Variable CSS | Quién lo edita |
|---|---|---|---|
| Primitivo | Paleta en bruto de la marca | `--zp-red-500` | La marca |
| Semántico | Propósito | `--z-accent`, `--z-surface`, `--z-fg` | La marca, al asignar primitivos |
| Componente | Uso concreto | `--z-card-bg`, `--z-button-radius` | El sistema; rara vez la marca |

Los componentes solo leen tokens semánticos y de componente. Nunca primitivos; la auditoría lo comprueba.

## Familias

| Familia | Tokens |
|---|---|
| Color | `fg`, `fg-muted`, `fg-subtle`, `fg-on-accent`, `surface`, `surface-2`, `surface-3`, `surface-solid`, `overlay`, `inset`, `line`, `line-strong`, `row-hover`, `accent`, `accent-hover`, `accent-solid`, `accent-soft`, `accent-ring`, `success`, `warning`, `danger`, `info` y sus `-soft` |
| Material | `glass-bg`, `glass-border`, `glass-highlight`, `glass-specular`, `glass-shadow`, `glass-blur`, `glass-saturate`, `canvas`, `canvas-gradient` |
| Tipografía | `font-display`, `font-sans`, `font-mono`, `text-*`, `weight-*`, `leading-*`, `tracking-*` |
| Espaciado | `space-0` a `space-20` |
| Forma | `radius-xs`, `sm`, `md`, `lg`, `xl`, `panel`, `full` |
| Elevación | `shadow-sm`, `md`, `lg` |
| Movimiento | `duration-*`, `ease-*` |
| Capas | `layer-sticky`, `overlay`, `menu`, `dialog`, `popover`, `tooltip`, `toast`, `top` |
| Layout | `rail-width`, `sidebar-width`, `inspector-width`, `header-height`, `shell-gap`, `content-max`, `prose-max`, `touch-target` |

`touch-target` es el objetivo táctil mínimo. Vale `0px` y pasa a `40px` cuando el puntero principal es el
dedo (`@media (pointer: coarse)`). `control-height-sm` y `control-height-md` se definen como
`max(30px, touch-target)` y `max(36px, touch-target)`: con ratón miden 30 y 36 px; en un teléfono, 40.
Para conservar los tamaños de ratón en táctil: `:root { --z-touch-target: 0px }` después de `tokens.css`.

`accent` se usa para texto, iconos y enlaces. `accent-solid` es el fondo de los botones primarios y
garantiza contraste con el texto que lleva encima.

## Marcas incluidas

| Marca | Acento | Fuentes | Origen |
|---|---|---|---|
| `dazlabs` (por defecto) | `#E74327` | Poppins, DM Sans | Manual de marca DAZLABS, sobre el material de zutool |
| `zutool` | `#FF6118` | Plus Jakarta Sans | Tokens de zutool |
| `zenith` | `#4051B5` (índigo) | Inter | Tema de MkDocs de Zenith (índigo, Inter, JetBrains Mono). Creada para el piloto de documentación; Zenith no tiene manual de marca |

La marca por defecto se fija en `tokens/config.json`.

## Salidas

`pnpm tokens` genera `tokens/dist/` y valida. Nadie edita `dist/` a mano.

| Archivo | Para qué |
|---|---|
| `tokens.css` | Todas las marcas: la de por defecto en `:root`, las demás con `data-brand` |
| `brands/<marca>.css` | Una sola marca en `:root` (se importa como `@zuccadev-labs/zuix-tokens/css/<marca>.css`) |
| `tailwind.css` | Puente a utilidades de Tailwind v4 (`@theme inline`) |
| `docusaurus.css` | Mapa a las variables del tema clásico de Docusaurus |
| `tokens.json` | Todo el contrato, para herramientas y agentes |
| `compat/<proyecto>.css` | Capa de compatibilidad: variables antiguas de un proyecto como alias de tokens (se importa como `@zuccadev-labs/zuix-tokens/compat/<proyecto>.css`). Ver [Migración](./07-migracion.md) |

## Temas

Claro y oscuro redefinen los tokens semánticos. Se elige con `data-theme` en `<html>`. Sin ese atributo
se sigue la preferencia del sistema.

## Crear una marca

Pasos y ejemplo en [Cambiar de marca](../agents/01-marca.md).

## Validación

`pnpm tokens` comprueba, por marca y tema, que no falte ningún token obligatorio y que ocho pares de
texto y fondo cumplan el contraste mínimo. Hoy pasan las tres marcas en ambos temas. También valida
las capas de compatibilidad de `tokens/compat/`: cada variable antigua con destino y cada token destino
existente.

## Reglas

- Un token que solo usa una aplicación se queda en esa aplicación.
- No se añade un token si uno existente expresa lo mismo.

## Sin verificar

El puente de Tailwind (`tailwind.css`) se genera pero no se ha probado en una aplicación: la suite no
usa Tailwind.
