# Calidad y pruebas

Qué comprueba cada comando, qué cubre cada suite y cuándo se ejecuta. La regla general: lo que una máquina
puede comprobar, lo comprueba en cada cambio y hace fallar la verificación.

## Mapa de comandos

| Comando | Qué comprueba |
|---|---|
| `pnpm check` | Tokens y contraste, iconos, auditoría de estilo, manifiestos, exportaciones, contrato HTML, bundles de navegador, `llms.txt` y tipos |
| `pnpm lint` | Biome con errores y avisos bloqueantes, y la regla de `"use client"` |
| `pnpm format:check` | Formato de TypeScript, CSS y JSON |
| `pnpm test:unit` | Lógica pura, con umbral de cobertura |
| `pnpm --filter @zuccadev-labs/zuix-zudocs build` | El sitio compila; enlaces, anclas e imágenes resuelven |
| `pnpm test:site` | El sitio compilado, página a página |
| `pnpm test:html` | El contrato HTML y el modo sin framework, en navegador |
| `pnpm test:browser` | El binding de React sobre `examples/app`, en navegador |
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

## Prueba de empaquetado

`pnpm test:pack` no publica nada. Empaqueta los cinco paquetes con `pnpm pack` y los usa como lo haría una
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
- Regresión visual: no hay comparación de capturas. Un cambio de valor en un token no lo detecta ninguna
  prueba salvo que rompa el contraste.
- Rendimiento del desenfoque y de la hidratación en hardware real.
- Las versiones mínimas de los navegadores admitidos ([Compatibilidad](../users/10-compatibilidad.md)).
