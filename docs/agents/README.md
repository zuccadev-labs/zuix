# Kit de agente

Cómo trabaja un agente de IA con la suite. Estas guías las escribo para ti, agente: son cortas, imperativas
y comprobables. Todas siguen el mismo formato: **reglas → patrones → verificación**. Un cambio está terminado
cuando la verificación pasa.

## Qué leer antes de tocar nada

| Tarea | Guía | Contrato legible por máquina |
|---|---|---|
| Usar o crear componentes | `zui/AGENTS.md` | `zui/manifest.json` |
| Montar una pantalla | [Pantallas](./02-pantallas.md) | `zout/manifest.json` |
| Elegir un icono | `zicon/AGENTS.md` | `zicon/manifest.json` |
| Cambiar de marca | [Marca](./01-marca.md) | `tokens/dist/tokens.json` |
| Documentar | [Documentación](./03-documentacion.md) | `zudocs/zudocs.schema.json` |
| Trabajar sin React | [Otros frameworks](./04-otros-frameworks.md) | `zui/html.json`, `zout/html.json` |
| Tocar la lógica compartida o las pruebas | [Arquitectura](../development/01-arquitectura.md), [Calidad y pruebas](../development/02-calidad-y-pruebas.md) | `tests/unit/run.mjs` (lista `COVERED`) |
| Cambiar lo que se publica | [Empaquetado](../package/README.md), [Contrato público](../package/03-contrato-publico.md) | `publishConfig.exports` de cada `package.json` |

## Las siete reglas

1. **Solo tokens.** Ningún color, radio, sombra o fuente literal. Solo `var(--z-*)`.
2. **Un token por uso del color.** Texto de color: `--z-*-text`. Fondo con texto encima: `--z-*-solid`. El
   color sin sufijo (`--z-accent`, `--z-danger`…) es para rellenos, bordes e iconos. `pnpm tokens` mide el
   contraste del par que escribas y falla si no llega.
3. **Sin apariencia en línea.** `style={{…}}` solo para maquetación calculada y variables locales.
4. **Iconos por nombre.** `<Icon name="…" />` en React, `<z-icon name="…">` en el resto. Sin emojis, sin
   SVG a mano.
5. **Componentes del sistema.** Si falta una variante se añade al sistema; no se improvisa en la pantalla.
   Sin bibliotecas de UI de terceros: lo interactivo se escribe sobre `zui/src/core/` y la plataforma.
6. **Cristal en el cromo, opaco en la lectura.** `.z-liquid` para paneles y barras; `.z-solid` para texto
   denso.
7. **Propiedades lógicas.** `inline-start` y `inline-end`, nunca `left` y `right`: la suite funciona en RTL.

## Verificación

Desde la raíz de zuix:

| Comando | Comprueba | Objetivo |
|---|---|---|
| `pnpm tokens` | Tokens obligatorios por marca y tema; contraste WCAG de la matriz y de los pares reales de las hojas | Sin fallos |
| `pnpm icons` | Iconos válidos; alias y emojis apuntan a iconos existentes | Sin fallos |
| `pnpm style-audit` | Colores literales, primitivos, tokens inexistentes, emojis, estilos en línea | 0 en todo |
| `pnpm manifest` | Cada componente exportado tiene manifiesto válido | Sin fallos |
| `pnpm html` | El contrato HTML se genera desde los componentes | Sin fallos |
| `pnpm dist` | CSS y módulos para usar sin bundler | Sin fallos |
| `pnpm typecheck` | Tipos, incluidos los nombres de icono | Sin errores |
| `pnpm check` | Todo lo anterior | Sin fallos |
| `pnpm lint` | Biome (TypeScript, React, accesibilidad, CSS, JSON) y la regla de `"use client"` | 0 errores y 0 avisos |
| `pnpm format:check` | Formato | Sin diferencias |
| `pnpm test:unit` | Lógica pura con umbral de cobertura | Sin fallos |
| `pnpm test:html` | Contrato HTML en Chrome, sin React | Sin fallos |
| `pnpm test:browser` | Aplicación de ejemplo de React en Chrome | Sin fallos |
| `pnpm test:site` | El sitio de documentación compilado | Sin fallos |
| `pnpm test:html:all`, `pnpm test:browser:all`, `pnpm test:site:all` | Las suites en Chrome, Firefox y WebKit | Sin fallos |
| `pnpm build` | Build de publicación: ESM, declaraciones y CSS en `dist/` de `zicon`, `zui` y `zout` | Sin fallos |
| `pnpm test:pack` | Los paquetes empaquetados se instalan, resuelven, renderizan y compilan fuera del workspace | Sin fallos |
| `pnpm bump check` | Versión única y entrada en cada `CHANGELOG.md` | Sin fallos |
| `pnpm verify` | Todo, en orden, en Chromium | Sin fallos |

`pnpm build` y `pnpm test:pack` hacen falta cuando el cambio toca lo que se publica: un `package.json`,
una entrada de `exports` o un archivo nuevo en `src/`. Detalle en [Empaquetado](../package/README.md).

La auditoría de estilo acepta rutas, así que sirve para una aplicación que consume la suite:

```
node tools/audit.mjs ../mi-app/src
```

## Cuando falta algo

| Falta | Qué hacer |
|---|---|
| Un token | Proponerlo en `tokens/src/base.json`, nivel `component`, referenciando un semántico |
| Una variante | Añadirla al componente y a su manifiesto |
| Un icono | Informar. No inventarlo |
| Un componente | Crearlo en `zui` con su manifiesto, siguiendo `zui/AGENTS.md` |
| Una dependencia | No añadirla a un paquete publicable sin que yo lo apruebe |

## Lo que un agente no hace

- No publica, no crea etiquetas y no empuja a `main`.
- No edita archivos generados; los regenera.
- No desactiva una política de `pnpm-workspace.yaml` ni una regla del linter para que algo pase.
- No da por hecho lo que no ha comprobado: lo dice.
