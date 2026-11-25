# Zui

`@zuccadev-labs/zuix-zui` es el sistema de componentes de la suite: 224 componentes en 19 grupos. Cada
componente es un contrato de HTML y CSS que solo lee tokens, así que una marca nueva no modifica componentes
y el mismo marcado sirve en cualquier framework. El paquete trae dos formas de darle vida: el binding de
React y `@zuccadev-labs/zuix-zui/dom`, sin framework ([Frameworks](./06-frameworks.md)). Sin framework se puede
cargar todo (`/dom`) o el núcleo (`/dom/core`) más las familias que use la página (`/dom/dates`, `/dom/agenda`,
`/dom/charts`…): ver [Elegir entrada](./06-frameworks.md#elegir-entrada-todo-o-por-familias).

No depende de ninguna biblioteca de UI. En ejecución solo necesita `@zuccadev-labs/zuix-tokens`;
`@zuccadev-labs/zuix-zicon` es un peer obligatorio y React y React DOM (18.2 o posterior, o 19) son peers opcionales.

El catálogo en vivo, con el código de cada ejemplo, está en [Componentes](/components).

## Catálogo

| Grupo | Componentes |
|---|---|
| Acciones | Button, ButtonGroup, CopyButton, DownloadTrigger, Fab, FabMenu, IconButton, Link, SegmentedControl, SplitButton, Swap, Toggle, ToggleGroup, Toolbar |
| Formularios | Calendar, Checkbox, CheckboxGroup, CircularSlider, ColorArea, ColorField, ColorPicker, ColorPickerTrigger, ColorSlider, ColorSwatchPicker, Combobox, DateField, DateInput, DatePicker, DateRangePicker, DateTimePicker, Editable, Field, Fieldset, FileUpload, Form, Input, InputGroup, Listbox, MonthPicker, NativeSelect, NumberInput, OTPInput, PasswordInput, Radio, RadioGroup, SearchInput, Select, ShortcutInput, Slider, Switch, TagsInput, Textarea, TimeField, TimePicker, TransferList, WeekPicker, YearPicker |
| Agenda | CalendarHeatmap, EventCalendar, FreeBusy, HabitCalendar, PerpetualYear, SlotPicker, TimelineView |
| Datos | Avatar, AvatarGroup, Badge, Chip, CircularProgress, DataTable, DescriptionList, FilterBar, Item, Kbd, Meter, PriceBreakdown, PriceTag, Progress, Rating, ReviewCard, ReviewSummary, StatTile, StatusDot, SummaryList, Table, Timeline |
| Gráficos | AreaChart, BarChart, DonutChart, LineChart, PieChart, Sparkline |
| Estado | Alert, Banner, DotMatrix, EmptyState, ErrorBoundary, ErrorState, LoadingOverlay, NotificationBadge, NotificationCenter, Skeleton, Spinner |
| Contenido | AspectRatio, Callout, Card, CardFooter, CardHeader, CardMedia, CodeBlock, Divider, FormatByte, FormatDate, FormatDuration, FormatNumber, Highlight, JsonTree, Marquee, Panel, Prose, RelativeTime, ScrollArea, Timer |
| Medios | CompareSlider, ImageCropper, ImageList, Masonry, QRCode, SignaturePad |
| Efectos | AttentionRing, Backdrop, BorderBeam, Confetti, Glow, TextEffect |
| Capas | ActionBar, Command, CommandPalette, ConfirmDialog, ContextMenu, Drawer, HoverCard, Menu, Modal, Popover, Toast, Toggletip, Tooltip, Tour |
| Navegación | Accordion, Breadcrumb, Collapsible, Menubar, NavList, Pagination, Stepper, Tabs, Tree |
| Carousel | Carousel, Gallery, Lightbox, Stories |
| Tiempo | AnalogClock, Clock, Countdown, DurationField, TimeZoneSelect, WorldClock |
| Terminal y código | CodeViewer, DiffViewer, LogConsole, Terminal |
| Chat y mensajería | CallCard, ChatHeader, Composer, ConversationList, DeliveryStatus, EmojiPicker, MessageBubble, MessageList, PinnedBar, Reactions, ThreadSummary, TypingIndicator, VoiceNote |
| IA y agentes | AgentPlan, AgentStatus, ApprovalCard, Artifact, AssistantMessage, BranchPicker, Citation, Markdown, PromptInput, Reasoning, Sources, Suggestions, ToolCall, UsageMeter |
| Dashboard y tableros | ActivityFeed, BarList, DashboardGrid, DeltaBadge, FunnelChart, Gauge, KanbanBoard, Leaderboard, MetricCard, MetricGroup, ProgressGoal, Tracker |
| Usuarios y perfiles | AccountMenu, MemberList, Persona, PresenceBadge, ProfileEditor, ProfileHeader, SettingsSection, UserCard |
| Nodos | Node, NodeCanvas, NodeControls, NodeListView, NodeMinimap |

Cada componente declara en el contrato qué necesita para funcionar:

| `behavior` | Significado | Cuántos |
|---|---|---|
| `none` | Solo CSS. Basta el marcado | 73 |
| `dom` | Necesita `@zuccadev-labs/zuix-zui/dom`, o el binding de React | 150 |
| `react` | Solo funciona con el binding de React. Hoy ninguno | 0 |

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
- Los componentes aceptan `ref` como una prop más, también con React 18: allí los que la reciben van envueltos
  en `forwardRef` por dentro.

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

## Familias de la 0.4

Las familias nuevas se pintan a partir de datos. En React se pasan por props; sin React, la raíz de la pieza lleva
sus opciones en atributos `data-*` y sus listas en un `<script type="application/json" data-props>`, y la familia
de `zui/dom` correspondiente la pinta con el mismo árbol
([Piezas con datos](./06-frameworks.md#piezas-con-datos)). Cada ejemplo HTML de esta sección necesita
`init()` con la familia que se indica (o `init()` de `@zuccadev-labs/zuix-zui/dom`, que las monta todas) dentro de
un contenedor con `data-z-dom`.

### Tiempo

`Clock`, `AnalogClock`, `WorldClock`, `Countdown`, `DurationField` y `TimeZoneSelect`. Sin React: `/dom/time`.

```tsx
import { Countdown } from "@zuccadev-labs/zuix-zui";

export function Launch() {
  return <Countdown to="2027-01-15T17:00:00Z" locale="en-GB" showTarget labels={{ timer: "Launch countdown" }} onComplete={() => location.reload()} />;
}
```

```html
<div class="z-countdown" data-to="2027-01-15T17:00:00Z" data-locale="en-GB" data-show-target data-timer-label="Launch countdown"></div>
```

Al llegar a cero emite `z:complete`. Sin `announceEvery`, el lector oye el tiempo restante cada hora, cada 15 minutos
en la última hora y cada minuto en los cinco últimos.

### Terminal y código

`Terminal`, `LogConsole`, `CodeViewer` y `DiffViewer`. Sin React: `/dom/terminal`.

```tsx
import { LogConsole } from "@zuccadev-labs/zuix-zui";

const entries = [
  { id: 1, time: "2026-11-21T10:42:01Z", level: "info" as const, source: "api", message: "GET /v1/projects 200" },
  { id: 2, time: "2026-11-21T10:42:03Z", level: "error" as const, source: "worker", message: "Job export-42 failed" },
];

export function Logs() {
  return <LogConsole title="api logs" timeZone="UTC" downloadName="api.log" entries={entries} />;
}
```

```html
<div class="z-log-console" data-title="api logs" data-time-zone="UTC" data-download-name="api.log">
  <script type="application/json" data-props>{ "entries": [{ "id": 1, "time": "2026-11-21T10:42:01Z", "level": "info", "source": "api", "message": "GET /v1/projects 200" }] }</script>
</div>
```

Las líneas nuevas se añaden con `appendLogEntries(el, entries)`; `terminal(el)` devuelve los controles de un
`Terminal` (`write`, `writeln`, `clear`, `focus`, `text`). El color ANSI se interpreta, el HTML no.

### Chat y mensajería

`MessageList`, `Composer`, `ConversationList`, `ChatHeader`, `MessageBubble`, `Reactions`, `EmojiPicker`,
`VoiceNote`, `CallCard`, `PinnedBar`, `ThreadSummary`, `TypingIndicator` y `DeliveryStatus`. Sin React:
`/dom/chat`. Para montar la pantalla, `ChatLayout` de zout ([Zout](./04-zout.md)).

```tsx
import { Composer } from "@zuccadev-labs/zuix-zui";

export function Reply({ send }: { send: (text: string) => void }) {
  return <Composer voice mentions={{ items: [{ id: "ana", label: "Ana López" }] }} onSend={({ text }) => send(text)} />;
}
```

```html
<div class="z-composer" data-voice>
  <script type="application/json" data-props>{ "mentions": { "items": [{ "id": "ana", "label": "Ana López" }] } }</script>
</div>
```

Enviar emite `z:send` con `{ text, attachments }`. `MessageList` virtualiza a partir de 150 filas y conserva el
mensaje que tenías delante al cargar el historial; `messageList(el)` lo controla desde código.

### IA y agentes

`AssistantMessage`, `PromptInput`, `Markdown`, `Reasoning`, `ToolCall`, `ApprovalCard`, `AgentPlan`,
`AgentStatus`, `Sources`, `Citation`, `Suggestions`, `Artifact`, `BranchPicker` y `UsageMeter`. Sin React:
`/dom/ai`. `Markdown` usa un analizador propio que construye nodos, nunca marcado, y descarta los enlaces que no
son `http`, `https` o `mailto`.

```tsx
import { PromptInput } from "@zuccadev-labs/zuix-zui";

export function Ask({ ask }: { ask: (text: string) => void }) {
  return (
    <PromptInput
      models={[{ id: "fast", label: "Fast" }, { id: "deep", label: "Deep reasoning" }]}
      usage={{ used: 12400, limit: 200000 }}
      onSubmit={({ text }) => ask(text)}
    />
  );
}
```

```html
<div class="z-prompt-input">
  <script type="application/json" data-props>{ "models": [{ "id": "fast", "label": "Fast" }, { "id": "deep", "label": "Deep reasoning" }], "usage": { "used": 12400, "limit": 200000 } }</script>
</div>
```

Sin React, enviar emite `z:send` (en React es `onSubmit`). Una respuesta que llega por partes se pinta con
`createTextStream` y `provisional`, que cierran la valla de código o el énfasis que aún no ha llegado.

### Dashboard y tableros

`MetricCard`, `MetricGroup`, `DeltaBadge`, `Gauge`, `ProgressGoal`, `BarList`, `FunnelChart`, `Tracker`,
`Leaderboard`, `ActivityFeed`, `KanbanBoard` y `DashboardGrid`. `MetricCard`, `MetricGroup`, `Leaderboard` y
`ActivityFeed` son solo marcado; el resto, `/dom/dashboard`. Para la página, `DashboardLayout` o `KanbanLayout` de zout.

```tsx
import { Gauge } from "@zuccadev-labs/zuix-zui";

export function Cpu({ value }: { value: number }) {
  return (
    <Gauge
      label="CPU"
      value={value}
      hint="Last 5 min"
      valueFormat={{ style: "unit", unit: "percent" }}
      zones={[{ to: 60, tone: "success", label: "Healthy" }, { to: 85, tone: "warning", label: "Warning" }, { to: 100, tone: "danger", label: "Critical" }]}
      locale="en-US"
    />
  );
}
```

```html
<div class="z-gauge" data-value="72" data-label="CPU" data-hint="Last 5 min" data-zones="60:success:Healthy|85:warning:Warning|100:danger:Critical" data-locale="en-US"></div>
```

La disposición de `DashboardGrid` se lee y se escribe con `getDashboardLayout` y `setDashboardLayout`, y se guarda
como texto con `serializeLayout`.

### Usuarios y perfiles

`Persona`, `UserCard`, `ProfileHeader`, `PresenceBadge`, `AccountMenu`, `SettingsSection` (con `SettingRow`),
`MemberList` y `ProfileEditor`. `Persona`, `UserCard`, `ProfileHeader`, `PresenceBadge` y `SettingsSection` son solo
marcado; `AccountMenu` abre con el menú del núcleo (`data-z-open`), y `MemberList` y `ProfileEditor` van en
`/dom/people`.

```tsx
import { MemberList } from "@zuccadev-labs/zuix-zui";

export function Team() {
  return (
    <MemberList
      title="Team"
      editable
      currentUserId="m1"
      roles={[{ id: "owner", label: "Owner", locked: true }, { id: "member", label: "Member" }]}
      members={[
        { id: "m1", name: "Ana López", email: "ana@example.com", role: "owner", presence: "online" },
        { id: "m2", name: "Marco Rossi", email: "marco@example.com", role: "member", presence: "away" },
      ]}
      onRoleChange={({ memberId, role }) => console.log(memberId, role)}
    />
  );
}
```

```html
<div class="z-member-list" data-title="Team" data-editable data-current-user="m1">
  <script type="application/json" data-props>{"roles":[{"id":"owner","label":"Owner","locked":true},{"id":"member","label":"Member"}],"members":[{"id":"m1","name":"Ana López","email":"ana@example.com","role":"owner","presence":"online"},{"id":"m2","name":"Marco Rossi","email":"marco@example.com","role":"member","presence":"away"}]}</script>
</div>
```

La presencia nunca se dice solo con color: el punto lleva su forma y su texto («Available», «Away»).

### Nodos

`NodeCanvas` (con `Node`, `NodeMinimap` y `NodeControls`) y `NodeListView`, la misma información como tabla.
Sin React: `/dom/nodes`.

```tsx
import { NodeCanvas } from "@zuccadev-labs/zuix-zui";

export function Flow() {
  return (
    <NodeCanvas
      aria-label="Order flow"
      defaultNodes={[
        { id: "hook", position: { x: 0, y: 40 }, data: { label: "Webhook", icon: "bolt" }, ports: [{ id: "out", kind: "source" }] },
        { id: "save", position: { x: 320, y: 40 }, data: { label: "Save order" }, ports: [{ id: "in", kind: "target" }] },
      ]}
      defaultEdges={[{ id: "e1", source: "hook", sourcePort: "out", target: "save", targetPort: "in" }]}
    />
  );
}
```

```html
<div class="z-node-canvas" data-z-node-canvas aria-label="Order flow" style="height: 320px">
  <div class="z-node" data-id="hook" role="group" aria-roledescription="node" aria-label="Webhook" data-x="0" data-y="40">
    <div class="z-node__header"><span class="z-node__title">Webhook</span></div>
    <button type="button" class="z-node-port" data-port="out" data-kind="source" data-side="right" aria-label="Output out"></button>
  </div>
  <div class="z-node" data-id="save" role="group" aria-roledescription="node" aria-label="Save order" data-x="320" data-y="40">
    <div class="z-node__header"><span class="z-node__title">Save order</span></div>
    <button type="button" class="z-node-port" data-port="in" data-kind="target" data-side="left" aria-label="Input in"></button>
  </div>
  <script type="application/json" class="z-node-canvas__edges">[{"id":"e1","source":"hook","sourcePort":"out","target":"save","targetPort":"in"}]</script>
</div>
```

El lienzo es una sola parada de Tab: las flechas van al nodo más cercano, Alt y flechas lo mueven e Intro entra en
él. Cada nodo se describe con sus puertos y conexiones. `setNodeGraph(el, graph)` cambia el grafo; `serializeGraph` y `parseGraph` lo guardan.

### Avisos

`NotificationCenter` (campana con panel de avisos agrupados por día) y `NotificationBadge` (contador con tope).
`NotificationCenter` va en `/dom/data`; `NotificationBadge` es solo marcado.

```tsx
import { NotificationCenter } from "@zuccadev-labs/zuix-zui";

export function Inbox() {
  return (
    <NotificationCenter
      locale="en-GB"
      timeZone="UTC"
      notifications={[
        { id: "n1", title: "Marco Rossi booked Sea View Loft", time: "2026-11-23T10:42:00Z", icon: "calendar-days", tone: "accent" },
        { id: "n2", title: "Payout sent", time: "2026-11-23T08:05:00Z", icon: "banknotes", read: true },
      ]}
      onReadChange={({ id, read }) => console.log(id, read)}
    />
  );
}
```

```html
<div class="z-notification-center" data-locale="en-GB" data-time-zone="UTC">
  <script type="application/json" data-props>{"notifications":[{"id":"n1","title":"Marco Rossi booked Sea View Loft","time":"2026-11-23T10:42:00Z","icon":"calendar-days","tone":"accent"},{"id":"n2","title":"Payout sent","time":"2026-11-23T08:05:00Z","icon":"banknotes","read":true}]}</script>
</div>
```

Eventos sin React: `z:readchange`, `z:readall`, `z:action` y `z:openchange`. Un aviso nuevo sin leer se anuncia una
vez, también con el panel cerrado; `silent` lo apaga.

### Opiniones

`ReviewSummary` (media, estrellas y una barra por estrella, solo marcado) y `ReviewCard` (una opinión, con el texto
largo plegado en `/dom/data`).

```tsx
import { ReviewSummary } from "@zuccadev-labs/zuix-zui";

export function Reviews() {
  return <ReviewSummary title="Guest reviews" locale="en-US" distribution={{ 5: 873, 4: 241, 3: 90, 2: 31, 1: 49 }} />;
}
```

El HTML de `ReviewSummary` es el que da el binding: cópialo de la pestaña HTML de su página del
[catálogo](/components). Sin React, en `ReviewCard`, «Read more» abre el texto y emite `z:change { open }`;
`setReviewExpanded(card, true)` lo hace desde código. Lo plegado lleva `hidden="until-found"`: Buscar en la página
lo encuentra.

### Importes

`PriceTag`, `PriceBreakdown` y `SummaryList` son solo marcado: se renderizan en un Server Component. Las sumas se
hacen en unidades menores enteras, así que el total es la suma exacta de las filas que se leen, también en yenes o
en dinares.

```tsx
import { PriceBreakdown, PriceTag } from "@zuccadev-labs/zuix-zui";

export function Booking() {
  return (
    <>
      <PriceTag amount={120} previous={150} currency="EUR" locale="en-IE" unit="/ night" trimZeros />
      <PriceBreakdown
        currency="EUR"
        locale="en-IE"
        lines={[
          { label: "3 nights", amount: 360 },
          { label: "Weekly discount", amount: 36, kind: "discount" },
          { label: "VAT (13%)", rate: 13, kind: "tax" },
        ]}
      />
    </>
  );
}
```

```html
<span class="z-price" data-size="md" data-discounted="">
  <s class="z-price__previous"><span class="z-sr-only">Previous price: </span>€150</s>
  <span class="z-price__current"><span class="z-sr-only">Current price: </span>€120</span>
  <span class="z-price__unit">/ night</span>
</span>
```

Sin React, los importes se calculan con `formatMoney` y `summarizePrice`, en la raíz y en `/dom/data`.

### FilterBar

Chips de filtro en una fila que desplaza: interruptores, o menús con casillas u opciones. «Clear» aparece con algún
filtro activo. Sin React: `/dom/data`.

```tsx
import { FilterBar } from "@zuccadev-labs/zuix-zui";

export function StayFilters() {
  return (
    <FilterBar
      filters={[
        { id: "instant", label: "Instant book", icon: "bolt" },
        { id: "type", label: "Type of place", options: [{ value: "entire", label: "Entire home" }, { value: "room", label: "Private room" }] },
      ]}
      defaultValue={{ instant: true }}
      onChange={({ value }) => console.log(value)}
    />
  );
}
```

```html
<div class="z-filter-bar">
  <script type="application/json" data-props>{"filters":[{"id":"instant","label":"Instant book","icon":"bolt"},{"id":"type","label":"Type of place","options":[{"value":"entire","label":"Entire home"},{"value":"room","label":"Private room"}]}],"defaultValue":{"instant":true}}</script>
</div>
```

Cambiar un filtro emite `z:change { value, id }`; `toggleFilter` y `toggleOption` lo hacen desde código.

### Navegadores anteriores y React 18

- Para Chromium 109, Firefox 115 y Safari 15.4, las hojas `styles.compat.css` y el polyfill de popover:
  [Modo compat](./10-compatibilidad.md#modo-compat). Los colores mezclados quedan fijos por marca y tema, y
  `:has()` falta en Firefox 115: los límites están en la misma página.
- El binding funciona con React 18.2 o posterior y con 19. En 18, los componentes que aceptan `ref` son objetos de
  `forwardRef`, no funciones ([React](./10-compatibilidad.md#react)).

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

## Funciones de la raíz

Además de los componentes, `@zuccadev-labs/zuix-zui` exporta la lógica que usan por dentro, para quien la necesite
fuera de ellos. Son funciones puras salvo los hooks; las firmas están en las declaraciones de tipos.

| Área | Exportaciones |
|---|---|
| Clases | `cx` |
| Hooks | `useToast`, `useFieldLabel`, `useFieldControl` |
| Importes | `formatMoney`, `summarizePrice`, `currencyDigits` |
| Fechas civiles | `formatDateRange`, `isoWeekText`, `weekNumber`, `weekStartOf`, `localeWeekInfo`, `rangePresets`, `resolvePreset`, `presetValue`, `PRESET_KEYS` |
| Agenda, recurrencia y zonas | `expandEvents`, `layoutTimed`, `layoutRow`, `rewriteSpan`, `expandDates`, `parseRRule`, `formatRRule`, `fromWall`, `toWall`, `wallStatus` |
| Color | `parseColor`, `formatColor`, `formatOf`, `normalizeColor`, `contrastRatio`, `hslToRgb`, `rgbToHsl`, `hsvToRgb`, `rgbToHsv`, `oklchToRgb`, `rgbToOklch` |
| Duraciones y husos | `formatDuration`, `parseISODuration`, `toISODuration`, `durationToMs`, `listTimeZones`, `groupZones`, `zoneOptions`, `offsetText` |
| Terminal y código | `parseAnsi`, `stripAnsi`, `createAnsiScreen`, `diffLines`, `parsePatch`, `toHunks`, `wordDiff`, `tokenize`, `tokenizeLines` |
| Atajos de teclado | `parseShortcut`, `normalizeShortcut`, `matchesShortcut`, `shortcutFromEvent`, `shortcutLabels`, `formatShortcutValue`, `ariaKeyshortcuts`, `isApplePlatform` |
| Descargas | `download`, `mimeFromName` |
| Medios y efectos | `qrcodeSvg`, `cropImage`, `cropImageBlob`, `signatureValue`, `signatureBlob`, `confetti`, `DOT_PATTERNS` |
| Chat | `mergeDelivery`, `toggleReaction`, `encodeMentions`, `mentionParts`, `linkify`, `safeHref`, `searchEmoji`, `peaksFrom`, `EMOJI_SET`, `QUICK_REACTIONS` |
| IA | `createTextStream`, `provisional`, `activePath`, `addBranch`, `branchInfo`, `selectBranch`, `stepBranch`, `siblings` |
| Dashboard | `computeDelta`, `computePace`, `elapsedFraction`, `funnelStages`, `normalizeLayout`, `parseLayout`, `serializeLayout`, `sortLayout`, `compactLayout`, `fitColumns`, `moveGridItem`, `resizeGridItem`, `moveCard`, `locateCard` |
| Usuarios | `presenceText`, `presenceRank`, `PRESENCE_LABELS`, `initialsOf`, `filterMembers`, `groupMembers`, `sortByName`, `sortByPresence`, `validateProfile`, `validHandle`, `bioCounter` |
| Nodos | `layeredLayout`, `parseGraph`, `serializeGraph`, `describeGraph`, `describeNode` |
| Textos por defecto | `REVIEW_SUMMARY_LABELS`, `REVIEW_CARD_LABELS`, `FILTER_BAR_LABELS`, `NOTIFICATION_CENTER_LABELS` |

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
