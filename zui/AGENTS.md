# Zui · guía para agentes

Formato: reglas → patrones → verificación. Un cambio está terminado cuando la verificación pasa.

## Reglas

0. **El contrato es el marcado, no React.** Un componente es HTML con clases `z-*` y atributos de estado,
   más su CSS. El `.tsx` es el binding de React que produce ese marcado. Toda la apariencia tiene que
   funcionar copiando el HTML a una página sin React (`zui/html.json`, `docs/agents/04-otros-frameworks.md`).

1. **Solo tokens.** El CSS lee `var(--z-*)`. Nunca un color literal (`#hex`, `rgb()`, `hsl()`), nunca un
   primitivo de marca (`--zp-*`). La lista de tokens está en `tokens/dist/tokens.json`.
2. **Sin apariencia en línea.** `style={{…}}` solo admite maquetación calculada (posición, tamaño,
   transformaciones) y variables locales (`"--z-algo": valor`). Color, fondo, borde, sombra, radio y
   fuente van en la hoja de estilos.
3. **Iconos de `@zuccadev-labs/zuix-zicon`.** `<Icon name="…" />`. Sin emojis, sin SVG incrustado a mano. Si no existe un
   icono para el concepto, se informa; no se inventa.
4. **Clases con prefijo `z-`**, estilo BEM: `.z-btn`, `.z-btn__icon`, `.z-btn--primary`. Estado por atributo:
   `[data-state]`, `[data-size]`, `[aria-selected]`, `[disabled]`.
5. **Cristal solo en el cromo.** `.z-liquid` para paneles, barras, menús y diálogos. Texto denso sobre
   `.z-solid`.
6. **Accesibilidad no opcional.** Lo interactivo complejo (diálogos, menús, pestañas, popovers) usa las
   primitivas propias de `src/primitives/` (React) sobre la lógica de `src/core/`, según el patrón APG de cada
   widget. Sin bibliotecas de UI: `radix-ui` y `@radix-ui/*` están vetados por lint. Todo control tiene nombre
   accesible, foco visible y uso con teclado.
7. **Sin dominio.** Pagos, reservas, mapas o clima viven en la aplicación, no aquí.
8. **Sin dependencias nuevas** sin justificarlo en el informe del cambio.
9. **Texto visible por props.** Los componentes no fijan idioma: las etiquetas llegan por props, con valor
   por defecto en inglés.

## Estructura

```
src/components/<grupo>/<Componente>.tsx            implementación
src/components/<grupo>/<Componente>.manifest.json  contrato legible por máquina
src/components/<grupo>/index.ts                    exportaciones del grupo
src/styles/<grupo>.css                             estilos del grupo, dentro de @layer zui.<grupo>
src/styles/native.css                              neutraliza <dialog>, [popover] y <button> para el contrato HTML
src/core/*.ts                                      lógica compartida, sin React ni efectos al importar: colocación,
                                                   foco itinerante, typeahead, capas, foco, presencia, fechas…
src/primitives/*                                   primitivas de React sobre core: diálogo (<dialog>), capa
                                                   (popover), menú, slot, hooks, campo nativo oculto
src/dom/index.ts                                   comportamiento sin framework (@zuccadev-labs/zuix-zui/dom), sobre core
```

Grupos: `actions`, `forms`, `data`, `feedback`, `content`, `overlay`, `navigation`, `carousel`.

## Patrón de componente

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ variant = "secondary", size = "md", icon, loading, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cx("z-btn", `z-btn--${variant}`, className)}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      disabled={rest.disabled}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
```

```css
@layer zui.actions {
  .z-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--z-space-2);
    height: var(--z-control-height-md); padding: 0 var(--z-space-4);
    border-radius: var(--z-button-radius); border: 1px solid var(--z-line);
    background: var(--z-surface); color: var(--z-fg);
    font-weight: var(--z-weight-semibold); font-size: var(--z-text-body);
    transition: background var(--z-duration-fast) var(--z-ease-standard);
  }
  .z-btn:hover:not(:disabled) { background: var(--z-surface-2); }
  .z-btn:focus-visible { outline: none; box-shadow: var(--z-focus-ring); }
  .z-btn--primary { background: var(--z-button-primary-bg); color: var(--z-button-primary-fg); border-color: transparent; }
  .z-btn[data-size="sm"] { height: var(--z-control-height-sm); }
}
```

## Manifiesto

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
  "tokens": ["button-radius", "button-primary-bg", "button-primary-fg", "surface", "surface-2", "line", "fg", "focus-ring", "control-height-md"],
  "classes": ["z-btn"],
  "a11y": "Elemento button nativo. Con `loading` expone aria-busy y aria-disabled: no actúa, pero conserva el foco.",
  "examples": [
    { "title": "Primario con icono", "code": "<Button variant=\"primary\" icon=\"plus\">New project</Button>" }
  ],
  "origin": "Button de un design system previo; variantes de zutool."
}
```

Campos obligatorios: `name`, `group`, `description`, `import`, `props`, `tokens`, `classes`, `examples`.

Campos del contrato HTML: `behavior` (`none` | `dom` | `react`; se deduce si falta) y `html` (lista de
`{ title, code, script? }`) cuando el marcado no sale del render estático, como en lo que va por portal.

## Lógica compartida

- Una sola lógica para React y para el modo DOM: lo que no depende de React vive en `src/core/` y lo consumen
  `src/primitives/`, `src/components/` y `src/dom/`. No se duplica un cálculo en los dos lados.
- `src/core/` no importa React ni toca el documento al cargarse. Un módulo nuevo lleva su prueba en
  `tests/unit/` y su entrada en la lista `COVERED` de `tests/unit/run.mjs`.
- Plataforma primero: `<dialog>` + `showModal()` para lo modal, `popover="manual"` para lo flotante, `useId`,
  `ref` como prop. El marcado que emite React es el del contrato (`html.json`).
- La dirección (RTL) se lee del DOM (`core/dir`), no de una prop ni de un proveedor.

## Si falta algo

- **Falta una variante:** se añade al componente y a su manifiesto. No se resuelve con una clase suelta en
  la pantalla.
- **Falta un token:** se propone en `tokens/src/base.json` (nivel `component`), referenciando un semántico.
  No se escribe el valor literal.
- **Falta un icono:** se informa.

## Verificación

Desde la raíz de zuix:

```
pnpm style-audit     # color, prim, token, emoji, inline: todo en 0
pnpm typecheck   # sin errores
pnpm manifest    # todo componente exportado tiene manifiesto válido
pnpm html        # el contrato HTML se regenera
pnpm test:html   # si tocaste zui/dom, native.css o un componente con behavior "dom"
```
