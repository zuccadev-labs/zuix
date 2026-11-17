# Tokens

`@zuccadev-labs/zuix-tokens` es la fuente única de los valores de diseño. Iconos, componentes, layouts y
documentación leen de aquí. Cambiar de marca es añadir o editar un archivo en `tokens/brands/`.

## Tres niveles

| Nivel | Qué contiene | Variable CSS | Quién lo edita |
|---|---|---|---|
| Primitivo | Paleta en bruto de la marca | `--zp-red-500` | La marca |
| Semántico | Propósito | `--z-accent`, `--z-surface`, `--z-fg` | La marca, al asignar primitivos |
| Componente | Uso concreto | `--z-card-bg`, `--z-button-radius` | El sistema; rara vez la marca |

Los componentes solo leen tokens semánticos y de componente. Nunca primitivos; la auditoría de estilo lo
comprueba.

## Familias

| Familia | Tokens |
|---|---|
| Texto | `fg`, `fg-muted`, `fg-subtle`, `fg-on-accent`, `canvas-fg`, `canvas-fg-muted` |
| Superficie | `surface`, `surface-2`, `surface-3`, `surface-solid`, `overlay`, `inset`, `line`, `line-strong`, `row-hover` |
| Acento | `accent`, `accent-hover`, `accent-soft`, `accent-text`, `accent-solid`, `accent-solid-hover`, `accent-ring` |
| Estado | `success`, `warning`, `danger`, `info`, cada uno con `-soft`, `-text` y `-solid` |
| Material | `glass-bg`, `glass-border`, `glass-highlight`, `glass-specular`, `glass-shadow`, `glass-blur`, `glass-saturate`, `canvas`, `canvas-gradient` |
| Tipografía | `font-display`, `font-sans`, `font-mono`, `text-*`, `weight-*`, `leading-*`, `tracking-*` |
| Espaciado | `space-0` a `space-20` |
| Forma | `radius-xs`, `sm`, `md`, `lg`, `xl`, `panel`, `full` |
| Elevación | `shadow-sm`, `md`, `lg` |
| Movimiento | `duration-fast`, `normal`, `slow`; `ease-standard`, `out`, `spring` |
| Capas | `layer-sticky`, `overlay`, `menu`, `dialog`, `popover`, `tooltip`, `toast`, `top` |
| Layout | `rail-width`, `sidebar-width`, `inspector-width`, `header-height`, `shell-gap`, `stage-pad-x`, `stage-pad-y`, `content-max`, `prose-max`, `touch-target` |
| Componente | `focus-ring`, `scrim`, `control-height-sm`, `md`, `lg`, `control-radius`, `control-bg`, `control-border`, `control-border-hover`, `button-*`, `card-*`, `panel-radius`, `popup-*`, `tooltip-bg`, `reading-bg`, `code-bg` |

La lista completa, con su valor por marca y tema, está en `tokens.json` y en la página [Tokens](/tokens).

### Qué token de color va en cada sitio

El color de marca y los de estado tienen tres usos y un token para cada uno. Mezclarlos es la forma más
frecuente de perder contraste.

| Uso | Token | Contraste que garantiza |
|---|---|---|
| Relleno, borde, icono, indicador | `accent`, `success`, `warning`, `danger`, `info` | 3:1 frente a la superficie que lo rodea |
| Texto de color y enlaces | `accent-text`, `success-text`, `warning-text`, `danger-text`, `info-text` | 4.5:1 sobre todas las superficies y sobre su propio fondo `-soft` |
| Fondo con texto encima (botón primario, insignia sólida) | `accent-solid`, `success-solid`, `warning-solid`, `danger-solid`, `info-solid` | 4.5:1 con `fg-on-accent` en los dos temas |
| Fondo tenue de un aviso o una insignia | `accent-soft`, `success-soft`… | El texto que va encima es el `-text` correspondiente |

Los `-text` son el color original mezclado con `fg` hasta llegar al mínimo; los `-solid`, mezclado con negro.
El anillo de foco (`accent-ring`, y con él `focus-ring`) usa `accent-text`, opaco: llega a 3:1 sobre
cualquier superficie.

### Objetivo táctil

`touch-target` es el objetivo táctil mínimo. Vale `0px` y pasa a `40px` cuando el puntero principal es el
dedo (`@media (pointer: coarse)`). `control-height-sm` y `control-height-md` se definen como
`max(30px, touch-target)` y `max(36px, touch-target)`: con ratón miden 30 y 36 px; en un teléfono, 40.
Para conservar los tamaños de ratón en táctil: `:root { --z-touch-target: 0px }` después de `tokens.css`.

## Marcas incluidas

| Marca | Acento | Fuentes | Origen |
|---|---|---|---|
| `dazlabs` (por defecto) | `#E74327` | Poppins, DM Sans, JetBrains Mono | Manual de marca DAZLABS, sobre el material de zutool |
| `zutool` | `#FF6118` | Plus Jakarta Sans | Tokens de zutool |
| `zenith` | Índigo | Inter, JetBrains Mono | La creé para el piloto local de zudocs sobre Zenith |

La marca por defecto se fija en `tokens/config.json`. Cómo crear una: [Cambiar de marca](../agents/01-marca.md).

## Temas y preferencias del sistema

Claro y oscuro redefinen los tokens semánticos. Se elige con `data-theme` en `<html>`; sin ese atributo se
sigue `prefers-color-scheme`.

| Preferencia | Qué cambia en los tokens |
|---|---|
| `pointer: coarse` | `touch-target` pasa a 40 px |
| `prefers-contrast: more` | `fg-muted` pasa a `fg`, líneas y bordes de control se refuerzan, y el cristal y el degradado del fondo se vuelven opacos |
| `forced-colors: active` | Se retiran el degradado del fondo y el destello del cristal, que el sistema no fuerza |

`prefers-reduced-motion` y `prefers-reduced-transparency` se atienden en las hojas de `zui` y `zout`, no en
los tokens ([Accesibilidad](./09-accesibilidad.md)).

## Salidas

`pnpm tokens` genera `tokens/dist/` y valida. Nadie edita `dist/` a mano.

| Archivo | Se importa como | Para qué |
|---|---|---|
| `tokens.css` | `@zuccadev-labs/zuix-tokens/tokens.css` | Todas las marcas: la de por defecto en `:root`, las demás con `data-brand` |
| `brands/<marca>.css` | `…/css/<marca>.css` | Una sola marca en `:root` |
| `tailwind.css` | `…/tailwind.css` | Puente a utilidades de Tailwind 4 (`@theme inline`) |
| `docusaurus.css` | `…/docusaurus.css` | Mapa a las variables del tema clásico de Docusaurus |
| `tokens.json` | `…/tokens.json` | Todo el contrato, para herramientas y agentes |
| `dtcg/<marca>.<tema>.tokens.json` | `…/dtcg/<archivo>` | Formato Design Tokens (DTCG 2025.10), un archivo autocontenido por marca y tema |
| `compat/<proyecto>.css` | `…/compat/<proyecto>.css` | Capa de compatibilidad: variables antiguas de un proyecto como alias de tokens ([Migración](./07-migracion.md)) |

### Tailwind 4

```css
@import "tailwindcss";
@import "@zuccadev-labs/zuix-tokens/css/dazlabs.css";
@import "@zuccadev-labs/zuix-tokens/tailwind.css";
```

Cada token queda como utilidad (`bg-surface`, `text-accent-text`, `bg-success-solid`, `rounded-panel`). La
variante `dark:` sigue al tema de los tokens: `data-theme="dark"` o, sin atributo, el sistema. zuix no usa
Tailwind; el puente está para las aplicaciones que sí. Lo probé con Tailwind 4.3 en un proyecto mínimo, no
en una aplicación completa.

### Design Tokens (DTCG)

Los archivos de `dtcg/` siguen el formato del
[Design Tokens Community Group](https://www.designtokens.org/tr/2025.10/format/), versión 2025.10. Los
colores van con espacio y componentes; lo que el formato no expresa (`clamp()`, `max()`, degradados,
unidades `em` y `ch`) viaja con su valor CSS dentro de `$extensions`, bajo la clave
`io.github.zuccadev-labs.zuix`. Los validé con `@terrazzo/parser` 2.10. Sirven para llevar los tokens a Figma o a
otra herramienta que lea el formato; no los he importado en ninguna.

## Validación

`pnpm tokens` falla, con la marca, el tema y el par exactos, si:

- a una marca le falta un token obligatorio, define uno que solo existe en un tema o tiene una referencia
  circular; cada marca se comprueba además contra `schema/brand.schema.json`;
- un token de texto no llega a 4.5:1 sobre alguna superficie (la matriz completa texto × superficie);
- un par que usan de verdad las hojas de `zui` y `zout` no llega a su mínimo: 4.5:1 en texto, 3:1 en iconos,
  indicadores y bordes de control. Los pares se leen de las propias hojas;
- el anillo de foco o el borde de un control no llegan a 3:1 frente a lo que los rodea;
- una capa de compatibilidad deja una variable antigua sin destino.

Las superficies translúcidas se componen sobre el fondo de la aplicación, incluidos los extremos de su
degradado: es una cota conservadora. Hoy son 654 comprobaciones entre las tres marcas y los dos temas, y
pasan todas. Por qué lo mido así: [Accesibilidad medida](../investigations/09-accesibilidad-medida.md).

## Reglas

- Un token que solo usa una aplicación se queda en esa aplicación.
- No se añade un token si uno existente expresa lo mismo.
- Texto de color con `-text`, fondo con texto con `-solid`. El color sin sufijo no lleva texto.
