# Contribuir a zuix

Cómo proponer y enviar un cambio. La guía de uso está en [`docs/users/`](./docs/users/README.md), la de
mantenimiento en [`docs/development/`](./docs/development/README.md) y las reglas para agentes de IA en
[`AGENTS.md`](./AGENTS.md) y [`docs/agents/`](./docs/agents/README.md).

Mantengo el proyecto yo solo. Reviso los issues y los pull requests cuando puedo; no hay plazos de respuesta.

## Antes de empezar

- Un error se reporta con la plantilla de error. Una vulnerabilidad no se reporta en un issue: ver
  [`SECURITY.md`](./SECURITY.md).
- Un componente, token o icono nuevo se propone primero con su plantilla. Añadirlo amplía el
  [contrato público](./docs/package/03-contrato-publico.md), y lo que entra en el contrato no se retira
  sin una versión incompatible.
- Un cambio pequeño (corrección, documentación) puede ir directamente como pull request.

## Entorno

Node 22.12 o posterior y pnpm 12. `packageManager` en `package.json` fija la versión exacta de pnpm;
`corepack enable` la instala. La CI se ejecuta con Node 26 y repite la verificación con Node 22 y 24.

```
pnpm install
pnpm check
pnpm --filter @zuccadev-labs/zuix-zudocs start    # documentación y catálogo en vivo
```

Las suites de navegador usan el Chrome instalado en el sistema. Firefox y WebKit son los de Playwright:
`pnpm exec playwright-core install firefox webkit`.

`pnpm install` aplica las políticas de [`pnpm-workspace.yaml`](./pnpm-workspace.yaml): ninguna dependencia
ejecuta scripts de instalación, no se instala una versión publicada hace menos de un día y no se acepta una
que haya perdido la procedencia que tenían las anteriores. Si la instalación se detiene por una de ellas al
añadir una dependencia, el pull request lo explica; no se desactiva la política.

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

Un cambio está terminado cuando pasan estos cuatro:

```
pnpm check                                        # tokens, iconos, auditoría de estilo, manifiestos, contrato HTML, tipos
pnpm lint && pnpm format:check                    # Biome y la regla de "use client"
pnpm test:unit                                    # lógica pura, con umbral de cobertura
pnpm --filter @zuccadev-labs/zuix-zudocs build    # el sitio compila sin enlaces ni anclas rotos
```

Según lo que toque el cambio, además:

| Si el cambio toca | Ejecutar |
|---|---|
| Interacción: `zui/src/core/`, `zui/src/dom/`, `zout/src/dom/`, un componente con comportamiento | `pnpm test:html` y `pnpm test:browser` |
| `zudocs/` | `pnpm test:site` |
| Lo que se publica: `package.json`, entradas de `exports`, archivos nuevos en `src/`, `tools/build.mjs` | `pnpm build` y `pnpm test:pack` |
| Varias de las anteriores, o una versión | `pnpm verify` (todo, en Chromium) |

La integración continua ejecuta lo mismo, con las suites de navegador en Chromium, Firefox y WebKit, y
comprueba además que los archivos generados están al día (`git diff --exit-code` después de `pnpm check`).
Qué hace cada suite: [Calidad y pruebas](./docs/development/02-calidad-y-pruebas.md).

## Reglas del código

- Los componentes solo leen tokens semánticos y de componente. Sin colores, radios ni sombras literales:
  `pnpm style-audit` debe quedar en 0.
- El texto de color usa los tokens `--z-*-text` y un fondo con texto encima usa `--z-*-solid`. `pnpm tokens`
  mide el contraste de los pares que las hojas usan y falla si alguno baja del mínimo.
- Las hojas usan propiedades lógicas (`inline-start`, `inline-end`): la suite funciona de derecha a izquierda.
- Los iconos se piden por nombre. No se usan emojis como iconos.
- El estándar es HTML, CSS y tokens. Un componente nuevo define primero su marcado y sus clases; React
  es un binding ([`docs/agents/04-otros-frameworks.md`](./docs/agents/04-otros-frameworks.md)).
- `zui` no depende de bibliotecas de UI. La lógica que comparten React y el modo sin framework vive en
  `zui/src/core/` y lleva prueba unitaria.
- Un módulo de React con hooks, contexto o manejadores de eventos propios empieza por `"use client";`.
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
- se anota en el `CHANGELOG.md` dentro de "Cambios incompatibles" y explica cómo migrar;
- sube la versión según [`docs/package/01-versionado.md`](./docs/package/01-versionado.md).

## CHANGELOG

Cada paquete publicable (`tokens/`, `zicon/`, `zui/`, `zout/` y el paraguas `suite/`) tiene su
`CHANGELOG.md`, en español y con formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Todo
cambio visible para quien usa el paquete se anota en "Sin publicar" en el mismo pull request, en la sección
que corresponda: `Cambios incompatibles`, `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado` o `Corregido`. Los
cambios internos (pruebas, herramientas, documentación) no se anotan.

La versión no se toca en un pull request normal: la subo yo con `pnpm bump`, en un pull request propio. Al
fusionarlo en `main`, el workflow `release` publica los cinco paquetes en npm y crea la etiqueta y el GitHub
Release; nadie publica a mano ([`docs/package/02-publicacion.md`](./docs/package/02-publicacion.md)).

## Datos privados

El repositorio es público. No se incluyen rutas absolutas de una máquina, nombres ni rutas de proyectos
privados o de clientes, credenciales, direcciones IP ni dominios de despliegue. Las herramientas que leen
archivos de fuera del repositorio reciben la ruta por argumento o variable de entorno
([`docs/package/04-apertura-del-repositorio.md`](./docs/package/04-apertura-del-repositorio.md)).

## Cómo se gobierna el repositorio

- `main` está protegida: todo entra por pull request con las comprobaciones de CI en verde, historial lineal
  y sin `force push`. Vale también para mí.
- No se exige la aprobación de otra persona: soy el único mantenedor y figuro en `.github/CODEOWNERS`.
- Cada pull request pasa además revisión de dependencias y CodeQL.
- Lo que llega a `main` con una versión nueva se publica en npm de forma automática
  ([Publicación](./docs/package/02-publicacion.md)).
- El trato en issues y pull requests se rige por el [código de conducta](./CODE_OF_CONDUCT.md).

## Licencia

Las contribuciones se publican bajo la licencia [MIT](./LICENSE) del proyecto.
