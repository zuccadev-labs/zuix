# Desarrollo de zuix

Cómo está hecha la suite por dentro y cómo se mantiene. Es el área para quien cambia el código de este
repositorio: yo, y quien envíe un pull request.

## Documentos

| # | Documento | Qué responde |
|---|---|---|
| 01 | [Arquitectura](./01-arquitectura.md) | Qué paquetes hay, cómo se dividen por dentro y de dónde sale cada archivo generado |
| 02 | [Calidad y pruebas](./02-calidad-y-pruebas.md) | Qué comprueba cada comando, qué cubre cada suite y cuándo se ejecuta |
| 03 | [CI y cadena de suministro](./03-ci-y-cadena-de-suministro.md) | Qué hacen los workflows, cómo se protegen las dependencias y cómo verificar una versión desde fuera |

## Empezar

Requisitos: Node 22.12 o posterior (uso Node 26) y pnpm 12. `packageManager` fija la versión exacta de pnpm;
`corepack enable` la instala.

```
pnpm install
pnpm check                                        # regenera y valida todo lo generado; comprueba tipos
pnpm --filter @zuccadev-labs/zuix-zudocs start    # sitio de documentación con el catálogo en vivo
pnpm --filter @zuccadev-labs/zuix-example-app dev # aplicación de ejemplo de React
```

No hace falta compilar para desarrollar: dentro del workspace cada paquete exporta su código fuente, y
`zudocs`, `examples/app` y las pruebas lo importan directamente. `dist/` solo existe para publicar.

## Dónde está cada cosa

| Carpeta | Contenido |
|---|---|
| `tokens/` | Contrato de tokens (`src/base.json`), marcas (`brands/`), generador y validador |
| `zicon/` | Iconos generados desde Figma, registro, componente y elemento |
| `zui/` | Componentes: lógica compartida, primitivas de React, modo DOM y hojas de estilo |
| `zout/` | Layouts: binding de React, modo DOM y la lógica que comparten |
| `suite/` | El paraguas: reexportaciones de una línea |
| `zudocs/` | Plantilla del sitio de documentación |
| `examples/app/` | Aplicación de React que ejercita la suite; base de `pnpm test:browser` |
| `examples/react18/` | La misma aplicación servida con React 18 (solo dependencias y `vite.config.ts`); base de `REACT=18 pnpm test:browser` |
| `examples/html/` | El contrato HTML en una página sin framework; base de `pnpm test:html` |
| `tools/` | Herramientas del repositorio: auditoría, manifiestos, contrato HTML, build, empaquetado, versión |
| `tests/` | Pruebas unitarias, de navegador y del sitio |
| `docs/` | Esta documentación |

## Reglas que no se discuten en cada cambio

- Lo generado no se edita a mano; se regenera con `pnpm check` y entra en el mismo cambio.
- `zui` no gana dependencias. Lo que comparten React y el modo sin framework va en `zui/src/core/`.
- Un cambio visible se anota en "Sin publicar" del `CHANGELOG.md` de su paquete.
- La versión solo se toca con `pnpm bump`, en su propio pull request ([Versionado](../package/01-versionado.md)).

El flujo de contribución está en `CONTRIBUTING.md`, en la raíz del repositorio.
