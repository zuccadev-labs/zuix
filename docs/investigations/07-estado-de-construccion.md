# 07 · Estado de construcción

Fecha: 2026-11-13; actualizado el 2026-11-14. Qué se construyó a partir del plan del documento 06, cómo se verificó y qué falta.

## Qué existe

| Paquete | Contenido | Verificación que pasa |
|---|---|---|
| `@zuccadev-labs/zuix-tokens` | Contrato base, 3 marcas (`dazlabs`, `zutool`, `zenith`), 2 temas, 5 salidas generadas y 2 capas de compatibilidad (`zutool`, `ui-glass`) | Tokens obligatorios y contraste en las 6 combinaciones; cada variable antigua de los dos proyectos con destino |
| `@zuccadev-labs/zuix-zicon` | 346 iconos × 2 variantes; componente React, elemento `<z-icon>`, `iconSvg()` y sprite; manifiesto, 152 emojis mapeados | Emparejado outline/solid, alias, tipos |
| `@zuccadev-labs/zuix-zui` | 64 componentes en 8 grupos, material liquid glass, contrato HTML (`html.json`) y comportamiento sin framework (`zui/dom`) | Auditoría en 0, 64 manifiestos, tipos, pruebas con y sin React en Chrome, Firefox y WebKit |
| `@zuccadev-labs/zuix-zout` | 10 layouts | Auditoría en 0, 10 manifiestos, tipos |
| `@zuccadev-labs/zuix` | Paquete paraguas (`suite/`): depende de los cuatro anteriores y los reexporta bajo subrutas | Mismo módulo que el paquete suelto, render, tipos y Vite en `pnpm test:pack` |
| `@zuccadev-labs/zuix-zudocs` | Sitio Docusaurus 3.10.2 con tema liquid glass, catálogo, buscador de iconos, tokens en vivo. Sirve a cualquier proyecto con `--config` | Build sin enlaces rotos del sitio de zuix y del piloto Zenith |
| Kit de agente | `tools/audit.mjs`, `tools/manifest.mjs`, `AGENTS.md` por paquete, `docs/agents/`, `llms.txt` | — |

Un solo comando ejecuta todo menos el build del sitio: `pnpm check`.

## Cómo quedaron las decisiones del documento 06

| # | Decisión | Resultado |
|---|---|---|
| 1 | Framework | **Ninguno obligatorio.** El responsable aclaró que la suite no es solo para React. El estándar es HTML + CSS + tokens; `@zuccadev-labs/zuix-zui/dom` da el comportamiento sin framework y React 19 con Radix queda como binding |
| 2 | Distribución | Paquetes de workspace que exportan su código fuente dentro del workspace y `dist/` compilado al empaquetar (`publishConfig`). No se montó un registro copiable |
| 3 | Referencias externas | No se copió código de las bibliotecas de `stack.txt`. Sirvieron de vara de medida |
| 4 | Marca por defecto | Paleta DAZLABS sobre el material de zutool; `zutool` como segunda marca |
| 5 | Taxonomía documental | Nombres en inglés plural (`users`, `agents`, `investigations`). Sin i18n todavía |
| 6 | Repositorio | Workspace de pnpm en zuix. Repositorio git local desde el 2026-11-14; remoto `github.com/zuccadev-labs/zuix`, público, pendiente del primer push |
| 7 | Reutilización del proyecto de origen | Autorizada por el responsable. El código extraído no conserva su nombre ni su dominio |

Las decisiones 1 a 5 se tomaron siguiendo la recomendación del documento 06 para poder avanzar; se
pueden revisar.

## Qué se extrajo de cada fuente

| Fuente | Destino |
|---|---|
| Design system base (paquete de interfaz del proyecto de origen) | Componentes genéricos de `zui`, cabeceras de página de `zout`, modelo de guía y auditoría |
| Carousel con efecto lente (página de presentación del proyecto de origen) | `zui/src/components/carousel/`, sin `animejs` ni dependencias del dominio |
| zutool (`apps/desktop/src`) | Tokens, material `.z-liquid`, menús, paleta de comandos, layouts de `zout` |
| `ui-glass` (`packages/ui-glass` en analizador-trafico) | Panel, StatTile, DataTable, rejillas |
| `Dazicon.fig` | `zicon` |

No se extrajeron los componentes de dominio del design system base (pagos, reservas, clima, visor 3D,
chat de asistente).

## Diferencias respecto al plan

| Plan | Lo que se hizo | Motivo |
|---|---|---|
| Tailwind v4 en el tema de Docusaurus | Sin Tailwind | `zui` es CSS plano sobre tokens. Desaparece el riesgo de convivencia con Infima |
| Style Dictionary para los tokens | Un script propio de Node sin dependencias | El contrato es pequeño y la validación de contraste es propia |
| Usar la red vectorial de Figma para los iconos | Se usó la geometría de relleno | Tiene curvas reales; el facetado visto en la prueba inicial era del renderizador |
| 348 iconos | 346 | Dos dibujos estaban rotos en ambas variantes y se sustituyeron por su versión corregida |
| Token `accent` para botones | Token aparte `accent-solid` | El acento de ambas marcas no da contraste 4.5 con texto blanco en tema oscuro |
| `@zuccadev-labs/zuix-zicon` como única entrada | Además `@zuccadev-labs/zuix-zicon/core` y registro de iconos | El set completo pesa unos 580 kB; las librerías no deben arrastrarlo |

## Cómo se verificó

- **Automático:** `pnpm check` (tokens, iconos, auditoría, manifiestos, contrato HTML, empaquetado, tipos)
  y el build de zudocs, que antes ejecuta `verify` (0 avisos tras renombrar los documentos).
- **Navegador, React:** `pnpm test:browser` sobre `examples/app`, 46 casos por navegador: overlays,
  navegación, Carousel (`css`, `gl`, movimiento reducido), `Shell` en tres anchos, móvil a 390 px, las
  cuatro combinaciones de marca y tema, y Select, Combobox, NativeSelect, Calendar y DatePicker (fecha
  y rango) con teclado y puntero, en la página y dentro de un `Modal`.
- **Navegador, sin React:** `pnpm test:html` sobre `examples/html/index.html`, 97 casos por navegador.
- **Tres motores:** `BROWSER=chromium|firefox|webkit|all` en las dos suites (`pnpm test:browser:all`,
  `pnpm test:html:all`). Chromium es el Chrome del sistema; Firefox y WebKit son los de Playwright
  (`pnpm exec playwright-core install firefox webkit`). Capturas en `tests/*/shots/<navegador>/`.
- **Accesibilidad automática:** axe-core en cada pantalla de `examples/app` (también con menú, modal,
  paleta, Select y DatePicker abiertos) y en `examples/html/index.html`, en tema claro y oscuro. Fallan
  las violaciones `serious` y `critical`; las leves se cuentan.
- **Preferencias del sistema:** `prefers-reduced-motion` emulado en los tres motores y
  `prefers-reduced-transparency` en Chrome (protocolo de depuración) y Firefox (preferencia de perfil).
- **Táctil emulado:** 6 casos en `tests/browser` y 11 en `tests/html/cases/07-touch.mjs`, en un contexto de
  teléfono (`hasTouch`, 390 × 844, `pointer: coarse`, sin hover) y otro de tableta para los divisores.
  Carousel (arrastre, inercia, el botón del slide no se activa al arrastrar, desplazamiento vertical de la
  página), Toast deslizado, ContextMenu con pulsación larga, Slider, `SplitPane`, `ResizeHandle`, cajones del
  `Shell`, objetivos de 40 px y ausencia de hover pegajoso. En Chrome los gestos son reales (protocolo de
  depuración, `Input.dispatchTouchEvent`): el navegador aplica `touch-action` y el desplazamiento nativo. En
  Firefox y WebKit Playwright solo ofrece el toque real; los arrastres son eventos de puntero sintéticos de tipo
  `touch` (`tests/touch.mjs`), que ejercitan los manejadores pero no la decisión del navegador.
- **Next.js con los paquetes empaquetados:** `pnpm test:pack:next` instala Next 16.4.6 (App Router, Turbopack)
  y los tarballs en `.tmp/consumer/next/`: `next build` sin avisos; HTML de servidor de una ruta estática, una
  dinámica y una página de cliente con todos los iconos dibujados; hidratación en Chrome sin avisos ni errores
  de consola; interacción con Modal, Tabs, Accordion, Menu, Select, Switch, Toast, `Shell` y `SplitPane`. Los
  iconos exigen importar `@zuccadev-labs/zuix-zicon/all` en el layout y en un módulo `"use client"` (un registro por grafo).
  No encontró defectos en los paquetes.
- **Desenfoque en Firefox con ventana:** `pnpm test:blur` (`tests/blur-firefox.mjs`) lanza el Firefox de
  Playwright con ventana en un servidor X virtual (Xvfb), dibuja un rayado de 2 px detrás de un menú, un modal,
  un aviso y el velo, y mide en una captura de la pantalla cuánto rayado sobrevive. Con ventana se funde por
  completo (energía de borde 0,0 a 1,0 frente a 111,7 del rayado desnudo); sin interfaz se sigue viendo (3,5 a
  55,8). `page.screenshot()` de Firefox no sirve para esto ni con ventana: vuelve a dibujar la página sin
  `backdrop-filter`; por eso la medida se hace sobre la pantalla (`xwd`).
- **Sitio:** capturas a 390 y 1440 px en claro y oscuro; se arregló el menú móvil. Probado con la
  marca `zutool`.
- **Iconos:** hojas de contacto de los 696 dibujos, revisadas a ojo.

Resultado del 2026-11-14 (correctos / fallidos / no verificables):

| Suite | Chrome 157 | Firefox 159 | WebKit 27.2 |
|---|---|---|---|
| React (`tests/browser`) | 46 / 0 / 0 | 46 / 0 / 0 | 45 / 0 / 1 |
| HTML sin React (`tests/html`) | 97 / 0 / 0 | 97 / 0 / 0 | 97 / 0 / 0 |
| Next.js empaquetado (`test:pack:next`) | pasa | no se ejecuta | no se ejecuta |
| Desenfoque con ventana (`test:blur`) | no aplica | pasa (Xvfb) | no se ejecuta |

El caso no verificable de WebKit es `prefers-reduced-transparency`: el WebKit de Playwright no permite
emularla.

La primera pasada en Chrome encontró 16 fallos reales en `zui` y `zout` (foco al cerrar diálogos,
avisos que no se cerraban, cajones del `Shell`, desbordamientos). La pasada en tres motores, los casos
de formulario y axe encontraron estos otros, ya corregidos:

| Fallo | Dónde se veía | Corrección |
|---|---|---|
| El menú contextual sin React se cerraba al soltar el botón | Firefox y WebKit (`contextmenu` llega al pulsar) | `zui/src/dom/index.ts`: abre al soltar |
| Tras redimensionar, el siguiente arrastre de `ResizeHandle` o `SplitPane` no hacía nada | WebKit (selección de texto y arrastre nativo) | `user-select: none` y `onDragStart` cancelado |
| El calendario de `DatePicker` no recibía el foco dentro de un `Modal` | Todos | El foco se mueve en `onOpenAutoFocus`, con la trampa del diálogo ya en pausa |
| `DatePicker` vacío enfocaba el día 1 en vez de hoy | Todos | `Calendar` y `DatePicker` buscan hoy por fecha |
| `Calendar` desbordaba contenedores de menos de 252 px | Móvil a 390 px | Rejilla fluida: las celdas encogen |
| Botones, campos y conmutadores dentro de capas conservaban transiciones con movimiento reducido | Todos (el portal queda fuera de `.z-root`) | `overlay.css`: la regla cubre cada capa y su contenido |
| Con transparencia reducida el cristal quedaba al 94-96 % y los velos seguían desenfocando | Todos | `material.css`: fondo `surface-solid` y velos sin desenfoque |
| `tablist` de `TabStrip` con botones de cierre dentro | axe (crítica) | Cierre con Supr; el botón queda como ayuda de puntero |
| Contador de `RailItem` fuera del nombre accesible | axe (grave) | El nombre incluye el contador |
| `Badge` informativo suave a 4.46:1 en tema oscuro | axe (grave) | Primitivo `sky-500` más claro en las dos marcas |
| `DatePicker` con `aria-label` no anunciaba la fecha elegida | axe (grave, contrato HTML) | La fecha forma parte del nombre o de la descripción |
| Interruptor del contrato HTML sin `aria-checked` hasta el primer clic | axe (crítica) | `hydrate()` lo deriva de `data-state` |

La pasada táctil encontró estos, ya corregidos:

| Fallo | Dónde se veía | Corrección |
|---|---|---|
| Controles de 30 y 36 px (botones, campos, pestañas, filas de menú) y zonas de agarre de 8 a 18 px (divisores, Slider, cierres) | Puntero grueso | Token `--z-touch-target` (40 px con `pointer: coarse`); zonas de pulsación ampliadas en `zui` y `zout` |
| El estilo de `:hover` se quedaba en el último control tocado | Pantallas táctiles | Las reglas `:hover` de `zui` y `zout` (49) pasan a `@media (hover: hover)` |
| Un aviso de `toast()` no se podía descartar deslizando (el de React sí) | Sin React | `swipeToDismiss` en `zui/src/dom/index.ts`; `.z-toast` declara `touch-action` |
| La pulsación larga no abría el menú contextual sin React | Chromium con pantalla táctil; iOS no emite `contextmenu` | Temporizador de 600 ms para dedo y lápiz en `zui/src/dom/index.ts` |
| El ContextMenu de React se salía 2 px de una ventana de 390 px | Todos | El menú se estrecha hasta el hueco disponible (`overlay.css`) |
| Al descartar un Toast deslizando volvía de golpe a su sitio antes de desvanecerse | Todos | `overlay.css`: conserva el desplazamiento final |

## Sin verificar

- Safari real y dispositivos reales. WebKit de Playwright en Linux comparte motor con Safari, pero no
  su integración con macOS e iOS (foco de botones al hacer clic, teclado en pantalla, VoiceOver).
- Táctil en un dispositivo real. Lo emulado no cubre: gestos reales en Firefox y WebKit (arrastres sintéticos;
  el desplazamiento vertical sobre el Carousel y el arrastre del Slider de React quedan sin comprobar allí), el
  `contextmenu` nativo de Android, la burbuja de iOS, el zoom con dos dedos, el teclado en pantalla y el hover
  que deja un toque (solo se comprobó que ninguna regla `:hover` queda fuera de `@media (hover: hover)`).
  Submenús sin pruebas táctiles. No llegan a 40 px los controles secundarios densos: días de `Calendar` en
  contenedores estrechos (33 px a 390), cierre de pestaña de `TabStrip`, quitar `Chip`, estrellas de `Rating`,
  copiar de `CodeBlock` y enlaces en línea.
- Lectores de pantalla. axe cubre nombres, roles y contraste, no la experiencia hablada.
- Next.js: `next dev`, Pages Router, runtime Edge, versiones anteriores a la 16, y servidor y navegador en
  fechas distintas (`Calendar` y `DatePicker` marcan hoy con `new Date()`). `next build --webpack` compiló en
  una pasada manual; la prueba en navegador solo corre sobre Turbopack y solo en Chrome.
- `prefers-reduced-transparency` en WebKit (no se puede emular).
- El desenfoque en Firefox está medido con ventana sobre Xvfb (render por software), no con GPU física ni en
  Wayland. Las capturas de Firefox de las dos suites siguen mostrando el cristal sin desenfocar: es una
  limitación de la captura, no del navegador.
- WebGL con GPU física (los tres motores lo probaron por software).
- Rendimiento del desenfoque.
- Flechas del teclado en `NativeSelect` cuando el motor abre la lista del sistema: la prueba lo anota y
  comprueba la búsqueda por letra.
- `zout/dom` todavía no sigue el nuevo contrato de `TabStrip` (Supr para cerrar y botón de cierre fuera
  del orden de tabulación); el binding de React y el marcado del contrato sí.
- Con carga alta de la máquina las suites pueden fallar por tiempos; repetirlas lo confirma.
- Autoría de Dazicon: el responsable fijó MIT para el set; no se contrastó con el archivo de origen.

## Qué falta

1. Sin React queda solo el modo WebGL del Carousel. Los submenús de `Menu` y `ContextMenu` ya existen en
   `zui/dom` (`data-z-submenu`).
2. Bindings para otros frameworks, si se quieren componentes y no solo el contrato HTML.
3. Integrar en zutool y `ui-glass` la migración a `@zuccadev-labs/zuix-tokens`. Desde el 2026-11-14 está aplicada en
   una rama `chore/zuix-tokens` de cada proyecto, en carpetas de trabajo aparte, sin integrar
   ([Migración](../users/07-migracion.md#estado-de-la-migración-2026-11-14)).
4. Adoptar zudocs en Zenith. El piloto está hecho dentro de zuix (`examples/zenith-docs/`): 121 documentos
   clasificados en cuatro áreas, `verify` sin errores y build en verde, repetible con `migrate.mjs`
   ([Zudocs](../users/05-zudocs.md#piloto-zenith)). El repositorio de Zenith no se tocó y sigue publicando
   con MkDocs. Falta decidir si la copia migrada sustituye a `docs/` allí, y resolver lo que quedó sin
   convertir: 8 diagramas Mermaid y 23 enlaces que ya estaban rotos en el origen.
5. Identidad visual definitiva de DAZLABS: la paleta y las fuentes salen de un manual incompleto.
6. Control de versiones: repositorio git local creado el 2026-11-14. El remoto `github.com/zuccadev-labs/zuix`
   existe, público y vacío; el primer push sale de un commit raíz limpio
   ([Apertura](../package/04-apertura-del-repositorio.md)). `.github/workflows/ci.yml` no se ha ejecutado nunca.
7. Publicación. A 2026-11-14 los cinco paquetes publicables (`@zuccadev-labs/zuix` y `@zuccadev-labs/zuix-tokens`,
   `-zicon`, `-zui`, `-zout`) están en `0.1.0`, verificados y sin publicar: `pnpm build` genera ESM,
   declaraciones y CSS en `dist/`, `pnpm test:pack` los instala y los usa fuera del workspace, y se
   ensayaron contra un registro local con pnpm, npm, yarn y bun ([Empaquetado](../package/README.md)).
   Licencia MIT, acceso público, scope `@zuccadev-labs` y repositorio decididos. Falta que el responsable
   ejecute la publicación manual con 2FA ([Publicación](../package/02-publicacion.md)).
