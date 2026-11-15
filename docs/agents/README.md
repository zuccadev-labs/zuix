# Kit de agente

Cómo trabaja un agente de IA con la suite. Todo sigue el mismo formato: **reglas → patrones →
verificación**. Un cambio está terminado cuando la verificación pasa.

## Qué leer antes de tocar nada

| Tarea | Guía | Contrato legible por máquina |
|---|---|---|
| Usar o crear componentes | `zui/AGENTS.md` | `zui/manifest.json` |
| Montar una pantalla | [Layouts](./02-pantallas.md) | `zout/manifest.json` |
| Elegir un icono | `zicon/AGENTS.md` | `zicon/manifest.json` |
| Cambiar de marca | [Marca](./01-marca.md) | `tokens/dist/tokens.json` |
| Documentar | [Documentación](./03-documentacion.md) | `zudocs/zudocs.schema.json` |
| Trabajar sin React | [Otros frameworks](./04-otros-frameworks.md) | `zui/html.json`, `zout/html.json` |
| Cambiar lo que se publica | [Empaquetado](../package/README.md), [Contrato público](../package/03-contrato-publico.md) | `publishConfig.exports` de cada `package.json` |

## Las cinco reglas

1. **Solo tokens.** Ningún color, radio, sombra o fuente literal. Solo `var(--z-*)`.
2. **Sin apariencia en línea.** `style={{…}}` solo para maquetación calculada y variables locales.
3. **Iconos por nombre.** `<Icon name="…" />` en React, `<z-icon name="…">` en el resto. Sin emojis, sin
   SVG a mano.
4. **Componentes del sistema.** Si falta una variante se añade al sistema; no se improvisa en la pantalla.
5. **Cristal en el cromo, opaco en la lectura.** `.z-liquid` para paneles y barras; `.z-solid` para texto
   denso.

## Verificación

Desde la raíz de zuix:

| Comando | Comprueba | Objetivo |
|---|---|---|
| `pnpm tokens` | Tokens obligatorios por marca y tema; contraste WCAG | Sin fallos |
| `pnpm icons` | Alias y emojis apuntan a iconos existentes | Sin fallos |
| `pnpm style-audit` | Colores literales, primitivos, tokens inexistentes, emojis, estilos en línea | 0 en todo |
| `pnpm manifest` | Cada componente exportado tiene manifiesto válido | Sin fallos |
| `pnpm html` | El contrato HTML se genera desde los componentes | Sin fallos |
| `pnpm dist` | CSS y módulos para usar sin bundler | Sin fallos |
| `pnpm typecheck` | Tipos, incluidos los nombres de icono | Sin errores |
| `pnpm check` | Todo lo anterior | Sin fallos |
| `pnpm test:html` | Contrato HTML en Chrome, sin React | Sin fallos |
| `pnpm test:browser` | Aplicación de ejemplo de React en Chrome | Sin fallos |
| `pnpm test:html:all`, `pnpm test:browser:all` | Las dos suites en Chrome, Firefox y WebKit (`BROWSER=all`) | Sin fallos |
| `pnpm build` | Build de publicación: ESM, declaraciones y CSS en `dist/` de `zicon`, `zui` y `zout` | Sin fallos |
| `pnpm test:pack` | Los paquetes empaquetados se instalan, resuelven, renderizan y compilan fuera del workspace | Sin fallos |
| `pnpm bump check` | Versión única y entrada en cada `CHANGELOG.md` | Sin fallos |

`pnpm build` y `pnpm test:pack` hacen falta cuando el cambio toca lo que se publica: un `package.json`,
una entrada de `exports` o un archivo nuevo en `src/`. Detalle en [Empaquetado](../package/README.md).

La auditoría acepta rutas, así que sirve para una aplicación que consume la suite:

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
