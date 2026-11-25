# zuix · guía para agentes

Esta guía la escribo para los agentes de IA que trabajan en este repositorio. Formato: reglas → patrones →
verificación. Un cambio está terminado cuando la verificación pasa, no antes.

zuix es una suite de UI con un solo estándar:

| Paquete | Carpeta | Qué es |
|---|---|---|
| `@zuccadev-labs/zuix-tokens` | `tokens/` | Fuente única de valores de diseño. Una marca es un archivo |
| `@zuccadev-labs/zuix-zicon` | `zicon/` | Estándar iconográfico: 366 iconos, `<z-icon>` y componente de React |
| `@zuccadev-labs/zuix-zui` | `zui/` | Sistema de componentes: contrato HTML y CSS, modo sin framework y binding de React |
| `@zuccadev-labs/zuix-zout` | `zout/` | Layouts y ventanas dinámicas |
| `@zuccadev-labs/zuix` | `suite/` | Paraguas: reexporta los cuatro anteriores bajo subrutas |
| `@zuccadev-labs/zuix-zudocs` | `zudocs/` | Estándar de documentación y plantilla Docusaurus. Privado |

Guías por paquete: `zui/AGENTS.md` y `zicon/AGENTS.md`. Guía general: `docs/agents/README.md`.

## Reglas

1. **El estándar es HTML + CSS + tokens, no React.** El marcado de cada componente está en `zui/html.json` y
   `zout/html.json`; el comportamiento sin framework, en `@zuccadev-labs/zuix-zui/dom` y
   `@zuccadev-labs/zuix-zout/dom`; los iconos, en `<z-icon>`. React es un binding que produce ese marcado. Ver
   `docs/agents/04-otros-frameworks.md`.
2. **Sin bibliotecas de UI.** `zui` solo depende de `@zuccadev-labs/zuix-tokens`. Lo interactivo se escribe
   sobre la plataforma (`<dialog>` con `showModal()`, Popover API) y sobre la lógica de `zui/src/core/`, con
   las primitivas de `zui/src/primitives/`. El linter rechaza la importación de bibliotecas de UI de
   terceros (`noRestrictedImports` en `biome.json`). Una
   dependencia nueva en un paquete publicable se justifica antes de añadirla.
3. **Solo tokens.** Ningún color, radio, sombra o fuente literal. El texto de color usa `--z-*-text`; un fondo
   con texto encima, `--z-*-solid`. `--z-accent`, `--z-success`, `--z-warning`, `--z-danger` e `--z-info` son
   para rellenos, bordes e iconos. Un `z-index` usa un token de capa (`--z-layer-*`) y un espacio, uno de
   `--z-space-*`. Un `!important` lleva al lado un comentario que diga por qué. `pnpm style-audit` cuenta
   todo esto y falla con cualquier cifra distinta de cero.
4. **Propiedades lógicas.** `margin-inline-start`, `inset-inline-end`, `border-start-start-radius`. Nada de
   `left` o `right` en una hoja: la suite funciona en `dir="rtl"`.
5. **Cinco paquetes, una versión.** Se publican `tokens`, `zicon`, `zui`, `zout` y el paraguas, siempre con
   el mismo número. `zudocs/` y `examples/` son privados. La versión solo se toca en el pull request de la
   subida (`pnpm bump`).
6. **Dos mapas de entradas.** Cada `package.json` publicable tiene `exports` (fuente, para el workspace) y
   `publishConfig.exports` (`dist/`, para el paquete publicado). Una entrada nueva va en los dos y, si debe
   verse por el paraguas, también en `suite/` (`.js`, `.d.ts` y `exports`).
7. **Dependencias internas.** Entre paquetes publicables, `workspace:^`. `@zuccadev-labs/zuix-zicon` es
   `peerDependency` de `zui` y `zout` (una sola copia del registro de iconos), nunca `dependency`.
8. **`"use client"`.** Un módulo de React con hooks, contexto o manejadores de eventos propios empieza por
   `"use client";`. Lo comprueba `tools/use-client.mjs` dentro de `pnpm lint`.
9. **Lo generado no se edita.** `tokens/dist/`, `zicon/src/icons/`, `zicon/src/names.ts`, `zicon/src/all.ts`,
   los `manifest.json` y `html.json` de la raíz de cada paquete, `*/dist/`, `zicon/sprite.svg`,
   `examples/html/index.html`, `zudocs/static/llms.txt` y `tokens/dist/compat/`. Las capas de compatibilidad
   salen de `tokens/compat/*.json`. Se regeneran con `pnpm check` y entran en el mismo cambio.
10. **Cada cambio visible se anota** en "Sin publicar" del `CHANGELOG.md` de su paquete.
11. **Un agente no publica.** Ni `pnpm publish` ni `npm publish` sin `--dry-run`, ni etiquetas, ni `git push`
    a `main`. Publica el workflow `release` cuando una subida de versión llega a `main`
    (`docs/package/02-publicacion.md`).
12. **El repositorio es público.** Sin rutas absolutas, nombres de proyectos privados ni credenciales en
    archivos versionados. Una herramienta que lee de fuera recibe la ruta por argumento o variable de entorno.
    El piloto de zudocs sobre Zenith (`examples/zenith-docs/`) no se versiona: Zenith es privado.
13. **Documentación en `docs/`, en español**, por áreas (`users`, `agents`, `development`, `package`,
    `investigations`), con el estándar de `docs/agents/03-documentacion.md`. Los ejemplos de código llevan la
    interfaz en inglés. El `README.md` de la raíz y los de los paquetes van en inglés.

## Patrones

### Dónde va cada cosa

| Quiero | Va en |
|---|---|
| Un valor de diseño | `tokens/src/base.json` (contrato) o `tokens/brands/<marca>.json` (marca) |
| Un cálculo que comparten React y el modo DOM | `zui/src/core/`, con su prueba en `tests/unit/` |
| Una primitiva de React (diálogo, capa, menú) | `zui/src/primitives/` |
| Un componente | `zui/src/components/<grupo>/` con su `*.manifest.json` y su hoja en `zui/src/styles/` |
| Comportamiento sin framework | `zui/src/dom/` o `zout/src/dom/` |
| Un layout | `zout/src/layouts/`; el cálculo, en `zout/src/logic.ts` |
| Una herramienta del repositorio | `tools/` |

### Espacio de trabajo

pnpm 12 con `tokens/`, `zicon/`, `zui/`, `zout/`, `zudocs/`, `suite/` y `examples/*`. Node 22.12 o posterior;
la CI usa Node 26 y prueba además 22 y 24. `pnpm-workspace.yaml` fija las políticas de instalación: ninguna
dependencia ejecuta scripts, no entra una versión con menos de un día en el registro ni una que pierda la
procedencia que tenían las anteriores. Si `pnpm install` se detiene por una de ellas, no se esquiva: se
informa.

## Verificación

| Comando | Cuándo |
|---|---|
| `pnpm check` | Siempre. Tokens, iconos, auditoría de estilo, manifiestos, exportaciones, contrato HTML, cobertura de la documentación (`pnpm docs:coverage`), `dist`, matriz de compatibilidad, `llms.txt` y tipos |
| `pnpm --filter @zuccadev-labs/zuix-zudocs build` | Siempre. El sitio compila sin enlaces ni anclas rotos |
| `pnpm lint` y `pnpm format:check` | Siempre que se toque código |
| `pnpm test:unit` | Si toca lógica de `core/`, `logic.ts`, `tokens/src/` o `tools/` |
| `pnpm test:html` y `pnpm test:browser` | Si toca interacción (sin React y con React) |
| `pnpm test:site` | Si toca `zudocs/` |
| `pnpm build` y `pnpm test:pack` | Si toca lo que se publica: `package.json`, `exports`, archivos nuevos en `src/`, `tools/build.mjs` |
| `pnpm verify` | Antes de una versión: todo lo anterior, con `format:check`, en Chromium |

Un cambio está terminado cuando pasan `pnpm check` y el build de zudocs, más lo que corresponda de la tabla.
Los runners de CI no ofrecen WebGL en Firefox: `NO_WEBGL=1 BROWSER=firefox pnpm test:browser` lo reproduce
en local. Un caso de navegador que falla una vez se mide antes de tocarlo: `node tests/browser/run.mjs
<filtro> --repeat=25` (`tests/html/run.mjs` y `tests/site/run.mjs` admiten el mismo argumento).

## Cuando falta algo

| Falta | Qué hacer |
|---|---|
| Un token | Proponerlo en `tokens/src/base.json`, nivel `component`, referenciando un semántico |
| Una variante | Añadirla al componente y a su manifiesto |
| Un icono | Informar. No se dibuja a mano ni se toma de otra biblioteca |
| Una decisión de contrato | Detenerse y preguntar: lo que entra en el contrato público no se retira sin una versión incompatible (`docs/package/03-contrato-publico.md`) |
