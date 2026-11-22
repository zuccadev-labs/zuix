# Usar zuix con cualquier framework

zuix no es una biblioteca de React. El estándar es un **contrato de HTML, CSS y tokens**; React es uno de
los bindings que lo implementan. El mismo marcado, con las mismas clases, se ve y se comporta igual en
HTML plano, Vue, Svelte, Angular, Astro o plantillas de servidor.

Mi primer plan era una biblioteca de React. Lo corregí al día siguiente de escribirlo, porque quiero
usar la suite también donde no hay React. Desde entonces un componente se diseña primero como marcado, y el
binding se escribe después y tiene que producir ese marcado.

## Las tres capas

| Capa | Qué es | Depende de |
|---|---|---|
| Contrato | Tokens `--z-*`, clases `z-*`, atributos de estado (`data-state`, `data-size`, `aria-*`) e iconos | Nada: CSS y SVG |
| Comportamiento | `@zuccadev-labs/zuix-zui/dom` y `@zuccadev-labs/zuix-zout/dom`: diálogos, menús, popovers, tooltips, avisos, pestañas, acordeón, controles, paneles | El navegador (`<dialog>`, Popover API) |
| Binding | `@zuccadev-labs/zuix-zui` y `@zuccadev-labs/zuix-zout` para React | React 19 |

El comportamiento y el binding comparten la misma lógica (colocación, foco, teclado, capas): está escrita
una vez, sin framework, y los dos la consumen. Un binding para otro framework solo tiene que producir el
marcado del contrato. La apariencia no se reescribe nunca.

## Instalar

```
pnpm add @zuccadev-labs/zuix
```

El paraguas trae tokens, iconos, componentes y layouts. `react` y `react-dom` son peers opcionales: las
entradas sin framework (`/zui/dom`, `/zout/dom`, `/zicon/dom`, `/zicon/element`) no los importan y un
proyecto que solo usa esas entradas no instala React. Paquete a paquete: `@zuccadev-labs/zuix-tokens`,
`@zuccadev-labs/zuix-zicon`, `@zuccadev-labs/zuix-zui` y `@zuccadev-labs/zuix-zout`
([Instalar](./README.md#instalar)).

## Empezar sin bundler

Los archivos listos para enlazar están en la carpeta `dist/` de cada paquete instalado
(`node_modules/@zuccadev-labs/zuix-zui/dist/zui.css`…). En una copia del repositorio los genera `pnpm dist`:

```html
<html data-theme="dark" data-brand="dazlabs">
<head>
  <link rel="stylesheet" href="tokens/dist/tokens.css">
  <link rel="stylesheet" href="zui/dist/zui.css">
  <link rel="stylesheet" href="zout/dist/zout.css">
</head>
<body class="z-root z-canvas" data-z-dom>
  <button type="button" class="z-btn z-btn--primary" data-size="md">
    <z-icon name="plus" size="16"></z-icon>
    New project
  </button>

  <script type="module">
    import "./zicon/dist/zicon.element.js";          // define <z-icon>
    import { init } from "./zui/dist/zui.dom.js";    // comportamiento
    init();
  </script>
</body>
</html>
```

- `z-root` aplica tipografía y foco; `z-canvas` pinta el fondo.
- `data-z-dom` activa el comportamiento de pestañas, acordeón y controles dentro de ese contenedor.
- El ejemplo completo, con todos los componentes, está en `examples/html/index.html`.

## Con bundler (Vue, Svelte, Angular, Astro)

```js
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/element";            // <z-icon> con el set completo
import { init, toast } from "@zuccadev-labs/zuix-zui/dom";

init();
```

Con el paraguas, lo mismo sin React:

```js
import "@zuccadev-labs/zuix/styles.css";
import "@zuccadev-labs/zuix/zicon/element";
import { init, toast } from "@zuccadev-labs/zuix/zui/dom";
import { init as initLayouts } from "@zuccadev-labs/zuix/zout/dom";

init();
initLayouts();
```

Después se escribe el marcado del contrato en la plantilla del framework. En Vue hay que declarar
`z-icon` como elemento personalizado (`compilerOptions.isCustomElement`); en Angular, añadir
`CUSTOM_ELEMENTS_SCHEMA`.

`init()` devuelve una función `destroy` (también exportada) que retira todos los listeners del documento y
de la ventana, también los de las agendas y las piezas que montó (`EventCalendar`, gráficos, `TimelineView`…);
`init()` se puede volver a llamar. Sirve en pruebas, en microfrontends y en aplicaciones que
montan y desmontan la interfaz.

## Con Next.js (App Router)

El binding de React funciona con Server Components. Los componentes de solo marcado (`Button`, `Badge`,
`Card`, `EmptyState`, `Icon`, `Page`, `Stack`, `Rail`…) se renderizan en el servidor sin enviar código al
navegador. Los que tienen estado, contexto o manejadores propios (`Modal`, `Menu`, `Tabs`, `Select`,
`Shell`…) llevan `"use client"` en su propio módulo: se usan desde un Server Component sin
envolverlos, siempre que sus props sean serializables. Un manejador (`onClick`, `onSelect`,
`onValueChange`) obliga a escribirlo en un archivo propio con `"use client"`.

Los iconos necesitan **dos importaciones**. El registro de iconos es estado de módulo y Next compila dos
grafos separados: el de Server Components y el de Client Components (que se renderiza en el servidor y en
el navegador). Cada grafo tiene su copia del registro.

```tsx
// app/layout.tsx (Server Component)
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all";              // iconos de los Server Components
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="z-root z-canvas"><Providers>{children}</Providers></body>
    </html>
  );
}
```

```tsx
// app/providers.tsx
"use client";
import "@zuccadev-labs/zuix-zicon/all";              // iconos de los Client Components
import { ToastProvider } from "@zuccadev-labs/zuix-zui";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
```

- Con una sola de las dos, la mitad de los iconos sale como `<svg>` vacío y `next build` escribe
  `[zicon] "…" no está registrado`. No hay error de hidratación, porque el servidor y el navegador
  coinciden en el hueco: hay que mirar el aviso.
- `@zuccadev-labs/zuix-zicon/all` añade el set completo (unos 580 kB sin comprimir) al bundle del navegador.
  Para enviar solo algunos, el módulo de cliente registra los suyos:
  `import { registerIcons } from "@zuccadev-labs/zuix-zicon/core"; import { check } from "@zuccadev-labs/zuix-zicon/icons/check"; registerIcons([check]);`.
  Los componentes de `zui` usan iconos propios (`x-mark`, `chevron-down`, `check`…): también hay que
  registrarlos.
- `next.config` no necesita `transpilePackages`: los paquetes publican ESM compilado.
- `Calendar` sin `value`, `month` ni `defaultMonth` no produce desajuste de hidratación aunque el reloj del
  servidor y el del navegador caigan en meses distintos. `DataTable` con fechas sin `render` sí puede
  producirlo: usa `render`.
- El paraguas funciona igual: una ruta de la prueba lo importa todo por `@zuccadev-labs/zuix`, con un solo
  `@import` de estilos.

Lo compruebo en cada pull request con la última versión estable de Next.js, instalando los paquetes
empaquetados fuera del workspace (`pnpm test:pack --next`).

## Dónde está el marcado de cada componente

`zui/html.json` y `zout/html.json` contienen el HTML de cada ejemplo. Se generan renderizando el
binding de React (`pnpm html`), así que el contrato documentado es el que produce la implementación.
El catálogo de [Componentes](/components) muestra cada ejemplo como React o como HTML.

Cada componente declara cómo se comporta:

| `behavior` | Significado |
|---|---|
| `none` | Solo CSS. Basta el marcado |
| `dom` | Necesita `@zuccadev-labs/zuix-zui/dom` (en layouts, `@zuccadev-labs/zuix-zout/dom`) |
| `react` | Solo existe en el binding de React. Hoy ningún componente con marcado está en este caso |

## Iconos sin React

| Forma | Uso |
|---|---|
| Elemento | `<z-icon name="bell" variant="solid" size="20" label="Alerts"></z-icon>` |
| Nodo | `iconElement("bell", { size: 20 })` desde `@zuccadev-labs/zuix-zicon/dom`: un `<svg>` construido con el DOM |
| Cadena | `iconSvg("bell", { size: 20 })` desde `@zuccadev-labs/zuix-zicon/dom` |
| Sprite | `<svg class="z-icon" width="16" height="16"><use href="sprite.svg#bell"/></svg>` (`#bell-solid` para la variante sólida) |
| Archivo | `@zuccadev-labs/zuix-zicon/svg/outline/bell.svg` |

`@zuccadev-labs/zuix-zicon/dom` no incluye datos: se registran los iconos que se usen con `registerIcons`.
`@zuccadev-labs/zuix-zicon/element` registra el set completo (unos 580 kB sin comprimir). Más en
[Zicon](./02-zicon.md#uso-sin-react).

## Comportamiento: `@zuccadev-labs/zuix-zui/dom`

### Elegir entrada: todo o por familias

`@zuccadev-labs/zuix-zui/dom` es la suite completa: exporta todo y `init()` monta todo, como en 0.2.0. No hace
nada al importarse, así que un bundler descarta lo que no se usa: quien toma solo `toast()` no carga la agenda ni
los gráficos. Lo que no se puede descartar es `init()`: monta todas las familias, porque no sabe qué marcado va a
encontrar. Para no cargarlas, se parte del núcleo y se añaden las familias que use la página:

```js
import { init } from "@zuccadev-labs/zuix-zui/dom/core";
import { datesModule } from "@zuccadev-labs/zuix-zui/dom/dates";
import { chartsModule } from "@zuccadev-labs/zuix-zui/dom/charts";

init(datesModule, chartsModule);
// Más tarde, una vista que trae la agenda (se conecta y prepara el documento en ese momento):
// const { agendaModule } = await import("@zuccadev-labs/zuix-zui/dom/agenda"); use(agendaModule);
```

| Entrada | Qué conecta | Exporta además |
|---|---|---|
| `/dom/core` | Diálogos, popovers, menús y submenús, tooltip, `toast`, `confirm`, pestañas, acordeón, casillas, interruptores, radios, Rating, acciones (Toolbar, CopyButton…), navegación (Menubar, Collapsible), capas (Drawer, HoverCard, Toggletip, Tour, ActionBar, Banner) y lo básico de formularios: Select, Combobox, Slider, OTPInput, FileUpload, NumberInput, PasswordInput, Field, Listbox y TagsInput | `init`, `use`, `hydrate`, `destroy`, `download`, utilidades de atajos |
| `/dom/dates` | Calendar, DatePicker y sus variantes, DateField, TimeField, TimePicker, DateTimePicker | `datesModule`, `setCalendarOptions`… |
| `/dom/data` | Tree, CommandPalette, orden de Table, Pagination, DataTable | `dataModule`, `sortTable`… |
| `/dom/content` | FormatNumber, FormatByte, FormatDate, Highlight, Marquee, JsonTree, Stepper con paneles, Timer, RelativeTime | `contentModule`, `setJsonTreeValue`… |
| `/dom/agenda` | EventCalendar, TimelineView, PerpetualYear, FreeBusy, SlotPicker, CalendarHeatmap, HabitCalendar (trae `/dom/dates`) | `agendaModule`, `setAgendaEvents`… |
| `/dom/charts` | AreaChart, BarChart, DonutChart, LineChart, PieChart, Sparkline | `chartsModule`, `setWidgetProps` |
| `/dom/color` | ColorPicker, ColorArea, ColorSlider, ColorSwatchPicker, ColorField, ColorPickerTrigger | `colorModule`, `setColorValue` |
| `/dom/media` | Carousel, CompareSlider, ImageCropper, QRCode, SignaturePad, CircularSlider, ShortcutInput, Confetti | `mediaModule`, `carousel`… |
| `/dom/effects` | DotMatrix, Backdrop, BorderBeam, Glow, AttentionRing, TextEffect | `effectsModule`, `setDotMatrixPattern` |
| `/dom/time` | Clock, AnalogClock, WorldClock, Countdown, DurationField, TimeZoneSelect (sobre el Combobox del núcleo) | `timeModule`, `refreshTimeZoneSelect`, `formatDuration` |
| `/dom/terminal` | Terminal, LogConsole, CodeViewer, DiffViewer | `terminalModule`, `terminal(el)`, `appendLogEntries`, `setWidgetProps` |
| `/dom/chat` | ConversationList, MessageList, Composer, EmojiPicker, VoiceNote, Reactions, CallCard, PinnedBar | `chatModule`, `messageList(el)`, `setWidgetProps`, `linkify`, `encodeMentions`, `chatRows` |
| `/dom/ai` | AssistantMessage, PromptInput, Markdown, Reasoning, ToolCall, ApprovalCard, AgentPlan, Sources, Suggestions, Artifact, BranchPicker | `aiModule`, `setWidgetProps`, `createTextStream`, `parseMarkdown`, `activePath` |

`init(módulo, …)` y `use(módulo, …)` son repetibles: cada familia se registra una vez, en cualquier orden, y si
`init()` ya corrió, `use()` conecta la familia nueva y prepara el documento. `@zuccadev-labs/zuix-zui/dom`
reexporta las mismas funciones y los mismos módulos, así que mezclar entradas no duplica nada. Con el paraguas, las
mismas rutas cuelgan de `@zuccadev-labs/zuix/zui/dom/…`. Qué pesa cada caso con esbuild (minificado, sin gzip):

| Consumidor | Antes, con una sola entrada | Ahora |
|---|---|---|
| Solo `toast()` | 225 kB (de `/dom`) | 11 kB, de `/dom` o de `/dom/core` (3 iconos) |
| `init()` del núcleo | — | 95 kB |
| `init()` del núcleo con fechas | — | 173 kB |
| `init()` del núcleo con agenda | — | 341 kB |
| `init()` del núcleo con tiempo | — | 140 kB |
| `init()` del núcleo con terminal y código | — | 156 kB |
| `init()` del núcleo con chat | — | 233 kB |
| `init()` del núcleo con IA | — | 225 kB |
| `init()` del núcleo con chat e IA | — | 300 kB |
| `init()` completo | 526 kB | 798 kB |

Sin bundler, `zui/dist/zui.dom.js` sigue siendo un solo archivo con todo. Para cargar por partes sin bundler, las
entradas de `dist/esm/` funcionan con un mapa de importación que resuelva `@zuccadev-labs/zuix-zicon/…`.

### Declarativo

| Atributo | Efecto |
|---|---|
| `data-z-open="#id"` | Abre el `<dialog>` o el elemento `[popover]` indicado, anclado al disparador. Un disparador deshabilitado (`disabled`, `aria-disabled`, `data-disabled`) no abre |
| `data-z-close` | Cierra el diálogo o popover que lo contiene |
| `data-z-context="#id"` | Abre ese menú en el puntero con clic derecho, o con una pulsación larga (600 ms) con dedo o lápiz |
| `data-z-submenu="#id"` | En un `.z-menu__item`: abre ese `.z-menu[popover]` como submenú |
| `data-z-tooltip="texto"` | Tooltip al pasar el puntero o enfocar. La burbuja admite el puntero y Escape la cierra |
| `data-z-placement` | `bottom-start` (por defecto), `bottom`, `bottom-end`, `top-start`, `top`, `top-end`, `right`, `left` |
| `data-z-static` | En un `<dialog>`: Escape y clic fuera no lo cierran |

```html
<button class="z-btn z-btn--secondary" data-size="md" data-z-open="#edit">Edit profile</button>

<dialog id="edit" class="z-liquid z-modal" data-size="md" aria-labelledby="edit-title">
  <header class="z-modal__header">
    <div class="z-modal__heading"><h2 id="edit-title" class="z-modal__title">Edit profile</h2></div>
  </header>
  <div class="z-modal__body">…</div>
  <footer class="z-modal__footer">
    <button class="z-dialog-btn" data-variant="primary" data-z-close value="save">Save</button>
  </footer>
</dialog>
```

### Submenús

Una entrada de `Menu` o `ContextMenu` con `data-z-submenu="#id"` abre otro `.z-liquid.z-menu[popover]`. El
marcado es el del binding de React: la entrada lleva `.z-menu__chevron`, `aria-haspopup="menu"`,
`aria-expanded` y `aria-controls` (`hydrate()` los completa si faltan).

```html
<div id="actions" popover class="z-liquid z-menu" role="menu" data-size="md">
  <button type="button" role="menuitem" class="z-menu__item" tabindex="-1">…</button>
  <button type="button" role="menuitem" class="z-menu__item" tabindex="-1"
          aria-haspopup="menu" aria-expanded="false" aria-controls="actions-share" data-z-submenu="#actions-share">
    <span class="z-menu__icon"><z-icon name="share" size="14"></z-icon></span>
    <span class="z-menu__text">Share</span>
    <span class="z-menu__chevron"><z-icon name="chevron-right" size="14"></z-icon></span>
  </button>
</div>

<div id="actions-share" popover class="z-liquid z-menu" role="menu" aria-label="Share" data-size="md">
  <button type="button" role="menuitem" class="z-menu__item" tabindex="-1">…</button>
</div>
```

| Acción | Efecto |
|---|---|
| Puntero sobre la entrada (100 ms) o clic | Abre el submenú; el foco no se mueve |
| Flecha derecha, Intro o Espacio | Abre y enfoca la primera entrada |
| Flecha izquierda o Escape | Cierra solo ese nivel; el foco vuelve a la entrada |
| Elegir una entrada, Tab o clic fuera | Cierra toda la cadena |
| Letras | Búsqueda por letra dentro del menú enfocado (también en menús sin submenús) |

- Se coloca a la derecha del menú padre y voltea a la izquierda si no cabe (`data-side`). Dentro de
  `dir="rtl"` abre hacia la izquierda y las flechas se invierten.
- Al ir con el puntero en diagonal hacia el submenú hay una zona de gracia: pasar por encima de otras
  entradas no lo cierra.
- El submenú puede ir fuera del menú (como arriba) o anidado dentro de él. Fuera, se emparenta con
  `showPopover({ source })`; en un navegador sin esa opción, `zui/dom` lo mueve dentro del menú padre al
  abrirlo para que el `popover` del padre no se cierre.
- `z:select` burbujea desde la entrada elegida. Con el submenú fuera del menú, el evento no pasa por el
  menú padre: se escucha en un ancestro común o en `document`. Anidado, llega al menú raíz.
- La entrada con submenú no emite `z:select`. `openSubmenu(entrada, enfocar)` lo abre desde código.

### Imperativo

```js
import {
  init, destroy, hydrate,
  openDialog, closeDialog, openPopover, closePopover, toast, confirm,
  setTheme, setBrand,
} from "@zuccadev-labs/zuix-zui/dom";

toast({ title: "Changes saved", intent: "success" });
if (await confirm({ title: "Delete project?", intent: "danger", confirmLabel: "Delete" })) remove();
setTheme("light");
hydrate(container);   // tras insertar marcado nuevo con pestañas, radios o acordeones
```

| Función | Notas |
|---|---|
| `openDialog(el)`, `closeDialog(el)` | `<dialog>` con `showModal()`: retiene el foco (Tab da la vuelta), bloquea el desplazamiento de la página y devuelve el foco al cerrar. `data-z-static` impide cerrar con Escape o con el velo |
| `openPopover(el, ancla, placement, { follow })` | Anclado a un elemento, lo sigue al desplazar o redimensionar la página; `follow: false` lo deja donde se abrió |
| `toast(opciones)` | El cierre automático se detiene mientras el puntero o el foco están en el aviso y con la ventana sin foco. F8 lleva el foco al aviso más reciente y Escape lo descarta. La región tiene nombre: `regionLabel`, por defecto `Notifications (F8)` |
| `confirm(opciones)` | Resuelve `true` o `false`. Escape cancela; el clic en el velo no cierra |
| `setSelectValue`, `setComboboxValue`, `setCalendarValue`, `setDatePickerValue`, `setSliderValue`, `setOtpValue`, `setPage`, `sortTable`, `selectTab`… | Cambian el valor desde código y emiten el mismo evento que la interacción |

Los textos que reciben estas funciones se escriben con `textContent`: un título con `<b>` se ve tal cual, no
se interpreta.

### Táctil

Sin código adicional. Un aviso de `toast()` se descarta deslizándolo hacia la derecha (hacia el borde en las
posiciones centradas); `data-z-context` abre con pulsación larga; el Slider, el Carousel y los divisores de
`@zuccadev-labs/zuix-zout/dom` siguen al dedo. Con puntero grueso los controles miden 40 px y los estilos de
`:hover` no se aplican ([zui · Táctil](./03-zui.md#táctil)).

### Eventos

Los elementos emiten `z:open`, `z:close`, `z:change` (con `detail.value`, `detail.checked` o
`detail.pressed`), `z:select` (entrada de menú elegida) y `z:sort`. `z:close` se emite también cuando un
`<dialog>` de zui se cierra con `dialog.close()` o con `<form method="dialog">`. Los de `zout/dom` están en
[Zout](./04-zout.md#eventos).

### Dirección de escritura

Dentro de `dir="rtl"` el modo DOM refleja el teclado igual que React: la flecha izquierda avanza en pestañas,
grupos de radio, calendario, árbol, valoración y Slider, y los popovers alinean `start` con el borde derecho
del ancla.

### Carousel en WebGL (modo `gl`)

Con `data-effect="lens"`, las zonas curvas se pueden dibujar en un lienzo WebGL2 a partir de una imagen de
cada slide, como hace la prop `rasterize` en React. La franja central sigue siendo el slide HTML real.

```html
<div id="covers" class="z-carousel" data-z-carousel data-effect="lens" data-loop aria-label="Project covers">
  <img data-raster src="atlas.png" alt="Atlas cover">
  <img data-raster src="beacon.png" alt="Beacon cover">
  <img data-raster src="cinder.png" alt="Cinder cover">
</div>
```

| Forma de declarar la imagen | Uso |
|---|---|
| `<img data-raster>` o `<canvas data-raster>` | El propio elemento, como slide o dentro de él, es la imagen |
| `data-raster="#selector"` | En el slide o en un descendiente: un `<img>`, `<canvas>` o `<video>` de la página |
| `data-raster-src="url"` | Una imagen por URL; de otro origen necesita CORS |
| `carousel(el, { rasterize(slide, index, size) })` | Devuelve la imagen o su URL; con `null` se usa la declarada en el marcado |

- El modo `gl` se activa cuando **todos** los slides declaran imagen, o cuando se pasa `rasterize`. La raíz
  queda con `data-mode="gl"` y `zui/dom` añade `<canvas class="z-carousel__canvas" aria-hidden="true">`.
- La imagen se ajusta en modo cover al tamaño del slide: debe verse igual que el slide.
- Sin WebGL2, si falta la imagen de algún slide, si no se puede leer (otro origen sin CORS) o con
  `prefers-reduced-motion`, la lente sigue en `css` o `flat`. No hay que comprobar nada en la aplicación.
- Los shaders no van en `zui.dom.js`: se cargan la primera vez que un carrusel los pide. Con bundler es el
  módulo `@zuccadev-labs/zuix-zui/dom/carousel-gl` (import dinámico); sin bundler, `zui/dist/zui.dom.carousel-gl.js`, que
  tiene que estar en la misma carpeta que `zui.dom.js`. Mientras llegan, el carrusel funciona en `css`.
- Si las imágenes cambian después de activar el carrusel (un `<canvas>` que se pinta más tarde, un cambio de
  tema): `carousel(el).refresh()` rehace las réplicas del bucle y las texturas.

## Qué cubre cada capa

| Componentes | Sin React |
|---|---|
| Acciones, datos, estado, contenido, navegación estática, layouts de página y rejillas | Solo CSS |
| Modal, Drawer, ConfirmDialog, Popover, Tooltip, Menu, ContextMenu (con submenús y búsqueda por letra), Toast | `zui/dom` |
| Rating de entrada (`.z-rating[data-interactive]`) | `zui/dom`: clic y flechas rellenan las estrellas; `z:change` con `detail.value` |
| Tabs, Accordion, Switch, Checkbox, Radio, Toggle, SegmentedControl | `zui/dom`. El acordeón emite `z:change` con las secciones abiertas y se recorre con flechas, Inicio y Fin |
| Select no nativo, Combobox, Calendar, DatePicker, Slider, OTPInput, FileUpload | `zui/dom`: teclado, puntero, campo oculto para formularios y `z:change`. El campo y su popup (`popover`) se enlazan con `aria-controls` |
| CommandPalette | `zui/dom`: `<dialog class="z-liquid z-palette">` abierto con `data-z-open`, con `data-z-hotkey="mod+k"` o con `openPalette(el)`. Filtra por etiqueta, detalle, `data-keywords` y grupo; flechas, Inicio/Fin, Intro y Escape; `z:select` con `detail.value`. `data-keep-open` no cierra al elegir |
| Tree | `zui/dom`: expandir, plegar, selección y teclado de árbol (flechas, Inicio/Fin, letra, Intro, Espacio). Las ramas plegadas van en el marcado con `hidden`. `z:change` con `detail.value` y `detail.expanded`; `toggleTreeItem(li)`, `selectTreeItem(li)` |
| DataTable (orden) | `zui/dom`: ordena las filas presentes al pulsar una cabecera con `aria-sort` (ascendente, descendente, sin orden). Tipo en `<th data-sort="number\|text\|date">`, valor en `<td data-sort-value>`; `data-manual-sort` en la tabla solo avisa. `z:sort` con `detail.key`, `direction` y `column`; `sortTable(th, direction)` |
| Pagination | `zui/dom`: cambia de página, recalcula el rango con huecos y emite `z:change` con `detail.value`. `data-page-count`, `data-siblings`, `data-page-label="Page {page}"`; `setPage(nav, page)` |
| Carousel | `zui/dom`: `<div class="z-carousel" data-z-carousel data-effect="lens\|none" data-loop>` con un hijo por slide; monta la tira, las flechas, el contador y los anuncios. Arrastre con inercia, bucle, teclado y `prefers-reduced-motion` con el mismo motor que React. `z:change` con `detail.index`; `carousel(el)` devuelve `{ next, prev, goTo, refresh, destroy }`. Zonas curvas en WebGL: [modo `gl`](#carousel-en-webgl-modo-gl) |
| `Shell` responsive, `ResizeHandle`, `SplitPane`, `TabStrip` y `Sidebar` de `zout` | `zout/dom` ([Zout](./04-zout.md#sin-react-zuccadev-labszuix-zoutdom)) |
| `Rail`, `TitleBar`, `SidePanel`, `Page`, `Grid`, `Stack`, `Inline` de `zout` | Solo CSS; el destino activo del `Rail` (`aria-current`) lo marca la aplicación |

Para un campo de selección sin React, `NativeSelect` usa el `<select>` del navegador y no necesita
comportamiento.

Para un campo de selección sin React, `NativeSelect` usa el `<select>` del navegador y no necesita
comportamiento.

## Verificación

```
pnpm html        # regenera el contrato HTML desde los componentes
pnpm dist        # empaqueta CSS y módulos, y regenera examples/html
pnpm test:html   # abre examples/html en Chrome y ejercita zui/dom, sin React
```

`pnpm test:html:all` repite la suite en Firefox y WebKit. Qué cubre cada suite, incluida la de Next.js y la
de táctil emulado: [Calidad y pruebas](../development/02-calidad-y-pruebas.md).

## Lo que no he comprobado

- Safari real. Las suites pasan en Chrome y en los motores Firefox y WebKit de Playwright; WebKit en Linux no
  es Safari en macOS o iOS.
- No he escrito bindings para Vue, Svelte ni Angular: se usa el contrato directamente.
- Next.js: lo pruebo con App Router, Turbopack, `next build` y `next start`. No he probado `next dev`, Pages
  Router ni el runtime Edge.
- Submenús: solo un nivel de anidamiento, y sin pruebas táctiles. La ruta sin `showPopover({ source })` la
  probé anulando el argumento en los tres motores, no en un navegador antiguo real.
- Táctil en un dispositivo real. La emulación cubre gestos reales solo en Chrome; en Firefox y WebKit los
  arrastres son eventos sintéticos.
- Lectores de pantalla.
- Modo `gl` del Carousel: probado con WebGL por software y con lienzos como imagen; no con `<video>`, con
  imágenes de otro origen ni con pérdida real del contexto WebGL.
