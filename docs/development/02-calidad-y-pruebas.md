# Calidad y pruebas

Qué comprueba cada comando, qué cubre cada suite y cuándo se ejecuta. La regla general: lo que una máquina
puede comprobar, lo comprueba en cada cambio y hace fallar la verificación.

## Mapa de comandos

| Comando | Qué comprueba |
|---|---|
| `pnpm check` | Tokens y contraste, iconos, auditoría de estilo, manifiestos, exportaciones, contrato HTML, cobertura de la documentación, bundles de navegador, matriz de compatibilidad, `llms.txt` y tipos |
| `pnpm lint` | Biome con errores y avisos bloqueantes, y la regla de `"use client"` |
| `pnpm format:check` | Formato de TypeScript, CSS y JSON |
| `pnpm test:unit` | Lógica pura, con umbral de cobertura |
| `pnpm --filter @zuccadev-labs/zuix-zudocs build` | El sitio compila; enlaces, anclas e imágenes resuelven |
| `pnpm test:site` | El sitio compilado, página a página |
| `pnpm test:html` | El contrato HTML y el modo sin framework, en navegador |
| `pnpm test:browser` | El binding de React sobre `examples/app`, en navegador. Con `REACT=18`, la misma aplicación con React 18 (`examples/react18`) |
| `pnpm audit:visual` | Medidas en navegador: márgenes, fuentes, escala, radios, alturas, alineación, foco, objetivo táctil y axe |
| `pnpm build` | El `dist/` de publicación |
| `pnpm test:pack` | Los cinco tarballs, consumidos fuera del workspace |
| `pnpm verify` | Todo lo anterior, en orden, en Chromium |

`pnpm verify` es la puerta antes de una versión. La integración continua ejecuta lo mismo y añade Firefox,
WebKit, Node 22 y 24 y el consumidor Next.js ([CI](./03-ci-y-cadena-de-suministro.md)).

## Lint y formato: Biome

`pnpm lint` ejecuta `biome lint --error-on-warnings` y después `tools/use-client.mjs`. La configuración está
en `biome.json`.

| Decisión | Detalle |
|---|---|
| Base | Reglas recomendadas, dominio `react` (hooks), grupo de accesibilidad, y linters de CSS y JSON |
| Añadidas como error | Importaciones y variables sin usar, dependencias de hooks, hooks solo en el nivel superior, `any` explícito, `import type` y `export type`, protocolo `node:`, y `console` salvo `warn` y `error` |
| Importaciones vetadas | Las bibliotecas de UI que la suite sustituyó por primitivas propias: reintroducirlas es un error de lint |
| Informativas | Aserción no nula, `!important` y especificidad descendente: se ven, no bloquean. La auditoría de estilo exige justificar cada `!important` |
| Desactivada | `useSemanticElements`: pide `<hr>` para un `role="separator"` interactivo, que es justo el patrón de un divisor redimensionable |
| Excepciones por carpeta | `console` permitido en `tools/`, `tests/` y scripts; las reglas de hooks no se aplican al código sin React (`dom/`, el motor WebGL), donde `gl.useProgram` no es un hook |
| Formato | 2 espacios, 140 columnas, comillas dobles, punto y coma, comas finales, LF. Un commit que solo cambia formato se anota en `.git-blame-ignore-revs` con el SHA que tiene en `main`, después de fusionarlo, para que `git blame` lo salte |
| Fuera de Biome | Markdown (realinea las tablas) y todo lo generado |

Elegí Biome y no ESLint por una razón práctica: el proyecto usa TypeScript 7 y `typescript-eslint` no lo
admite todavía ([versiones que admite](https://typescript-eslint.io/users/dependency-versions/)). Biome no
depende del compilador de TypeScript, lint y formato son una sola herramienta y una pasada completa tarda
menos de un segundo. El razonamiento entero, y lo que descarté, está en
[Lint, pruebas y por qué no Barrits](../investigations/11-lint-pruebas-y-barrits.md).

### La regla de `"use client"`

Ningún linter la trae, así que es un script: `tools/use-client.mjs` recorre `zui/src`, `zout/src` y
`zicon/src` (sin `dom/`, `icons/` ni `styles/`) y falla si un módulo usa hooks de React, hooks propios,
`createContext` o un manejador de eventos escrito en el propio módulo y no empieza por `"use client";`.
Reenviar una prop (`onClick={onClick}`) no cuenta. Sin la directiva, un Server Component que importe ese
módulo falla al compilar en Next.js; con la directiva de más, un componente de solo marcado deja de poder
renderizarse en el servidor.

### Auditoría de estilo

`pnpm style-audit` (`tools/audit.mjs`) cuenta por archivo y exige cero en cada columna:

| Columna | Qué cuenta |
|---|---|
| `color` | Colores literales: `#hex` y funciones de color |
| `prim` | Uso directo de primitivos de marca (`--zp-*`) |
| `token` | `var(--z-*)` que no existe en los tokens ni se declara en lo auditado |
| `emoji` | Emojis usados como iconos |
| `inline` | `style={{…}}` con propiedades de apariencia |
| `named` | Colores con nombre (`red`, `white`) |
| `important` | `!important` sin un comentario que lo justifique |
| `zindex` | `z-index` con un número literal en lugar de un token de capa |
| `px` | Un radio, un tamaño de fuente o un espacio en píxeles donde hay un token |

`--strict` añade una columna informativa con el resto de longitudes en píxeles. El comando acepta rutas:
sirve para auditar una aplicación que consume la suite.

### Exportaciones

`pnpm barrels` (`tools/check-barrels.mjs`) comprueba que todo componente con manifiesto se puede importar
desde la raíz de su paquete: que sale del `index.ts` de su carpeta y, de ahí, del de `src/`. Sin esa
comprobación un componente nuevo, con su manifiesto y su hoja de estilos, podría publicarse sin que nadie
pudiera importarlo, y el compilador no lo notaría: un archivo que nadie importa no es un error de tipos. La
dirección contraria, un componente exportado sin manifiesto, la comprueba `pnpm manifest`.

### Cobertura de la documentación

`pnpm docs:coverage` (`tools/docs-coverage.mjs`) contrasta el proyecto con lo que cuenta la documentación vigente
(los README, los `AGENTS.md` y `docs/` salvo las investigaciones) y falla con el primer hueco. La escribí después de
encontrar, al publicar la 0.4.0, la portada de usuarios describiendo todavía la 0.3.0 y más de la mitad de las funciones
sin framework sin nombrar en ninguna guía.

| Comprueba | Dónde |
|---|---|
| Cada componente de zui y cada pieza de zout aparece en la guía de su paquete | `docs/users/03-zui.md`, `04-zout.md` |
| Cada entrada de `exports` de los cinco paquetes está documentada | Documentación de usuario o README del paquete |
| Cada familia `/dom/<nombre>` tiene su fila, y cada función que exporta está en «Todas las funciones» bajo esa entrada (y ninguna de más) | `docs/users/06-frameworks.md` |
| Las funciones de la raíz de zui y zout, de `zout/dom` y de `zicon` están nombradas | La guía de su paquete |
| Cada miembro propio de `<Nombre>Props` está en las props de su manifiesto, del que salen las páginas del catálogo | `*.manifest.json` |
| Los recuentos de componentes, grupos, layouts, iconos y categorías, y la tabla de `behavior` | Documentación vigente |
| La lista de grupos de `zui/AGENTS.md`, la versión que dice describir la portada de usuarios y cada comando de `package.json` | — |
| Los enlaces relativos y los de `blob/main/…` de los README, `AGENTS.md` y `CHANGELOG.md` | Los de `docs/` los comprueba el build de zudocs |

Una línea que compara versiones («pasa de 144 a 224», `0.3.0`) habla del pasado y no cuenta como recuento.
`node tools/docs-coverage.mjs --report` lista además, sin fallar, lo que solo nombran el `CHANGELOG.md` o las
investigaciones, las herramientas de `tools/` y los archivos de prueba que ninguna guía cita.

## Pruebas unitarias

`pnpm test:unit` usa el runner nativo de Node (`node:test`) con `tsx` para importar el TypeScript y el TSX
reales, y `happy-dom` donde hace falta un documento. No hay framework de pruebas que mantener. Los archivos
son `tests/unit/*.test.mjs` y `*.test.ts`.

No necesita ningún paso previo: `tokens/dist/` no se versiona y varias pruebas lo leen, así que la suite lo
genera antes de empezar. Pasa en un checkout recién clonado, con solo `pnpm install`.

| Qué | Cómo |
|---|---|
| Cobertura | La de V8, medida sobre una lista explícita de módulos de lógica (`COVERED` en `tests/unit/run.mjs`) |
| Umbral | 80 % de líneas, 70 % de ramas y 75 % de funciones sobre esa lista. Por debajo, el comando falla |
| Qué cubre | `zui/src/core/`, el motor y la lente del Carousel, paginación y orden de tabla, la lógica de `zout`, el registro y el SVG de `zicon`, el color y los pares de `tokens`, las herramientas (`version`, `build`, `audit`, `use-client`) y la configuración de zudocs |
| Un módulo nuevo de lógica | Lleva su prueba y su línea en `COVERED` |

```
pnpm test:unit                  # todas, con cobertura y umbral
pnpm test:unit calendar         # solo los archivos cuyo nombre contiene "calendar", sin umbral
pnpm test:unit --no-coverage
```

### Pruebas basadas en propiedades

`tests/unit/properties.test.ts` usa [fast-check](https://fast-check.dev/): en vez de casos elegidos a mano,
genera las entradas y cada prueba afirma algo que debe cumplirse para todas. Corre dentro de `pnpm test:unit`,
con el mismo runner.

| Módulo | Qué se afirma |
|---|---|
| `iconSvg` | Cualquier nombre, tamaño, etiqueta, clase o trazado da un único `<svg>` bien formado, sin elementos ni atributos de más |
| `computePlace` | La capa que cabe queda dentro de la ventana; solo voltea al lado opuesto y solo si no cabía |
| Fechas | Formato y lectura son inversos; sumar y restar días o meses no produce fechas inexistentes |
| Paginación | La página es siempre una que existe; el rango contiene la actual y sus vecinas |
| Búsqueda | `fold` es idempotente; prefijo, fragmento y subsecuencia puntúan lo que deben |
| `snap` del Slider | El valor queda en el recorrido, sobre un paso, y volver a ajustarlo no lo mueve |
| Color | `parseColor` devuelve `null` o cuatro números finitos; el contraste es simétrico y va de 1 a 21 |
| Versiones | `compareVersions` es un orden total; `nextVersion` da siempre una versión posterior |
| `stripTags` | No queda ninguna etiqueta y solo se quita texto |

La semilla es fija (300 ejecuciones por propiedad, unos dos segundos en total): un fallo se reproduce igual
en cualquier máquina. Para buscar más lejos:

```
ZUIX_FC_RUNS=20000 pnpm test:unit properties
ZUIX_FC_SEED=7 pnpm test:unit properties
```

Al escribirlas, el 2026-11-18, encontraron cuatro defectos que los casos a mano no cubrían, todos corregidos:
`snap` devolvía un `max` que no era un paso y lo cambiaba al volver a ajustar; `score` no encontraba una
subsecuencia con caracteres de fuera del plano básico; `parseColor` daba canales `NaN` o infinitos y lanzaba
con `__proto__`; `iconSvg` lanzaba con un objeto que no se puede convertir a texto.

Las ramas que solo existen en un navegador real (WebGL, captura de puntero, capa superior) no cuentan para
el umbral: las cubren las suites de navegador.

## Pruebas de navegador

Las tres suites usan un runner propio sobre `playwright-core`, sin `@playwright/test`. Chromium es el Chrome
instalado en el sistema; Firefox y WebKit son los de Playwright (`pnpm exec playwright-core install firefox
webkit`). `BROWSER=chromium|firefox|webkit|all` elige el motor; los scripts `:all` usan los tres.

Un caso falla si lanza o si la página registra errores de consola, excepciones o peticiones fallidas.

| Suite | Sobre qué | Qué ejercita |
|---|---|---|
| `test:html` | `examples/html/index.html` y `shell.html`: el contrato sin React | Capas, formularios, colecciones, layouts, submenús, táctil, Carousel en WebGL, RTL, colores forzados, inyección de marcado, CSP estricta y Trusted Types |
| `test:browser` | `examples/app`: el binding de React | Lo mismo desde React, las combinaciones de marca y tema, `Shell` en tres anchos, móvil a 390 px, formularios dentro de un `Modal`, y las capas apiladas: cierre en orden con cuatro niveles, 200 aperturas seguidas sin fugas, y desmontaje con la capa abierta |
| `test:site` | El sitio de documentación compilado, servido bajo su `baseUrl` | Todas las páginas del sitemap en dos temas y tres anchos: hidratación, consola, red, desbordamiento, enlaces y anclas; teclado; impresión; `sitemap.xml`, `robots.txt` y `llms.txt` |

Los casos van por áreas. `tests/html/cases/NN-<área>.mjs` sigue el orden de `examples/html` (núcleo, formularios,
colecciones, layouts, agenda, gráficos, chat e IA, nodos, compat…); `tests/browser/cases-<área>.mjs` agrupa los de una
pantalla de `examples/app` (`?screen=chat`, `?screen=flows`…) y `cases.mjs`, los generales. Las dos suites comparten
los ayudantes de `tests/`: `touch.mjs` (gestos), `webgl.mjs` (detección de WebGL y `NO_WEBGL`), `rest.mjs` (reposo
real de un Carousel) y `popover-api.mjs` (navegador sin Popover API, simulado).

En las tres:

- **axe-core** revisa cada pantalla en claro y oscuro, también con menús, diálogos y selectores abiertos. Las
  violaciones graves y críticas hacen fallar. En el sitio, con las reglas de WCAG 2.2 A y AA.
- **Preferencias del sistema** emuladas: `prefers-reduced-motion`, `forced-colors`,
  `prefers-reduced-transparency` (en Chrome y Firefox; WebKit no permite emularla).
- **Táctil emulado**: un contexto de teléfono (390 × 844, puntero grueso, sin hover) y otro de tableta. En
  Chrome los gestos son reales, por el protocolo de depuración, y el navegador aplica `touch-action` y el
  desplazamiento nativo. En Firefox y WebKit, Playwright solo ofrece el toque; los arrastres son eventos de
  puntero sintéticos, que ejercitan los manejadores pero no la decisión del navegador.
- **Sin WebGL**: `NO_WEBGL=1` lanza los motores sin WebGL, como el Firefox sin interfaz de los runners de CI.
  Los casos del modo `gl` del Carousel quedan entonces como no verificables, no como fallos.

`pnpm test:blur` es una prueba aparte: mide por píxeles que Firefox con ventana pinta el desenfoque del
cristal. Necesita una pantalla X (`xvfb-run -a pnpm test:blur`). Existe porque el Firefox sin interfaz, y sus
capturas, no dibujan `backdrop-filter`, y quería saber si era el navegador o la captura: es la captura.

Con la máquina muy cargada un caso puede fallar por tiempos; repetirlo lo confirma o lo descarta. Los tres
runners admiten `--repeat=N`:

```
node tests/browser/run.mjs "menú" --repeat=25     # N veces cada caso elegido
node tests/html/run.mjs --repeat=5                # N pasadas completas, con una página nueva cada vez
node tests/site/run.mjs teclado --repeat=25
```

El objetivo es N de N. Un caso que falla una de cada veinticinco bloquea igual una publicación.

`tests/browser/run.mjs` arranca el servidor de Vite de `examples/app` con `ZUIX_TEST_SERVER=1`: sin
vigilancia de archivos ni HMR. Sin eso, un archivo que cambia a mitad de una ejecución (un editor, `pnpm
check` regenerando fuentes) recarga la página que se está probando y el caso falla sin que haya ningún
defecto.

## Auditoría visual

`pnpm audit:visual` (`tools/visual-audit.mjs`) mide en Chrome lo que la auditoría de estilo no puede ver en el
código: el valor que de verdad calcula el navegador. Recorre el sitio compilado (todas las páginas del sitemap,
la búsqueda y la 404), cada pantalla de `examples/app` (`?screen=`) y `examples/html`, en las marcas, temas y
anchos que se le pidan (por defecto dazlabs, zutool y zenith; claro y oscuro; 1440, 768 y 390 px). El sitio se
compila con una marca: las otras se inyectan con su hoja de `tokens/dist/brands/` para medir color y contraste.

| Comprobación | Qué es un defecto |
|---|---|
| Desbordamiento | El documento se desplaza en horizontal, o un elemento se sale del viewport sin contenedor que desplace |
| Recorte | Texto con `scrollWidth > clientWidth` sin elipsis ni `line-clamp` |
| Tapado | Otra capa pinta encima de una parte de un texto, dentro de lo que sus contenedores dejan ver en los dos ejes |
| Cortes | Una tira o una tabla que desplaza corta un texto en seco, sin fundido ni barra; una fila flex pasa de su borde; un botón o una barra con fondo sale de la caja de su padre; una fila de controles parte línea en cada pieza; una fecha o un código parte en dos líneas; un nombre corto (hasta tres palabras) se corta con elipsis |
| Trazos | Las letras (con una holgura de 0,12 em) pisan el trazo fijo de un SVG de su componente: las cifras de una esfera, el valor de un indicador sobre su arco |
| Carrusel | La lente corta los vecinos en seco o reserva un sangrado que nada ocupa; el slide activo no es el del centro; la tarjeta de arriba de un mazo no se distingue de las de debajo |
| Teléfono | A 480 px o menos, una navegación lateral acoplada se come el ancho del contenido |
| Solape | Dos elementos interactivos que se pisan donde se ven |
| Fuente | La familia computada no es la de la marca, la fuente no cargó (`document.fonts`) o el sistema pinta otra (`CSS.getPlatformFontsForNode`) |
| Escala | Tamaño, interlineado o peso fuera de los tokens; relleno, margen o hueco fuera de `--z-space-*` (±0,5 px); radio fuera de la familia; altura de control fuera de `--z-control-height-*` |
| Píldora | Un radio mayor que el de la familia en algo que no es circular |
| Alineación | Controles de una fila con alturas distintas, icono descentrado en su botón, huecos desiguales entre hermanos |
| Icono desalineado | Un icono que comparte línea con un texto tiene su centro vertical a más de 1 px del de esa línea (1,5 px si mide más de 20) |
| Foco | Una parada de Tab sin contorno, o con contraste menor que 3:1 contra lo que tiene detrás |
| Objetivo | Menor de 24 × 24 (40 con puntero grueso) sin la excepción de espaciado de WCAG 2.5.8 |
| axe, consola y red | WCAG 2.2 A y AA con contraste; errores de página, de consola y peticiones fallidas |

Lo que una regla acepta (elipsis intencionada, relleno que compensa el borde, radio concéntrico, muestra de
tallas distintas, objetivo pequeño con espacio alrededor…) queda contado como aceptado y con el motivo en el
informe; no se descarta nada en bloque. La medida en bruto se guarda, así que `--report` reclasifica sin abrir
el navegador.

El icono desalineado se mide contra la caja de la línea del texto de al lado (un `Range` sobre el nodo de texto,
que da una caja por línea), no contra la caja del elemento: un nombre que parte en dos líneas cuenta con la línea
que el icono cruza, y el icono de una alerta con título, con la primera. Si el icono va en un recuadro propio (fondo
o borde), se mide el recuadro. No cuentan el icono que va solo (un botón de solo icono lo mide «icono descentrado»),
el que está posicionado encima de otra cosa, el que gira ni el texto oculto para lectores de pantalla. Se aceptan con
su motivo el recuadro junto a un bloque de varias líneas, el icono centrado en una pila de título y subtítulo y la
marca circular del tamaño de un avatar.

El arreglo de fondo está en `native.css`: un `svg.z-icon` en línea con el texto lleva el centro a media altura de las
mayúsculas (`vertical-align: calc(0.5cap - <medio icono>)`), que es el centro de la caja de la letra, en lugar de
apoyarse en la línea base con el hueco del descendente debajo. En un contenedor flex o grid no tiene efecto. Un
icono que acompaña a la primera línea de un texto que puede partir va en una caja de una línea de alto
(`block-size: 1lh`) con el icono centrado, o en una fila alineada por la primera línea base, no con un margen fijo
de 2 px que solo vale para una letra y un tamaño de icono.

El margen lateral de `Container` con `gutter="fluid"` sale del token `container-gutter`, un `clamp()` entre 16 y
40 px que sigue al ancho del contenedor: casi nunca cae en un paso de `--z-space-*`. La auditoría lo acepta solo en
`padding-left` y `padding-right`, cuando el `--z-container-pad` del elemento es ese token y el valor queda entre sus
dos límites. Un relleno fluido que no salga del token sigue contando como defecto.

En la excepción de espaciado de un objetivo pequeño, el vecino cuenta por la parte que se ve: un chip desplazado
fuera de su fila (overflow) no está junto al objetivo aunque su caja caiga encima.

Dentro de un lienzo de nodos (`.z-node-canvas`) el solape entre su contenido y su cromo es parte del diseño: los
nodos pasan bajo el minimapa y los controles flotantes, y con poco zoom se acercan entre sí. Los controles del cuerpo
de un nodo miden en pantalla lo que dicta el zoom. Los dos casos se cuentan como aceptados con su motivo; los
puertos mantienen el objetivo de 24 px a cualquier zoom.

```
pnpm audit:visual --target site --brands dazlabs --widths 1440 --themes dark   # una pasada rápida
pnpm audit:visual --target app --filter chat,inputs --dir rtl                     # de derecha a izquierda
pnpm audit:visual --target app --filter forms --shots                          # una pantalla, con capturas
AUDIT_OUT=/ruta/salida pnpm audit:visual                                       # todo, en otra carpeta
```

Salida en `.tmp/visual-audit/` (fuera del control de versiones): `raw.json`, `report.json`, `report.md` y, con
`--shots`, las capturas. Sale con código 1 si queda algún defecto.

## Prueba de empaquetado

`pnpm test:pack` (`tools/pack-test.mjs`) no publica nada. Empaqueta los cinco paquetes con `pnpm pack` y los usa como lo haría una
aplicación, en proyectos fuera del workspace:

| Paso | Qué comprueba |
|---|---|
| Tarballs | Sin `src/`, sin `workspace:`, sin archivos internos; con `README.md`, `LICENSE`, `CHANGELOG.md` y metadatos de npm; cada destino de `exports` existe; rango `^` entre paquetes y `zicon` como peer |
| Paraguas | Cada subruta es el mismo módulo que la del paquete suelto |
| Proyecto con React | Render en servidor, resolución de todas las entradas, `tsc --noEmit` con `skipLibCheck: false` en TypeScript 5.9, 6 y 7 y con `Bundler` y `NodeNext`, y build con Vite, suelto y por el paraguas. Falla si el set completo de iconos entra en el bundle |
| Proyecto sin React | Importa los módulos `dom` en Node sin que React esté instalado |
| `--next` | Next.js, última estable, App Router: `next build`, `next start` y una pasada en Chrome con marcado de servidor, hidratación sin avisos e interacción. Una ruta lo importa todo por el paraguas |
| `publint` y `attw` | Metadatos del paquete y resolución de tipos. Sin red se avisa y no cuenta como fallo |

La CI lo ejecuta siempre con `--next`: prefiero ver un fallo de Next.js en el pull request que al publicar.

## Lo que ninguna prueba cubre

- Safari real, dispositivos táctiles reales y lectores de pantalla.
- Regresión visual: no hay comparación de capturas. `pnpm audit:visual` mide la escala, no la compara con
  una versión anterior: un cambio de valor en un token que siga dentro de la escala no lo detecta.
- Rendimiento del desenfoque y de la hidratación en hardware real.
- Las versiones mínimas de los navegadores admitidos ([Compatibilidad](../users/10-compatibilidad.md)).
