# Zui

`@zuccadev-labs/zuix-zui` es el sistema de componentes de la suite: 64 componentes en 8 grupos. Cada componente es
un contrato de HTML y CSS que solo lee tokens, así que una marca nueva no modifica componentes y el
mismo marcado sirve en cualquier framework. El paquete trae dos formas de darle vida: el binding de
React (lógica accesible de Radix) y `@zuccadev-labs/zuix-zui/dom`, sin framework. Ver [Frameworks](./06-frameworks.md).

El catálogo en vivo, con el código de cada ejemplo, está en [Componentes](/components).

## Catálogo

| Grupo | Componentes |
|---|---|
| Acciones | Button, IconButton, Link, Toggle, SegmentedControl |
| Formularios | Field, Input, Textarea, Select, NativeSelect, Combobox, Checkbox, RadioGroup, Radio, Switch, Slider, DateInput, Calendar, DatePicker, OTPInput, FileUpload, SearchInput |
| Datos | Table, DataTable, Badge, Chip, Avatar, AvatarGroup, StatTile, Meter, Progress, Rating, Kbd |
| Estado | Spinner, Skeleton, LoadingOverlay, EmptyState, ErrorState, ErrorBoundary, Alert |
| Contenido | Card, CardHeader, CardFooter, Panel, Callout, CodeBlock, Divider |
| Superposición | Modal, ConfirmDialog, Drawer, Popover, Tooltip, Menu, ContextMenu, CommandPalette, Toast |
| Navegación | Tabs, Breadcrumb, Pagination, Stepper, Accordion, Tree, NavList |
| Carousel | Carousel con efecto lente |

## Uso con React

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zicon/all";

import { Button, Field, Input, ToastProvider, useToast } from "@zuccadev-labs/zuix-zui";

function Save() {
  const { toast } = useToast();
  return <Button variant="primary" icon="check" onClick={() => toast({ title: "Saved", intent: "success" })}>Save</Button>;
}
```

- `ToastProvider` envuelve la aplicación una vez.
- Los textos visibles llegan por props; los valores por defecto están en inglés.
- La clase `z-root` en el contenedor de la aplicación aplica tipografía, foco y selección.

### Con Next.js

Los componentes con estado llevan `"use client"`; los de solo marcado se renderizan como Server
Components. `@zuccadev-labs/zuix-zicon/all` se importa dos veces, en `app/layout.tsx` y en un módulo con
`"use client"`, porque Next mantiene un registro de iconos por cada grafo. Ejemplo completo en
[Frameworks](./06-frameworks.md#con-nextjs-app-router).

## Variantes y estados

- Intención: `primary`, `secondary`, `ghost`, `danger`. Tamaño: `sm`, `md`, `lg`.
- Todo componente interactivo define reposo, hover, foco, activo y deshabilitado.

## Táctil

- Con el dedo como puntero principal (`pointer: coarse`) los controles `sm` y `md` miden 40 px de alto: sale del
  token `--z-touch-target` ([Tokens](./01-tokens.md)). Checkbox, Radio y Switch ganan aire vertical; el Slider,
  los botones de cierre y las opciones de SegmentedControl amplían su zona de pulsación sin cambiar el dibujo.
  No llegan a 40 px los controles secundarios densos: días de `Calendar` en contenedores estrechos, cierre de
  pestaña de `TabStrip`, quitar `Chip`, estrellas de `Rating` y enlaces en línea.
- Los estilos de `:hover` solo se aplican donde hay hover (`@media (hover: hover)`).
- Gestos: el Carousel se arrastra con inercia y deja pasar el desplazamiento vertical (`touch-action: pan-y`);
  un Toast se descarta deslizándolo; el ContextMenu se abre con pulsación larga; Slider, `SplitPane` y
  `ResizeHandle` se arrastran con el dedo (`touch-action: none`). Igual con React y con `@zuccadev-labs/zuix-zui/dom`.

## Material

| Clase | Uso |
|---|---|
| `z-liquid` | Cristal: paneles, barras, menús, diálogos |
| `z-solid` | Superficie opaca para lectura y edición |
| `z-canvas` | Fondo de aplicación sobre el que flota el cristal |

Con `prefers-reduced-transparency` el cristal pasa a opaco.

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

Arrastre con inercia, bucle infinito, flechas, teclado y anuncios para lectores de pantalla.

## De dónde sale cada cosa

| Fuente | Aporta |
|---|---|
| Radix | Lógica accesible de diálogos, menús, pestañas, controles |
| Design system base (paquete `ui` de un proyecto previo) | Button, Input, DateInput, Card, Avatar, Chip, Rating, Meter, estados |
| zutool | Aspecto liquid glass, menús, paleta de comandos, controles |
| `ui-glass` | Panel, StatTile, DataTable |
| Proyecto previo (landing) | Carousel con efecto lente |

## Reglas de uso

1. No se pasan colores, radios ni sombras por `style` o clases sueltas.
2. Si una variante no existe, se añade al sistema.
3. El cristal no se aplica sobre áreas de lectura o edición de texto.
4. Los componentes de dominio (pagos, reservas, mapas) viven en la aplicación.

## Manifiestos

Cada componente tiene un `*.manifest.json` con props, valores permitidos, tokens que lee, clases y
ejemplos completos. `pnpm manifest` los valida y los reúne en `zui/manifest.json`.

## Verificado y sin verificar

- `pnpm test:browser` (46 casos, binding de React) abre y cierra cada overlay con teclado y puntero,
  recorre menús, paleta de comandos, avisos, pestañas, acordeón, árbol, tabla y formulario, y prueba
  el Carousel en modo `css`, `gl` y movimiento reducido, en las dos marcas y los dos temas.
- Select, Combobox, NativeSelect, Calendar y DatePicker (fecha y rango) tienen casos propios con
  teclado y puntero, en la página y dentro de un `Modal`.
- `pnpm test:html` (97 casos, sin React) hace lo propio con el contrato HTML y `@zuccadev-labs/zuix-zui/dom`.
- Las dos suites pasan en Chrome, Firefox y WebKit: `BROWSER=chromium|firefox|webkit|all`, o
  `pnpm test:browser:all` y `pnpm test:html:all`.
- `pnpm test:pack:next` instala los paquetes empaquetados en una aplicación Next.js 16 (App Router) y
  comprueba el marcado de servidor con iconos, la hidratación sin avisos y la interacción en Chrome.
- axe-core revisa cada pantalla en tema claro y oscuro; fallan las violaciones graves y críticas.
- `prefers-reduced-motion` se prueba en los tres motores; `prefers-reduced-transparency`, en Chrome y
  Firefox.
- El modo `gl` del Carousel se probó con WebGL por software, no con una GPU física.
- Táctil emulado en las dos suites (teléfono a 390 px): gestos reales en Chrome; toques reales y arrastres
  sintéticos en Firefox y WebKit.
- `pnpm test:blur` mide por píxeles que Firefox con ventana pinta el desenfoque del cristal (pasa sobre Xvfb).
  El Firefox sin interfaz y sus capturas no lo muestran.
- Sin verificar: Safari real, táctil en un dispositivo real y lectores de pantalla. Detalle en
  [`../investigations/07-estado-de-construccion.md`](../investigations/07-estado-de-construccion.md).
