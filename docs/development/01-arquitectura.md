# Arquitectura

Qué paquetes hay, cómo se divide cada uno por dentro y de dónde sale cada archivo generado.

## Los paquetes y sus dependencias

```
marca (un archivo JSON)
        ↓
tokens ─────────────────────────────┐
        ↓                           │
zicon (peer)      zui ──────────────┤
        ↓          ↓                │
        └────────  zout             │
                   ↓                ↓
        suite (paraguas)      zudocs, examples
```

| Paquete | `dependencies` | `peerDependencies` |
|---|---|---|
| `tokens` | — | — |
| `zicon` | — | `react` (opcional) |
| `zui` | `tokens` | `zicon`; `react` y `react-dom` (opcionales) |
| `zout` | `tokens`, `zui` | `zicon`; `react` y `react-dom` (opcionales) |
| Paraguas | `tokens`, `zicon`, `zui`, `zout` | `react` y `react-dom` (opcionales) |

Ningún paquete publicado depende de código de terceros en ejecución. `zicon` es peer de `zui` y `zout` para
que el registro de iconos sea una sola copia en la aplicación
([por qué](../package/02-publicacion.md#registro-de-iconos-duplicado)).

## El contrato manda

Un componente es, por este orden:

1. **Marcado y clases.** HTML con clases `z-*` y atributos de estado.
2. **Una hoja de estilos** que solo lee tokens.
3. **Comportamiento**, si lo necesita, escrito una vez sin framework.
4. **Un binding de React** que produce ese marcado y usa ese comportamiento.

`tools/html.mjs` cierra el círculo: renderiza cada ejemplo de los manifiestos con el binding de React y
guarda el resultado en `html.json`. El HTML que documento para otros frameworks es exactamente el que produce
la implementación, y `examples/html/index.html`, la página que prueba el modo sin framework, se genera desde
ese mismo archivo.

## `zui` por dentro

```
zui/src/
  core/         lógica pura: sin React, sin efectos al importar
  primitives/   primitivas de React sobre core
  components/   los 224 componentes, por grupo, cada uno con su manifiesto
  dom/          el modo sin framework, sobre core
  styles/       una hoja por grupo, en su @layer
```

### `core/`: una sola lógica

Todo lo que necesitan a la vez React y el modo DOM vive aquí, escrito una vez. Ningún módulo importa React
ni toca el documento al cargarse, así que se prueban en Node.

| Módulo | Qué resuelve |
|---|---|
| `place` | Colocación de una capa junto a su ancla: lado, alineación, volteo si no cabe, espacio disponible |
| `layers` | Pila de capas: Escape cierra solo la de arriba; cierre al interactuar fuera |
| `focus` | Elementos tabulables, entrada del foco en una capa, trampa de Tab y devolución al cerrar |
| `scroll-lock` | Bloqueo del desplazamiento de la página con un diálogo abierto, con recuento de usos |
| `presence` | Esperar la animación de salida antes de retirar un elemento |
| `roving`, `typeahead` | Foco itinerante y búsqueda por letra de los patrones de APG |
| `dir` | Dirección de escritura, leída del DOM |
| `menu-aim` | Zona de gracia del puntero al ir en diagonal hacia un submenú |
| `swipe`, `long-press`, `timer` | Deslizar para descartar, pulsación larga, y temporizador con pausas de los avisos |
| `date`, `pagination`, `slider`, `compare`, `search`, `accept` | Aritmética de calendario, de paginación y de Slider; orden de tabla; búsqueda sin acentos; filtro de archivos |
| `ref` | Resolver por id el elemento que nombra un atributo |
| `keys` | Claves estables para listas sin identificador propio |

### `primitives/`: React sobre la plataforma

| Primitiva | Sobre qué va |
|---|---|
| `dialog` | `<dialog>` con `showModal()`: la capa superior, el velo y la inercia los pone el navegador |
| `popup` | Un elemento `popover="manual"` anclado con `core/place` |
| `menu` | Menú y submenús según el patrón de APG, sobre `popup` |
| `native-input` | El campo nativo oculto que lleva el valor de un control propio al formulario |
| `slot` | Fusión de props y `ref` con un elemento hijo (`asChild`, disparadores) |
| `hooks`, `radio-context` | Hooks comunes y el estado que comparte un `RadioGroup` con sus `Radio` |

No hay portales ni `z-index`: `<dialog>` y `popover` viven en la capa superior del navegador.

### `dom/`: el modo sin framework

`index.ts` conecta los listeners del documento (`init()`, que devuelve `destroy`) y reexporta las funciones
de cada grupo: `forms-*` (controles, lista, calendario, popup), `collections` (paleta, árbol, tabla,
paginación) y `carousel`. `carousel-gl.ts` lleva los shaders del modo WebGL y se carga con `import()` solo
cuando un carrusel lo pide. `shared.ts` tiene el único punto que escribe marcado como cadena (`setMarkup`,
con la política de Trusted Types).

### `styles/`

Una hoja por grupo dentro de su `@layer zui.<grupo>`, más tres de base:

| Hoja | Qué contiene |
|---|---|
| `material.css` | `.z-liquid`, `.z-solid`, `.z-canvas` y las preferencias de transparencia |
| `base.css` | `.z-root`: tipografía, foco, selección, `forced-colors`, `prefers-contrast`, movimiento reducido |
| `native.css` | Neutraliza `<dialog>`, `[popover]` y `<button>` para que el contrato HTML se vea igual que React |

## `zout` por dentro

`src/logic.ts` es la lógica pura (modo de cada panel según el ancho, límites de un tirador, reparto de un
`SplitPane`). La consumen `src/layouts/*.tsx` (React) y `src/dom/index.ts` (sin framework). Toda la hoja está
en un `@layer zout`, y `.z-shell` es un contenedor de consultas para que el CSS decida qué paneles caben antes
de que el comportamiento mida.

## `zicon` por dentro

| Paso | Herramienta | Salida |
|---|---|---|
| Extraer del archivo de Figma | `scripts/extract.py` (lee el `.fig` sin Figma) | `icons.json` y `svg/` de los iconos de Dazicon |
| Convertir los iconos propios (solo al añadir o retocar uno) | `scripts/own.mjs` (`pnpm icons:own`, con `canvaskit-wasm`) lee los dibujos con trazo de `own/` | `icons-own.json` y `svg/` de los iconos propios |
| Generar módulos | `scripts/build.mjs` une `icons.json` e `icons-own.json` (un nombre repetido es un error) | `src/icons/<nombre>.ts`, `src/names.ts`, `src/all.ts`, `manifest.json` y las tablas de `AGENTS.md` |
| Generar el sprite | `scripts/sprite.mjs` | `sprite.svg` |

El registro (`src/registry.ts`) es un mapa en un módulo. `Icon`, `<z-icon>`, `iconSvg()` e `iconElement()`
leen de él; `registerIcons()` escribe. Por eso tiene que haber una sola copia del paquete en la aplicación.

## `tokens` por dentro

| Archivo | Papel |
|---|---|
| `src/base.json` | El contrato: escala, semánticos derivados, tokens de componente, obligatorios, secciones `coarse`, `moreContrast` y `forcedColors`, y qué pares de contraste se exigen |
| `brands/<marca>.json` | Primitivos, fuentes y semánticos de cada tema |
| `src/build.mjs` | Genera `dist/`: CSS, Tailwind, Docusaurus, JSON y DTCG. Valida cada marca contra su esquema |
| `src/validate.mjs` | Mide el contraste: matriz, pares declarados, pares reales de las hojas y no texto |
| `src/pairs.mjs` | Lee de las hojas de `zui` y `zout` qué color va sobre qué fondo |
| `src/color.mjs` | Conversión de color, composición de translúcidos y razón de contraste |
| `src/compat.mjs` | Capas de compatibilidad desde `compat/<proyecto>.json` |

Es un script de Node sin dependencias. El contrato es pequeño y la validación de contraste es propia; no
necesité Style Dictionary.

## El paraguas

`suite/` no tiene build: son archivos de una línea escritos a mano (`zui.js`, `zui.d.ts`, `styles.css`…) que
reexportan una entrada de otro paquete. `pnpm build` comprueba que cada reexportación apunta a una entrada
publicada, y `pnpm test:pack` que cada subruta del paraguas es el mismo módulo que la del paquete suelto.

## Qué se genera y quién lo genera

| Archivo | Lo genera | Comando |
|---|---|---|
| `tokens/dist/` | `tokens/src/build.mjs` | `pnpm tokens` |
| `zicon/src/icons/`, `names.ts`, `all.ts`, `svg/`, `manifest.json`, `sprite.svg` | `zicon/scripts/` | `pnpm icons` |
| `zui/manifest.json`, `zout/manifest.json` | `tools/manifest.mjs`, desde los `*.manifest.json` | `pnpm manifest` |
| `zui/html.json`, `zout/html.json` | `tools/html.mjs` | `pnpm html` |
| `*/dist/*.css`, `*/dist/*.js` (bundles de navegador) | `tools/dist.mjs` | `pnpm dist` |
| `*/dist/*.compat.css`, `tokens/dist/**/*.compat.css` (modo compat) | `tools/compat.mjs`, desde `tools/dist.mjs` | `pnpm dist` |
| Matriz de soporte de `docs/users/10-compatibilidad.md` | `tools/compat-matrix.mjs` | `pnpm matrix` |
| `examples/html/index.html` | `examples/html/build.mjs` | `pnpm dist` |
| `zudocs/static/llms.txt` | `zudocs/scripts/llms.mjs` | `pnpm llms` (también lo regenera el build de zudocs) |
| `*/dist/esm/` (publicación) | `tools/build.mjs` | `pnpm build` |

`pnpm check` encadena los seis primeros, la auditoría de estilo, la comprobación de exportaciones y la de
tipos. La CI comprueba después que el árbol de trabajo sigue limpio: un archivo generado que no esté al día,
o uno nuevo sin añadir, hace fallar el pull request.

## Dos mapas de entradas

Cada `package.json` publicable tiene `exports`, que apunta a `src/` y es el que ve el workspace, y
`publishConfig.exports`, que apunta a `dist/` y es el que pnpm copia al empaquetar. Una entrada nueva se
escribe en los dos. El porqué y el detalle del build de publicación están en
[Empaquetado](../package/README.md).

## Por qué así

Las decisiones que explican esta forma están en las investigaciones:
[Arquitectura de la suite y decisiones](../investigations/06-arquitectura-y-decisiones.md) y
[Primitivas propias](../investigations/08-primitivas-propias.md).
