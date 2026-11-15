# Contribuir a zuix

Cómo proponer y enviar un cambio. La guía de uso está en [`docs/users/`](./docs/users/README.md) y las
reglas para agentes en [`AGENTS.md`](./AGENTS.md) y [`docs/agents/`](./docs/agents/README.md).

## Antes de empezar

- Un error se reporta con la plantilla de error. Una vulnerabilidad no se reporta en un issue: ver
  [`SECURITY.md`](./SECURITY.md).
- Un componente, token o icono nuevo se propone primero con su plantilla. Añadirlo amplía el
  [contrato público](./docs/package/03-contrato-publico.md), y lo que entra en el contrato no se retira
  sin una versión incompatible.
- Un cambio pequeño (corrección, documentación) puede ir directamente como pull request.

## Entorno

Requisitos: Node 20 o superior y pnpm 12. `packageManager` en `package.json` fija la versión exacta;
`corepack enable` la instala.

```
pnpm install
pnpm check
pnpm --filter @zuccadev-labs/zuix-zudocs start    # documentación y catálogo en vivo
```

Las suites de navegador usan el Chrome instalado en el sistema.

## Flujo

1. Crear una rama desde `main`.
2. Hacer el cambio en el fuente. No se editan a mano los archivos generados: `tokens/dist/`,
   `zicon/src/icons/`, `zicon/src/names.ts`, `zicon/src/all.ts`, los `manifest.json` y `html.json` de la
   raíz de cada paquete, `*/dist/`, `zicon/sprite.svg`, `examples/html/index.html` ni
   `zudocs/static/llms.txt`. Se regeneran con `pnpm check` y se incluyen en el mismo cambio.
3. Anotar el cambio en el `CHANGELOG.md` del paquete afectado, bajo "Sin publicar".
4. Ejecutar la verificación.
5. Abrir el pull request y completar su lista.

## Verificación obligatoria

Un cambio está terminado cuando pasan los dos:

```
pnpm check                          # tokens, iconos, auditoría de estilo, manifiestos, contrato HTML, tipos
pnpm --filter @zuccadev-labs/zuix-zudocs build    # el sitio compila y no tiene enlaces rotos
```

Según lo que toque el cambio, además:

| Si el cambio toca | Ejecutar |
|---|---|
| Interacción: `zui/src/dom/`, `zout/src/dom/`, un componente con comportamiento | `pnpm test:html` y `pnpm test:browser` |
| Lo que se publica: `package.json`, entradas de `exports`, archivos nuevos en `src/`, `tools/build.mjs` | `pnpm build` y `pnpm test:pack` |
| Varias de las anteriores, o una release | `pnpm verify` (todo, en Chromium) |

La integración continua ejecuta lo mismo, con las suites de navegador en Chromium, Firefox y WebKit.

## Reglas del código

- Los componentes solo leen tokens semánticos y de componente. Sin colores, radios ni sombras literales:
  `pnpm style-audit` debe quedar en 0.
- Los iconos se piden por nombre. No se usan emojis como iconos.
- El estándar es HTML, CSS y tokens. Un componente nuevo define primero su marcado y sus clases; React
  es un binding ([`docs/agents/04-otros-frameworks.md`](./docs/agents/04-otros-frameworks.md)).
- Un componente con hooks, contexto, Radix o manejadores de eventos propios empieza por `"use client";`.
- Una entrada nueva de un paquete va en `exports` y en `publishConfig.exports`. Si debe verse por el paraguas
  `@zuccadev-labs/zuix`, también en `suite/` (`.js`, `.d.ts` y `exports`).
- Entre paquetes publicables se depende con `workspace:^`; `@zuccadev-labs/zuix-zicon` es `peerDependency` de
  `zui` y `zout`.
- Documentación en español; ejemplos de código con la interfaz en inglés.

Guías por paquete: [`zui/AGENTS.md`](./zui/AGENTS.md) y [`zicon/AGENTS.md`](./zicon/AGENTS.md).

## Contrato público

[`docs/package/03-contrato-publico.md`](./docs/package/03-contrato-publico.md) define qué es superficie
pública (tokens, clases, atributos, marcado, eventos, nombres de icono, props, entradas de paquete) y
qué cuenta como cambio incompatible. Un cambio incompatible:

- se discute en un issue antes de escribirlo;
- se anota en el `CHANGELOG.md` empezando por `**Incompatible:**` y explica cómo migrar;
- sube la versión según [`docs/package/01-versionado.md`](./docs/package/01-versionado.md).

## CHANGELOG

Cada paquete publicable (`tokens/`, `zicon/`, `zui/`, `zout/` y el paraguas `suite/`) tiene su `CHANGELOG.md`, en español y con formato Keep a Changelog. Todo cambio
visible para quien usa el paquete se anota en "Sin publicar" en el mismo pull request, en la sección que
corresponda: `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado` o `Corregido`. Los cambios internos (pruebas,
herramientas, documentación) no se anotan.

La versión no se toca en un pull request normal: la sube el responsable con `pnpm bump`, en un pull
request propio. Al fusionarlo en `main`, el workflow `release` publica los cinco paquetes en npm y crea la
etiqueta y el GitHub Release; nadie publica a mano
([`docs/package/02-publicacion.md`](./docs/package/02-publicacion.md)).

## Datos privados

El repositorio es público. No se incluyen rutas absolutas de una máquina, nombres ni rutas de proyectos
privados o de clientes, credenciales, direcciones IP ni dominios de despliegue. Las herramientas que leen
archivos de fuera del repositorio reciben la ruta por argumento o variable de entorno
([`docs/package/04-apertura-del-repositorio.md`](./docs/package/04-apertura-del-repositorio.md)).

## Licencia

Las contribuciones se publican bajo la licencia [MIT](./LICENSE) del proyecto.

## Pendiente de definir por el responsable

- Revisores obligatorios: no hay `CODEOWNERS` porque el repositorio aún no tiene cuentas asignadas.
- Protección de la rama `main` y comprobaciones requeridas.
- Código de conducta.
