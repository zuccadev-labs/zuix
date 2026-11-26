# Zui

`@zuccadev-labs/zuix-zui` es el sistema de componentes de la suite: 237 componentes en 19 grupos. Cada
componente es un contrato de HTML y CSS que solo lee tokens, así que una marca nueva no modifica componentes
y el mismo marcado sirve en cualquier framework. El paquete trae dos formas de darle vida: el binding de
React y `@zuccadev-labs/zuix-zui/dom`, sin framework ([Frameworks](./06-frameworks.md)). Sin framework se puede
cargar todo (`/dom`) o el núcleo (`/dom/core`) más las familias que use la página (`/dom/dates`, `/dom/agenda`,
`/dom/charts`, `/dom/forms`…): ver [Elegir entrada](./06-frameworks.md#elegir-entrada-todo-o-por-familias).

No depende de ninguna biblioteca de UI. En ejecución solo necesita `@zuccadev-labs/zuix-tokens`;
`@zuccadev-labs/zuix-zicon` es un peer obligatorio y React y React DOM (18.2 o posterior, o 19) son peers opcionales.

El catálogo en vivo, con el código de cada ejemplo, está en [Componentes](/components).

## Catálogo

| Grupo | Componentes |
|---|---|
| Acciones | Button, ButtonGroup, CopyButton, DownloadTrigger, Fab, FabMenu, IconButton, Link, SegmentedControl, SplitButton, Swap, Toggle, ToggleGroup, Toolbar |
| Formularios | Calendar, Cascader, Checkbox, CheckboxGroup, CircularSlider, ColorArea, ColorField, ColorPicker, ColorPickerTrigger, ColorSlider, ColorSwatchPicker, Combobox, DateField, DateInput, DatePicker, DateRangePicker, DateTimePicker, DateTimeRangePicker, Editable, Field, Fieldset, FileUpload, Form, Input, InputGroup, Listbox, MaskedInput, MonthPicker, NativeSelect, NumberInput, OTPInput, PasswordInput, QuarterPicker, Radio, RadioGroup, SearchInput, Select, ShortcutInput, Slider, Switch, TagsInput, Textarea, TimeField, TimePicker, TimeRangePicker, TransferList, TreeSelect, WeekPicker, YearPicker |
| Agenda | CalendarHeatmap, EventCalendar, FreeBusy, HabitCalendar, PerpetualYear, SlotPicker, TimelineView |
| Datos | Avatar, AvatarGroup, Badge, Chip, CircularProgress, DataTable, DescriptionList, FilterBar, Item, Kbd, Meter, PriceBreakdown, PriceTag, Progress, Rating, ReviewCard, ReviewSummary, StatTile, StatusDot, SummaryList, Table, Timeline |
| Gráficos | AnimatedNumber, AreaChart, BarChart, BulletChart, CategoryBar, ComboChart, DonutChart, HeatmapChart, LineChart, PieChart, RadarChart, ScatterChart, Sparkline |
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
| `none` | Solo CSS. Basta el marcado | 72 |
| `dom` | Necesita `@zuccadev-labs/zuix-zui/dom`, o el binding de React | 164 |
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

## Formularios de la 0.5

Seis selectores nuevos para formularios. Todos envían su valor con `name` (en un campo nativo oculto que da también
la validación `required` del navegador), vuelven al valor con el que se montaron con `form.reset()` y avisan a la
aplicación del cambio, así un valor controlado no se queda atrás. Los textos visibles llegan por `labels` (y
`messages` donde hay validación), en inglés por defecto. Sin React: Cascader, TreeSelect y MaskedInput en
`/dom/forms`; DateTimeRangePicker, TimeRangePicker y QuarterPicker en `/dom/dates`.

### Cascader

Selección jerárquica por columnas: país › región › ciudad. El valor es la ruta de valores (`["es", "md", "alc"]`) y
el formulario recibe `es/md/alc` (`separator` lo cambia). Con `searchable`, lo que se teclea busca en la ruta completa
sin mayúsculas ni acentos («alcala» encuentra «Spain / Madrid / Alcalá de Henares»). Una opción con `isLeaf: false` y
sin `children` pide sus hijos con `loadChildren` al abrirla, con un indicador de carga en la opción y `aria-busy` en
la columna; si la promesa falla, queda como hoja y se emite `onLoadError`. `changeOnSelect` deja elegir una rama sin
llegar a una hoja. `multiple` pone casillas con estado mixto (las de `Tree`) y `showCheckedStrategy` decide si una
rama marcada entera cuenta como la rama (`parent`, por defecto), como todas sus rutas (`all`) o solo como sus hojas
(`child`). En una ventana de 640 px o menos se ve una columna cada vez, con «Back» y el nombre del nivel anterior.

El teclado es el de un combobox: el foco se queda en el campo, flechas arriba y abajo recorren la columna, derecha
abre la rama (izquierda en RTL), izquierda vuelve, Intro elige y Escape vacía la búsqueda o cierra.

```tsx
import { Cascader, type CascaderOption } from "@zuccadev-labs/zuix-zui";

const places: CascaderOption[] = [
  { value: "es", label: "Spain", children: [{ value: "md", label: "Madrid", children: [{ value: "alc", label: "Alcalá de Henares" }] }] },
  { value: "fr", label: "France", isLeaf: false },
];

export function Location() {
  return (
    <Cascader
      name="location"
      searchable
      levelLabels={["Country", "Region", "City"]}
      options={places}
      loadChildren={(option) => fetch(`/api/regions/${option.value}`).then((r) => r.json())}
      onValueChange={(path, { labels }) => console.log(path, labels)}
    />
  );
}
```

```html
<div class="z-cascader" data-searchable data-name="location" data-label="Location">
  <script type="application/json" data-props>{"options":[{"value":"es","label":"Spain","children":[{"value":"md","label":"Madrid"}]}],"levelLabels":["Country","Region"]}</script>
</div>
```

Sin React, la carga diferida se pasa por propiedad: `setWidgetProps(el, { loadChildren })`. Emite `z:change { value,
labels, option }`, `z:load { path, options }` y `z:loaderror { path, error }`.

### TreeSelect

Un select con un árbol en su panel: el campo es un combobox con `aria-haspopup="tree"` y la fila activa va por
`aria-activedescendant`. Teclear filtra y expande los antepasados de lo que coincide. Con `multiple`, las casillas son
las de `Tree` (la misma lógica de `core/tree`), lo elegido va en piezas dentro del campo (`maxChips` resume el resto en
«+N») y el valor sale según `showCheckedStrategy`, como en Cascader.

```tsx
import { TreeSelect } from "@zuccadev-labs/zuix-zui";

<TreeSelect
  multiple
  name="teams"
  nodes={[{ value: "eng", label: "Engineering", children: [{ value: "web", label: "Web" }, { value: "mobile", label: "Mobile" }] }]}
  defaultValue={["web"]}
  onValueChange={(value) => console.log(value)}
/>;
```

```html
<div class="z-treeselect" data-multiple data-name="teams" data-label="Teams">
  <script type="application/json" data-props>{"nodes":[{"value":"eng","label":"Engineering","children":[{"value":"web","label":"Web"}]}],"value":["web"]}</script>
</div>
```

### MaskedInput

Campo con máscara: presets `phone`, `card` (15 cifras en 4-6-5 si empieza por 34 o 37; si no, 16 en grupos de 4),
`date`, `time`, `plate` y `postal`, un patrón con `9` (cifra), `a` (letra), `*` (letra o cifra) y `\` para escapar,
una función que elige el patrón según lo tecleado o una máscara completa con ranuras propias. Cada edición se calcula
sobre el valor crudo con `beforeinput`, así el cursor queda tras lo tecleado al escribir, pegar o borrar en medio; la
composición de un IME, el autocompletado y los teclados de móvil que no dejan cancelar la edición se reformatean al
terminar. `onValueChange` da el crudo, el texto formateado y si está completo. El formato va encima del campo (debajo
lo taparía el teclado del móvil) y se anuncia con `aria-describedby`; con el valor a medias, el campo no es válido
(`incompleteMessage`). El formulario recibe el crudo, o el texto con `submit="formatted"`.

```tsx
<MaskedInput mask="phone" name="phone" onValueChange={(raw, { value, complete }) => console.log(raw, value, complete)} />
<MaskedInput mask="aa-9999-**" formatHint="AB-1234-X9" name="order" />
```

```html
<span class="z-masked" data-mask="phone">
  <span class="z-masked__format" id="phone-format">Format: (___) ___-____</span>
  <span class="z-input"><input class="z-input__control" type="text" inputmode="numeric" autocomplete="tel-national" aria-describedby="phone-format"></span>
  <input type="hidden" name="phone">
</span>
```

Sin React: `setMaskedValue(el, raw)` y, para ranuras propias o un patrón que es una función, `setMask(el, spec)`.

### DateTimeRangePicker

Rango de fecha y hora en un panel: el calendario de rango (`Calendar`), una hora de inicio y otra de fin (`TimeField`),
preajustes (`last-hour`, `last-24-hours`, `today`, `yesterday`, `last-7-days`, `next-7-days`, `this-week` o una
función) y, con `showTimeZone`, la zona horaria. El valor (`{ start, end, timeZone }`) cambia con «Apply»; Escape y
«Cancel» lo descartan. Con zona, el formulario recibe cada extremo con su desfase y su zona,
`2026-11-28T22:00+01:00[Europe/Madrid]/2026-11-29T02:00+01:00[Europe/Madrid]`, que es lo que lee
`Temporal.ZonedDateTime.from`: la hora queda atada al lugar. Sin zona, el reloj civil, como `datetime-local`.

```tsx
<DateTimeRangePicker
  name="window"
  showTimeZone
  presets={[{ label: "Today", value: "today" }, { label: "Next 7 days", value: "next-7-days" }]}
  onValueChange={({ start, end, timeZone }) => console.log(start, end, timeZone)}
/>
```

### TimeRangePicker

Dos `TimePicker` en un grupo. El fin tiene que ser posterior al inicio; con `allowOvernight` puede caer al día
siguiente y un indicador («+1 day», «Ends the next day» para lectores) lo dice. Muestra la duración y admite
`minDuration` y `maxDuration`. El formulario recibe `22:00/06:00`; un rango que no vale lleva su mensaje en el campo
nativo (lo muestra un `Field` con `validate`).

```tsx
<TimeRangePicker name="shift" allowOvernight defaultValue={{ start: "22:00", end: "06:00" }} />
```

### QuarterPicker

Trimestres con el mismo patrón que `MonthPicker` y `YearPicker`: un botón con el valor y un panel con la rejilla del
calendario, aquí de 2 × 2 (Q1 Q2 / Q3 Q4) con los meses de cada uno. Valor `YYYY-Qn`; `onValueChange` recibe además el
primer y el último día. Flechas, Inicio, Fin, Re Pág y Av Pág (con Mayús, de diez en diez años), con `min` y `max`.

```tsx
<QuarterPicker name="quarter" min="2024-Q1" max="2027-Q4" onValueChange={(value, { from, to }) => console.log(value, from, to)} />
```

```html
<div class="z-quarterpicker" data-name="quarter" data-label="Fiscal quarter" data-min="2024-Q1" data-max="2027-Q4" data-value="2026-Q4"></div>
```

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

## Gráficos

`LineChart`, `AreaChart`, `BarChart`, `DonutChart`, `PieChart`, `ScatterChart`, `RadarChart`, `ComboChart`,
`HeatmapChart` y `BulletChart` son el mismo componente con otro `type`: un `figure` con título, leyenda, botón
«View as table» que cambia el gráfico por su tabla, resumen para lectores de pantalla, tooltip al pasar o enfocar y
una sola parada de Tab con flechas entre puntos. `CategoryBar`, `AnimatedNumber` y `Sparkline` son piezas sueltas.
Todo está en `/dom/charts` sin React. Los números y las fechas salen de `Intl` con `locale`, el color de cada
serie es un token `--z-chart-1…8` que sigue a la serie aunque se oculten otras, y nada depende solo del color:
formas de marcador, trazos, tramas y, con colores forzados, `CanvasText`. Con `prefers-reduced-motion` no hay
animación de entrada ni cuenta.

- `ScatterChart`: un punto por fila (`xKey`, `yKey`), series por el valor de `seriesKey` con forma propia,
  burbujas con `sizeKey` (el área es proporcional al valor) y `trend` para la recta de regresión de cada serie,
  con su pendiente y R² en el resumen. ←→ recorren la serie en orden de x y ↑↓ cambian de serie.
- `RadarChart`: un eje radial por fila y un polígono translúcido por serie. La escala se fija con `yMin`, `yMax` y
  `yTicks` y se escribe bajo el radar («Scale 0 to 100, rings every 25»), no sobre los anillos; `gridShape="circle"`
  cambia la retícula.
- `ComboChart`: cada serie dice si es barra o línea (`type`) y en qué eje va (`axis: "end"` para el secundario,
  con `y2Format`, `y2Min` y `y2Max`).
- `HeatmapChart`: una celda por fila (`xKey` columna, `yKey` fila, `valueKey` valor) en un `role="grid"` con
  flechas, Inicio/Fin y Ctrl+Inicio/Fin. `scale="sequential"` usa cinco niveles del acento
  (`--z-heatmap-0…4`); `scale="diverging"`, cuatro por lado alrededor de `midpoint` en azul y ámbar
  (`--z-heatmap-pos-*`, `--z-heatmap-neg-*`). La leyenda dice el tramo de cada nivel y `showValues` escribe el
  valor en la celda.
- `BulletChart`: valor, objetivo y rangos cualitativos (`ranges`, `rangeLabels`) por fila, en horizontal o
  `orientation="vertical"`. Las filas comparten escala: medidas de unidades distintas van en gráficos distintos.
- `CategoryBar`: tramos proporcionales a `values`, con `categories`, `colors`, `marker`, `showLabels` y `legend`.
- `AnimatedNumber`: cuenta del valor anterior al nuevo con `format` de `Intl.NumberFormat`. El servidor pinta el
  valor final, así que no hay desajuste de hidratación; el texto que cuenta está oculto a los lectores de
  pantalla y una copia con el final se lee una vez (`live="polite"` la anuncia al cambiar). Va solo, como
  `value` de `StatTile` o con `animate` en `MetricCard`.

```tsx
import { AnimatedNumber, HeatmapChart, StatTile } from "@zuccadev-labs/zuix-zui";

export function Load({ cells, orders }: { cells: { day: string; hour: string; value: number }[]; orders: number }) {
  return (
    <>
      <StatTile label="Orders" value={<AnimatedNumber value={orders} live="polite" locale="en-US" />} />
      <HeatmapChart title="Support tickets" data={cells} xKey="hour" yKey="day" locale="en-US" />
    </>
  );
}
```

```html
<div class="z-chart" data-type="heatmap" data-title="Support tickets" data-x-key="hour" data-y-key="day" data-locale="en-US">
  <script type="application/json" data-props>{"data":[{"day":"Mon","hour":"09","value":4}]}</script>
</div>
<span class="z-animated-number" data-value="1284" data-live="polite" data-locale="en-US"></span>
```

Sin React, `setWidgetProps(el, { value: 1500 })` cambia el número y lo hace contar, y `setWidgetProps(el, { data })`
repinta un gráfico con datos nuevos.

## Idiomas

Los textos propios de los componentes salen en inglés salvo que los cambies. `labels` por prop sigue mandando; por
debajo, `LocaleProvider` (React) o `setLocale()` (sin React) ponen los de un paquete de idioma: `en`, `es`, `pt`,
`fr` y `de`, en `@zuccadev-labs/zuix-zui/locales/<id>`.

```tsx
import { LocaleProvider, useLocale } from "@zuccadev-labs/zuix-zui";
import es from "@zuccadev-labs/zuix-zui/locales/es";

<LocaleProvider locale="es" messages={es}>
  <Cascader options={regions} />
</LocaleProvider>;
```

`loadLocale(id)` carga un paquete bajo demanda; `useLocale()` da el idioma vigente y `formatNumber`, `formatDate`,
`formatList` y `messages()` en ese idioma. Plurales, carga bajo demanda, el `lang` heredado y cómo añadir un idioma:
[Idiomas](./13-idiomas.md).

## Dirección de escritura

Dentro de un contenedor con `dir="rtl"` las hojas se reflejan (usan propiedades lógicas), los iconos
direccionales se voltean y el teclado se invierte donde el patrón lo pide: en `Tabs`, `Menu`, `Slider`,
`RadioGroup`, `SegmentedControl`, `Calendar`, `Tree` y `Rating` la flecha izquierda avanza. La dirección se
lee del DOM; no hay proveedor ni prop.

En las familias de la 0.4 (chat, IA, dashboard, personas, nodos, terminal y tiempo) la regla es que una flecha
lleva al elemento que está en ese lado de la pantalla:

- Van de derecha a izquierda los filtros de `ConversationList`, la rejilla y las pestañas de `EmojiPicker`, las
  columnas de `KanbanBoard`, los días de `Tracker`, las piezas de `DashboardGrid`, los archivos de `CodeViewer`,
  las unidades de `Countdown` y las ciudades de `WorldClock`.
- Siguen de izquierda a derecha, en cualquier dirección: el código (`CodeViewer`, `DiffViewer`, `Terminal`, la
  entrada y salida de `ToolCall`), la rejilla de `LogConsole`, los segmentos de `DurationField` (se escriben como una
  hora) y el lienzo de `NodeCanvas`, que es espacial: → lleva al nodo de la derecha y un puerto `data-side="left"`
  está a la izquierda también en un nodo suelto.
- Responder, reenviar, deshacer, rehacer, entrar y salir se reflejan donde aparezcan. La hora de un mensaje va al
  final de su texto aunque el texto vaya en la dirección contraria a la de la página (`dir="auto"`).

## Material 3 Expressive (0.5)

Variantes opcionales sobre componentes que ya existían: sin ellas, nada cambia. Todas leen tokens y respetan el
movimiento reducido.

```tsx
<Progress label="Exporting" value={64} variant="wavy" showValue />
<CircularProgress label="Loading" variant="wavy" size="lg" />
<Button variant="tonal" icon="eye">Preview</Button>
<ButtonGroup label="View" connected>
  <Button aria-pressed="true" icon="squares-2x2">Grid</Button>
  <Button aria-pressed="false" icon="list-bullet">List</Button>
</ButtonGroup>
<Slider aria-label="Balance" defaultValue={[-20]} min={-50} max={50} origin="center" />
<Field label="Email" labelPlacement="floating">
  <Input type="email" autoComplete="email" />
</Field>
<Modal title="New event" fullScreen="compact" trigger={<Button>New event</Button>}>…</Modal>
```

| Variante | Qué hace |
|---|---|
| `Progress` y `CircularProgress` con `variant="wavy"` | Lo hecho es una onda y lo que falta, una línea (o un anillo) plana tras un hueco. La onda avanza mientras hay trabajo; con movimiento reducido se queda quieta y el anillo indeterminado gira más despacio. El `role="progressbar"` (o el `<progress>`) sigue siendo el control accesible |
| `Button` con `variant="tonal"` | Relleno suave del acento, entre el primario y el secundario. Tokens `--z-button-tonal-bg`, `--z-button-tonal-bg-hover` y `--z-button-tonal-fg`. También en `IconButton` y `CopyButton` |
| `ButtonGroup` con `connected` | 2 px entre piezas, esquinas interiores cerradas y las exteriores con el radio del botón. La pieza pulsada (`aria-pressed`, `data-state="on"` o `data-active`) recupera sus cuatro esquinas y se rellena: el estado se lee por color y por forma |
| `Slider` con `origin="center"` | Con un tirador, la pista se rellena desde el punto medio entre `min` y `max` hasta el valor, con una marca en el centro. Para ajustes con cero en medio. En el modo DOM, `data-origin="center"` |
| `Field` con `labelPlacement="floating"` | La etiqueta va dentro del campo mientras está vacío y sube al enfocarlo, al escribir o cuando el navegador lo autocompleta. Sigue siendo un `<label for>`. «Vacío» es `:placeholder-shown`: `Input` pone un marcador vacío si no le das uno, y el tuyo solo se ve con la etiqueta arriba. Con `Input` (también con icono); sin efecto en `layout="inline"` |
| `Modal` con `fullScreen` | `compact` ocupa toda la ventana por debajo de 600 px de ancho; `always`, siempre. Sin radio, todo el alto dinámico, el pie fijo abajo y las zonas seguras |
| `Fab` extendido y `FabMenu` | El texto del FAB extendido crece con la talla (`sm`, `md`, `lg`). El menú del FAB no tiene panel: una columna de acciones opacas alineadas al borde del FAB que entran escalonadas, y el «+» gira a cierre |

Nada es una píldora: el grupo conectado y las acciones del menú del FAB son rectángulos de esquinas redondeadas.

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

## Escala y rejilla (0.5)

Las listas y tablas que ya había aguantan miles de entradas y la tabla de datos se comporta como una rejilla. Todo es
opcional: sin las props nuevas, el marcado y el comportamiento son los de la 0.4.

### Listas largas: ventana virtual

Con muchas entradas solo se pintan las que se ven, más unas de margen. Se activa sola a partir de un umbral y se
controla con `virtualize`: `false` nunca, `true` siempre, un número es el umbral propio.

| Componente | Umbral por defecto | Desplaza en |
|---|---|---|
| `DataTable` | 200 filas | su propio alto (`--z-datatable-height`, 560 px), con la cabecera fija |
| `Select`, `Combobox`, `Listbox` | 100 opciones | la lista |
| `CommandPalette`, `Command` | 150 comandos | la lista |
| `Tree` | 200 filas visibles | su propio alto (`--z-tree-height`, 480 px); las filas pasan a plano |
| `ConversationList` | 150 conversaciones | la lista |
| `MemberList` | 200 personas | su propio alto (`--z-member-list-height`, 480 px) |
| `TransferList` | 200 opciones por lista | cada lista |

Las ventanas que ya existían (`MessageList`, `LogConsole`, `TimelineView` y la lista de `EventCalendar`) usan el mismo
núcleo, `core/virtual`, que comparten el binding de React y el modo DOM. Lo que garantiza:

- La entrada con el foco (o la activa de un `aria-activedescendant`, o la que se edita) no sale nunca del documento:
  el foco sobrevive al reciclado y las flechas llevan a una entrada que aún no estaba pintada.
- Los lectores reciben la posición y el total: `aria-setsize` y `aria-posinset` en listas y árboles,
  `aria-rowcount` y `aria-rowindex` en la tabla.
- Altura fija o medida: las filas de alto variable (mensajes, detalle de una tabla, grupos) se miden al pintarse.

El límite: la búsqueda del navegador (Ctrl+F) solo encuentra lo pintado. Para eso están los filtros de la tabla y las
búsquedas de las listas. En el modo DOM, una lista o un árbol que llegan enteros en el marcado del servidor no salen
del documento: llevan `content-visibility: auto` y Ctrl+F los encuentra igual. La tabla del modo DOM sí recicla filas
(con más de 200, o con `data-virtual`).

### DataTable como rejilla

Con columnas editables, agrupación o datos en árbol (o con `grid`), la tabla sigue el patrón APG «data grid»: una sola
parada de Tab en el cuerpo y el foco por celdas.

```tsx
<DataTable
  caption="Team"
  locale="es-ES"
  rows={people}
  rowKey={(p) => p.id}
  selectable
  reorderable
  onCellEdit={({ rowKey, key, value }) => (value === "taken" ? "Ese nombre ya existe" : save(rowKey, key, value))}
  columns={[
    { key: "name", header: "Name", accessor: (p) => p.name, pinned: "start", editable: true, required: true },
    { key: "seats", header: "Seats", accessor: (p) => p.seats, editable: true, editor: "number", min: 1, max: 50 },
    { key: "joined", header: "Joined", accessor: (p) => p.joined, pinned: "end" },
  ]}
/>
```

| Tecla | Qué hace |
|---|---|
| Flechas, Inicio, Fin, RePág, AvPág | Mueven la celda activa; Ctrl+Inicio y Ctrl+Fin van a la primera y la última |
| F2, Intro o una letra | Editan la celda (la letra empieza el valor) |
| Intro / Tab / Escape (editando) | Confirma / confirma y pasa a la siguiente editable / cancela |
| → y ← en la primera celda | Abren y cierran un grupo o una rama; ← en un hijo va a su padre |
| Mayús+Espacio, Mayús+↑/↓, Mayús+clic | Seleccionan un rango de filas (con `selectable`) |
| Espacio, ←/→, Espacio, Escape (en el asa) | Cogen, mueven, sueltan y devuelven una columna (`reorderable`) |

- Edición por celda o por fila (`editMode="row"`). Reglas por columna (`required`, `min`, `max`, `pattern`, `editor`
  con `options`) y `validate`. `onCellEdit` y `onRowEdit` devuelven un mensaje (o una promesa con él) para rechazar:
  el campo se queda abierto con `aria-invalid` y el mensaje se anuncia. La tabla no cambia `rows`.
- Columnas fijadas a los dos lados: `pinned: "start" | "end"`.
- Agrupación: `groupBy` (una columna o varias) y `aggregate` por columna (`sum`, `avg`, `min`, `max`, `count` o una
  función). El agregado sale en la fila de cada grupo y en el pie si la columna no tiene `footer`.
- Datos en árbol: `getRowChildren` y `expandedRows`. Fila de detalle: `renderDetail` y `expandedDetails`.
- Las celdas `Date` se escriben con `locale` y `dateFormat` de la tabla, no con el idioma del entorno: en render de
  servidor, fija `locale` (y `timeZone` en `dateFormat`) y no hay desajuste de hidratación.

Rendimiento: con 10 000 filas, en el documento hay unas 20; ordenar y filtrar trabajan sobre todas. La prueba de
tiempo está en `tests/browser/cases-scale.mjs` (React) y `tests/html/cases/28-scale.mjs` (modo DOM).

### Opciones del servidor

`Combobox`, `Select` y `Listbox` aceptan `loadOptions(query, { signal, page })`, que devuelve `{ options, hasMore }` o
un array. La petición sale tras `debounce` ms sin teclear (250), la anterior se cancela con su `AbortController` (pasa
`signal` a `fetch`) y la página siguiente se pide al llegar al final de la lista. Hay estado de carga (`aria-busy`),
de vacío y de error con un botón de reintentar (Intro también reintenta). `Select` con `loadOptions` lleva búsqueda;
sin ella, `searchable` la añade y filtra las opciones locales conservando el título de los grupos con coincidencias.

### Tree: mover nodos y cargar ramas

- `draggable`: se arrastra con el puntero (marcador delante, dentro o detrás) o con el teclado: Ctrl/⌘+X coge el
  nodo, ↑/↓ eligen el sitio, Intro o Ctrl/⌘+V lo sueltan y Escape cancela. Cada paso se anuncia. `onMove(drop, nodes)`
  recibe el movimiento y el árbol ya movido; `canDrop` limita los destinos.
- `loadChildren`: una rama con `hasChildren` pide sus hijos al abrirse por primera vez (aria-busy mientras llegan).
- La selección múltiple con casillas ya estaba (`checkable`, `selectionMode="multiple"`).

### Tabs que no caben

`overflow="scroll"` (por defecto) desplaza la tira, difumina el borde con pestañas ocultas y lleva la elegida a la
vista. `overflow="menu"` deja las que caben y pone las demás en un menú «Más» tras la tira: el botón queda fuera del
tablist, y la pestaña elegida nunca va al menú.

## Reglas de uso

1. No se pasan colores, radios ni sombras por `style` o clases sueltas.
2. Si una variante no existe, se añade al sistema.
3. El cristal no se aplica sobre áreas de lectura o edición de texto.
4. Los componentes de dominio (pagos, reservas, mapas) viven en la aplicación.
5. `DataTable` escribe una fecha sin `render` con su `locale` y su `dateFormat`. Sin `locale`, usa el idioma del
   entorno: en render de servidor, con otro idioma o zona horaria que el navegador, eso produce un desajuste de
   hidratación. Para fechas, pasa `locale` (y `timeZone` en `dateFormat`) o `render`.

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
| Listas largas y árboles | `wantsVirtual`, `virtualWindow`, `moveNode` |
| Nodos | `layeredLayout`, `parseGraph`, `serializeGraph`, `describeGraph`, `describeNode` |
| Textos por defecto | `REVIEW_SUMMARY_LABELS`, `REVIEW_CARD_LABELS`, `FILTER_BAR_LABELS`, `NOTIFICATION_CENTER_LABELS`, `TREE_DRAG_LABELS` |
| Idiomas | `LocaleProvider`, `useLocale`, `loadLocale`, `LOCALES`, `registerLocale`, `registeredLocales`, `resolveLocale`, `localize`, `formatMessage`, `formatNumber`, `formatDate`, `formatList`, `pluralRules` ([Idiomas](./13-idiomas.md)) |

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
