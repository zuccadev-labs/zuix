# Zui

`@zuccadev-labs/zuix-zui` es el sistema de componentes de la suite: 103 componentes en 9 grupos. Cada
componente es un contrato de HTML y CSS que solo lee tokens, así que una marca nueva no modifica componentes
y el mismo marcado sirve en cualquier framework. El paquete trae dos formas de darle vida: el binding de
React y `@zuccadev-labs/zuix-zui/dom`, sin framework ([Frameworks](./06-frameworks.md)).

No depende de ninguna biblioteca de UI. En ejecución solo necesita `@zuccadev-labs/zuix-tokens`;
`@zuccadev-labs/zuix-zicon` es un peer obligatorio y React y React DOM 19 son peers opcionales.

El catálogo en vivo, con el código de cada ejemplo, está en [Componentes](/components).

## Catálogo

| Grupo | Componentes |
|---|---|
| Acciones | Button, ButtonGroup, CopyButton, IconButton, Link, SegmentedControl, Swap, Toggle, ToggleGroup, Toolbar |
| Formularios | Calendar, Checkbox, CheckboxGroup, Combobox, DateField, DateInput, DatePicker, DateRangePicker, DateTimePicker, Editable, Field, Fieldset, FileUpload, Form, Input, InputGroup, Listbox, MonthPicker, NativeSelect, NumberInput, OTPInput, PasswordInput, Radio, RadioGroup, SearchInput, Select, Slider, Switch, TagsInput, Textarea, TimeField, TimePicker, WeekPicker, YearPicker |
| Agenda | CalendarHeatmap, EventCalendar, FreeBusy, HabitCalendar, PerpetualYear, SlotPicker, TimelineView |
| Datos | Avatar, AvatarGroup, Badge, Chip, DataTable, Kbd, Meter, Progress, Rating, StatTile, Table |
| Estado | Alert, Banner, EmptyState, ErrorBoundary, ErrorState, LoadingOverlay, Skeleton, Spinner |
| Contenido | Callout, Card, CardFooter, CardHeader, CodeBlock, Divider, Panel, RelativeTime, Timer |
| Capas | ActionBar, Command, CommandPalette, ConfirmDialog, ContextMenu, Drawer, HoverCard, Menu, Modal, Popover, Toast, Toggletip, Tooltip, Tour |
| Navegación | Accordion, Breadcrumb, Collapsible, Menubar, NavList, Pagination, Stepper, Tabs, Tree |
| Carousel | Carousel |

Cada componente declara en el contrato qué necesita para funcionar:

| `behavior` | Significado | Cuántos |
|---|---|---|
| `none` | Solo CSS. Basta el marcado | 37 |
| `dom` | Necesita `@zuccadev-labs/zuix-zui/dom`, o el binding de React | 65 |

`ErrorBoundary` es el único que solo existe en React: es un límite de errores de React, no un marcado.

## Uso con React

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zicon/all";

import { Button, ToastProvider, useToast } from "@zuccadev-labs/zuix-zui";

function Save() {
  const { toast } = useToast();
  return <Button variant="primary" icon="check" onClick={() => toast({ title: "Saved", intent: "success" })}>Save</Button>;
}

export function App() {
  return <ToastProvider><Save /></ToastProvider>;
}
```

- `ToastProvider` envuelve la aplicación una vez.
- Los textos visibles llegan por props; los valores por defecto están en inglés.
- La clase `z-root` en el contenedor de la aplicación aplica tipografía, foco y selección.
- Los componentes aceptan `ref` como prop, sin `forwardRef`: es la forma de React 19.

### Con Next.js

Los módulos con hooks, contexto o manejadores propios llevan `"use client"`; los de solo marcado se
renderizan como Server Components. `@zuccadev-labs/zuix-zicon/all` se importa dos veces, en `app/layout.tsx`
y en un módulo con `"use client"`, porque Next mantiene un registro de iconos por cada grafo. Ejemplo completo
en [Frameworks](./06-frameworks.md#con-nextjs-app-router).

## Cómo están hechas las capas

| Pieza | Sobre qué va | Qué da el navegador |
|---|---|---|
| `Modal`, `Drawer`, `ConfirmDialog`, `CommandPalette`, `Popover modal` | `<dialog>` abierto con `showModal()` | Capa superior, velo (`::backdrop`, transparente en el Popover) e inercia del resto de la página |
| `Popover`, `Tooltip`, `Menu`, `ContextMenu`, `Select`, `Combobox`, `DatePicker`, avisos | Un elemento `popover="manual"` | Capa superior, sin `z-index` ni portales |
| Colocación junto al disparador | Una función propia, la misma en React y en el modo DOM | — |

Lo que el navegador no da lo pone la suite: retener el foco y devolverlo al cerrar, cerrar con Escape solo
la capa de arriba, cerrar al interactuar fuera, bloquear el desplazamiento de la página y seguir al
disparador cuando la página se desplaza.

El marcado que emite React es el del contrato: se puede copiar a una página sin React y funciona con
`zui/dom`. Por eso el velo de un diálogo se estiliza como `dialog::backdrop` y un selector de aplicación debe
escribir `dialog.z-modal`, no `.z-modal[role=dialog]`.

## Variantes y estados

- Intención: `primary`, `secondary`, `ghost`, `danger`. Tamaño: `sm`, `md`, `lg`.
- Todo componente interactivo define reposo, hover, foco, activo y deshabilitado.
- `Button` e `IconButton` con `loading` llevan `aria-disabled="true"`, no `disabled`: no ejecutan `onClick`
  ni envían el formulario, pero conservan el foco del teclado.
- `Popover` exige nombre accesible en sus tipos: `label`, o `aria-labelledby` con el id de un encabezado del
  panel.

## Formularios

- `Field` etiqueta su control con `<label for>` y, cuando el control no es etiquetable (`RadioGroup`,
  `OTPInput`, `Slider`), con `aria-labelledby`. `useFieldLabel()` lo expone para controles propios.
- `Select`, `Checkbox`, `Switch`, `RadioGroup` y `DatePicker` llevan un campo nativo oculto
  (`.z-native-input`): participan en el envío del formulario y vuelven a su valor inicial con `form.reset()`.
  `Select required` y `DatePicker required` usan además la validación nativa: el formulario no se envía vacío.
- `Slider` con varios tiradores envía un campo por tirador con el mismo `name`.
- `FileUpload` con `name` conserva los archivos aceptados en el campo y el formulario los envía.

## Dirección de escritura

Dentro de un contenedor con `dir="rtl"` las hojas se reflejan (usan propiedades lógicas), los iconos
direccionales se voltean y el teclado se invierte donde el patrón lo pide: en `Tabs`, `Menu`, `Slider`,
`RadioGroup`, `SegmentedControl`, `Calendar`, `Tree` y `Rating` la flecha izquierda avanza. La dirección se
lee del DOM; no hay proveedor ni prop.

## Táctil

- Con el dedo como puntero principal (`pointer: coarse`) los controles `sm` y `md` miden 40 px de alto: sale
  del token `--z-touch-target` ([Tokens](./01-tokens.md#objetivo-táctil)). Checkbox, Radio y Switch ganan aire
  vertical; el Slider, los botones de cierre y las opciones de SegmentedControl amplían su zona de pulsación
  sin cambiar el dibujo.
- Las estrellas de `Rating` de entrada miden al menos 24 × 24 px con cualquier puntero.
- No llegan a 40 px los controles secundarios densos: días de `Calendar` en contenedores estrechos, quitar
  `Chip`, copiar de `CodeBlock` y enlaces en línea.
- Los estilos de `:hover` solo se aplican donde hay hover (`@media (hover: hover)`).
- Gestos: el Carousel se arrastra con inercia y deja pasar el desplazamiento vertical (`touch-action: pan-y`);
  un Toast se descarta deslizándolo; el ContextMenu se abre con pulsación larga; Slider, `SplitPane` y
  `ResizeHandle` se arrastran con el dedo. Igual con React y con `zui/dom`.

## Material

| Clase | Uso |
|---|---|
| `z-liquid` | Cristal: paneles, barras, menús, diálogos |
| `z-solid` | Superficie opaca para lectura y edición |
| `z-canvas` | Fondo de aplicación sobre el que flota el cristal |

Con `prefers-reduced-transparency` o `prefers-contrast: more` el cristal pasa a opaco.

## Carousel

```tsx
<Carousel
  ariaLabel="Featured projects"
  items={projects}
  getKey={(p) => p.id}
  renderItem={(p, i, { active }) => <ProjectCard project={p} highlighted={active} />}
/>
```

| Modo | Cuándo |
|---|---|
| `css` | Por defecto: deforma las diapositivas reales, sirve con cualquier contenido |
| `gl` | Si se pasa `rasterize` y hay WebGL2: los bordes se dibujan en un lienzo. Sin React: `data-raster` ([Frameworks](./06-frameworks.md#carousel-en-webgl-modo-gl)) |
| `flat` | Con `effect="none"` o movimiento reducido |

Arrastre con inercia, bucle infinito, flechas, teclado y anuncios para lectores de pantalla. Si el navegador
no ofrece WebGL2 se pregunta una sola vez por página y el carrusel sigue en `css`.

## Reglas de uso

1. No se pasan colores, radios ni sombras por `style` o clases sueltas.
2. Si una variante no existe, se añade al sistema.
3. El cristal no se aplica sobre áreas de lectura o edición de texto.
4. Los componentes de dominio (pagos, reservas, mapas) viven en la aplicación.
5. `DataTable` muestra una fecha sin `render` con `toLocaleDateString()`. En render de servidor, con otra
   zona horaria o idioma que el navegador, eso produce un desajuste de hidratación: para fechas, pasa `render`.

## Manifiestos

Cada componente tiene un `*.manifest.json` con props, valores permitidos, tokens que lee, clases y ejemplos
completos. `pnpm manifest` los valida y los reúne en `zui/manifest.json`; `pnpm html` genera `zui/html.json`
con el marcado de cada ejemplo. Los dos se publican con el paquete.

## De dónde sale cada cosa

| Fuente | Aporta |
|---|---|
| WAI-ARIA Authoring Practices | Roles, teclado y foco de cada patrón |
| El design system de un proyecto privado anterior | Button, Input, DateInput, Card, Avatar, Chip, Rating, Meter, estados |
| zutool | Aspecto liquid glass, menús, paleta de comandos, controles |
| `ui-glass` | Panel, StatTile, DataTable |
| La página de presentación de ese mismo proyecto | Carousel con efecto lente |

Las dos técnicas adaptadas de terceros (la zona de gracia del puntero en submenús y la prueba de punto en
polígono) llevan su aviso en `THIRD_PARTY_NOTICES.md`, dentro del paquete.

## Qué está probado

Las pruebas y lo que cubre cada una están en [Calidad y pruebas](../development/02-calidad-y-pruebas.md); los
límites, en [Accesibilidad](./09-accesibilidad.md#lo-que-no-he-comprobado) y
[Compatibilidad](./10-compatibilidad.md#lo-que-no-he-comprobado).
