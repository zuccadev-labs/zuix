# Layouts adaptativos

Un layout responsive es el mismo layout estirado o plegado: las columnas se apilan, la sidebar pasa a cajón y
poco más. Un layout adaptativo elige, para cada clase de tamaño y de entrada, un layout distinto: qué regiones
hay, dónde va cada pieza, en qué orden, qué se oculta o pasa a un cajón y qué variante de un componente se usa
(unas pestañas en un teléfono son un `<select>` o una barra inferior).

En zuix lo responsive sigue siendo la base y no cambia: `Grid`, `Shell` con sus cortes en px, `Navbar` con su
cajón medido. Lo adaptativo es una capa aparte, opcional y declarativa, que se apoya en un contrato pequeño:
cinco clases de tamaño, ajustes por clase en cada pieza y una plantilla de áreas por clase.

| | Responsive | Adaptativo |
|---|---|---|
| Qué cambia | Tamaños y saltos de línea del mismo layout | El layout: regiones, posición, orden, visibilidad y variante |
| Dónde se decide | En la hoja de cada componente | En la página, con plantillas y ajustes por clase |
| Lo edita | Quien escribe el CSS | La página, o el editor visual sin tocar código |
| Piezas | `Grid`, `Stack`, `Shell` (cortes en px) | `AdaptiveLayout`, `AdaptiveSwitch` y las variantes |

## Clases de tamaño

Son las *window size classes* de Material 3. Se miden por defecto sobre el contenedor (consultas de contenedor),
no sobre la ventana: una página dentro de un panel estrecho se coloca como en un teléfono. `measure="window"` mide
la ventana.

| Clase | Ancho | Token |
|---|---|---|
| `compact` | menos de 600 px | `--z-size-compact` (0) |
| `medium` | 600–839 px | `--z-size-medium` |
| `expanded` | 840–1199 px | `--z-size-expanded` |
| `large` | 1200–1599 px | `--z-size-large` |
| `xlarge` | 1600 px o más | `--z-size-xlarge` |

En JavaScript están en `SIZE_CLASSES` (`{ name, min, next }`) y `sizeClassFor(width)` da la clase de un ancho.
Una consulta de CSS no admite `var()` en la condición: la hoja de zout lleva los cortes escritos, y los tokens
sirven para leerlos desde el código.

La entrada se describe aparte: `pointer` (`coarse` con el dedo, `fine` con ratón o lápiz) y `hover` (sí o no).
`useSizeClass()`, `sizeClassOf()` y el evento `z:sizeclass` la devuelven junto con la clase de tamaño. Para el
CSS, `@media (pointer: coarse)` sigue siendo la herramienta.

## El contrato

### Ajustes por clase

Cada pieza declara sus ajustes por clase:

```ts
adaptive: {
  [clase]: { order?: number, hidden?: boolean, area?: string, span?: number, variant?: string, props?: object }
}
```

| Clave | Qué hace |
|---|---|
| `area` | Área de la plantilla en la que va la pieza |
| `order` | Orden dentro de su área, o en el flujo si la clase no tiene plantilla |
| `hidden` | Oculta la pieza en esa clase (`display: none`: no se ve, no se enfoca, no se lee) |
| `span` | Columnas que ocupa una pieza sin área |
| `variant` | Variante del componente (`tabs`, `select`, `drawer`, `rail`, `menu`…). La interpreta cada componente |
| `props` | Props que cambian en esa clase; se fusionan clave a clave |

Las clases se heredan hacia arriba (mobile-first): lo de `compact` vale hasta que una clase mayor lo sobrescribe.

```ts
{ compact: { hidden: true }, expanded: { hidden: false, area: "nav" } }
// compact y medium: oculta. expanded, large y xlarge: visible, en el área nav.
```

`resolveAdaptive(adaptive, clase)` hace esa fusión; `resolveAll(adaptive)` la da para las cinco clases.

Este núcleo (sin React ni DOM) está en `@zuccadev-labs/zuix-zui/adaptive` y zout lo reexporta desde su raíz: lo usan
también el conector del editor visual, que escribe el mismo marcado que `AdaptiveLayout`, y cualquier servidor
que quiera escribirlo.

### Plantillas

Un layout adaptativo lleva una plantilla por clase, también heredada hacia arriba:

```ts
templates: {
  [clase]: { areas: string[], columns?: string, rows?: string }
}
```

`areas` se escribe como `grid-template-areas`, una cadena por fila; `.` deja una celda vacía. Sin `columns`, las
columnas son iguales. Una clase sin plantilla (por debajo de la primera definida) coloca las piezas en una columna,
por `order`.

`validateTemplate(plantilla)` comprueba que la plantilla tenga filas del mismo ancho, nombres válidos y áreas
rectangulares. `validateAdaptive(templates, piezas)` comprueba además, clase por clase, que cada pieza visible
con área tenga esa área en la plantilla de la clase. Una pieza cuya área no existe queda en el flujo y el binding
lo avisa.

## AdaptiveLayout

```tsx
import { AdaptiveItem, AdaptiveLayout } from "@zuccadev-labs/zuix-zout";

<AdaptiveLayout
  templates={{
    compact: { areas: ["header", "main", "aside"] },
    medium: { areas: ["header header", "main aside"], columns: "minmax(0, 2fr) minmax(0, 1fr)" },
    expanded: { areas: ["nav header header", "nav main aside"], columns: "200px minmax(0, 2fr) minmax(0, 1fr)" },
  }}
>
  <AdaptiveItem id="header" area="header"><h2>Overview</h2></AdaptiveItem>
  <AdaptiveItem id="nav" area="nav" adaptive={{ compact: { hidden: true }, expanded: { hidden: false } }}>
    <button type="button">Reports</button>
  </AdaptiveItem>
  <AdaptiveItem id="main" area="main">…</AdaptiveItem>
  <AdaptiveItem id="aside" area="aside">…</AdaptiveItem>
</AdaptiveLayout>
```

La colocación la hace la hoja, no JavaScript. Cada pieza lleva sus valores para las cinco clases en variables
(`--z-place-<clase>`, `--z-order-<clase>`) y la rejilla su plantilla (`--z-areas-<clase>`, `--z-columns-<clase>`,
`--z-rows-<clase>`); una consulta de contenedor elige la de la clase activa. El HTML que sale del servidor ya está
colocado, y la hidratación no mueve nada: la suite lo comprueba pintando la página con `react-dom/server`,
midiendo cada pieza, hidratando y midiendo otra vez, en las cinco clases.

JavaScript queda para lo que CSS no puede: saber la clase (`useSizeClass`), reordenar el DOM en modo `dom` y
cambiar de variante.

Props: `reorder` (`dom` o `visual`), `measure` (`container` o `window`), `gap`, `transition`,
`onSizeClassChange`, `onOrderMismatch` y `onIssues`. Las de cada pieza: `id`, `area`, `order`, `span`, `hidden`,
`adaptive` y `elementId` (el atributo `id`, porque `id` es el de la pieza).

## Sin React

El marcado es el del contrato (`zout/html.json`): `.z-adaptive > .z-adaptive__grid > .z-adaptive__item`, con
las variables en `style` y `data-hidden-in` con las clases en que la pieza se oculta. Funciona sin JavaScript;
con `@zuccadev-labs/zuix-zout/dom` se mide la clase y se reordena el DOM.

```html
<div class="z-adaptive" data-reorder="dom">
  <div class="z-adaptive__grid"
       style='--z-areas-compact: "header" "main"; --z-areas-expanded: "nav header" "nav main";
              --z-columns-expanded: 200px minmax(0, 1fr); …'>
    <div class="z-adaptive__item" data-item="nav" data-hidden-in="compact medium"
         style="--z-place-expanded: nav; --z-order-expanded: 0; …">…</div>
    …
  </div>
</div>
```

Las variables de las cinco clases salen de `templateVars(templates)` y de `nodeStyle(templates, pieza)`: una
plantilla de servidor las escribe igual que el binding.

| Atributo | Dónde | Qué hace |
|---|---|---|
| `data-reorder="dom\|visual"` | `.z-adaptive` | Modo del orden de lectura (por defecto `dom`) |
| `data-measure="window"` | `.z-adaptive` | Mide la ventana en lugar del contenedor |
| `data-transition` | `.z-adaptive` | `setAdaptiveTemplates` y `setAdaptiveItem` animan el cambio con view transitions |
| `data-item` | `.z-adaptive__item` | Identificador de la pieza |
| `data-hidden-in` | `.z-adaptive__item` | Clases en que se oculta, separadas por espacios |
| `data-size-class` | `.z-adaptive`, `.z-adaptive-switch`, `.z-shell` | Clase medida. La escribe el módulo; la hoja no depende de él |

| Evento | Dónde | `detail` | Si se cancela |
|---|---|---|---|
| `z:sizeclass` | `.z-adaptive`, `.z-adaptive-switch` | `{ sizeClass, previous, width, pointer, hover }` y, en el switch, `variant` | En el layout, no se reordena |
| `z:ordermismatch` | `.z-adaptive` en modo `visual` | `{ sizeClass, dom, visual, readingFlow }` | No se avisa por consola |

`setAdaptiveTemplates(layout, templates)` cambia las plantillas y `setAdaptiveItem(item, { area, order, hidden,
adaptive })` los ajustes de una pieza; `getAdaptiveTemplates(layout)` lee las plantillas efectivas de las
variables. Es lo que usa un editor sin React. `sizeClassOf(el)` mide la clase de un elemento y
`observeSizeClass(el, fn)` la vigila.

El módulo acepta también el marcado que escribe el documento del editor visual: plantillas en
`--z-adaptive-areas-<clase>` (con `--z-adaptive-columns-<clase>` y `--z-adaptive-rows-<clase>`) en el layout o en
su rejilla, los ajustes de cada pieza en `data-z-adaptive` (JSON) y `data-measure="viewport"`. Al hidratar los
traduce a las variables de arriba; hasta entonces, sin ellas, las piezas van en una columna.

## Orden de lectura y foco

Cuando una plantilla pone delante una pieza que va detrás en el DOM, lo que se ve y lo que recorren el teclado y el
lector de pantalla se separan (WCAG 1.3.2 y 2.4.3). `reorder` decide cómo se evita:

- **`dom`** (por defecto). Al cambiar de clase, las piezas se mueven en el DOM al orden en que se ven, por fila y
  después por columna lógica (en RTL la columna inicial es la derecha y se sigue leyendo primero). Se mueven con
  `moveBefore` donde existe (Chrome 133, Firefox 144): los nodos no se rehacen y conservan el foco, los iframes y las
  animaciones. Donde no existe, con `insertBefore`, y si el foco estaba en una pieza movida se devuelve a ella. Las
  piezas ocultas van al final.
- **`visual`**. El DOM se queda en su orden de origen y solo cambia la colocación. La rejilla lleva
  `reading-flow: grid-rows`: en un navegador que lo admite (Chrome 137) el foco y la lectura siguen el orden visual.
  Donde no, el binding avisa en desarrollo (`onOrderMismatch` o la consola) y `zout/dom` emite `z:ordermismatch`.

Usa `dom` salvo que el contenido de las piezas pierda algo al moverse (un reproductor que se reinicia en Safari, que
no tiene `moveBefore`) o que el orden de origen sea el que tiene sentido leer en todas las clases. En ese caso,
`visual`, y revisa el aviso.

Antes de hidratar (o sin JavaScript) el DOM está en el orden de origen; el modo `dom` lo corrige al medir.

## Variantes

### AdaptiveSwitch

Una variante de un componente por clase. Es su propio contenedor de consulta: decide con el ancho que le queda.

```tsx
<AdaptiveSwitch
  adaptive={{ compact: { variant: "icon" }, medium: { variant: "text" } }}
  variants={{
    icon: <IconButton icon="plus" label="New project" />,
    text: <Button icon="plus" variant="primary">New project</Button>,
  }}
/>
```

Hasta medir están todas las variantes en el documento y la hoja muestra la de la clase activa, así que el servidor
y la hidratación no saltan; medido, React deja montada solo esa. Si el foco estaba en la variante que se va, pasa
al primer control de la nueva. Como es un contenedor de consulta, su ancho no depende de su contenido: en una fila
flexible, dale `flex: 1`.

### Las que vienen hechas

| Componente | Variantes | Por defecto |
|---|---|---|
| `AdaptiveTabs` | `tabs`, `select` (un `<select>` nativo) y `bottom-nav` (`BottomNavigation`) | `select` en compacto, `tabs` desde medio |
| `AdaptiveTable` | `table` (`DataTable` con todas sus props) y `cards` (lista de tarjetas con los campos como lista de definiciones) | `cards` en compacto, `table` desde medio |
| `AdaptiveToolbar` | Cada acción en la barra o en el menú «más» (`variant: "menu"`), u oculta | Todas en la barra |
| `Shell` | Cada panel `docked`, `drawer` o `rail` (acoplado y plegado a iconos), u oculto | Sin `adaptive`, el corte en px de siempre |

```tsx
<Shell
  sidebar={{
    label: "Navigation",
    content: <Sidebar>…</Sidebar>,
    adaptive: { compact: { variant: "drawer" }, medium: { variant: "rail" }, expanded: { variant: "docked" } },
  }}
>
```

Con `adaptive`, el panel ignora `mode` y el corte en px, y la `Sidebar` de dentro se pliega sola en `rail` (si no le
pasas `collapsed`). Antes de medir, la hoja ya oculta el panel en las clases en que es cajón y lo estrecha en las
que es rail. En `zout/dom`, los mismos atributos que escribe el binding en el `<aside>`: `data-adaptive`,
`data-drawer-in`, `data-rail-in` y `data-hidden-in`.

## Saber la clase

```tsx
import { useSizeClass } from "@zuccadev-labs/zuix-zout";

const { sizeClass, pointer } = useSizeClass();          // la del AdaptiveLayout o AdaptiveSwitch que lo contiene
const own = useSizeClass(ref);                          // la del contenedor de consulta de `ref`
```

Fuera de un layout o un switch, y sin `ref`, mide la ventana. Hasta medir devuelve todo `null`: lo que se pinta en
el servidor no debe depender de la clase. Para eso están las plantillas y `AdaptiveSwitch`, que colocan con CSS.

Sin React, `sizeClassOf(el)` y `observeSizeClass(el, fn)` de `@zuccadev-labs/zuix-zout/dom`, y el evento
`z:sizeclass`.

## Editar el layout

El contrato es el mismo que guarda el editor visual: plantillas por clase y, en cada pieza, sus ajustes por clase.
La pantalla `?screen=adaptive` de la aplicación de ejemplo enseña la misma página en un marco redimensionable y un
panel para cambiar en vivo el área, el orden y la visibilidad de cada pieza en cada clase.

Las transiciones son opcionales. Con `transition` (o `data-transition`) cada pieza lleva
`view-transition-class: z-adaptive-item`, y un cambio hecho dentro de `adaptiveTransition(scope, update)` se anima
pieza a pieza con view transitions: el de una plantilla o de unos ajustes, o el ancho del marco de la pantalla de
ejemplo. `setAdaptiveTemplates` y `setAdaptiveItem` ya lo hacen. Con `prefers-reduced-motion: reduce` el cambio se
aplica sin animar. Un cambio de clase porque la ventana se estrecha no se anima: lo mueve la hoja en el mismo
fotograma, y mover después los nodos no cambia nada a la vista.

## Lo que no he comprobado

- Safari real: no tiene `moveBefore` ni `reading-flow`; el modo `dom` usa `insertBefore` y el `visual` avisa.
- Lectores de pantalla reales recorriendo un layout reordenado. Las suites comprueban el orden del DOM y el de Tab.
- Plantillas con muchas filas implícitas: una pieza sin área se lee detrás de las colocadas aunque la rejilla la
  meta en un hueco anterior.
