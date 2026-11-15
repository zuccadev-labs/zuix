# Zuix para usuarios

Zuix es una suite de UI/UX: tokens, iconos, componentes, layouts y documentación con un solo estándar.
Una marca replica el sistema cambiando un archivo. El estándar es HTML, CSS y tokens: sirve con
cualquier framework, y trae un binding de React.

> **Estado (2026-11-14):** versión `0.1.0`, la primera. Los paquetes pasan su verificación y se distribuyen
> en npmjs.com bajo `@zuccadev-labs`; el procedimiento y el estado de la publicación están en
> [Empaquetado y publicación](../package/README.md).

## Paquetes

| Paquete | Qué es | Guía |
|---|---|---|
| `@zuccadev-labs/zuix` | Paraguas: la suite completa en una dependencia | [Instalar](#instalar) |
| `@zuccadev-labs/zuix-tokens` | Fuente única de valores de diseño. Una marca es un archivo | [Tokens](./01-tokens.md) |
| `@zuccadev-labs/zuix-zicon` | 346 iconos en outline y solid | [Zicon](./02-zicon.md) |
| `@zuccadev-labs/zuix-zui` | 64 componentes accesibles que solo leen tokens | [Zui](./03-zui.md) |
| `@zuccadev-labs/zuix-zout` | 10 layouts: shell, paneles, pestañas, rejillas | [Zout](./04-zout.md) |
| `@zuccadev-labs/zuix-zudocs` | Estándar de documentación y plantilla Docusaurus. No se publica en npm | [Zudocs](./05-zudocs.md) |

## Instalar

Lo habitual es el paraguas, que trae los otros cuatro en la misma versión:

```
pnpm add @zuccadev-labs/zuix                 # o npm install, yarn add, bun add
pnpm add react react-dom                     # solo para el binding de React
```

| Subruta del paraguas | Equivale a |
|---|---|
| `@zuccadev-labs/zuix/styles.css` | `tokens.css` + estilos de `zui` + estilos de `zout`, en ese orden. Necesita un bundler |
| `@zuccadev-labs/zuix/tokens.css` | `@zuccadev-labs/zuix-tokens/tokens.css` |
| `@zuccadev-labs/zuix/zui`, `/zui/dom` | `@zuccadev-labs/zuix-zui`, `@zuccadev-labs/zuix-zui/dom` |
| `@zuccadev-labs/zuix/zout`, `/zout/dom` | `@zuccadev-labs/zuix-zout`, `@zuccadev-labs/zuix-zout/dom` |
| `@zuccadev-labs/zuix/zicon`, `/zicon/core`, `/zicon/dom`, `/zicon/element`, `/zicon/all` | Las mismas entradas de `@zuccadev-labs/zuix-zicon` |

Las guías de este sitio escriben los imports con el nombre de cada paquete; con el paraguas se cambia
el prefijo según la tabla. Lo que el paraguas no reexporta (manifiestos, `html.json`, iconos sueltos
`icons/<nombre>`, una marca por separado, bundles `dist/`) se importa del paquete suelto, que entonces
se añade también a las dependencias del proyecto.

También se puede instalar paquete a paquete:

```
pnpm add @zuccadev-labs/zuix-zui @zuccadev-labs/zuix-zicon @zuccadev-labs/zuix-tokens
pnpm add @zuccadev-labs/zuix-zout            # layouts
```

`@zuccadev-labs/zuix-zicon` es un peer de `zui` y `zout`: la aplicación lo instala siempre. Los paquetes
de la suite comparten versión y **se actualizan juntos** (`pnpm up "@zuccadev-labs/*"`). Si quedan dos
versiones de `@zuccadev-labs/zuix-zicon` en un proyecto, los iconos registrados en una no se ven desde
la otra y salen vacíos; con el paraguas, los iconos se importan por sus subrutas
(`@zuccadev-labs/zuix/zicon/all`) y no del paquete suelto.

## Trabajar en el repositorio

Requisitos: Node 20 o superior y pnpm 12.

```
pnpm install
pnpm check                          # tokens, iconos, auditoría, manifiestos, contrato HTML y tipos
pnpm --filter @zuccadev-labs/zuix-zudocs start    # este sitio, con el catálogo en vivo
```

## Usar la suite

En cualquier framework o en HTML plano: [Frameworks](./06-frameworks.md). Un proyecto que ya tiene sus
propias variables CSS: [Migración](./07-migracion.md). Con React:

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";   // o @zuccadev-labs/zuix-tokens/css/<marca>.css
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all";           // registra los iconos

import { Button } from "@zuccadev-labs/zuix-zui";

<Button variant="primary" icon="plus">New project</Button>
```

- El tema se elige con `data-theme="dark"` o `"light"` en `<html>`.
- La marca se elige importando su CSS o con `data-brand` en `<html>`.
- El binding de React requiere React 19. El resto de la suite no depende de React.

Con el paraguas:

```tsx
import "@zuccadev-labs/zuix/styles.css";          // tokens + componentes + layouts
import "@zuccadev-labs/zuix/zicon/all";           // registra los iconos
import { Button } from "@zuccadev-labs/zuix/zui";
import { Stack } from "@zuccadev-labs/zuix/zout";
```

## Reglas comunes

1. Los componentes solo leen tokens. No hay colores, radios ni sombras literales.
2. Los iconos se piden por nombre. No se usan emojis como iconos.
3. El cristal va en el cromo (paneles, barras, menús). El texto denso va sobre superficie opaca.
4. Si falta una variante, un token o un icono, se añade al sistema; no se improvisa en la pantalla.

## Para agentes

La guía está en [Kit de agente](../agents/README.md). Cada paquete trae su `AGENTS.md` y un
`manifest.json` legible por máquina.
