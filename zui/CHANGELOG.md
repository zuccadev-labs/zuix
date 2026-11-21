# Cambios de @zuccadev-labs/zuix-zui

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

Base visual nueva, «liquid glass», sobre los tokens de `@zuccadev-labs/zuix-tokens`. Botón, campo, select,
pestañas, control segmentado e insignia son las piezas de referencia; el resto de componentes hereda escala,
radios y material de los tokens.

### Añadido

- Oleada 7, medios y piezas tardías (todo con contrato HTML, modo sin framework y binding de React sobre un solo
  árbol de `core/vnode`):
  - Familia `ColorPicker`: `ColorPicker` (área de saturación y brillo, tono, opacidad, campos por canal o
    hexadecimal, formato hex/rgb/hsl/oklch, muestrario, cuentagotas con `EyeDropper` como mejora progresiva y
    selector del sistema con `<input type="color">`, que también es el respaldo sin JavaScript),
    `ColorPickerTrigger` (botón con muestra que lo abre en un popover nativo), `ColorArea`, `ColorSlider` (tono u
    opacidad, horizontal o vertical), `ColorSwatchPicker` (radiogroup) y `ColorField`. El valor público es una cadena
    CSS; dentro se guarda en HSV para que el tono no se pierda en los grises. El área es un deslizador en dos ejes
    accesible con teclado; tono y alfa siguen el patrón APG «slider». En `/dom`, `setColorValue(el, valor)` y los
    avisos `z:change`, `z:changeend` y `z:formatchange`.
  - `core/color` (exportado desde la raíz: `parseColor`, `formatColor`, `normalizeColor`, `formatOf`,
    `rgbToHsv`/`hsvToRgb`, `rgbToHsl`/`hslToRgb`, `rgbToOklch`/`oklchToRgb`, `contrastRatio`): lectura de hex,
    `rgb()`, `hsl()`, `hwb()` y `oklch()` (con comas o espacios, porcentajes y ángulos), conversiones a OKLab según
    Ottosson con el croma reducido dentro de sRGB y escritura con redondeos estables (escribir, leer y volver a
    escribir da la misma cadena en los cuatro formatos, probado con fast-check).
  - `Carousel` ampliado sin cambiar su contrato: `autoplay` (`true` o milisegundos) con botón de pausa visible como
    primer control (WCAG 2.2.2), pausa con el puntero encima, con el foco dentro, con la pestaña oculta y fuera de
    pantalla, sin arranque automático con movimiento reducido y región viva callada mientras corre; `indicators`
    (`counter` por defecto, `dots`, `bar`, `thumbnails` con `renderThumbnail`, `none`); `slidesPerPage` (1–8) y
    `orientation="vertical"` (con `height`), que usan el desplazamiento nativo con scroll-snap. En `/dom`, los mismos
    con `data-autoplay`, `data-indicators`, `data-per-page` y `data-orientation`. Lógica en `core/carousel` y
    `core/carousel-runtime`, compartida por los dos modos.
  - Grupo `media`. `QRCode`: codificador propio (`core/qr`, ISO/IEC 18004: modo byte en UTF-8, versiones 1–40,
    corrección L/M/Q/H, Reed–Solomon sobre GF(256), las ocho máscaras con la penalización de la norma, formato y
    versión con BCH) probado contra los vectores de la norma; un solo `path` de SVG oscuro sobre claro con zona de
    silencio, `role="img"` con nombre, icono central opcional (sube la corrección a H). Sin estado: vale en un Server
    Component.
  - `CircularSlider`: deslizador en un anillo (círculo completo o arco abierto tipo dial, `arc` y `startAngle`) con
    el valor formateado en el centro, `caption`, marcas y el tirador de Slider; patrón APG «slider» y arrastre por
    todo el anillo (lo que cae en el hueco de un arco abierto va al extremo más cercano). Cálculo en `core/circular`.
  - `CompareSlider` (grupo `media`): antes/después con dos capas apiladas, divisor arrastrable y asa `role="slider"`
    con teclado, horizontal o vertical, rótulos opcionales. En `/dom`, un `.z-compare` con dos hijos recibe divisor y
    asa; `setCompareValue(el, valor)`.
  - `ImageCropper` (grupo `media`): área de recorte con ocho asas, relación de aspecto fija o libre, forma
    rectangular o circular, rejilla de tercios, teclado (flechas mueven, Mayús + flechas redimensionan, Alt
    multiplica el paso) con anuncio en una región viva; recorte en fracciones y en píxeles. `cropImage` y
    `cropImageBlob` (raíz y `/dom`) dibujan la salida en un canvas o un Blob (PNG, JPEG o WebP, `maxSize`, círculo
    transparente). Cálculo en `core/crop`.
  - `SignaturePad` (grupo `media`): firma con el puntero (presión, trazado suavizado, eventos fusionados), deshacer,
    borrar y la alternativa accesible de escribir el nombre (modo «Type»); `signatureValue(el)` (trazos y SVG) y
    `signatureBlob(el)` (PNG) en la raíz y en `/dom`; campo oculto con el SVG para formularios. Cálculo en
    `core/signature`.
  - `ShortcutInput`: captura de atajos con normalización portable («Mod+Shift+K»: ⌘ en Apple, Ctrl en el resto),
    teclas por su posición física, vista con las teclas de la plataforma, Escape cancela, Retroceso borra, Tab sale
    sin grabar y anuncio en una región viva. `core/shortcut` exporta `parseShortcut`, `normalizeShortcut`,
    `shortcutLabels`, `ariaKeyshortcuts` y `matchesShortcut` para escuchar el atajo guardado.
  - `Confetti` (grupo `effects`) y `confetti(opciones)`: ráfaga de papel en un lienzo fijo encima de la página, sin
    puntero ni foco, con los colores `chart-1…8` de la marca; no anima con movimiento reducido y se quita al terminar o
    con la pestaña oculta. En `/dom`, `data-z-confetti` en un botón. Física en `core/confetti`.
  - `DownloadTrigger` (grupo `actions`): botón que genera el archivo al pulsar (texto, Blob, bytes o una función
    asíncrona con estado de carga) o descarga una URL, con enlace temporal y URL liberada. En `/dom`,
    `data-z-download="#id"` descarga un QRCode (SVG o PNG), un SignaturePad, un canvas o un texto; `download`,
    `downloadBlob` y `downloadUrl`. `qrcodeSvg(props)` da el QR como SVG autónomo.
  - `DotMatrix`: seis patrones propios más (`diamond`, `radar`, `zigzag`, `helix`, `heart`, `cascade`), 18 en total.

- Oleada 6, efectos y cargadores con estética liquid glass (todo con contrato HTML, modo sin framework y binding de
  React; movimiento solo con `prefers-reduced-motion: no-preference`, en pausa fuera de pantalla con un único
  `IntersectionObserver` compartido, `core/visibility`):
  - `Spinner` con `shape`: `ring` (por defecto, sin cambios), `dots` (tres puntos) y `bars` (cuatro barras).
  - `DotMatrix`: cargador de rejilla de puntos (2–16 × 2–16) con 12 patrones de diseño propio (`wave`, `rain`,
    `spiral`, `pulse`, `sweep`, `checker`, `orbit`, `ripple`, `cross`, `snake`, `equalizer`, `sparkle`), CSS puro
    (cada punto desfasa la misma animación de opacidad y escala), `role="status"`, fotograma quieto con movimiento
    reducido. `DOT_PATTERNS` exportado; en `/dom`, `setDotMatrixPattern(el, patrón)` y dibujo de los puntos si el
    marcado llega sin ellos.
  - Grupo `effects`: `Backdrop` (rejilla, puntos, hexágonos y malla de color; tres intensidades, desvanecido y
    deriva), `BorderBeam` (haz cónico que recorre el borde), `Glow` (brillo de borde o superficie que sigue al
    puntero), `AttentionRing` (anillo o halo que late tres veces y queda fijo) y `TextEffect` (aparición por
    palabras o letras, desenfoque, degradado con tokens de texto y brillo de espera; texto entero para los lectores
    y visible sin JavaScript).

- Oleada 4, capas y navegación de aplicación:
  - `Toolbar`, `ToolbarGroup` y `ToolbarSeparator` (patrón APG «toolbar»): una sola parada de tabulación para
    todos los controles de la barra, también los de un `ToggleGroup` anidado, flechas del eje con vuelta, Inicio y
    Fin, y la barra recuerda el último control. Variantes `glass` (cromo) y `plain`, horizontal y vertical. En
    `/dom`, `.z-toolbar[role=toolbar]`.
  - `Collapsible` (patrón APG «disclosure»): plegada, la región lleva `hidden="until-found"` y la búsqueda en la
    página la abre; colapso parcial con `peek` (fundido, el botón tras el texto y el foco dentro lo despliega),
    variante `card` y deshabilitado. En `/dom`, `.z-collapsible` y `setCollapsibleOpen()`.
  - `Banner`: franja de aviso de página (`page`) o de panel (`inline`) en seis tonos, con insignia, acción (al lado
    del texto si cabe, debajo si no: consulta de contenedor) y cierre con nombre que deja el foco en el siguiente
    elemento tabulable. Persistente; `live` lo anuncia si se inserta tras una acción. En `/dom`, `.z-banner` con
    `z:dismiss` cancelable y `dismissBanner()`. Utilidad `nextTabbable()` en `core/focus`.
  - `Menu` y `ContextMenu`: entradas casilla (`{ type: "checkbox", checked, onCheckedChange }`,
    `menuitemcheckbox`: Espacio la cambia y deja el menú abierto, Intro o el clic la cambian y cierran), grupos de
    radio (`{ type: "radio-group", label, value, onValueChange, items }`, `menuitemradio` en un `group` con nombre) y
    entradas enlace (`href`, `<a role=menuitem>`). Tipos `MenuCheckboxEntry`, `MenuRadioGroupEntry` y
    `MenuRadioItem`. En `/dom`, `aria-checked` y `z:change` en la casilla o en el grupo.
  - `Menubar` (patrón APG «menubar»): barra de menús de aplicación con una sola parada de tabulación, flechas entre
    títulos y entre menús abiertos (también desde un submenú), Flecha arriba para entrar por la última entrada y
    cambio de menú con el puntero cuando ya hay uno abierto. Cada menú es el de la suite (submenús, casillas,
    radios). Lógica en `core/menubar`. En `/dom`, `.z-menubar[role=menubar]` con títulos `data-z-open` y
    `openMenubarMenu()`.
  - `Popover`: ancla distinta del disparador (`anchor`), flecha hacia el centro del ancla que sigue al lado en
    que quede el panel (`arrow`) y botón de cierre (`showClose`, `closeLabel`). Donde el navegador tiene CSS anchor
    positioning, el popover no modal se ancla con CSS (`position-area`, `position-try-fallbacks`) y la colocación
    propia queda de respaldo; si el motor deja la capa lejos del ancla, se vuelve a ella. En `/dom`, `data-arrow`
    en el popover y `data-z-anchor="#id"` en el disparador; `openPopover()` acepta `{ trigger }`. Nuevos
    `core/anchor` (`anchorWithCss`, `positionArea`, `supportsAnchor`) y `arrowOffset` en `core/place`; `place()`
    escribe `--z-arrow-offset`.
  - `HoverCard`: vista previa al pasar el puntero (retardos de apertura y cierre) o enfocar un enlace, que lo
    describe (`aria-describedby`); el puntero cruza a la tarjeta sin cerrarla, Escape y una pulsación fuera la
    cierran y Tab entra en ella y sale hacia lo que sigue al enlace. Flecha opcional.
  - `Toggletip`: botón de ayuda con nombre propio y `aria-expanded`; el puntero o el foco la asoman, el clic la fija.
  - Lógica común en `core/interest` (`createInterest`, `bridgeTab`). En `/dom`, `[data-z-hovercard]` y
    `[data-z-toggletip]` con `.z-hovercard`/`.z-toggletip` en `popover=manual`, y `setHintOpen()`.
  - Avisos de promesa: `useToast().promise(promise, { loading, success, error })` y `update(id, options)`; el aviso
    en curso lleva anillo y `aria-busy` y no se cierra solo, y el resultado (texto, opciones o función del valor) se
    escribe en el mismo aviso, que entonces empieza su cuenta atrás. En `/dom`, `toastPromise()`; `toast()` devuelve
    además `update()`. Opción `loading` en los dos.
  - `Command`: la paleta de comandos incrustada en la página (sin diálogo), con el mismo patrón combobox; Escape
    vacía la búsqueda. `CommandPalette` y `Command` aceptan `footer` (`.z-palette__footer`). En `/dom`,
    `.z-palette.z-command`.
  - `ActionBar`: barra flotante de acciones sobre una selección (recuento vivo, acciones y cierre) sobre Toolbar;
    `fixed`, `sticky` o `inline`; Escape y el cierre vacían la selección. En `/dom`, `.z-actionbar` con `z:close`
    cancelable y `closeActionBar()`.
  - `Drawer`: lado `top`, asa para arrastrar y cerrar (`dragToClose`) y puntos de anclaje (`snapPoints`,
    `snapPoint`, `defaultSnapPoint`, `onSnapPointChange`, `handleLabel`) en `top` y `bottom`: el asa es un slider
    con flechas, Re Pág/Av Pág, Inicio y Fin, y el arrastre va al anclaje más cercano con su inercia o cierra por
    debajo del menor. Lógica en `core/sheet` (`sheetRelease`, `snapKey`, `attachSheet`). En `/dom`,
    `dialog.z-drawer[data-drag]` con `.z-drawer__handle`, `data-snap-points` y `setDrawerSnap()`.
  - `Tour`: recorrido guiado no modal con una tarjeta (role=dialog con encabezado) anclada a cada elemento, anillo
    que lo resalta, progreso, Anterior, Siguiente/Hecho y Saltar; el foco entra en la tarjeta en cada paso, Escape
    o Saltar lo cierran y el foco vuelve a donde estaba; las flechas laterales cambian de paso. Lógica en
    `core/tour`. En `/dom`, `startTour()`.
- DataTable, oleada 5: selección de filas con casillas (`selectable`, `selectedKeys`, `defaultSelectedKeys`,
  `onSelectionChange`, `isRowSelectable`), «seleccionar todo» de la página con estado indeterminado, Mayús +
  clic para un rango y conteo visible anunciado (`role="status"`, `selectedLabel`); pie en `tfoot` por columna
  (`footer`, contenido o función sobre todas las filas); paginación integrada con Pagination (`pageSize`,
  `page`, `defaultPage`, `onPageChange`, `manualPagination` + `rowCount`, `rangeLabel`). Sin las props nuevas
  el marcado no cambia. Modo DOM (`.z-datatable`): `data-page-size`, `data-selected-label`,
  `data-range-label`, `z:selectionchange` y `z:pagechange`, y `setDataTableSelection()`,
  `dataTableSelection()` y `setDataTablePage()` en `/dom`. Lógica en `core/selection`.
- Tree, oleada 5: `selectionMode="multiple"` (`aria-multiselectable`; Ctrl/Cmd y Mayús con el puntero,
  Espacio, Mayús+flechas y Ctrl+A; `selectedIds`, `defaultSelectedIds`, `onSelectedChange`), casillas en
  cascada con estado mixto (`checkable`, `checked`, `defaultChecked`, `onCheckedChange`; `aria-checked`
  true/false/mixed) y renombrar (`renamable`, `onRename`, `renameLabel`: F2 o doble clic, Intro confirma,
  Escape cancela). Modo DOM: `aria-multiselectable`, `data-checkable`, `data-renamable`, `z:change` con
  `values` y `checked`, `z:rename` cancelable y `checkTreeItem()`/`renameTreeItem()` en `/dom`. Lógica en
  `core/tree` (cascada, rangos, profundidad).
- `JsonTree`: visor de JSON y de valores de JavaScript sobre Tree (tipos con color de texto, `Array(3)`,
  `Map(2)`, `Set(1)`, fechas, bigint, `[Circular]`), `defaultExpandDepth`, `maxStringLength` (texto completo en
  `title`), rutas `$.a[0].b` con `onSelect` y `copyPath` (anuncio en `role="status"`). Modo DOM: `.z-jsontree` con
  `<script type="application/json" data-value>` o `setJsonTreeValue(el, valor)`; `z:select` y `z:copy`.
- Stepper: icono por paso (`icon`), estado de carga (`loading`: marcador que gira y `aria-busy`) y panel por
  paso (`content`) con Anterior/Siguiente (`onStepChange`, `completed`, `navLabels`, `nextDisabled`). El foco va
  al panel nuevo y los ocultos conservan lo escrito. Modo DOM: `.z-stepper-panels` (`data-current`, `z:change`,
  `setStep()` en `/dom`). Sin cambios para el Stepper sin paneles.
- Breadcrumb: migas colapsadas (`maxItems`, `itemsBeforeCollapse`, `itemsAfterCollapse`, `collapsedLabel`): las
  del medio pasan a un Menu tras un botón «…»; y separador propio (`separator`). Modo DOM con `data-z-open` y un
  `.z-menu[popover]` de enlaces.
- Accordion: variante tarjeta (`variant="card"`, radios concéntricos) y `collapsible={false}` (con una sola
  abierta, su cabecera lleva `aria-disabled` y no la cierra; sigue en las flechas). Modo DOM: `data-variant="card"`
  y `data-collapsible="false"`.
- Gráficos propios en SVG, sin dependencias (grupo `charts`): `LineChart`, `AreaChart` (apiladas con `stacked`),
  `BarChart` (vertical u horizontal, agrupadas o apiladas, negativos), `DonutChart`, `PieChart` y el genérico
  `Chart`. Escalas lineal, temporal (marcas de calendario) y de banda, marcas «bonitas» (1, 2, 2,5, 5 × 10ⁿ), apilado
  por signo, sectores y curvas lineal, monótona y escalonada en `core/chart`; la pieza en `core/chart-widget` (un
  árbol para React y para el modo DOM). Ejes con rótulos de `Intl` (compactos desde 10 000), cuadrícula, leyenda con
  botones `aria-pressed` que ocultan series (`hidden`/`defaultHidden`/`onHiddenChange`; el color sigue a la serie),
  tooltip y cruceta al pasar y al enfocar, una posición enfocable por punto con su nombre completo (flechas,
  Inicio/Fin, Re Pág/Av Pág, Intro → `onPointClick`), tabla de datos alternativa («View as table»), `figure` +
  `figcaption` con resumen calculado, marcadores con forma (`markers`) y trazos o tramas (`patterns`, siempre con
  colores forzados e impresión), entrada animada que respeta `prefers-reduced-motion`, RTL y consultas de
  contenedor. Marcas de línea, área y sector en SVG con trazos que no escalan; barras, puntos, ejes y tooltip en
  HTML colocado por fracciones (nada se mide). Modo DOM: `.z-chart` con `data-type`, `data-x-key`… y datos en
  `<script type="application/json" data-props>`; `z:pointclick`, `z:hiddenchange`, `z:viewchange`.
- `Sparkline` (línea, área o barras; imagen con nombre que resume la serie; sin estado, vale en un Server
  Component; modo DOM con `.z-sparkline[data-values]`) y `StatTile` con `trend` y `trendProps`.
- Datos y contenido, oleada 5: `Timeline` (`<ol>`, formas de punto, estilos de línea, alineación inicio/fin/alterna
  que pasa a una columna en estrecho, `<time datetime>`), `CircularProgress` (sobre `<progress>`), `Progress`
  vertical y segmentada, `DescriptionList` (`<dl>`), `Item`/`ItemGroup`, `StatusDot` (tono, tamaño, pulso; nunca
  solo color), `Chip` con `tone`, `CardMedia` y `AspectRatio`.
- Lectura y formato: `Prose` (`.z-prose`, con `.z-not-prose` para salir), `ScrollArea` (región enfocable con nombre,
  `scrollbar-color`/`scrollbar-width` y sombras solo hacia donde queda contenido, sin JavaScript), `Marquee` (copias
  `inert`, pausa al pasar o enfocar, botón de pausa visible, quieto con `prefers-reduced-motion`), `Highlight`
  (`<mark>`, varias consultas, sin mayúsculas, sin acentos o palabras completas; `setHighlightQuery()` en `/dom`) y
  `FormatNumber`, `FormatByte` (decimal con unidades de `Intl` o binario IEC) y `FormatDate` (`<time datetime>`, o
  relativa con RelativeTime). Lógica en `core/format`; modo DOM en `dom/reading`.
- Calendar completo: modo `multiple` (`maxSelected`), varios meses (`numberOfMonths`, `pagedNavigation`) con
  una sola rejilla para el teclado, vistas de mes, año y década (clic en el título, `view`, `minView`,
  `maxView`), desplegables nativos de mes y año (`captionLayout`), preajustes (`presets`, claves de
  `rangePresets`), fechas reservadas (`isDateUnavailable`, tachadas y con trama, cortan un rango),
  `modifiers`, semanas fijas, números de semana (ISO o del locale), botón Hoy, `today`, tamaño de celda,
  contenido por celda (`renderDay`, `getDayDescription`), leyenda, `minRange`/`maxRange` y Ctrl+Inicio/Fin.
  Valores ISO civiles; acepta un `Temporal.PlainDate` en `value`.
- DatePicker: modo `multiple`, dos meses, preajustes, `confirm` con Aplicar/Cancelar, `closeOnSelect`,
  `formatValue`, `formatCount` y `serialize`. Nuevos `DateRangePicker` (dos meses por defecto),
  `MonthPicker` (`YYYY-MM`), `YearPicker` (`YYYY`) y `WeekPicker` (`YYYY-Www`).
- Utilidades de fechas civiles en la raíz y en `/dom`: `rangePresets`, `resolvePreset`, `formatDateRange`,
  `isoWeekText`, `weekStartOf`, `weekNumber`, `localeWeekInfo`. En `/dom`, `setCalendarOptions()` para las
  funciones del calendario y los eventos `z:monthchange` y `z:viewchange`.
- `DateTimePicker`: campo tecleable (DateField) con calendario y TimeField en el mismo panel, valor
  `YYYY-MM-DDTHH:mm[:ss]` sin zona; con `granularity="day"` es el DatePicker con campo tecleable
  (`DatePicker input`). Alt+Flecha abajo abre.
- Agenda, oleada 2. `EventCalendar` añade las vistas `year` (12 minimeses con densidad en el fondo y en el
  nombre, `density`), `perpetual` (año perpetuo de una página) y `timeline` (recursos del día, `resources`), un
  contenido propio por evento (`renderEvent`, sin perder el nombre accesible completo), carga por rango visible
  (`loadEvents`, `onRangeChange`; en `/dom`, `setAgendaOptions()` y `z:rangechange`), el chevrón de continuación en
  las barras de varios días y la banda continua de la semana visible en el minicalendario.
- Agenda con muchos eventos (5000 en un mes): la rejilla de horas pinta como mucho cuatro solapes lado a lado en la
  semana (ocho en el día) y el resto en un «+N» por hora en la última columna del grupo (nombre «+3 more,
  Thursday 19 November, 10:00–11:00», con tabulador y flechas, que abre el popover de ese intervalo); la lista
  (`agenda`) pinta solo su ventana visible con un margen a partir de 150 filas (rellenos del alto del resto,
  `aria-setsize`/`aria-posinset`, la fila con el foco siempre pintada; Inicio y Fin van al primero y al último
  aunque no estén pintados). Arrastrar con el puntero en la vista `timeline` del EventCalendar (mover y alargar
  por el asa del final, con desplazamiento automático horizontal). En `/dom`, `setAgendaOptions({ density })`
  para la vista de año.
- `layoutTimed` devuelve además el grupo de solape de cada trozo (`group`, `groupStart`) y acepta un tope de
  columnas.
- Piezas nuevas del grupo `agenda`, en React y sin framework (`/dom`, `setWidgetProps()`): `PerpetualYear`
  (tabla con caption, instrucciones y buscador con respuesta en texto), `TimelineView` (Gantt con fases
  plegables, progreso, hitos, dependencias, camino crítico, hoy y zoom día/semana/mes; recursos con conflictos
  con trama y texto, crear arrastrando y ventana virtual de filas), `FreeBusy` (buscar hueco entre zonas),
  `SlotPicker` (franjas de cita con zona del visitante y 12/24 h), `CalendarHeatmap` (5 niveles, leyenda,
  etiqueta al enfocar, tabla alternativa, `encoding="size"`, filo con contraste alto) y `HabitCalendar` (rachas
  con banda, estados con forma e icono, variante de semana).
- Estancia en Calendar y DatePicker de rango: `isDateCheckoutOnly`, `rangeUnit="nights"`, aviso visible del
  mínimo (`minRangeLabel`), flexibilidad de fechas (`flexibility`, `flexibilityOptions`, `onFlexibilityChange`)
  y ajuste ±1 noche (`showLengthStepper`). En `/dom`: `data-checkout-only-dates`, `data-range-unit`,
  `data-length-stepper`, `data-flexibility` y `z:flexibilitychange`.
- Núcleo sin documento con pruebas: `core/perpetual`, `core/heatmap` (niveles por cuantiles, rachas),
  `core/timeline` (escalas, rutas de dependencias, camino crítico), `core/freebusy`, `core/virtual` y
  `core/slots`.
- `EventCalendar` (grupo nuevo `agenda`): barra (Hoy, anterior, siguiente, título con `aria-live`, zona horaria,
  vistas), lateral con minicalendario (Calendar) y calendarios como leyenda, y vistas de día (con segunda zona),
  semana, semana laboral, mes con eventos (barras de varios días, «+N more» con popover, puntos y lista del día en
  estrecho) y lista. Eventos ISO con fin exclusivo: todo el día, con `timeZone`, flotantes o instantes; series RRULE
  (subconjunto de RFC 5545) con `exdate` y excepciones. Mover, redimensionar y crear arrastrando con puntero;
  agarrar–mover–soltar con teclado; «Move to…» (tecla Menú, Mayús+F10 o el detalle) como alternativa sin
  arrastre; una región viva con retraso. Modo DOM con el mismo árbol (`setAgendaEvents`, `setAgendaCalendars`,
  `setAgendaView`, `destroyAgenda`, eventos `z:eventchange`, `z:selectslot`…). En la raíz: `expandEvents`,
  `layoutTimed`, `layoutRow`, `rewriteSpan`, `parseRRule`, `expandDates`, `formatRRule`, `toWall`, `fromWall` y
  `wallStatus`.
- `Timer`: cuenta atrás (`duration` en segundos o `PT…`) y cronómetro (`mode="stopwatch"`), con iniciar, pausar,
  reanudar y reiniciar, décimas (`precision`), cifras del locale y modo DOM (`startTimer`, `pauseTimer`,
  `resetTimer`, `z:statechange`, `z:complete`). La pantalla es `role="timer"` sin región viva; los hitos
  (inicio, pausa, cada `announceEvery` segundos, los últimos `announceFinal`, fin) van a un `role="status"`.
- `WeekPicker mode="range"`: de una semana a otra, valor `{ from, to }` con semanas `YYYY-Www`.
- Calendar: `onWeekNumberClick` (y `data-week-select` en `/dom`, con `z:week`) convierte el número de semana en
  un botón que elige la semana; `presetsPlacement="top"` pone los preajustes encima.
- DatePicker y DateRangePicker: `drawer="auto" | "always"` abre el calendario en una hoja inferior (Drawer
  modal) con puntero grueso o ventana estrecha; también en `/dom` con `data-drawer`.
- DateTimePicker: `min` y `max` con hora limitan también las horas del día límite (el TimeField del panel y el
  valor al aplicar).
- `RelativeTime`: «3 minutes ago», «in 2 days» con `Intl.RelativeTimeFormat` sobre un instante, en un `<time>`
  con `datetime` y la fecha completa en `title`; se repinta con una cadencia que se alarga con la distancia.
- `DateField`: fecha (y hora, con `granularity`) que se teclea por segmentos, un spinbutton de APG por día, mes,
  año, hora, minuto, segundo y AM/PM, en el orden y con los separadores del locale. Teclado completo (flechas con
  ciclo, RePág/AvPág, Inicio/Fin, dígitos con avance, Retroceso, flechas laterales también en RTL, `a`/`p`), una
  sola parada de Tab, pegado de una fecha entera (ISO o en el formato del locale), `min`/`max`, `minuteStep`,
  `secondStep`, `hourCycle`, `placeholderValue`, `clearable`, `readOnly` y campo nativo oculto (`name`) con
  validez propia. El 31 de febrero se acepta al teclear y se marca al salir. Valor ISO civil, sin zona.
- `TimeField`: el mismo campo solo con hora; valor `HH:mm` o `HH:mm:ss` en 24 h, ciclos h11, h12, h23 y h24, y
  `min`/`max` que cruzan la medianoche.
- `TimePicker`: `TimeField` con un panel de columnas (horas, minutos, segundos, AM/PM; un listbox por columna) o
  de franjas de `step` minutos filtrables al teclear; `isTimeDisabled`, `min`, `max` y botón «Now» opcional.
- Modo sin framework de los tres (`.z-datefield`, `.z-timefield`, `.z-timepicker`) con `setDateFieldValue()`,
  `setTimeFieldValue()` y `setTimePickerValue()` en `@zuccadev-labs/zuix-zui/dom`. Lógica compartida en
  `core/segments` y `core/time`.

- Formularios y acciones (oleada 3). Nuevos: `InputGroup` (con `InputGroupAddon`, `InputGroupText`,
  `InputGroupInput`, `InputGroupTextarea`), `PasswordInput` (mostrar u ocultar con aria-pressed, medidor
  opcional), `NumberInput` (spinbutton con pasos, topes, rueda opcional y formato con `Intl.NumberFormat`),
  `Listbox` en línea (única o múltiple, grupos, búsqueda por letra), `TagsInput`, `CheckboxGroup` (con casilla
  «todas»), `Fieldset` y `FieldGroup`, `Form` (validación nativa pintada en los campos y foco al primer error),
  `Editable`, `ButtonGroup` (+ `ButtonGroupSeparator`), `ToggleGroup`, `CopyButton` y `Swap`.
- Variantes: Button `outline` y `link`, tamaños `xs` y `xl` (también IconButton); Toggle `variant="ghost"`;
  SegmentedControl `orientation="vertical"` y `variant="underline"`; Checkbox, Radio (por RadioGroup) y Switch
  `variant="card"`, y Switch con `description` e `invalid`; Field `validate` (mensajes por `ValidityState`);
  Select `multiple`, `maxSelected`, `formatValue` y `emptyText`; Combobox con grupos, `multiple` (piezas),
  `allowCustomValue` (autocompletar) e `icon`; Slider `marks`; Rating `allowHalf`; OTPInput `groups` y
  `placeholder`; NativeSelect con grupos (`<optgroup>`); FileUpload `showFiles` (miniatura, progreso y quitar),
  `directory` y `capture`.
- `/dom`: los mismos comportamientos sin React y `setNumberInputValue()`, `setListboxValue()`, `setTagsValue()`;
  `setSelectValue()` acepta una lista con Select múltiple. Eventos nuevos: `z:copy`, `z:copyerror`, `z:invalid`,
  `z:reject`.
- Tipos `ButtonVariant`, `ButtonSize` y `CheckedState`, y hoja `styles/fields.css`.

### Cambiado

- Rendimiento de la agenda (5000 eventos, build de producción, CPU del hilo principal por interacción): pasar de
  semana, de 700–770 ms a 150–200 ms (una semana con 1156 eventos: se pintan 254 y el resto va a «+N»); abrir la
  lista de 30 días, de 430–540 ms a 30–50 ms; el mes, el día y el año, de 120–150 ms a 55–75 ms.
  `expandEvents` usa un índice por intervalos (búsqueda binaria; se vuelve a indexar si la lista o un evento cambian
  en su sitio) con memoria por rango (la misma lista y las mismas ocurrencias para el mismo rango: no se
  modifican), las vistas reparten las ocurrencias por día en una sola pasada, los carriles del mes dejan de buscar
  más allá de `dayMaxEvents`, el marcado de cada evento se memoriza (mover el foco o arrastrar no vuelve a recorrer
  los que no cambian, ni en React ni en el modo DOM, que además compara atributos con el pintado anterior en vez de
  leer el documento) y el minicalendario no se vuelve a pintar si no cambia su mes. El aviso de rango
  (`onRangeChange`, `z:rangechange`) y la carga (`loadEvents`) pasan a después del siguiente pintado.
- Modo DOM: el parcheo con claves ya no sustituye un nodo que hará falta más adelante (lo recoloca) y devuelve el
  foco a la pieza que mueve; los datos de los `<script type="application/json">` se analizan una vez por texto.

- `Button` e `IconButton` respetan un `aria-disabled` recibido (antes lo pisaba el estado de carga) y, con él,
  no ejecutan `onClick`: un botón apagado que conserva el foco, como pide una barra de herramientas.
- `ToggleGroup` dentro de una `Toolbar` deja a la barra la parada de tabulación y las flechas.
- Un menú que se vuelve a abrir durante su animación de salida se monta de nuevo: el foco vuelve a su primera
  entrada (antes se quedaba en el menú que se cerraba).
- Calendario con la base liquid glass: celdas de 36 px con radio de control (no círculos), hoy con anillo y
  punto, elegido en acento sólido con brillo, banda de rango redondeada en los extremos de cada fila, cristal
  elevado con `className="z-liquid"`. Los días no elegibles ya no van tachados (lo va la fecha reservada).
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

### Corregido

- Revisión visual de la oleada 5:
  - `AspectRatio` ocupa el ancho de su contenedor (en una fila flex encogía hasta su contenido) y sin medio (solo un
    icono de relleno) se ve como un hueco de superficie con su proporción; antes era invisible.
  - Rejilla de horas (`EventCalendar`, `TimeGrid`): la hora en punto a menos de media hora de «ahora» cede el sitio a
    su rótulo (se pisaban), y el desplazamiento inicial no deja el rótulo de «ahora» a medias bajo la cabecera.
  - `ColorPicker` y `ColorField`: los campos de canal recuperan su relleno compacto (la talla `sm` del campo lo
    pisaba) y un valor de tres cifras («260» en H de OKLCH) se ve entero.
  - `Carousel` y `CompareSlider` ocupan el ancho de su contenedor también dentro de una fila flex: el carrusel encogía
    hasta 139 px (con tres por página, slides de 33 px y el texto letra a letra) y la comparación con capas sin
    ancho propio quedaba en 0.
  - `Carousel` con varias por página: cada slide tiene un ancho mínimo (`--z-carousel-slide-min`, 11rem) y en una tira
    más estrecha se muestran las que caben (con sus posiciones, puntos, barra y flechas al día, en React y en
    `/dom`); antes, tres por página a 390 dejaban tarjetas de 45 px con el título partido.
  - `ColorPicker` y `ColorField` estrechos (menos de 18rem): el formato va en su propia línea y cada canal tiene un
    suelo en el que caben tres cifras (antes, en 220 px, el canal A medía 18 px y cortaba «100»).
  - `CardMedia` a sangre con ancho explícito: en WebKit salía más baja que su proporción (2,19 en vez de 16:9).
  - `ScrollArea` con sombras lleva relleno: el contenido ya no toca sus cantos.
  - `Accordion` ocupa el ancho de su contenedor también dentro de una fila flex (encogía y el chevron se pegaba al
    título).
  - El ejemplo apilado de `AreaChart` se titula como sus series («Revenue and costs, stacked»).
  - `CircularProgress`: el texto central usa la escala (11, 16 y 26 px según la talla; antes un 26 % del
    diámetro) y ya no se corta por arriba.
  - `PieChart`: la porción enfocada muestra el anillo de foco (el canto separador lo tapaba).
  - `Stepper` horizontal en un teléfono: los pasos siguen en una fila; los que no son el actual muestran solo su
    marcador (el nombre sigue para el lector de pantalla). Antes la fila se partía y el conector quedaba colgando. El paso
    actual no encoge: su nombre se lee entero.
  - El ejemplo de `ScrollArea` oculta varias filas (antes una sola, que parecía un recorte).
  - `Avatar`: el tinte va sobre una base opaca; sobre una tarjeta o una fila con fondo las iniciales bajaban a
    4,3:1 (axe, zutool y zenith claros).
  - Escala de los gráficos (`niceTicks`): un valor apenas por fuera de una marca (−600 000,000001 con paso
    200 000) quedaba fuera del eje; la holgura es ahora la del error de coma flotante.
- `Tabs` y `Listbox` en fila: cuando la tira desplaza, el lado con contenido oculto se difumina (máscara con
  degradado que sigue al desplazamiento, `data-scroll-edges`); sin transparencia o con colores forzados, un canto
  normal. Igual en React y en `/dom`.
- `TimePicker` sin React: el panel cerrado ya no se ve (su `display: flex` tapaba el `display: none` del popover
  cerrado y quedaba encima de lo que hubiera debajo).
- `Carousel` con miniaturas: la tira se centra solo si cabe y lleva a la vista la miniatura actual.

- Modo DOM de las piezas de árbol (`core/widget`): las variables locales de la raíz (`--z-*`) se escriben en cada
  pintado; antes solo se aplicaban los atributos y la raíz conservaba las del primer marcado.

- Auditoría visual (`pnpm audit:visual`):
  - `Calendar` mide lo que su contenido aunque el contenedor lo estire (`inline-size: fit-content`): la cabecera
    ya no se separa de la rejilla, y con dos meses apilados cada rejilla queda centrada bajo la cabecera.
  - `<code>`, `<kbd>`, `<samp>` y `<pre>` dentro de `.z-root` usan la mono de la marca; antes caían en la
    monoespaciada del sistema.
  - Segmentos de `DateField` de 24 px de alto (40 con puntero grueso), objetivo mínimo de WCAG 2.5.8.
  - La primera hora de la rejilla de `EventCalendar` ya no se corta por arriba.
  - Los huecos y rellenos de `2px` y `3px` literales pasan a `--z-space-0-5`; `5px` a `--z-space-1`.
  - `Slider` con etiquetas de marca reserva `--z-space-5` debajo (antes 18 px fuera de la escala).
  - Contraste (axe, zutool y zenith claros sobre tarjeta): el contador de `Chip` y `Kbd` usan `--z-fg` en vez
    de `--z-fg-muted` (4,4:1 → más de 7:1).
  - Botón de quitar de `Chip` de 24 px en la talla md (antes 20, por debajo de WCAG 2.5.8).
  - `ButtonGroup` sin `attached` centra en la fila botones de tallas distintas (quedaban alineados arriba).
  - El texto de ejemplo de `Select` y de los segmentos vacíos de `DateField` pasa de `--z-fg-subtle` a
    `--z-fg-muted`: es texto real y en zutool claro sobre tarjeta quedaba en 4,46:1.
  - `EventCalendar`: al abrir la semana o el día, la rejilla deja aire sobre la primera hora visible (el rótulo
    quedaba bajo la cabecera pegajosa) y la última hora no sale de la columna.
  - `EventCalendar`: cuando el segmentado de vistas no cabe en una fila (agenda de menos de 640 px), se sustituye
    por un único selector compacto (`.z-agenda__view-picker` con un `<select>` nativo, mismo nombre accesible);
    antes se partía en tres filas. Igual en React y en `/dom`.
  - `Select` y `NativeSelect` usan `chevron-up-down` como pide la especificación (antes `chevron-down`; cambia el
    icono del contrato HTML, no se retira nada).
  - Modo DOM: al volver a pintar, el árbol quitaba el atributo `value` de las `<option>` (solo debía respetar lo
    tecleado en campos de texto): un `<select>` repintado valía el texto de la opción. Afectaba también al selector
    de zona horaria de la agenda.
  - `TimelineView`: la inicial del día de la escala ya no encoge con el `<small>` del navegador (9,2 px) y el
    rótulo de un bloque de `FreeBusy` acaba en elipsis en vez de cortarse a media palabra.


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
