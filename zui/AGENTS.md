# Zui · guía para agentes

Guía para los agentes de IA que usan o extienden `@zuccadev-labs/zuix-zui`. Formato: reglas → patrones →
verificación. Un cambio está terminado cuando la verificación pasa.

## Reglas

0. **El contrato es el marcado, no React.** Un componente es HTML con clases `z-*` y atributos de estado,
   más su CSS. El `.tsx` es el binding de React que produce ese marcado. Toda la apariencia tiene que
   funcionar copiando el HTML a una página sin React (`html.json`).
1. **Solo tokens.** El CSS lee `var(--z-*)`. Nunca un color literal (`#hex`, `rgb()`, `hsl()`), nunca un
   primitivo de marca (`--zp-*`). La lista de tokens está en `tokens.json`, en `@zuccadev-labs/zuix-tokens`.
2. **Un token por uso del color.** Texto de color: `--z-accent-text`, `--z-danger-text`… Fondo con texto
   encima: `--z-accent-solid`, `--z-danger-solid`… con `--z-fg-on-accent`. `--z-accent`, `--z-success`,
   `--z-warning`, `--z-danger` e `--z-info` son para rellenos, bordes e iconos. `pnpm tokens` lee las hojas,
   mide cada par y falla si el texto no llega a 4.5:1 o un indicador a 3:1.
3. **Sin apariencia en línea.** `style={{…}}` solo admite maquetación calculada (posición, tamaño,
   transformaciones) y variables locales (`"--z-algo": valor`). Color, fondo, borde, sombra, radio y
   fuente van en la hoja de estilos.
4. **Iconos de `@zuccadev-labs/zuix-zicon`.** `<Icon name="…" />`. Sin emojis, sin SVG incrustado a mano. Si
   no existe un icono para el concepto, se informa; no se inventa.
5. **Clases con prefijo `z-`**, estilo BEM: `.z-btn`, `.z-btn__spinner`, `.z-btn--primary`. Estado por atributo:
   `[data-state]`, `[data-size]`, `[aria-selected]`, `[disabled]`.
6. **Propiedades lógicas.** `margin-inline-start`, `inset-inline-end`, `padding-block`. Nunca `left`, `right`,
   `margin-left`. Un icono direccional se refleja en `[dir="rtl"]`.
7. **Cristal solo en el cromo.** `.z-liquid` para paneles, barras, menús y diálogos. Texto denso sobre
   `.z-solid`.
8. **Accesibilidad no opcional.** Lo interactivo complejo (diálogos, menús, pestañas, popovers) usa las
   primitivas de `src/primitives/` sobre la lógica de `src/core/`, según el patrón de
   [APG](https://www.w3.org/WAI/ARIA/apg/) de cada widget. Todo control tiene nombre accesible, foco visible
   (también con `forced-colors`) y uso con teclado.
9. **Sin dependencias.** El paquete solo depende de `@zuccadev-labs/zuix-tokens`. No se añade una biblioteca
   de UI; el linter rechaza su importación. Cualquier otra dependencia nueva necesita mi aprobación.
10. **Sin dominio.** Pagos, reservas, mapas o clima viven en la aplicación, no aquí.
11. **Texto visible por props.** Los componentes no fijan idioma: las etiquetas llegan por props, con valor
    por defecto en inglés.
12. **`"use client"`** en la primera línea de un módulo con hooks, contexto o manejadores de eventos propios.
    Un componente de solo marcado no lo lleva: así se renderiza en un Server Component.

## Estructura

```
src/components/<grupo>/<Componente>.tsx            implementación
src/components/<grupo>/<Componente>.manifest.json  contrato legible por máquina
src/components/<grupo>/index.ts                    exportaciones del grupo
src/styles/<grupo>.css                             estilos del grupo, dentro de @layer zui.<grupo>
src/styles/native.css                              neutraliza <dialog>, [popover] y <button> para el contrato HTML
src/core/*.ts                                      lógica compartida, sin React ni efectos al importar: colocación,
                                                   foco itinerante, búsqueda por letra, capas, foco, presencia, fechas…
src/primitives/*                                   primitivas de React sobre core: diálogo (<dialog>), capa
                                                   (popover), menú, slot, hooks, campo nativo oculto
src/dom/*.ts                                       comportamiento sin framework (@zuccadev-labs/zuix-zui/dom), sobre core
```

Grupos: `actions`, `forms`, `agenda`, `data`, `charts`, `feedback`, `content`, `media`, `effects`, `overlay`, `navigation`, `carousel`, `time`, `terminal`, `chat`, `ai`, `dashboard`, `people`, `nodes`.

## Patrones

### Componente de solo marcado

```tsx
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { withRef } from "../../react-compat";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}

export const Button = withRef(function Button({ variant = "secondary", size = "md", icon, loading, className, children, disabled, onClick, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx("z-btn", `z-btn--${variant}`, className)}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      disabled={disabled}
      {...(loading ? { type: "button" as const, onClick: undefined } : { onClick })}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
});
```

- `ref` es una prop más. Un componente que la acepta se declara con `withRef` (`src/react-compat.ts`):
  `export const Button = withRef(function Button(…) {…})`. En React 19 es la misma función; en React 18 la
  envuelve en `forwardRef`. El binding funciona con React 18.2+ y 19.
- En carga el botón lleva `aria-disabled`, no `disabled`: conserva el foco. No hay manejador propio, así que
  el módulo no necesita `"use client"`.

```css
@layer zui.actions {
  .z-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--z-space-2);
    height: var(--z-control-height-md); padding-inline: var(--z-space-3-5);
    border-radius: var(--z-button-radius); border: 1px solid var(--z-glass-border);
    background: var(--z-surface-2); color: var(--z-fg);
    box-shadow: inset 0 1px 0 var(--z-glass-highlight);
    font-weight: var(--z-weight-medium); font-size: var(--z-text-body);
    transition: background var(--z-duration-fast) var(--z-ease-standard), scale var(--z-duration-press) var(--z-ease-out);
  }
  @media (hover: hover) { .z-btn:hover:not(:disabled) { background: var(--z-surface-3); } }
  .z-btn:focus-visible { outline: var(--z-focus-width) solid var(--z-accent-ring); outline-offset: var(--z-focus-offset); }
  .z-btn:active:not(:disabled) { scale: 0.97; }
  .z-btn--primary { background: var(--z-button-primary-bg); color: var(--z-button-primary-fg); border-color: transparent; }
  .z-btn--danger { background: var(--z-danger-soft); color: var(--z-danger-text); }
  .z-btn[data-size="sm"] { height: var(--z-control-height-sm); border-radius: var(--z-control-radius-sm); }
}
```

- `:hover` va dentro de `@media (hover: hover)`.
- El foco se dibuja con contorno: `outline: var(--z-focus-width) solid var(--z-accent-ring)` y
  `outline-offset: var(--z-focus-offset)`. Sigue al radio de la pieza y sobrevive a los colores forzados. En
  un campo, el anillo va en `:focus-within` del contenedor, separado 1 px; dentro de un control compuesto
  (opción de una lista, pestaña de un segmentado), con desplazamiento negativo para no recortarse. Un estado
  que solo cambia el fondo necesita además su regla en `@media (forced-colors: active)` de `base.css`.
- Forma: rectángulo de esquinas redondeadas, no píldora. Radios concéntricos por tamaño
  (`control-radius-sm` 8, `control-radius` 10, `control-radius-lg` 12); el radio de una pista es el de su
  opción más el relleno. `radius-full` solo para lo circular (avatar, punto, interruptor, radio).
- Texto de peligro con `--z-danger-text` sobre `--z-danger-soft`.

### Lógica compartida

- Una sola lógica para React y para el modo DOM: lo que no depende de React vive en `src/core/` y lo consumen
  `src/primitives/`, `src/components/` y `src/dom/`. No se duplica un cálculo en los dos lados.
- `src/core/` no importa React ni toca el documento al cargarse. Un módulo nuevo lleva su prueba en
  `tests/unit/` y su entrada en la lista `COVERED` de `tests/unit/run.mjs`.
- Plataforma primero: `<dialog>` + `showModal()` para lo modal, `popover="manual"` para lo flotante, `useId`.
  El marcado que emite React es el del contrato (`html.json`).
- La dirección (RTL) se lee del DOM (`core/dir`), no de una prop ni de un proveedor.
- El modo DOM escribe el texto de la aplicación con `textContent` y su marcado propio con `setMarkup`
  (`src/dom/shared.ts`). Un atributo que nombra otro elemento se resuelve con `byRef`.

### Manifiesto

```json
{
  "name": "Button",
  "group": "actions",
  "description": "Acción principal o secundaria.",
  "import": "import { Button } from \"@zuccadev-labs/zuix-zui\"",
  "props": [
    { "name": "variant", "type": "enum", "values": ["primary", "secondary", "ghost", "danger"], "default": "secondary", "description": "Intención." },
    { "name": "size", "type": "enum", "values": ["sm", "md", "lg"], "default": "md" },
    { "name": "icon", "type": "IconName", "description": "Icono a la izquierda del texto." },
    { "name": "loading", "type": "boolean", "default": false }
  ],
  "states": ["rest", "hover", "focus", "active", "disabled", "loading"],
  "tokens": ["button-radius", "button-primary-bg", "button-primary-fg", "surface-2", "surface-3", "line", "fg", "focus-ring", "control-height-md"],
  "classes": ["z-btn"],
  "a11y": "Elemento button nativo. Con `loading` expone aria-busy y aria-disabled: no actúa, pero conserva el foco.",
  "examples": [
    { "title": "Primario con icono", "code": "<Button variant=\"primary\" icon=\"plus\">New project</Button>" }
  ]
}
```

Campos obligatorios: `name`, `group`, `description`, `import`, `props`, `tokens`, `classes`, `examples`.

Cada miembro propio de `<Nombre>Props` va en `props` (los atributos reenviados, `id`, `className`, `ref` y
`children`, no hacen falta): `pnpm docs:coverage` falla si falta uno. Un componente nuevo se nombra además en la
tabla de su grupo de `docs/users/03-zui.md`, y una función nueva de `/dom/<familia>` en «Todas las funciones» de
`docs/users/06-frameworks.md`.

Campos del contrato HTML: `behavior` (`none` | `dom` | `react`; se deduce si falta) y `html` (lista de
`{ title, code, script? }`) cuando el marcado no sale del render estático.

## No hacer

| En lugar de | Usa |
|---|---|
| `color: var(--z-accent)` en un texto | `var(--z-accent-text)` |
| `background: var(--z-success)` con texto encima | `var(--z-success-solid)` y `var(--z-fg-on-accent)` |
| `margin-left`, `right: 0`, `text-align: left` | `margin-inline-start`, `inset-inline-end: 0`, `text-align: start` |
| Un foco sin indicador | `outline: var(--z-focus-width) solid var(--z-accent-ring)` en `:focus-visible` |
| `border-radius: var(--z-radius-full)` en un botón, campo o pestaña | `var(--z-button-radius)` o `var(--z-control-radius*)` |
| Un `div` flotante con `z-index` | Un elemento `popover` con las primitivas de `src/primitives/` |
| `disabled` para un botón en carga | `aria-disabled` |
| `forwardRef`, o `ref` en las props sin `withRef` | `withRef(function X(…) {…})`, con `ref` en las props |
| `inert={true}`, `popoverTarget=` | `inert={inertProp(x)}`, `{...popoverTarget(id)}` (React 18 no los conoce) |
| Leer `child.props.ref` o `child.ref` | `elementRef(child)` |
| Una clase suelta en la pantalla | Una variante en el componente y en su manifiesto |

## Cuando falta algo

- **Falta una variante:** se añade al componente y a su manifiesto.
- **Falta un token:** se propone en `tokens/src/base.json` (nivel `component`), referenciando un semántico.
  No se escribe el valor literal.
- **Falta un icono:** se informa.

## Verificación

Desde la raíz de zuix:

```
pnpm tokens       # el contraste de los pares que usan las hojas
pnpm style-audit  # color, prim, token, emoji, inline: todo en 0
pnpm lint         # Biome y la regla de "use client"
pnpm typecheck    # sin errores
pnpm manifest     # todo componente exportado tiene manifiesto válido
pnpm barrels      # todo componente con manifiesto se exporta desde la raíz del paquete
pnpm html         # el contrato HTML se regenera
pnpm docs:coverage # el componente, sus props y sus funciones aparecen en la documentación de usuario
pnpm test:unit    # si tocaste src/core o lógica cubierta
pnpm test:html    # si tocaste src/dom, native.css o un componente con behavior "dom"
pnpm test:browser # si tocaste el binding de un componente interactivo
```
