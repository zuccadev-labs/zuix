# Construcción de la 0.1.0

El registro de lo que construí a partir del [plan](./06-arquitectura-y-decisiones.md), de cómo lo verifiqué y
de los fallos que encontré. Lo escribí entre el 2026-11-13 y el 2026-11-14, el día que publiqué la `0.1.0`.
Las cifras son de esa fecha; lo que cambió después está en los documentos 08 a 12.

## Qué existía al publicar

| Paquete | Contenido | Verificación que pasaba |
|---|---|---|
| `@zuccadev-labs/zuix-tokens` | Contrato base, 3 marcas (`dazlabs`, `zutool`, `zenith`), 2 temas, 5 salidas generadas y 2 capas de compatibilidad (`zutool`, `ui-glass`) | Tokens obligatorios y ocho pares de contraste en las 6 combinaciones |
| `@zuccadev-labs/zuix-zicon` | 346 iconos × 2 variantes; componente de React, elemento `<z-icon>`, `iconSvg()` y sprite; manifiesto, 152 emojis mapeados | Emparejado outline y solid, alias, tipos |
| `@zuccadev-labs/zuix-zui` | 64 componentes en 8 grupos, material liquid glass, contrato HTML y comportamiento sin framework | Auditoría en 0, 64 manifiestos, tipos, pruebas con y sin React en tres motores |
| `@zuccadev-labs/zuix-zout` | 10 layouts | Auditoría en 0, 10 manifiestos, tipos |
| `@zuccadev-labs/zuix` | Paraguas: depende de los cuatro anteriores y los reexporta bajo subrutas | Mismo módulo que el paquete suelto, render, tipos y Vite |
| `@zuccadev-labs/zuix-zudocs` | Sitio Docusaurus con tema liquid glass, catálogo, buscador de iconos y tokens en vivo | Build sin enlaces rotos |
| Kit de agente | `tools/audit.mjs`, `tools/manifest.mjs`, `AGENTS.md` por paquete, `docs/agents/`, `llms.txt` | — |

## Qué saqué de cada fuente

| Fuente | Destino |
|---|---|
| El design system del proyecto de origen | Componentes genéricos de `zui`, cabeceras de página de `zout`, el modelo de guía y de auditoría |
| El carousel con efecto lente | `zui/src/components/carousel/`, sin su biblioteca de animación ni su dominio |
| zutool (`apps/desktop/src`) | Tokens, material `.z-liquid`, menús, paleta de comandos, layouts de `zout` |
| `ui-glass` (`packages/ui-glass` en analizador-trafico) | Panel, StatTile, DataTable, rejillas |
| `Dazicon.fig` | `zicon` |

## Cómo lo verifiqué

- **Automático.** `pnpm check` (tokens, iconos, auditoría, manifiestos, contrato HTML, empaquetado, tipos) y
  el build de zudocs, que antes ejecuta `verify`.
- **Navegador, React.** `pnpm test:browser` sobre `examples/app`, 46 casos por navegador: capas, navegación,
  Carousel (`css`, `gl`, movimiento reducido), `Shell` en tres anchos, móvil a 390 px, las combinaciones de
  marca y tema, y Select, Combobox, NativeSelect, Calendar y DatePicker con teclado y puntero, en la página y
  dentro de un `Modal`.
- **Navegador, sin React.** `pnpm test:html` sobre `examples/html/index.html`, 97 casos por navegador.
- **Tres motores.** Chromium es el Chrome del sistema; Firefox y WebKit, los de Playwright.
- **Accesibilidad automática.** axe-core en cada pantalla, también con menú, modal, paleta, Select y
  DatePicker abiertos, en claro y oscuro. Fallan las violaciones graves y críticas.
- **Preferencias del sistema.** `prefers-reduced-motion` emulado en los tres motores y
  `prefers-reduced-transparency` en Chrome y Firefox.
- **Táctil emulado.** Un contexto de teléfono (390 × 844, puntero grueso, sin hover) y otro de tableta:
  Carousel, Toast deslizado, ContextMenu con pulsación larga, Slider, `SplitPane`, `ResizeHandle`, cajones del
  `Shell`, objetivos de 40 px y ausencia de hover pegajoso. En Chrome los gestos son reales; en Firefox y
  WebKit, Playwright solo ofrece el toque y los arrastres son eventos de puntero sintéticos.
- **Next.js con los paquetes empaquetados.** Next 16 (App Router, Turbopack), fuera del workspace:
  `next build` sin avisos, HTML de servidor con todos los iconos dibujados, hidratación sin avisos e
  interacción. Ahí aprendí que los iconos exigen importar `zicon/all` en el layout y en un módulo
  `"use client"`: hay un registro por grafo.
- **Desenfoque en Firefox.** El Firefox sin interfaz y sus capturas no dibujan `backdrop-filter`, y quería
  saber si el cristal se veía de verdad. `pnpm test:blur` lanza Firefox con ventana en un servidor X virtual,
  dibuja un rayado de 2 px detrás de un menú, un modal, un aviso y el velo, y mide en una captura de la
  pantalla cuánto rayado sobrevive. Con ventana se funde por completo (energía de borde de 0,0 a 1,0, cuando
  la del rayado desnudo es 111,7); sin interfaz se sigue viendo (de 3,5 a 55,8). Era la captura, no el navegador.
- **Iconos.** Hojas de contacto de los 692 dibujos, revisadas a ojo.

Resultado del 2026-11-14 (correctos / fallidos / no verificables):

| Suite | Chrome 157 | Firefox 159 | WebKit 27.2 |
|---|---|---|---|
| React (`tests/browser`) | 46 / 0 / 0 | 46 / 0 / 0 | 45 / 0 / 1 |
| HTML sin React (`tests/html`) | 97 / 0 / 0 | 97 / 0 / 0 | 97 / 0 / 0 |
| Next.js empaquetado | pasa | no se ejecuta | no se ejecuta |
| Desenfoque con ventana | no aplica | pasa (Xvfb) | no se ejecuta |

El caso no verificable de WebKit es `prefers-reduced-transparency`: el WebKit de Playwright no permite
emularla.

## Los fallos que encontré

La primera pasada en Chrome encontró 16 fallos reales en `zui` y `zout`: foco al cerrar diálogos, avisos que
no se cerraban, cajones del `Shell`, desbordamientos. La pasada en tres motores, los casos de formulario y
axe encontraron estos otros:

| Fallo | Dónde se veía | Corrección |
|---|---|---|
| El menú contextual sin React se cerraba al soltar el botón | Firefox y WebKit (`contextmenu` llega al pulsar) | `zui/src/dom/index.ts`: abre al soltar |
| Tras redimensionar, el siguiente arrastre de `ResizeHandle` o `SplitPane` no hacía nada | WebKit (selección de texto y arrastre nativo) | `user-select: none` y `onDragStart` cancelado |
| El calendario de `DatePicker` no recibía el foco dentro de un `Modal` | Todos | El foco se mueve al abrir, con la trampa del diálogo ya en pausa |
| `DatePicker` vacío enfocaba el día 1 en vez de hoy | Todos | `Calendar` y `DatePicker` buscan hoy por fecha |
| `Calendar` desbordaba contenedores de menos de 252 px | Móvil a 390 px | Rejilla fluida: las celdas encogen |
| Botones, campos y conmutadores dentro de capas conservaban transiciones con movimiento reducido | Todos (el portal queda fuera de `.z-root`) | `overlay.css`: la regla cubre cada capa y su contenido |
| Con transparencia reducida el cristal quedaba al 94-96 % y los velos seguían desenfocando | Todos | `material.css`: fondo `surface-solid` y velos sin desenfoque |
| `tablist` de `TabStrip` con botones de cierre dentro | axe (crítica) | Cierre con Supr; el botón queda como ayuda de puntero |
| Contador de `RailItem` fuera del nombre accesible | axe (grave) | El nombre incluye el contador |
| `Badge` informativo suave a 4.46:1 en tema oscuro | axe (grave) | Primitivo `sky-500` más claro en las dos marcas |
| `DatePicker` con `aria-label` no anunciaba la fecha elegida | axe (grave, contrato HTML) | La fecha forma parte del nombre o de la descripción |
| Interruptor del contrato HTML sin `aria-checked` hasta el primer clic | axe (crítica) | `hydrate()` lo deriva de `data-state` |

La pasada táctil encontró estos:

| Fallo | Dónde se veía | Corrección |
|---|---|---|
| Controles de 30 y 36 px (botones, campos, pestañas, filas de menú) y zonas de agarre de 8 a 18 px (divisores, Slider, cierres) | Puntero grueso | Token `--z-touch-target` (40 px con `pointer: coarse`); zonas de pulsación ampliadas en `zui` y `zout` |
| El estilo de `:hover` se quedaba en el último control tocado | Pantallas táctiles | Las reglas `:hover` de `zui` y `zout` (49) pasan a `@media (hover: hover)` |
| Un aviso de `toast()` no se podía descartar deslizando (el de React sí) | Sin React | `swipeToDismiss` en `zui/src/dom/index.ts`; `.z-toast` declara `touch-action` |
| La pulsación larga no abría el menú contextual sin React | Chromium con pantalla táctil; iOS no emite `contextmenu` | Temporizador de 600 ms para dedo y lápiz en `zui/src/dom/index.ts` |
| El ContextMenu de React se salía 2 px de una ventana de 390 px | Todos | El menú se estrecha hasta el hueco disponible (`overlay.css`) |
| Al descartar un Toast deslizando volvía de golpe a su sitio antes de desvanecerse | Todos | `overlay.css`: conserva el desplazamiento final |

Y la primera ejecución de la CI en GitHub falló en dos puntos que en local no se veían: el Firefox sin
interfaz de los runners no ofrece WebGL y avisaba en la consola cada vez que el Carousel pedía un contexto, y
un caso táctil medía un cajón del `Shell` tras una espera fija, antes de que WebKit hubiera avanzado la
animación. Corregí los dos; desde entonces `NO_WEBGL=1` reproduce en local un motor sin WebGL.

## Lo que esa verificación no vio

Todo lo anterior pasaba, y aun así la `0.1.0` salió con problemas que ninguna de esas pruebas buscaba:

| Qué no medía | Dónde lo cuento |
|---|---|
| El contraste de los pares de color que las hojas usan de verdad; solo medía ocho pares | [Accesibilidad medida](./09-accesibilidad-medida.md) |
| Escritura de derecha a izquierda y colores forzados | [Accesibilidad medida](./09-accesibilidad-medida.md) |
| La seguridad del modo sin framework ante datos hostiles, y Trusted Types | [Primitivas propias](./08-primitivas-propias.md) |
| El peso real de lo que instalaba una aplicación | [Primitivas propias](./08-primitivas-propias.md) |
| El sitio de documentación como producto: fuentes de terceros, contenido no confiable, rendimiento | [El sitio, medido](./12-el-sitio-medido.md) |
| Lógica pura sin pruebas unitarias, y ningún linter | [Lint, pruebas y por qué no Barrits](./11-lint-pruebas-y-barrits.md) |

La lección que saqué es que una suite de pruebas verde solo dice que pasa lo que se me ocurrió comprobar.

## Lo que sigue sin comprobar

- Safari real y dispositivos reales. El WebKit de Playwright en Linux comparte motor con Safari, pero no su
  integración con macOS e iOS (foco de botones al hacer clic, teclado en pantalla, VoiceOver).
- Táctil en un dispositivo real: gestos reales en Firefox y WebKit, el `contextmenu` nativo de Android, el
  zoom con dos dedos y el teclado en pantalla.
- Lectores de pantalla. axe cubre nombres, roles y contraste, no la experiencia hablada.
- Next.js con `next dev`, Pages Router y el runtime Edge.
- WebGL con GPU física: los tres motores lo probaron por software.
- El rendimiento del desenfoque en hardware real.
