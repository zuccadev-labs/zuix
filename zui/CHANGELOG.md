# Cambios de @zuccadev-labs/zuix-zui

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

### Añadido

- React 18: el binding funciona con React 18.2 o posterior además de con React 19. Los peers pasan a
  `^18.2.0 || ^19.0.0`. Los componentes que aceptan `ref` la siguen recibiendo como prop; en React 18 van envueltos
  en `forwardRef` por dentro (son objetos, no funciones). `inert` se escribe como `inert=""`, `popovertarget` en
  minúsculas, la ref del hijo de un `trigger` o `asChild` se lee de `element.ref` y la fusión de refs no devuelve una
  limpieza, que React 18 no admite. `EventCalendar`, `FileUpload`, `Carousel` y los widgets de agenda usan
  `useEffect` en el servidor, donde React 18 avisa de cada `useLayoutEffect`. `DateTimePicker` (y `DatePicker` con
  `input`) reinicia el borrador al abrir durante el render: con React 18 el calendario se abría enfocando el día de
  la apertura anterior. Con React 19 nada cambia.
- Sin Popover API, el binding de React ya no lanza: `Popup` (las capas de Popover, Menu, Select, Tooltip…), `Toast`
  y los avisos de la agenda abren con la comprobación de `core/popover`, como el modo sin framework. Con
  `@oddbird/popover-polyfill` se abren por él y se reconocen abiertos por su clase `:popover-open`.
- Modo compat: `styles.compat.css` (`dist/zui.compat.css`), la hoja de componentes para Chromium 109, Firefox 115
  y Safari 15.4, generada con lightningcss: sin `@layer` (aplanado en el orden de las capas), sin `color-mix()` (lee
  los colores de `tokens.compat.css`), sin anidado ni `:dir()`, con la clase `.\:popover-open` de
  `@oddbird/popover-polyfill` y anillos de foco con `:focus-within` donde falta `:has()`. Límites en
  [Compatibilidad](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/10-compatibilidad.md#modo-compat).
- Resúmenes y precios (grupo `data`, solo marcado: se renderizan en un Server Component):
  - `SummaryList`: lista clave–valor (`<dl>`) con los valores alineados al final en cifras tabulares, pista bajo la
    etiqueta, tonos, separadores y fila de total destacada.
  - `PriceBreakdown`: desglose sobre `SummaryList` con `Intl.NumberFormat` (`currency`, `locale`); descuentos y
    créditos restan siempre y se escriben con signo, impuestos por importe o por porcentaje de la base, subtotal
    opcional. Las sumas van en unidades menores enteras: el total es la suma exacta de las filas que se leen, también
    en monedas sin decimales (JPY) o con tres (KWD).
  - `PriceTag`: precio con moneda, anterior tachado delante del actual con prefijo para lectores («Previous price:»)
    y unidad («/ night»).
  - `formatMoney`, `summarizePrice` y `currencyDigits` en la raíz y en `/dom/data`.
- Opiniones (grupo `data`):
  - `ReviewSummary`: media, estrellas de solo lectura, número de valoraciones y una barra por estrella. Cada barra
    se lee entera en texto («5 stars: 873 reviews, 68%») y los porcentajes se reparten por el mayor resto, así que
    siempre suman 100. Nota y barras lado a lado o apiladas según el ancho de su hueco (consulta de contenedor).
  - `ReviewCard`: autor con `Persona`, valoración, fecha en `<time>`, título, fotos (botones con nombre propio con
    `onPhotoSelect`) y respuesta del propietario. El texto largo se pliega en un espacio cerca de `collapseAt`; lo
    plegado lleva `hidden="until-found"`, así que Buscar en la página lo encuentra y lo abre. En `/dom/data`,
    «Read more» y `beforematch` sin React, `setReviewExpanded`, `z:change { open }` y `z:photoselect { index }`.
- Iconos en el árbol compartido de las piezas (`core/vnode`): variante `solid`.
- Avisos (grupo `feedback`):
  - `NotificationCenter`: campana con el número de no leídos en su nombre («Notifications, 3 unread») y un panel en
    `popover` automático con los avisos agrupados por día civil en la zona de quien mira («Today», «Yesterday»,
    fecha), leídos y no leídos (prefijo oculto «Unread:» además del fondo), acciones propias por aviso, marcar como
    leído o no leído con nombre propio, «Mark all as read», estado vacío y enlace «View all». Un aviso nuevo sin leer
    se anuncia una vez por el anunciador central, también con el panel cerrado (`silent` lo apaga). En `/dom/data`:
    `.z-notification-center` con los avisos en `data-props`, `z:readchange`, `z:readall`, `z:action` y
    `z:openchange`; `badgeText`, `groupByDay` y `unreadCount`.
  - `NotificationBadge`: contador con tope («99+») o punto, suelto o pegado a la esquina de otro elemento; la cifra
    va oculta y se lee el texto entero («12 unread»). No añado un `AlertBell`: sería otro nombre para la misma campana.
- `FilterBar` (grupo `data`): chips de interruptor (`aria-pressed`) y de menú (popover con casillas o botones de opción
  nativos; el chip dice la opción elegida o cuántas) en una fila que desplaza en horizontal con el borde difuminado
  solo del lado con chips ocultos. «Clear» aparece con algún filtro activo y deja el foco en el primer chip; el número
  de activos va en la descripción del grupo y se anuncia al cambiar. Valor controlado o libre; en `/dom/data`,
  `.z-filter-bar` con `data-props`, `z:change { value, id }`, `toggleFilter`, `toggleOption`, `activeCount` y `chipText`.
- `FileUpload`: `layout="grid"`, rejilla de miniaturas grandes para fotos (en un lienzo, sin URL de objeto, como la
  lista), con `sortable` (arrastrar el asa o, con el teclado, Espacio coge, flechas mueven por la rejilla también
  arriba y abajo y en RTL, Espacio suelta y Escape cancela; cada posición se anuncia una vez), `cover` (la primera es
  la portada y las demás llevan «Make … the cover»), quitar y progreso por foto. `onReorder` y `onCoverChange`; textos
  en `reorderLabels`. Las casillas se mueven, no se rehacen: el foco y la miniatura se conservan. Con la lista o la
  rejilla dentro, el campo se nombra solo con su texto principal (`aria-labelledby`). En el modo DOM: `data-layout`,
  `data-sortable`, `data-cover`, `data-reorder-labels`, `z:reorder`, `z:cover` y `reorderUpload`; en rejilla con
  `multiple`, lo elegido se suma a lo que ya había.
- Modo DOM: un icono que el registro del módulo no tiene (el de un aviso de la aplicación) se pinta con `<z-icon>`,
  que lo dibuja con el set que haya cargado la página, en vez de quedar en blanco.
- `ChatHeader`: `moreActions` (`ChatHeaderAction[]`) y `moreLabel`. Las acciones secundarias son botones de icono en
  una cabecera ancha y pasan a un menú «Más» en una de 420 px o menos: con tres iconos el nombre quedaba en «An…».
- Familia de chat y mensajería (grupo `chat`; contrato HTML, `/dom/chat` y binding de React sobre el mismo árbol de
  `core/vnode`):
  - `MessageList`: grupos por autor y tiempo con la cola en la última burbuja, separadores de día en su propia franja (encabezados
    reales) y el día flotante mientras se desplaza, sin tapar mensajes, marca de no leídos, indicador de escritura, historial hacia arriba sin saltos (se conserva el mensaje que
    tenías delante), «ir al final» con los nuevos contados y ventana virtual con altos medidos a partir de 150 filas.
    Una sola parada de Tab con ↑/↓, Inicio/Fin y RePág/AvPág; Intro lleva a la barra de acciones del mensaje
    (reaccionar, responder, reenviar, copiar, editar, borrar) y R responde. Los mensajes nuevos de otros se anuncian
    por el anunciador central, cortos y agrupados; las reacciones responden al instante.
  - `MessageBubble`: el mismo marcado suelto, con cita, reenviado, editado, borrado, fallido con reintentar, emojis
    grandes, y adjuntos: álbum de imágenes, archivo con tamaño y progreso, nota de voz con onda, ubicación (imagen de la
    aplicación o un plano decorativo, sin mapas de terceros) y vista previa de enlace. Los enlaces del texto solo salen
    con destino http, https o mailto (`core/linkify`, con el analizador de URL).
  - `Composer`: crece con el texto, Intro envía y Mayús+Intro salta de línea sin enviar durante la composición de un
    IME, adjuntos (elegir, pegar o soltar), emojis, menciones con `@` como combobox (`core/mentions`, tokens `<@id>`),
    respondiendo/editando y notas de voz con MediaRecorder cuando existe (pulsar para grabar y para enviar, Cancelar).
  - `ConversationList` (presencia, último mensaje o quién escribe o el borrador, hora corta, no leídos y menciones,
    silenciado, fijado, búsqueda y filtros), `ChatHeader`, `EmojiPicker` (conjunto propio de unos 120 emojis con
    nombres CLDR, recientes, tono de piel y carga a demanda de otro conjunto; la fila que queda a medias abajo se
    difumina), `VoiceNote`, `Reactions`,
    `TypingIndicator`, `DeliveryStatus` (leído con otro texto y otro trazo, no solo color), `ThreadSummary`, `CallCard`
    (entrante con aviso asertivo, saliente y en curso) y `PinnedBar`.
  - `core/`: `chat-group`, `chat-anchor`, `delivery`, `linkify`, `mentions`, `waveform`, `emoji-data` y `chat-tree`.
- Familia de IA, chatbots y agentes (grupo `ai`; `/dom/ai`):
  - `AssistantMessage`: partes en orden (texto en streaming con cursor, razonamiento, herramientas, aprobaciones,
    fuentes con citas en línea y artefactos), `aria-busy` mientras llega y un solo anuncio al terminar; acciones
    (copiar, regenerar, valorar) y ramas «‹ 2 / 3 ›».
  - `Markdown`: Markdown mínimo propio (`core/markdown-lite`) que construye nodos, nunca marcado: párrafos,
    encabezados, listas anidadas y de tareas, citas, tablas, énfasis, enlaces http(s), citas `[n]` y código con el
    `CodeViewer`. Mientras llega, `core/stream-text` cierra a título provisional el código y el énfasis abiertos.
  - `PromptInput` (la forma de prompt de Composer: modelo, herramientas, uso de contexto y enviar ↔ parar), `Reasoning`,
    `ToolCall`, `ApprovalCard` (con riesgo alto, aprobar pide confirmar), `AgentPlan`, `Sources`, `Citation`,
    `Suggestions`, `Artifact` (vista previa en un iframe aislado sin scripts, código, versiones, copiar y descargar),
    `BranchPicker`, `AgentStatus` y `UsageMeter`.
  - `core/`: `agent-state` (transiciones y qué se anuncia), `branches` (árbol de la conversación y rama activa),
    `usage` y `stream-text`.
- Dashboard y tableros (grupo `dashboard`, entrada `/dom/dashboard`):
  - `MetricCard`: etiqueta, valor, variación frente al periodo anterior con su sentido (`positive="down"` para lo
    que es bueno que baje), minigráfico, meta con ritmo, nota y acciones; estados `loading` (huesos con
    `aria-busy`), `empty` y `error`; enlace que cubre la tarjeta. `MetricGroup` reúne varias en una fila de KPI.
  - `DeltaBadge`: flecha, magnitud y una frase para el lector («up 12.4%, better than last month»).
  - `Gauge`: semicírculo, 240° o anillo con zonas (cada una con nombre y trazo propio) y aguja opcional; es un
    `role="meter"` con la zona en `aria-valuetext`.
  - `ProgressGoal`: avance hacia una meta con la marca del ritmo esperado (delante, en ritmo, detrás, conseguido).
  - `BarList`, `FunnelChart` (conversión frente a la etapa anterior y la total) y `Leaderboard` (rangos con empates).
  - `Tracker`: tira de estados por día con la disponibilidad calculada, una sola parada de tabulación y la etiqueta
    del día activo.
  - `ActivityFeed`: actividad agrupada por día en la zona de la persona, hora relativa con la absoluta en `<time>`.
  - `DashboardGrid` y `DashboardGridItem`: rejilla de 12 columnas que se mueve y se redimensiona con el puntero y
    con el teclado (Espacio coge, flechas mueven, Mayús + flechas redimensionan, Intro suelta, Escape cancela), con
    anuncios en la región central, el orden del DOM igual al de lectura y `onLayoutChange` para guardar la
    disposición. En un contenedor estrecho se apila. Sin `/dom`: `z:layoutchange`, `getDashboardLayout` y
    `setDashboardLayout`.
  - `KanbanBoard`: columnas con contador y límite de trabajo en curso, tarjetas que se arrastran con el puntero o
    se mueven con el teclado, `onMove`, `onOpen` y `onAdd` (en `/dom`, `z:move`, `z:open` y `z:add`).
  - Lógica en `core/`: `metric`, `gauge`, `funnel`, `tracker`, `grid-layout` (colocación, colisiones, compactación
    y serialización), `kanban`, `activity` e `initials`. Se exportan `computeDelta`, `computePace`,
    `normalizeLayout`, `moveGridItem`, `resizeGridItem`, `serializeLayout`, `parseLayout`, `moveCard` y más.
- Usuarios y perfiles (grupo `people`, entrada `/dom/people`): `Persona`, `PresenceBadge` (seis estados, cada uno
  con su forma y su texto, y «visto hace…»), `UserCard`, `ProfileHeader`, `MemberList` (búsqueda que anuncia los
  resultados, grupos por rol o presencia, rol en un selector nativo, quitar e invitar), `AccountMenu` (cuentas, tema
  y salir sobre `Menu`), `ProfileEditor` (validación al salir de cada campo y al guardar, contador de la biografía,
  foto; en `/dom`, `z:submit`) y `SettingsSection` con `SettingRow` (etiqueta unida al control y estado de guardado).
  Lógica en `core/user-presence`, `core/members` y `core/profile`.
- `Fab` (tres tamaños, extendido y plegable, fijo en una esquina), `FabMenu` y `SplitButton`, de Material 3.
- `ImageList` (`standard`, `quilted`, `woven`, `masonry`) y `Masonry` (carriles nativos donde existen, columnas CSS
  donde no).
- Familia de nodos (grupo `nodes`, entrada `/dom/nodes`), sin bibliotecas de terceros:
  - `NodeCanvas`: lienzo con zoom (Ctrl/⌘ + rueda o pellizco), desplazamiento (rueda, arrastre del fondo, Espacio +
    arrastre, flechas), fondo de puntos o rejilla que sigue la vista, imán a la cuadrícula, caja de selección con
    Mayús, arrastrar y redimensionar nodos, conectar arrastrando desde un puerto, con dos clics o con el teclado,
    reconectar arrastrando el extremo de una arista, borrar, copiar/cortar/pegar (también con el portapapeles del
    sistema como JSON), duplicar, agrupar y desagrupar, deshacer/rehacer y disposición automática por capas. Modelo
    `{ nodes, edges }` serializable, controlado o no, con `onNodesChange`, `onEdgesChange`, `onChange` y `onConnect`.
    Solo pinta los nodos y aristas que se ven. Al montar encuadra el grafo sin bajar del 80 % (el texto de los nodos
    se lee); si a ese zoom no cabe, empieza por su principio y el resto se ve desplazando o con el botón de encuadrar.
  - `Node`, `NodeGroup` y `NodePort`: nodo con cabecera (icono, título, estado), cuerpo libre, estados seleccionado,
    ejecutando, correcto y error, y puertos de entrada y salida con tipo y límite de conexiones.
  - Aristas recta, bézier, escalonada y escalonada suave, con flecha, etiqueta, tono y trazo animado (quieto con
    movimiento reducido y pausado fuera de pantalla).
  - `NodeMinimap`, `NodeControls` (una Toolbar) y `NodeListView` (tablas de nodos y conexiones con las mismas
    acciones; en estrecho, el borde con columnas ocultas se difumina).
  - El lienzo ocupa el ancho de su contenedor: todo lo que lleva dentro va posicionado y, en una fila flex centrada,
    se quedaba en los 2 px del borde.
  - Teclado: una parada de Tab con foco itinerante, flechas al nodo más cercano en esa dirección, Intro y Escape para
    entrar y salir de un nodo, Alt + flechas para moverlo, `]` y `[` para seguir conexiones (con varias, un menú para
    elegir), conectar eligiendo origen y destino, Supr, Ctrl+Z/Y/A/C/X/V/D/G. Descripción textual del grafo y de cada
    nodo, y anuncios en el anunciador central.
  - `core/`: `viewport`, `edge-path`, `graph`, `graph-edit`, `ports`, `undo`, `layout-layers`, `minimap`, `node-view`
    y la caja de selección en `selection` (`boxSelection`), con pruebas de propiedades de geometría e historial.
- `TransferList` (grupo `forms`): disponibles y elegidos con casillas, búsqueda opcional, mover lo marcado o todo lo
  visible, Intro y doble clic para mover, rango con Mayús y anuncio de lo movido. En `/dom/data`, `.z-transfer` con los
  elementos en `data-props` y `z:change`. Lógica pura en `core/transfer`.
- `DataTable`, funciones de tabla de datos avanzada: filtro por columna (`filterable`, `filters`, `onFiltersChange`), ancho
  ajustable con puntero o flechas (`resizable`, `onColumnResize`), columnas fijadas al inicio (`pinned: "start"`) y
  exportar a CSV (`exportable`, `dataTableCSV`), con los textos que empiezan por `=`, `+`, `-` o `@` neutralizados. En
  `/dom/data`, lo mismo sobre el marcado (`tr.z-table__filters`, `.z-table__resize`, `th[data-pinned]`,
  `.z-datatable__export`), con `z:filterchange`, `z:columnresize` y `dataTableCSVFromDom`.
- `Chip` con `avatar`: ficha de persona («input chip» de Material 3) con un avatar delante del texto.
- `core/announcer`: una región viva educada y una asertiva por documento (o por diálogo modal abierto), con retraso
  corto, vaciado previo y espera mientras la persona escribe. En una ráfaga solo se lee el último anuncio y no habla
  nada que esté en un árbol `inert`. En `/dom`, `announce(texto, { politeness, source })`. `announceIn` de los widgets y
  la región de la agenda usan ya la misma cola.
- `Carousel` con dos ejes:
  - `layout`: `strip`, los de Material 3 (`multi-browse`, `hero` y `hero-center` con máscaras por keylines,
    `uncontained`, `fullscreen`) y `stack` (mazo que se descarta deslizando).
  - `effect`: además de `lens` y `none`, `prism` (coverflow de cristal con profundidad, la variante de marca),
    `coverflow`, `fade` (con `kenBurns`), `parallax` (capas `[data-parallax-layer]`) y `wheel` (cilindro vertical).
  - Los efectos se pintan desde `--z-slide-progress`, que anima el navegador con animaciones ligadas al
    desplazamiento (`view()`) o escribe el motor donde no existen. Con `prefers-reduced-motion` todo queda plano.
  - `indicators="progress"` (el punto actual se alarga y se llena durante el intervalo), `slidesPerMove`,
    `slidesPerPage="auto"`, `autoHeight`, `depth` y `peek`. En `/dom`, los mismos como `data-*`.
- `Stories` (historias por persona con barras de progreso, toque para avanzar o retroceder, pulsación larga para
  pausar; empieza en pausa con movimiento reducido), `Lightbox` (visor a pantalla completa sobre `<dialog>` con zoom y
  encuadre, `core/zoom`; al abrir, el foco empieza en «Acercar», o en «Cerrar» sin zoom, también en Safari) y `Gallery` (carrusel con miniaturas sincronizadas y botón de pantalla completa). En `/dom`:
  `[data-z-stories]`, `dialog[data-z-lightbox]` con `openLightbox(dialog, índice)` y `[data-z-gallery]`.
- `Skeleton` por patrón: `pattern` (`card`, `list`, `table`, `profile`, `chat`, `chart`, `article`, `calendar`, también
  como `Skeleton.Card`, `Skeleton.List`…), `loading` para envolver el contenido real y `SkeletonGroup` (contenedor con
  `aria-busy` y un solo brillo sincronizado). Los anchos salen de una semilla: servidor y cliente pintan lo mismo. En
  `/dom`, un `.z-skeleton-pattern[data-pattern]` vacío se expande solo.

### Cambiado

- `Avatar`: estados `dnd` y `oof`, una forma dentro del punto de estado desde el tamaño `md` y, sin `statusLabel`,
  el texto del estado («Available», «Do not disturb») como nombre accesible. Las iniciales ya no parten caracteres
  compuestos.
- `AvatarGroup`: con `items` es una lista y, con `overflow="list"`, el «+N» abre la lista de sobrantes; además
  `reverse` y `spacing`.

- El bucle del `Carousel` en desplazamiento nativo ya no salta del final al principio: aparca el primer o el último
  slide con CSS `order` junto al actual y compensa el salto (guía `carousel`), sin clonar nada. La tira con lente
  sigue con réplicas, porque allí la pista es transformada y no desplazamiento nativo.
- En el desplazamiento nativo y en el mazo, la posición se anuncia tras asentarse (`scrollend`) y solo si cambió;
  antes se anunciaba al pulsar. El teclado (flechas, Inicio y Fin) lo lleva el motor común de React y `/dom`.
- Familia de tiempo y hora (grupo `time`; contrato HTML, modo sin framework y binding de React sobre un solo árbol
  de `core/vnode`):
  - `Clock`: reloj digital con 12 o 24 h según el locale (o `hourCycle`), segundos, fecha y nombre de la zona
    opcionales, zona IANA y separadores que laten.
  - `AnalogClock`: esfera en SVG con marcas de horas o de minutos, números (cuartos o todos), segundero a saltos o
    continuo y tres tamaños. Es una imagen con nombre («10:42, Madrid») que cambia una vez por minuto.
  - `WorldClock`: varias zonas en lista o rejilla, con diferencia frente a una zona de referencia («+6 h»), día
    distinto («Tomorrow»), día o noche y, con `removable`, botón para quitar cada ciudad (`onRemove`, `z:remove`).
    Cada ciudad se lee como una frase completa.
  - `Countdown`: cuenta atrás hasta un instante, en cajas, en línea o con cifras que giran. `role="timer"` sin
    región viva; los hitos (cada hora, cada cuarto en la última hora, cada minuto en los últimos cinco, o
    `announceEvery`) y el final van a una región `status` aparte, nunca cada segundo. `onComplete` y `z:complete`.
  - `DurationField`: duración por segmentos (horas, minutos, segundos) con `spinbutton` por unidad, paso, tope,
    preajustes y pegado de «1:30», «90m» o «PT1H30M». Valor ISO 8601 (`onValueChange`, `z:change`).
  - `TimeZoneSelect`: Combobox de zonas IANA agrupadas por región o desfase, con desfase y hora en cada opción;
    se busca por ciudad, identificador o desfase. En el modo DOM, `data-z-tz-select` sobre un Combobox.
  - `FormatDuration` (grupo `content`): duración legible con `Intl.DurationFormat` en `long`, `short`, `narrow` o
    `digital`, con respaldo donde falte, en un `<time datetime="PT…">`.
- Un único temporizador compartido para todos los relojes (`core/ticker`): se programa al siguiente borde de segundo
  o de minuto, se para con la pestaña oculta y para cada pieza fuera de pantalla, y la pone al día al volver.
- `core/duration`, `core/clock`, `core/countdown` y `core/timezones`, con pruebas (también de propiedades con
  fast-check). Desde la raíz: `formatDuration`, `parseISODuration`, `toISODuration`, `durationToMs`,
  `listTimeZones`, `zoneOptions`, `groupZones` y `offsetText`.
- Familia de terminal y código (grupo `terminal`; mismo modelo de un solo árbol):
  - `Terminal`: prompt, historial con ↑/↓ (conserva lo que se estaba escribiendo), autocompletado con Tab solo si
    hay `onComplete` (si no, Tab sale), Ctrl+L, Ctrl+C (interrumpe sin selección; con selección, copia), salida en
    streaming con colores ANSI de 16, 256 y 24 bits, negrita, subrayado, enlaces OSC 8 (solo http y https), retorno
    de carro y borrado de línea, límite de líneas y copiar. `onCommand` devuelve texto, un código de salida, una
    promesa o un iterable asíncrono; la `ref` (`TerminalHandle`) escribe desde fuera. La salida es `role="log"` sin
    anunciar cada línea; se anuncia el final de cada orden.
  - `LogConsole`: hora, nivel, origen y mensaje; filtros por nivel con contadores, búsqueda con `<mark>`, seguir el
    final, copiar y descargar. Pinta por ventana (`core/virtual`): miles de entradas sin miles de nodos. Rejilla con
    `aria-rowcount` y `aria-rowindex` y una sola parada de Tab.
  - `CodeViewer`: CodeBlock ampliado con números de línea, líneas resaltadas, pestañas de archivos, copiar y un
    resaltado mínimo propio (JavaScript, TypeScript, JSX, JSON, CSS, HTML, XML, shell y Python), o el de la aplicación
    con `highlight`.
  - `DiffViewer`: diff de dos textos (Myers) o de un parche unificado con varios archivos, en vista unificada o lado a
    lado, con palabras cambiadas, regiones sin cambios plegadas y el tipo de cada línea en texto oculto.
- `core/ansi`, `core/diff`, `core/code-tokens`, `core/history` y `core/log-filter`, con pruebas (también de
  propiedades con fast-check). Desde la raíz: `createAnsiScreen`, `parseAnsi`, `stripAnsi`, `diffLines`, `parsePatch`,
  `toHunks`, `wordDiff`, `tokenize` y `tokenizeLines`.
- Entrada `@zuccadev-labs/zuix-zui/dom/terminal` (`terminalModule`, `terminal(el)`, `appendLogEntries`), también
  incluida en `@zuccadev-labs/zuix-zui/dom`.
- Entrada `@zuccadev-labs/zuix-zui/dom/time` (`timeModule`, `refreshTimeZoneSelect`), también incluida en
  `@zuccadev-labs/zuix-zui/dom`.

### Corregido

- `Avatar`: el punto de estado `online`, `busy` y `away` salía gris. La regla base del punto en `zui.people` volvía a
  poner el fondo por defecto y, por ir en una capa posterior, pisaba el color de cada estado de `zui.data`. Ahora
  solo `zui.data` pone ese fondo.
- `/dom` sin Popover API (Chromium < 114, Firefox < 125, Safari < 17): abrir un menú, un popover, un tooltip o un
  submenú lanzaba, porque `:popover-open` no es un selector válido ahí y `showPopover` no existe. Ahora no se abren y
  nada lanza; con `@oddbird/popover-polyfill` cargado por la aplicación, funcionan.
- `/dom` en Safari < 16.4: el módulo no cargaba, porque el resaltado de código y las tablas de Markdown usaban
  aserciones hacia atrás (`(?<!…)`) en expresiones regulares. Se escriben sin ellas y el resultado es el mismo.
- `Chip` interactivo (también los de `FilterBar`): con puntero grueso el botón quedaba en 38 px, 2 px por dentro del
  borde del chip de 40. Su zona de pulsación cubre ahora el borde y llega a los 40 sin cambiar el dibujo.
- `Calendar` con `numberOfMonths` de 2 o más: el título del rango («December 2026 – January 2027») usa espacios
  normales. El de Node llevaba espacios finos y no casaba con el del navegador al hidratar un render en el servidor.
- `AnalogClock`: con marcas, las cifras van a radio 31 (antes 35) y no pisan las marcas del 3, el 6 y el 9.
- `AvatarGroup`: el solape depende de la talla (0,28 del diámetro; 0,2 en `sm`; ninguno en `xs`, donde dos iniciales
  ocupan casi todo el círculo) y las iniciales de cada avatar tapado se centran en la parte que se ve. El siguiente
  avatar ya no tapa las iniciales del anterior.
- `Table` y `DataTable`: una columna `mono` (fechas, códigos) no parte línea («2026-11-\n10»), y el borde con columnas
  ocultas se difumina (`data-scroll-edges`, también en `/dom`): en estrecho la tabla ya no se corta en seco. En una
  tabla cuenta desde 1 px escondido (en una tira, desde 8): la última columna llega al borde y unos pocos píxeles ya
  cortan su texto.
- `SlotPicker`: con más horas de las que caben, el borde de la lista con horas ocultas se difumina en vez de cortar una
  hora a media altura.
- `KanbanBoard`, `CalendarHeatmap` y las miniaturas de `Carousel` y `Gallery`: el borde con contenido oculto se difumina en
  lugar de cortar una tarjeta, un mes o una miniatura en seco (también en `/dom`).
- `PromptInput`: modelo, herramientas y uso van en una sola fila que desplaza, con el borde oculto difuminado; en un
  teléfono partían línea y quedaban uno debajo de otro.
- `MetricCard`: la etiqueta usa hasta dos líneas antes de cortarse («New custom…» cabía entera).
- `Gauge`: la cifra baja de talla cuando el indicador encoge por debajo de su medida; a 168 px rozaba el arco.
- `Carousel`: un salto sin animación (volver al slide inicial al montar, ajustar tras un cambio de tamaño) relaja
  `scroll-snap-stop` durante el salto. Se paraba en el primer slide del camino: Prism abría en «Scene 3» con el
  índice en 0 y la rueda con `defaultIndex` en otra hora.
- `Carousel` `prism` y `coverflow`: solo el slide central recibe el puntero. Chromium encontraba antes un vecino girado
  que se pinta detrás, que tapaba el borde del pie central y se llevaba sus clics.
- `Carousel` `wheel`: la opción elegida va en una banda de cristal del ancho de la rueda y el cilindro se funde arriba
  y abajo; `layout="stack"`: la tarjeta de arriba se separa del mazo con un tono más claro y sombra alta.
- `Gallery` con lente: los vecinos se funden en los bordes de la tira en vez de cortarse en seco, y el margen vertical
  sigue al estiramiento real de la forma, que crece con el tramo curvo: en un teléfono sobraban unos 60 px arriba y
  abajo del slide.
- `ColorPicker`: el formato pasa a su propia línea por debajo de 21rem (antes 18rem). Entre 288 y 336 px la fila de
  canales con alfa y el selector del sistema se salía de la tarjeta.
- `StatTile`: en una baldosa de menos de 7,5rem de contenido el icono cede su sitio al nombre («Complet…»).
- `OTPInput`: las casillas ceden ancho (hasta la altura de un control pequeño) en una columna más estrecha que el
  código; la sexta casilla se salía del grupo.
- `VoiceNote`: las barras de la onda se reparten su ancho sin hueco fijo; en una burbuja de teléfono pasaban del borde.
- `ChatHeader`: el avatar no sale de su identidad aunque las acciones aprieten.
- `Artifact`: en una barra estrecha los controles bajan a otra línea; el título quedaba en 0 px y las acciones se
  salían.
- `ToolCall`: el nombre de la herramienta no cede ancho; lo cede el identificador.
- `ImageList`: hasta `--z-image-cols` columnas de 7rem como mínimo; en estrecho caben menos y el pie de cada imagen
  se lee. La consulta de contenedor que pasaba a dos columnas no se aplicaba (el elemento consultaba su propio
  tamaño). `StatTile`: la cifra no parte línea. `AccountMenu` con avatar no se estira con su contenedor. `ActionBar`:
  el borde con acciones ocultas se difumina.
- `CodeViewer` y `LogConsole`: el tinte del código va sobre una base opaca. Sobre un fondo oscuro, los comentarios, los
  números de línea y el filtro de niveles bajaban a 4,46:1 en zutool claro.
- `LogConsole`: desplazar hacia arriba justo después de que la consola baje sola (al limpiar la búsqueda o cambiar
  un filtro) a veces no dejaba de seguir el final: se ignoraba el desplazamiento de la persona si llegaba fundido
  con el de la pieza. Ahora solo se ignora el que llega a la posición que pidió la pieza.
- `LogConsole`: subir en el mismo fotograma en que la consola se repinta (llega una entrada, se limpia la búsqueda)
  devolvía la vista al final antes de que llegara el evento de desplazamiento, y la consola seguía siguiendo. Ahora el
  repintado ve que la posición subió desde la última conocida y deja de seguir en vez de bajar.

## [0.3.0] - 2026-11-21

Base visual nueva, «liquid glass», sobre los tokens de `@zuccadev-labs/zuix-tokens`. Botón, campo, select,
pestañas, control segmentado e insignia son las piezas de referencia; el resto de componentes hereda escala,
radios y material de los tokens.

### Añadido

- Color, medios y piezas sueltas (todo con contrato HTML, modo sin framework y binding de React sobre un solo
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

- Efectos y cargadores con la estética liquid glass (todo con contrato HTML, modo sin framework y binding de
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

- Capas y navegación de aplicación:
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
  - `HoverCard`: vista previa al pasar el puntero (retardos de apertura y cierre) o enfocar un enlace, con el
    patrón de pista rica de la propuesta `interestfor`: la tarjeta es `role="tooltip"` (el rol mínimo de una pista con
    enlaces) y describe al enlace con `aria-describedby` desde que se monta, abierta o cerrada, sin
    `aria-expanded` y sin mover el foco al abrirse; un `aria-describedby` del autor manda. El puntero cruza a la
    tarjeta sin cerrarla, Escape y una pulsación fuera la cierran y Tab entra en ella y sale hacia lo que sigue al
    enlace. Flecha opcional.
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
- DataTable: selección de filas con casillas (`selectable`, `selectedKeys`, `defaultSelectedKeys`,
  `onSelectionChange`, `isRowSelectable`), «seleccionar todo» de la página con estado indeterminado, Mayús +
  clic para un rango y conteo visible anunciado (`role="status"`, `selectedLabel`); pie en `tfoot` por columna
  (`footer`, contenido o función sobre todas las filas); paginación integrada con Pagination (`pageSize`,
  `page`, `defaultPage`, `onPageChange`, `manualPagination` + `rowCount`, `rangeLabel`). Sin las props nuevas
  el marcado no cambia. Modo DOM (`.z-datatable`): `data-page-size`, `data-selected-label`,
  `data-range-label`, `z:selectionchange` y `z:pagechange`, y `setDataTableSelection()`,
  `dataTableSelection()` y `setDataTablePage()` en `/dom`. Lógica en `core/selection`.
- Tree: `selectionMode="multiple"` (`aria-multiselectable`; Ctrl/Cmd y Mayús con el puntero,
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
- Datos y contenido: `Timeline` (`<ol>`, formas de punto, estilos de línea, alineación inicio/fin/alterna
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
- `EventCalendar`, vistas de año y de recursos: `year` (12 minimeses con densidad en el fondo y en el nombre,
  `density`), `perpetual` (año perpetuo de una página) y `timeline` (recursos del día, `resources`), un
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

- Formularios y acciones. Nuevos: `InputGroup` (con `InputGroupAddon`, `InputGroupText`,
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

- `/dom` por partes: `@zuccadev-labs/zuix-zui/dom/core` (núcleo con `init()`, diálogos, popovers, menús,
  `toast`, `confirm`, pestañas, capas y lo básico de formularios) y una entrada por familia, `/dom/dates`,
  `/dom/data`, `/dom/content`, `/dom/agenda`, `/dom/charts`, `/dom/color`, `/dom/media` y `/dom/effects`, cada
  una con su módulo (`datesModule`, `agendaModule`…) para `init(módulo, …)` o para `use(módulo, …)`, que también
  conecta una familia después de `init()`. Cada módulo registra sus propios iconos. `/dom` sigue exportando todo
  y su `init()` sigue montando todo. Con esbuild, solo `toast()` pasa de 225 a 11 kB y `init()` del núcleo pesa
  92 kB, frente a 515 kB del completo. Tipos `DomModule` y `DomPart`.

### Cambiado

- `/dom` no hace nada al importarse: `sideEffects` ya no marca `src/dom` ni `dist/esm/dom`, los iconos de
  `toast()` y `confirm()` se registran al usarse y `hydrate()` e `init()` registran las familias. Un bundler
  descarta lo que no se usa (`dist/zui.dom.js` sigue siendo un solo archivo con todo).
- `Button` e `IconButton` respetan un `aria-disabled` recibido (antes lo pisaba el estado de carga) y, con él,
  no ejecutan `onClick`: un botón apagado que conserva el foco, como pide una barra de herramientas.
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
- El resto de componentes pasa a la misma anatomía. Nada en píldora: chips, avisos,
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
- `Select` y `NativeSelect` usan el icono `chevron-up-down` (antes `chevron-down`). Cambia el icono del contrato
  HTML; no se retira nada.

### Corregido

- `FileUpload` dibuja la miniatura de una imagen en un `<canvas>` con `createImageBitmap`, sin crear una URL de
  objeto ni asignar un `src` con el archivo elegido; si el navegador no puede leer la imagen, queda el icono.
- El analizador de colores (`parseColor`) ya no tiene un caso de retroceso costoso con cadenas largas de ceros.
- `/dom`: un menú abierto con el teclado bajo un puntero quieto ya no resalta la entrada que queda debajo: el
  foco sigue en la primera hasta que el puntero se mueve, como en el binding de React.
- El manifiesto de `Calendar` declara el valor por defecto de `showOutsideDays` (`true` con un mes, `false` con
  varios).
- `Accordion` y `Carousel` ocupan el ancho de su contenedor también dentro de una fila flex: el acordeón encogía
  y el chevron se pegaba al título, y el carrusel encogía hasta 139 px.
- `Stepper` horizontal en un teléfono: los pasos siguen en una fila; los que no son el actual muestran solo su
  marcador (el nombre sigue para el lector de pantalla) y el actual no encoge. Antes la fila se partía y el
  conector quedaba colgando.
- `Avatar`: el tinte va sobre una base opaca; sobre una tarjeta o una fila con fondo las iniciales bajaban a
  4,3:1 en zutool y zenith claros.
- `Tabs` en fila: cuando la tira desplaza, el lado con contenido oculto se difumina (máscara con degradado que
  sigue al desplazamiento, `data-scroll-edges`); sin transparencia o con colores forzados, un canto normal. Igual
  en React y en `/dom`.
- `Calendar` mide lo que su contenido aunque el contenedor lo estire (`inline-size: fit-content`): la cabecera
  ya no se separa de la rejilla.
- `<code>`, `<kbd>`, `<samp>` y `<pre>` dentro de `.z-root` usan la mono de la marca; antes caían en la
  monoespaciada del sistema.
- Contraste sobre tarjeta en zutool y zenith claros: el contador de `Chip` y `Kbd` usan `--z-fg` en vez de
  `--z-fg-muted` (de 4,4:1 a más de 7:1), y el texto de ejemplo de `Select` pasa de `--z-fg-subtle` a
  `--z-fg-muted` (quedaba en 4,46:1).
- Botón de quitar de `Chip` de 24 px en la talla md (antes 20, por debajo de WCAG 2.5.8).

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
