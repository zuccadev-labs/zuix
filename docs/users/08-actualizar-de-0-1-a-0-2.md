# Actualizar de 0.1 a 0.2

La `0.2.0` es la primera versión con cambios incompatibles. Los hice todos juntos a propósito: mientras la
suite está en `0.x` prefiero romper una vez, con una guía, que arrastrar decisiones que ya sé que son malas.
Esta página reúne todo lo que hay que tocar en una aplicación que usa la `0.1.0`. El detalle de cada cambio
está en el `CHANGELOG.md` de su paquete.

Hay tres motivos detrás de casi todo:

1. **Sin bibliotecas de UI.** El binding de React estaba hecho sobre `radix-ui`. Ahora usa primitivas propias
   sobre la plataforma (`<dialog>`, Popover API), con la misma lógica que el modo sin framework. Cambia el
   marcado de las capas y desaparecen las variables `--radix-*`.
2. **Contraste medido.** La validación de tokens mide ahora los pares de color que las hojas usan de verdad.
   Varios no llegaban al mínimo de WCAG 2.2 AA y cambiaron de valor.
3. **Node 20 terminó su soporte** el 2026-04-30. El mínimo pasa a Node 22.12.

## Antes de empezar

| Requisito | 0.1 | 0.2 |
|---|---|---|
| Node | 20 o posterior | 22.12 o posterior |
| React y React DOM (solo para el binding) | 19 | 19. React 18 no se admite |
| Navegadores | Sin línea declarada | Chrome y Edge 116, Firefox 125, Safari 17, Safari de iOS 18.3 ([Compatibilidad](./10-compatibilidad.md)) |
| Dependencias que instala `zui` | `zuix-tokens` y `radix-ui` | Solo `zuix-tokens` |

Los cinco paquetes se actualizan juntos:

```
pnpm up "@zuccadev-labs/*"
```

Si tu aplicación importaba algo de `radix-ui` o de `@radix-ui/*` aprovechando que `zui` lo instalaba,
decláralo ahora en tu propio `package.json`: ya no llega de forma transitiva.

## Lista rápida

Búsquedas que encuentran casi todo lo que hay que cambiar en el código de una aplicación:

```
grep -rnE -- "--radix-|data-radix-|radix-" src/           # variables y atributos que ya no existen
grep -rnE "z-overlay-scrim|\[role=.?dialog.?\]" src/       # velo y selectores de diálogo
grep -rnE "data-elevated|asChild|forceMount" src/          # atributos y props retirados
grep -rnE "<ToastProvider[^>]* label=" src/                # prop renombrada
grep -rnE "<Popover" src/                                  # ahora exige label o aria-labelledby
grep -rnE 'data-side="(left|right)"' src/                  # tiradores de zout escritos a mano
```

## CSS y marcado

Afecta a quien escribió selectores propios sobre el marcado de `zui`, y a quien escribió a mano el HTML del
contrato.

### Diálogos

`Modal`, `Drawer`, `ConfirmDialog` y `CommandPalette` de React pintan un `<dialog>`, como ya hacía el modo
sin framework. Antes eran un `div[role=dialog]` con un `div.z-overlay-scrim` aparte.

| Antes | Ahora |
|---|---|
| `.z-modal[role=dialog]` | `dialog.z-modal` |
| `.z-overlay-scrim` y sus modificadores | `dialog::backdrop`. La clase ya no existe |
| Sin `title`, un `h2.z-sr-only` daba el nombre | Sin `title`, el nombre va en `aria-label` |
| `[data-elevated]` para subir una capa | No existe: todo va en la capa superior del navegador |

En pruebas de extremo a extremo, un diálogo abierto se localiza con `dialog:modal` o `dialog[open]`. El fondo
queda inerte por el propio navegador: ya no lleva `aria-hidden`.

### Variables CSS

No queda ningún `--radix-*`, `data-radix-*` ni id `radix-…`.

| Antes | Ahora |
|---|---|
| `--radix-select-trigger-width` | `--z-anchor-width` |
| `--radix-*-content-available-height` | `--z-available-height` |
| `--radix-*-content-available-width` | `--z-available-width` |
| `--radix-toast-swipe-move-x`, `-move-y`, `-end-x`, `-end-y` | `--z-toast-swipe-move-x`, `-move-y`, `-end-x`, `-end-y` |
| `--radix-accordion-content-height` | `--z-accordion-content-height` |

### Resto del marcado

| Componente | Qué cambia |
|---|---|
| Toast (React y `toast()`) | La región es `div.z-toast-viewport[role=region]` con nombre y cada aviso un `div.z-toast[role=status\|alert]`. Antes eran `ol` y `li`. La región solo existe mientras hay avisos |
| Menu, ContextMenu (React) | Cada entrada es un `button[role=menuitem]` (antes `div`) y el separador lleva `role="separator"` |
| Select (React) | `role="listbox"` va en `.z-listbox__viewport`, dentro de `.z-listbox`, y las opciones llevan `data-value`. Con `name` o `required`, el campo de formulario es un `<select>` nativo oculto (`.z-native-input`), no un `input[type=hidden]` |
| Checkbox, Switch, Radio | El campo nativo oculto lleva la clase `z-native-input` (antes estilos en línea) y está siempre en el marcado. `RadioGroup` y `SegmentedControl` ya no llevan `dir` ni `tabindex` en el grupo |
| Tabs | Los ids son `…-tab-<valor>` y `…-panel-<valor>`; cada pestaña lleva `data-value` |
| Accordion | La cabecera es un `h2`…`h6` real según `headingLevel` (antes `h3` con `aria-level`). El contenido de una sección cerrada sigue montado, oculto con `hidden`. `.z-accordion` lleva `data-type` |
| Slider (React) | Los tiradores son hijos directos de `.z-slider` y la pista se sitúa con `inset-inline-start` y `-end`. El contenedor lleva `data-min`, `data-max`, `data-step` y `data-value` |

El marcado que emite React es ahora exactamente el del contrato (`html.json`): se puede copiar a una página
sin React.

## Props y tipos de React

| Componente | Antes | Ahora |
|---|---|---|
| `Popover` | `label` opcional | El nombre accesible es obligatorio en los tipos: `label`, o `aria-labelledby` con el id de un encabezado del panel |
| `ToastProvider` | `label` | `regionLabel`: nombre de la región, por defecto `Notifications (F8)` |
| `Checkbox`, `Switch`, `Radio`, `RadioGroup`, `Slider`, `Toggle` | Sus `*Props` extendían los tipos de la biblioteca anterior | Son los atributos del elemento más las props propias (`checked`, `defaultChecked`, `onCheckedChange`, `value`, `onValueChange`, `pressed`, `onPressedChange`…). Desaparecen `asChild`, `dir`, `loop` y `forceMount` |
| `Slider` con varios tiradores | Enviaba `name[]` | Envía un campo por tirador con el mismo `name` |
| `Button`, `IconButton` con `loading` | `disabled` | `aria-disabled="true"`. Ver abajo |

`NavLink asChild` se mantiene.

## Comportamiento

Nada de esto exige cambiar código, pero cambia lo que ve y lo que hace quien usa la aplicación. Conviene
repasar las pruebas que dependan de ello.

| Qué | Antes | Ahora |
|---|---|---|
| `Button` e `IconButton` con `loading` | Deshabilitados: el foco del teclado se perdía al empezar la carga | `aria-disabled`: no ejecutan `onClick` ni envían el formulario (pasan a `type="button"` mientras cargan), pero conservan el foco. Un selector `:disabled` ya no los encuentra |
| Dirección de escritura | `Tabs`, `Menu`, `Slider`, `RadioGroup` y `SegmentedControl` de React la leían de una prop o de un proveedor | Se lee del DOM: dentro de `dir="rtl"` las flechas se reflejan sin configurar nada |
| Escape | En un `SearchInput` con texto dentro de un `Modal`, limpiaba el campo y además cerraba el diálogo | Cierra solo la capa de arriba y respeta un evento ya cancelado: la primera pulsación limpia el campo y la segunda cierra el diálogo. En un submenú cierra ese nivel |
| `SegmentedControl`, `RadioGroup` | — | Las flechas mueven el foco y la selección, con vuelta al otro extremo |
| `Menu` | — | Las flechas dan la vuelta del último al primero; abierto con el puntero, el foco va al menú sin resaltar ninguna entrada |
| `Popover` no modal | — | Salir con Tab por un extremo lo cierra y devuelve el foco al disparador. `modal` retiene el foco y marca `aria-modal`, pero ya no bloquea el puntero fuera del panel |
| `DatePicker required` | El botón llevaba `aria-required` | La obligatoriedad la valida un campo nativo oculto, que impide enviar el formulario vacío |
| `confirm()` de `zui/dom` | Escape no hacía nada | **Escape cancela** (resuelve `false`), como `ConfirmDialog` en React. El clic en el velo sigue sin cerrar |
| `ConfirmDialog` | Cerrar con Escape solo llamaba a `onOpenChange(false)` | Llama también a `onCancel` |
| Tooltip (React y `data-z-tooltip`) | La burbuja ignoraba el puntero | La burbuja recibe el puntero y Escape la cierra (WCAG 1.4.13) |
| `Link disabled` | Ejecutaba `onClick` | No lo ejecuta |
| `z:close` en un `<dialog>` | Solo al cerrar con `closeDialog()` | También con `dialog.close()` y con `<form method="dialog">`; `data-state` pasa a `closed` |
| Casilla (`role="checkbox"`) en `zui/dom` | Intro la cambiaba | Solo Espacio, como en React |
| Clic en el velo de un `<dialog>` | Soltar sobre el velo cerraba | Solo cierra si la pulsación empezó también en el velo |
| Diálogos en `zui/dom` | — | Bloquean el desplazamiento de la página y Tab da la vuelta dentro del diálogo |
| `Pagination`, `DataTable`, `CommandPalette` | — | `page` se redondea; los `NaN` se ordenan al final; la búsqueda de la paleta ignora acentos |

## Tokens y color

Ningún token se elimina ni se renombra. Cambian valores, y hay tokens nuevos que conviene usar.

### Valores que cambian

| Token | Qué cambia | Efecto visible |
|---|---|---|
| `--z-fg-subtle` | Más opaco en todas las marcas y temas | El texto sutil se ve algo más marcado |
| `--z-control-border`, `--z-control-border-hover` | De `--z-line` a `--z-fg` al 50 % y a `--z-fg-muted` | Los campos de formulario tienen un borde más marcado (3:1) |
| `--z-accent-ring`, `--z-focus-ring` | De `--z-accent` al 45 % a `--z-accent-text`, opaco | El anillo de foco es más visible |
| `--z-accent-solid-hover` | Oscurece en lugar de aclarar | El botón primario se oscurece al pasar el puntero |
| Marca `zutool`, tema oscuro | Degradado del fondo atenuado; cristal de 0.66 a 0.82 de opacidad; `fg-muted` y `canvas-fg-muted` más opacos | El cristal deja pasar menos fondo |
| Marca `dazlabs`, tema oscuro | Cristal de 0.66 a 0.72 de opacidad | Igual, más leve |

### Tokens nuevos

| Para | Usa | En lugar de |
|---|---|---|
| Texto de color y enlaces | `--z-accent-text`, `--z-success-text`, `--z-warning-text`, `--z-danger-text`, `--z-info-text` | `--z-accent`, `--z-success`… |
| Fondo con texto encima | `--z-success-solid`, `--z-warning-solid`, `--z-danger-solid`, `--z-info-solid` (y el `--z-accent-solid` que ya existía) | El color sin sufijo |

Si tu aplicación pinta texto con `var(--z-accent)` o `var(--z-danger)`, cámbialo al `-text`: el color sin
sufijo queda para rellenos, bordes e iconos, y como texto no llega a 4.5:1 en todas las superficies.

### Componentes que cambian de color

Los componentes de `zui` ya usan los tokens nuevos. Cambia el tono de: los enlaces (`.z-link`, cuyo hover se
distingue ahora por el subrayado pleno), el texto de peligro (`Button variant="danger"`, errores de `Field`,
entradas de menú con `data-danger`), el texto y el fondo de `Badge` en sus tres variantes, el delta de
`StatTile`, las estrellas vacías de `Rating`, el día de hoy del calendario y el velo de `LoadingOverlay`, que
pasa a ser del color del lienzo.

## Layouts (`zout`)

| Qué | Antes | Ahora | Qué hacer |
|---|---|---|---|
| `TitleBar` | `<div>` | `<header>` (región `banner`). Las clases no cambian | Si ya tienes otro `banner` en la página, `as="div"`. Un selector `div.z-titlebar` pasa a `.z-titlebar` |
| Tirador de los paneles del `Shell` | `data-side="right"` (sidebar) y `"left"` (inspector) | `data-side="end"` y `"start"` | Solo si escribiste el marcado a mano o tienes selectores sobre ese atributo |
| Cierre de una pestaña de `TabStrip` | 18 × 18 px | 24 × 24 px | Nada; revisa si ajustaste el alto de la tira |
| Panel `auto` del `Shell` antes de medirse | Se veía acoplado un instante | No se muestra si no cabe. `.z-shell` es un contenedor de consultas (`container: z-shell / inline-size`) | Nada, salvo que tu CSS declare otro `container-name` sobre `.z-shell` |

## Iconos (`zicon`) y paraguas

No hay cambios incompatibles. `<z-icon hidden>` ahora se oculta de verdad, y `Icon` con `aria-label` deja de
ir con `aria-hidden`. El paraguas gana entradas (`/zui/dom/carousel-gl`, `/tokens/<marca>.css`,
`/tailwind.css`, `/docusaurus.css`).

## Si usas una política de seguridad de contenido

`zui/dom` crea la política de Trusted Types `zuix-zui`. Si tu CSP declara `require-trusted-types-for
'script'`, añade `trusted-types zuix-zui` ([CSP y Trusted Types](./11-csp-y-trusted-types.md)).

## Comprobar el resultado

1. `tsc --noEmit`: los tipos señalan `Popover` sin nombre, `ToastProvider label` y las props retiradas.
2. Abrir cada diálogo, menú y selector de la aplicación, con teclado y con puntero.
3. Repasar en los dos temas las pantallas con texto de color, insignias y formularios.
4. Si tienes pruebas de extremo a extremo, revisar los selectores de diálogo, de avisos y de botones en carga.
