# Zuix para usuarios

zuix es una suite de UI: tokens, iconos, componentes, layouts y documentación con un solo estándar. Una
marca replica el sistema cambiando un archivo. El estándar es HTML, CSS y tokens: sirve con cualquier
framework o sin ninguno, y trae un binding de React.

Esta documentación describe la `0.2.0`. Quien venga de la `0.1.0` tiene lo que cambia entre una y otra en
[Actualizar de 0.1 a 0.2](./08-actualizar-de-0-1-a-0-2.md).

## Documentos

| # | Documento | Qué responde |
|---|---|---|
| 01 | [Tokens](./01-tokens.md) | Qué tokens hay, cómo se elige marca y tema y qué salidas genera el paquete |
| 02 | [Zicon](./02-zicon.md) | Cómo se usa un icono, con React y sin él |
| 03 | [Zui](./03-zui.md) | Qué componentes hay y cómo se usan |
| 04 | [Zout](./04-zout.md) | Cómo se monta la estructura de una pantalla |
| 05 | [Zudocs](./05-zudocs.md) | Cómo documentar un proyecto con la plantilla |
| 06 | [Frameworks](./06-frameworks.md) | Cómo usar la suite sin React: HTML plano, Vue, Svelte, Angular, Astro; y con Next.js |
| 07 | [Migración de variables propias](./07-migracion.md) | Cómo pasa un proyecto con sus propias variables CSS a leer los tokens de zuix |
| 08 | [Actualizar de 0.1 a 0.2](./08-actualizar-de-0-1-a-0-2.md) | Qué se rompe al subir de versión y cómo arreglarlo |
| 09 | [Accesibilidad](./09-accesibilidad.md) | Qué garantiza la suite, cómo se mide y qué queda en manos de la aplicación |
| 10 | [Compatibilidad](./10-compatibilidad.md) | Navegadores, Node, React, TypeScript y bundlers admitidos |
| 11 | [CSP y Trusted Types](./11-csp-y-trusted-types.md) | Cómo desplegar con una política de seguridad de contenido estricta |

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

```bash
pnpm add @zuccadev-labs/zuix
```

Y, solo para el binding de React:

```bash
pnpm add react react-dom
```

| Subruta del paraguas | Equivale a |
|---|---|
| `@zuccadev-labs/zuix/styles.css` | `tokens.css` + estilos de `zui` + estilos de `zout`, en ese orden. Necesita un bundler |
| `@zuccadev-labs/zuix/tokens.css` | `@zuccadev-labs/zuix-tokens/tokens.css` (todas las marcas) |
| `@zuccadev-labs/zuix/tokens/dazlabs.css`, `/tokens/zutool.css`, `/tokens/zenith.css` | Una sola marca en `:root` |
| `@zuccadev-labs/zuix/tailwind.css`, `/docusaurus.css` | Puentes de los tokens a Tailwind 4 y a Docusaurus |
| `@zuccadev-labs/zuix/zui`, `/zui/dom`, `/zui/dom/carousel-gl` | Las mismas entradas de `@zuccadev-labs/zuix-zui` |
| `@zuccadev-labs/zuix/zout`, `/zout/dom` | `@zuccadev-labs/zuix-zout`, `@zuccadev-labs/zuix-zout/dom` |
| `@zuccadev-labs/zuix/zicon`, `/zicon/core`, `/zicon/dom`, `/zicon/element`, `/zicon/all` | Las mismas entradas de `@zuccadev-labs/zuix-zicon` |

Las guías escriben los imports con el nombre de cada paquete; con el paraguas se cambia el prefijo según la
tabla. Lo que el paraguas no reexporta (manifiestos, `html.json`, `tokens.json`, el sprite, los iconos
sueltos `icons/<nombre>` y los bundles `dist/`) se importa del paquete suelto, que entonces se añade también
a las dependencias del proyecto. El campo `exports` de Node no puede reenviar una subruta a otro paquete, y
no quise publicar copias de esos archivos dentro del paraguas.

La entrada raíz (`import { zui, zout, zicon } from "@zuccadev-labs/zuix"`) exporta tres espacios de nombres.
Es cómoda para explorar, pero un espacio de nombres arrastra el paquete entero: importar `Stack` así añade
todo `zout` al bundle. Para una aplicación conviene importar por subruta.

También se puede instalar paquete a paquete, con `@zuccadev-labs/zuix-zout` además si hacen falta los layouts:

```bash
pnpm add @zuccadev-labs/zuix-zui @zuccadev-labs/zuix-zicon @zuccadev-labs/zuix-tokens
```

`@zuccadev-labs/zuix-zicon` es un peer de `zui` y `zout`: la aplicación lo instala siempre. Los paquetes de
la suite comparten versión y **se actualizan juntos** (`pnpm up "@zuccadev-labs/*"`). Si quedan dos versiones
de `@zuccadev-labs/zuix-zicon` en un proyecto, los iconos registrados en una no se ven desde la otra y salen
vacíos; con el paraguas, los iconos se importan por sus subrutas (`@zuccadev-labs/zuix/zicon/all`) y no del
paquete suelto.

## Empezar

Con React:

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";   // o @zuccadev-labs/zuix-tokens/css/<marca>.css
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all";           // registra los iconos

import { Button } from "@zuccadev-labs/zuix-zui";

<Button variant="primary" icon="plus">New project</Button>
```

Con el paraguas:

```tsx
import "@zuccadev-labs/zuix/styles.css";          // tokens + componentes + layouts
import "@zuccadev-labs/zuix/zicon/all";           // registra los iconos
import { Button } from "@zuccadev-labs/zuix/zui";
import { Stack } from "@zuccadev-labs/zuix/zout";
```

- El tema se elige con `data-theme="dark"` o `"light"` en `<html>`. Sin el atributo se sigue la preferencia
  del sistema.
- La marca se elige importando su CSS o con `data-brand` en `<html>`.
- El contenedor de la aplicación lleva `class="z-root z-canvas"`: `z-root` aplica tipografía, foco y
  selección; `z-canvas` pinta el fondo.
- El binding requiere React 19. El resto de la suite no depende de React.

Sin React, en HTML plano o en otro framework: [Frameworks](./06-frameworks.md).

## Reglas comunes

1. Los componentes solo leen tokens. No hay colores, radios ni sombras literales.
2. Los iconos se piden por nombre. No se usan emojis como iconos.
3. El cristal va en el cromo (paneles, barras, menús). El texto denso va sobre superficie opaca.
4. Si falta una variante, un token o un icono, se añade al sistema; no se improvisa en la pantalla.

## Para agentes de IA

La guía está en [Kit de agente](../agents/README.md). Cada paquete trae un `manifest.json` legible por
máquina, y `zui` y `zicon` incluyen su `AGENTS.md` en el paquete publicado.
