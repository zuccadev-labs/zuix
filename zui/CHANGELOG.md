# Cambios de @zuccadev-labs/zuix-zui

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

Base visual nueva, «liquid glass», sobre los tokens de `@zuccadev-labs/zuix-tokens`. Botón, campo, select,
pestañas, control segmentado e insignia son las piezas de referencia; el resto de componentes hereda escala,
radios y material de los tokens.

### Cambiado

- Botones, campos, selects, pestañas y segmentados son rectángulos de esquinas redondeadas, no píldoras, con
  radios concéntricos por tamaño (sm 8, md 10, lg 12) y alturas de 28, 34 y 40 px.
- Foco por contorno (`outline` con `focus-width` y `accent-ring`) en lugar de sombra: sigue al radio y se
  mantiene con colores forzados. En los campos va en el contenedor, separado 1 px; en rojo si el campo es
  inválido.
- Botón: la variante por defecto es de cristal (canto `glass-border` y brillo superior); el primario lleva
  brillo interior y sombra corta; peso 500; al pulsar cede un 3 % (`scale`) en lugar de bajar un píxel.
- Campo y select: fondo `control-bg-hover` al pasar el puntero; el icono inicial pasa a `fg-muted`; la
  etiqueta pesa 500 y la ayuda baja a 12 px. `SearchInput` deja de ser una píldora. Textarea con
  `field-radius-multiline`.
- Lista de opciones (Select, Combobox): cristal elevado (`popup-blur`, `popup-shadow`), opciones de 32 px con
  radio concéntrico, resaltado `surface-2`, marca en `accent-text` y entrada de 200 ms con `@starting-style`
  (sin soporte aparece sin transición; sin desplazamiento con movimiento reducido).
- Pestañas `segmented` y `SegmentedControl`: pista hundida con canto de cristal; la opción activa se levanta
  (`surface-3`, brillo y sombra) en lugar de llenarse de acento.
- Insignia: radio de 6 px y peso 500.
- Material: `.z-liquid` acepta `--z-lg-blur` y `--z-lg-shadow`; menús, popovers, diálogos y listas los usan
  para el cristal elevado. `.z-solid` desenfoca el 6 % del lienzo que deja ver. En `body.z-canvas` el
  degradado va en una capa fija (Safari de iOS ignora `background-attachment: fixed`). Con
  `prefers-reduced-transparency`, también `.z-solid` pasa a superficie opaca.
- Base: texto de interfaz con `leading-ui`; titulares con `text-wrap: balance` y párrafos con `pretty`.
- Fase D: el resto de componentes pasa a la anatomía del estándar. Nada en píldora: chips, avisos,
  paginación, pasos, flechas del carrusel, botón de copiar del código, cierres de diálogo y de alerta, iconos
  de estado vacío, de confirmación, de subida y de `StatTile` son rectángulos de radios concéntricos (o
  baldosas). `radius-full` queda para lo circular: avatar y su punto de estado, punto de insignia y de aviso,
  radio, interruptor y su pulgar, pomo del deslizador y spinners. Las barras finas (progreso, medidor, pista
  del deslizador) usan `radius-xs`.
- Foco por contorno en todos los componentes que aún usaban `focus-ring` como sombra (enlace, alerta,
  tarjeta interactiva, chip, tabla ordenable y fila pulsable, valoración, código, carrusel, migas,
  paginación, pasos, acordeón, árbol, enlaces de barra lateral, casilla, radio, interruptor, OTP, subida,
  avisos y diálogos); por dentro en las piezas de un control compuesto (fila, opción de menú, árbol, pestaña).
- Capas (modal, confirmación, popover, tooltip, menú, paleta, aviso): entrada con `@starting-style` (fundido,
  desplazamiento corto y, en modal, paleta y aviso, escala .98; sin desplazamiento ni escala con movimiento
  reducido) y salida con la animación de `data-state="closed"` que ya espera la presencia, también en Firefox
  y Safari. Panel lateral, paleta y avisos usan el cristal elevado (`popup-bg`, `popup-blur`,
  `popup-shadow`); modal y paleta con radio de panel (24); velo de los diálogos con `blur(6px)`.
- Diálogos: título 16/600, descripción 13, relleno 24; acciones con la anatomía del botón (cristal y
  primario de 34 px). Menú: opciones de 32 px con `item-radius`, 14/500, iconos de 16, atajos en 12 mono,
  destructivo sobre `danger-soft`. Paleta: opciones de 36 px, seleccionada levantada en `surface-2` con el
  icono en acento. Aviso: título 14, acción como botón de cristal sm.
- Tabla: cabecera 13/500 en `fg-muted` sin mayúsculas, celdas de 14 con relleno 12 × 16; fondo `surface` en
  la cabecera de la tabla enmarcada. Tarjeta: relleno 20, título 16 con interletrado `snug`, elevación al
  pasar con brillo y `shadow-md`. Código: `code-radius` (20), barra de 44 px, cuerpo 13/1,7.
- Navegación: enlaces de barra lateral de 32 px con `item-radius` y barra de acento de 2 px en el activo;
  página actual de la paginación levantada (cristal) en lugar de rellena de acento; árbol con filas de 32 px;
  acordeón con disparador de 40 px y cuerpo en `fg-prose`; marcadores de pasos en baldosa.
- `Slider`: el tirador es un objetivo de 24 × 24 px (WCAG 2.5.8) que dibuja dentro su pomo de 18 px (14 en
  `sm`) con `::before`; el aspecto no cambia. `--z-slider-thumb` pasa a ser el tamaño del objetivo y
  `--z-slider-knob` el del pomo.
- Casilla y radio con borde `control-border` (3:1) y brillo interior al marcarse.
- `SegmentedControl` sm: opciones de 24 px (antes 22) para el objetivo mínimo de WCAG 2.5.8; la pista mide 30 px
  y fija `box-sizing: border-box`.
- `Slider`: ancho mínimo de seis tiradores; en un contenedor ajustado a su contenido el 100 % era 0 y los
  tiradores de un rango se solapaban.


## [0.2.0] - 2026-11-18

Esta versión trae cambios incompatibles. Qué hay que tocar en una aplicación está en la
[guía de actualización](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/08-actualizar-de-0-1-a-0-2.md).

El paquete ya no depende de ninguna biblioteca de UI: `radix-ui` se retira y el binding de React usa
primitivas propias sobre la plataforma (`<dialog>`, Popover API), con la misma lógica que
`@zuccadev-labs/zuix-zui/dom`. En ejecución solo necesita `@zuccadev-labs/zuix-tokens`;
`@zuccadev-labs/zuix-zicon` es un peer obligatorio y React y React DOM 19, peers opcionales. Un proyecto que
solo usa el contrato HTML y `zui/dom` deja de instalar los más de setenta paquetes que llegaban por esa
dependencia.

### Cambios incompatibles

Entorno:

- Node 22.12 o posterior (antes, 20). Node 20 terminó su soporte el 2026-04-30.
- Navegadores admitidos: Chrome y Edge 116, Firefox 125, Safari 17 y Safari de iOS 18.3. Lo marca la Popover
  API.

Marcado y CSS:

- `Modal`, `Drawer`, `ConfirmDialog` y `CommandPalette` de React pintan un `<dialog>` abierto con
  `showModal()` (antes un `div[role=dialog]` y un `div.z-overlay-scrim` aparte). **La clase `z-overlay-scrim`
  y sus modificadores desaparecen**: el velo es `dialog::backdrop`. Un selector `.z-modal[role=dialog]` pasa
  a `dialog.z-modal`. Sin `title`, el nombre va en `aria-label` (antes un `h2.z-sr-only`).
- Variables CSS renombradas: `--radix-select-trigger-width` → `--z-anchor-width`;
  `--radix-*-content-available-height` → `--z-available-height`; `--radix-*-content-available-width` →
  `--z-available-width`; `--radix-toast-swipe-move-x|y` y `--radix-toast-swipe-end-x|y` →
  `--z-toast-swipe-…`; `--radix-accordion-content-height` → `--z-accordion-content-height`. No queda ningún
  `--radix-*`, `data-radix-*` ni id `radix-…`.
- Toast de React: la región es `div.z-toast-viewport[role=region]` con nombre y cada aviso un
  `div.z-toast[role=status|alert]` (antes `ol` y `li`). `toast()` del modo DOM genera el mismo `div`. La
  región solo existe mientras hay avisos.
- Menús de React: cada entrada es un `button[role=menuitem]` (antes `div`), el separador lleva
  `role="separator"` y el atributo `data-elevated` desaparece: todo va en la capa superior.
- `Popover modal` de React es un `<dialog>` abierto con `showModal()` (antes un `div[role=dialog]`). Un
  selector `.z-popover[role=dialog]` pasa a `dialog.z-popover` para el modal; el no modal sigue siendo un
  `div`.
- `Select` de React: `role="listbox"` va en `.z-listbox__viewport`, dentro de `.z-listbox`, y las opciones
  llevan `data-value`. Con `name` o `required`, el campo de formulario es un `<select>` nativo oculto
  (`.z-native-input`), no un `input[type=hidden]`.
- `Checkbox`, `Switch` y `Radio`: el campo nativo oculto lleva la clase `z-native-input` (antes estilos en
  línea) y está siempre en el marcado. `RadioGroup` y `SegmentedControl` ya no llevan `dir` ni `tabindex` en
  el grupo.
- `Tabs`: los ids son `…-tab-<valor>` y `…-panel-<valor>`; cada pestaña lleva `data-value`.
- `Accordion`: la cabecera es un `h2`…`h6` real según `headingLevel` (antes `h3` con `aria-level`); el
  contenido de una sección cerrada sigue montado, oculto con `hidden`; `.z-accordion` lleva `data-type`.
- `Slider` de React: los tiradores son hijos directos de `.z-slider` y la pista se sitúa con
  `inset-inline-start` y `-end`; el contenedor lleva `data-min`, `data-max`, `data-step` y `data-value`.

Props y tipos:

- `Popover`: el nombre accesible es obligatorio en los tipos: `label`, o `aria-labelledby` con el id de un
  encabezado del panel.
- `ToastProvider`: `label` se sustituye por `regionLabel` (nombre de la región, por defecto
  `Notifications (F8)`).
- `CheckboxProps`, `SwitchProps`, `RadioProps`, `RadioGroupProps`, `SliderProps` y `ToggleProps` son los
  atributos del elemento más las props propias (`checked`, `defaultChecked`, `onCheckedChange`, `value`,
  `onValueChange`, `pressed`, `onPressedChange`…). Desaparecen `asChild`, `dir`, `loop` y `forceMount`, y
  con ellas tres props que la suite no usaba: `form` en `RadioGroup`, `checked` y `required` en `Radio` (los
  decide el grupo) y `preserveThumbOrder` en `Slider`. `RadioGroup value` ya no admite `null`.
- `Slider` con varios tiradores envía un campo por tirador con el mismo `name` (antes `name[]`).

Comportamiento:

- `Button` e `IconButton` con `loading`: `aria-disabled="true"` en lugar de `disabled`. El botón no ejecuta
  `onClick` ni envía el formulario (pasa a `type="button"` mientras carga), pero conserva el foco del
  teclado.
- `confirm()` de `zui/dom`: **Escape cancela** (resuelve `false`), igual que `ConfirmDialog` en React y que
  el patrón de diálogo modal de APG. Antes Escape no hacía nada. El clic en el velo sigue sin cerrar.
- `ConfirmDialog`: cerrar con Escape llama a `onCancel`, además de a `onOpenChange(false)`.
- La dirección se lee del DOM: dentro de `dir="rtl"`, `Tabs`, `Menu`, `Slider`, `RadioGroup` y
  `SegmentedControl` de React reflejan las flechas sin proveedor ni prop.
- Escape cierra solo la capa de arriba y respeta un evento ya cancelado: en un `SearchInput` con texto dentro
  de un `Modal`, la primera pulsación limpia el campo y la segunda cierra el diálogo. En un submenú cierra
  ese nivel.
- `SegmentedControl` y `RadioGroup`: las flechas mueven el foco y la selección, con vuelta al otro extremo.
- `Menu` y `ContextMenu` de React: al abrir, el foco va a la primera entrada, también con el puntero (antes,
  con el puntero, lo recibía el menú sin resaltar ninguna). Es el patrón de botón de menú de APG y lo que ya
  hacía `zui/dom`. Las flechas dan la vuelta del último al primero.
- `Popover` no modal: salir con Tab por un extremo lo cierra y devuelve el foco al disparador. `Popover
  modal`: retiene el foco (Tab da la vuelta), bloquea el desplazamiento de la página y el resto queda inerte
  para el puntero, el teclado y los lectores de pantalla; una pulsación fuera solo lo cierra, sin llegar a
  lo que hay debajo.
- `DatePicker required`: el botón ya no lleva `aria-required` (su rol no lo admite); la obligatoriedad la
  valida un campo nativo oculto, que impide enviar el formulario vacío.
- Tooltip (React y `data-z-tooltip`): la burbuja recibe el puntero. Se puede pasar del disparador a ella sin
  que se cierre, y Escape la cierra (WCAG 1.4.13). Antes llevaba `pointer-events: none`.
- `Link disabled` ya no ejecuta `onClick`.
- `z:close` se emite también cuando un `<dialog>` de zui se cierra con `dialog.close()` o con
  `<form method="dialog">`, y `data-state` pasa a `closed`. Antes solo al cerrar con `closeDialog()`.
- Casilla (`role="checkbox"`) en modo DOM: Intro ya no la cambia; se marca con Espacio, como en React.
- Clic en el velo de un `<dialog>`: solo cierra si la pulsación empezó también en el velo.
- Los diálogos bloquean el desplazamiento de la página también en el modo DOM, y Tab da la vuelta dentro del
  diálogo en lugar de salir a la interfaz del navegador.
- `Pagination`: `page` se redondea y un `pageCount` no numérico cuenta como una página. `DataTable`: los
  `NaN` se ordenan al final.

Color:

- Los pares de color de las hojas que no llegaban al mínimo de WCAG 2.2 AA usan los tokens nuevos de
  `@zuccadev-labs/zuix-tokens`: `--z-*-text` para texto y `--z-*-solid` para fondos con texto encima.
  `--z-accent`, `--z-success`, `--z-warning`, `--z-danger` e `--z-info` quedan para rellenos, bordes e
  iconos. Cambia el tono de:
  - el texto con acento: `.z-link` (el hover se distingue por el subrayado pleno), `.z-table__sort[data-active]`,
    `.z-chip[data-selected]`, las iniciales de `Avatar`, `.z-toggle[data-state="on"]`, `IconButton active`,
    el día de hoy del calendario y los iconos de `FileUpload` y `ConfirmDialog`;
  - el texto de peligro: `Button variant="danger"`, `.z-field__required`, `.z-field__error`,
    `.z-menu__item[data-danger]` y el icono de `ErrorState` y de `ConfirmDialog intent="danger"`;
  - `Badge`: la variante suave y `outline` usan `--z-*-text`; la sólida, `--z-*-solid` de fondo. `StatTile`:
    el delta usa `--z-*-text`, y los textos secundarios de la variante sólida dejan de atenuarse;
  - `Rating`: las estrellas vacías usan `--z-control-border`;
  - `LoadingOverlay`: el velo es del color del lienzo, con el texto normal encima;
  - el botón de peligro de los diálogos usa `--z-danger-solid` de fondo.

### Añadido

- Una sola lógica para React y para `zui/dom`: colocación, foco itinerante, búsqueda por letra, dirección,
  capas y cierre al interactuar fuera, foco, bloqueo de desplazamiento, presencia, deslizar para descartar,
  fechas, paginación, orden de tabla, búsqueda sin acentos y aritmética del Slider. El HTML que emite React
  es el del contrato (`html.json`): se puede copiar a una página sin React.
- `init()` de `zui/dom` devuelve `destroy`, y `destroy()` se exporta: retira todos los listeners del
  documento y de la ventana. `init()` se puede volver a llamar.
- `zui/dom`: Rating de entrada (`.z-rating[data-interactive]`). Clic y flechas rellenan las estrellas y
  emiten `z:change { value }`. `Rating` de React: Inicio y Fin.
- `zui/dom`: el acordeón emite `z:change { value }` con las secciones abiertas, como `onValueChange` en
  React. En React y en DOM: flechas, Inicio y Fin entre cabeceras; la altura se anima con
  `--z-accordion-content-height`.
- `toast()` y Toast de React: el cierre automático se detiene mientras el puntero o el foco están en el
  aviso, y con la ventana sin foco (WCAG 2.2.1); F8 lleva el foco al aviso más reciente y Escape lo descarta.
  La región tiene `role="region"` y nombre (`regionLabel`).
- `openPopover(el, ancla, placement, { follow })`: un popover anclado a un elemento lo sigue al desplazar o
  redimensionar la página. `follow: false` lo deja donde se abrió. `place()` escribe `data-align`,
  `--z-available-width` y `--z-available-height`.
- RTL: propiedades lógicas en todas las hojas, iconos direccionales reflejados y teclado reflejado en Tabs,
  RadioGroup, Calendar, Tree, Rating, Slider y submenús, en React y en el modo DOM. El submenú abre hacia la
  izquierda y los popovers alinean `start` con el borde derecho del ancla.
- `forced-colors: active` (contraste alto de Windows): foco siempre visible y estados seleccionado, marcado,
  resaltado y deshabilitado con colores del sistema. `prefers-contrast: more`: cristal a superficie sólida,
  bordes fuertes y foco más grueso.
- `Field` nombra también los controles que `<label for>` no puede etiquetar (`RadioGroup`, `OTPInput`,
  `Slider`) con `aria-labelledby`. `useFieldLabel()` lo expone para controles propios.
- `Select required` participa en la validación nativa del formulario; `Select`, `Checkbox`, `Switch`,
  `RadioGroup` y `DatePicker` vuelven a su valor inicial con `form.reset()`.
- `Slider`: `inverted` en los dos ejes (`data-inverted` en el modo DOM).
- Submenús (React y DOM): zona de gracia del puntero al ir en diagonal hacia el submenú.
- `Tree` de React: búsqueda por letra, como en el modo DOM. `Calendar`: atributo `data-month="YYYY-MM"`.
  OTPInput (React y DOM): Supr borra el carácter de la casilla.
- `CommandPalette` (React y DOM): la búsqueda ignora acentos.
- Trusted Types: `zui/dom` escribe su marcado a través de la política `zuix-zui` (`trusted-types zuix-zui` en
  la política de seguridad de contenido).
- `Popover modal`: la inercia del resto de la página la pone el navegador (`<dialog>`), no atributos
  `aria-hidden` repartidos por el documento.
- Las hojas usan los tokens nuevos `--z-layer-raised`, `--z-layer-below`, `--z-space-1-5` y `--z-space-2-5`
  de `@zuccadev-labs/zuix-tokens` donde antes había un `z-index` o un espacio literal.
- `THIRD_PARTY_NOTICES.md` en el paquete.

### Corregido

- `Slider`: con un `max` que no es un paso desde `min` (`min` 0, `max` 10, `step` 3), el tope es el último
  paso que cabe (9), como en `<input type="range">`. Antes se podía arrastrar hasta 10 y el valor volvía a 9
  al redibujarse.
- `CommandPalette`: la coincidencia por subsecuencia cuenta caracteres, no unidades UTF-16. Una búsqueda con
  un emoji o una letra fuera del plano básico ya encuentra la entrada que los contiene.

Seguridad del modo DOM:

- `data-z-open`, `data-z-context`, `data-z-submenu` y `data-raster` se resuelven por id. Un valor que no es
  un selector válido ya no lanza una excepción en cada clic, y funcionan los ids con caracteres especiales,
  como los de `useId` de React.
- El icono de la opción elegida en Select y Combobox se copia nodo a nodo, sin volver a interpretar marcado;
  todo el marcado propio pasa por un único punto.
- Un disparador `data-z-open` deshabilitado (`disabled`, `aria-disabled`, `data-disabled`) no abre.
- Los eventos `keydown` sin `key` (autocompletado del navegador) ya no lanzan.

Accesibilidad:

- `confirm()`: el diálogo tiene nombre y descripción accesibles.
- Tooltip en modo DOM: aparece también en controles que ya tenían `aria-describedby` y la conserva; dentro de
  un diálogo modal se inserta en el diálogo, donde no queda inerte.
- `Rating` de entrada: cada estrella mide al menos 24 × 24 px (WCAG 2.5.8); en `sm` y `md` medía 18 y 22 px.
  Con `value` mayor que `max` sigue siendo alcanzable con el teclado.
- `NavLink disabled` con `href` lleva `role="link"`, y `NavLink` admite atributos HTML (`data-*`, `aria-*`,
  `id`). `Slider` dentro de un `Field` queda descrito por su ayuda y su error.

Comportamiento:

- Avisos con un diálogo modal abierto (React y `toast()`): la región se muda al diálogo de arriba y vuelve a
  `<body>` cuando se cierra, sin repetir la animación de entrada ni reiniciar el temporizador. Fuera del
  diálogo el navegador la deja inerte: el aviso se veía, pero no se podía pulsar, enfocar ni leer. En React
  la región vive en un contenedor `div[data-z-toast-root]` (`display: contents`), que es lo que se mueve.
- Carousel: un clic en un slide lateral cuando la tira está terminando de asentarse cuenta como clic. Antes
  se tomaba por «parar la tira» y se perdía, sobre todo con pocos fotogramas por segundo.
- Carousel en `zui/dom`: un `.z-carousel__viewport` escrito a mano sin `.z-carousel__stage` o sin
  `.z-carousel__track` lanza un error que lo dice, en lugar de un `TypeError` más adelante.
- Modo DOM: el cierre pedido por el sistema (gesto atrás) cierra el diálogo con su animación. Un acordeón
  anidado ya no cierra las secciones del exterior.
- `Calendar` sin `value`, `month` ni `defaultMonth`: sin desajuste de hidratación cuando el reloj del
  servidor y el del navegador caen en meses distintos. Fechas con año menor que 100 en `Calendar` y
  `DatePicker`.
- `NativeSelect`: el `placeholder` se muestra sin tener que pasar `defaultValue=""`.
- `FileUpload` con `name`: el campo conserva los archivos aceptados y el formulario los envía. Pasar el
  arrastre sobre un hijo de la zona ya no apaga `data-dragging`.
- `CommandPalette`: si los grupos cambian con la paleta abierta, el comando activo se acota a la lista; al
  reabrirla no se llega a pintar la búsqueda anterior.
- `Textarea autoRows` crece también sin controlar. `Avatar` detecta una imagen que falló antes de hidratar.
- Refs fusionadas (`SearchInput`, `DateInput`, `Combobox`, `Carousel`): respetan la función de limpieza de
  las refs de React 19 y no se reconectan en cada render.
- `DataTable`: reconoce fechas creadas en otro realm (un iframe), y una celda sin cifras en una columna
  numérica se ordena al final en lugar de contar como cero.
- `setPage(nav, NaN)` deja la página actual; `setSliderValue(el, NaN)` no mueve el tirador.
- Carousel en modo `gl`: si el navegador no ofrece WebGL2, se pregunta una sola vez por página.
- Contrato: el ejemplo «Activable» de Card y el «En línea» de Field producen marcado utilizable sin React.

## [0.1.0] - 2026-11-14

Primera versión publicada.

### Añadido

- 64 componentes en 8 grupos: acciones (5), formularios (17), datos (11), estado (7), contenido (7),
  capas (9), navegación (7) y Carousel. La lista con props, tokens y clases está en `manifest.json`.
- Contrato HTML: clases `z-*`, atributos de estado (`data-state`, `data-size`, `aria-*`) y el marcado de cada
  ejemplo en `html.json`, generado desde el binding de React.
- Estilos sobre tokens `--z-*`: `@zuccadev-labs/zuix-zui/styles.css` (todo) y `@zuccadev-labs/zuix-zui/styles/<grupo>.css`. Material
  liquid glass (`.z-liquid`, `.z-solid`).
- `@zuccadev-labs/zuix-zui/dom`: comportamiento sin framework. Diálogos, popovers, menús, menú contextual, tooltips,
  avisos, confirmación, pestañas, acordeón, controles de formulario, Select, Combobox, Calendar,
  DatePicker, Slider, OTPInput, FileUpload, CommandPalette, Tree, orden de DataTable, Pagination y
  Carousel. Eventos `z:open`, `z:close`, `z:change`, `z:select` y `z:sort`.
- `@zuccadev-labs/zuix-zui`: binding de React 19 sobre Radix. React es un peer opcional: el contrato y `dom` no lo usan.
- `@zuccadev-labs/zuix-zicon` es `peerDependency`: la aplicación lo instala junto a este paquete y hay una sola copia
  del registro de iconos.
- `dist/zui.css` y `dist/zui.dom.js`: listos para enlazar sin bundler.
- Salida de publicación: ESM compilado módulo a módulo con declaraciones en `dist/esm/`, y `"use client"`
  en los módulos con estado, eventos o Radix.
- Carousel sin React en modo `gl`: las zonas curvas se dibujan en WebGL2 cuando cada slide declara su imagen
  (`data-raster`, `data-raster="#selector"`, `data-raster-src`) o con `carousel(el, { rasterize })`. Cae a
  `css` sin WebGL2 o si falta una imagen. `carousel(el).refresh()` rehace réplicas y texturas.
- `@zuccadev-labs/zuix-zui/dom/carousel-gl` y `dist/zui.dom.carousel-gl.js`: los shaders, que `@zuccadev-labs/zuix-zui/dom` carga bajo
  demanda. `zui.dom.js` no los incluye.
- `README.md` en el paquete publicado.

### Táctil

- **Objetivo táctil de 40 px.** Con puntero principal grueso (`@media (pointer: coarse)`) los controles `sm` y `md`
  crecen hasta `--z-touch-target` (40 px; token de `@zuccadev-labs/zuix-tokens`): botones, campos, Select, pestañas,
  filas de árbol y de menú, opciones de lista. Checkbox, Radio y Switch ganan aire vertical, el Slider crece en
  su eje corto, y los botones de cierre (`.z-overlay-close`, `.z-alert__dismiss`), el botón del campo y las
  opciones de SegmentedControl amplían su zona de pulsación sin cambiar el dibujo. Con ratón nada cambia.
  `--z-touch-target: 0px` lo desactiva.
- **Sin hover pegajoso.** Todas las reglas `:hover` van dentro de `@media (hover: hover)`: en una pantalla táctil
  el último control tocado no se queda con el estilo de hover.
- `@zuccadev-labs/zuix-zui/dom`: los avisos (`toast()`) se descartan deslizando, con dedo, lápiz o ratón, igual que el Toast de
  React (a la derecha, o hacia el borde en las posiciones centradas). `.z-toast` declara `touch-action`. Al
  descartarlo, el aviso conserva el desplazamiento mientras se desvanece.
- `@zuccadev-labs/zuix-zui/dom`: el menú contextual (`data-z-context`) se abre con una pulsación larga de 600 ms con dedo o
  lápiz. iOS no emite `contextmenu`, y un Chromium de escritorio con pantalla táctil tampoco. El menú sigue
  abierto al levantar el dedo.
- ContextMenu de React en ventanas estrechas: si el menú no cabe a ningún lado del puntero, se estrecha hasta
  el hueco disponible en lugar de salirse de la ventana.
