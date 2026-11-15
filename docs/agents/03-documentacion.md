# Documentar con zudocs

## Adaptar el sitio a otro proyecto o marca

Se edita un solo archivo: `zudocs.config.json`. Tiene esquema (`zudocs/zudocs.schema.json`), así que un
editor o un agente ven los campos válidos. El del sitio de zuix está en `zudocs/`; otro proyecto tiene el
suyo en su carpeta y lo pasa con `--config` (ver [Zudocs](../users/05-zudocs.md#usarla-en-otro-proyecto)).
Las rutas del archivo son relativas a él.

| Campo | Qué cambia |
|---|---|
| `name`, `tagline` | Título, navbar y portada |
| `brand` | Marca de `@zuccadev-labs/zuix-tokens` (colores, material, fuentes) |
| `defaultTheme` | Tema inicial |
| `logo` | Logo de la navbar. `src` es una ruta dentro de la carpeta de estáticos |
| `static` | Carpeta de estáticos del proyecto (por defecto `static`, junto a la configuración) |
| `outDir` | Carpeta de salida del build (por defecto `build`, junto a la configuración) |
| `fonts` | Hojas de estilo de las fuentes de la marca |
| `docs.path` | Carpeta de documentación |
| `docs.areas` | Áreas: cada una es una subcarpeta, una entrada de navbar y una sidebar |
| `pages` | Páginas de catálogo de la suite: `components`, `icons`, `tokens`. Desactivadas por defecto |
| `home` | Portada: `eyebrow`, `title`, `emphasis` y `suite` (cifras y carrusel de la suite zuix) |
| `llms` | `append`: archivo que se añade al final de `llms.txt` |
| `markdown` | `mermaid: true` dibuja los bloques <code>```mermaid</code> con los colores de la marca. Desactivado por defecto |
| `search` | Buscador local: `enabled` e idiomas del índice (`languages`) |
| `navbar` | Enlaces adicionales |
| `footer` | Texto del pie |

No se toca `docusaurus.config.ts` ni el CSS del tema.

## Añadir un documento

```
pnpm --filter @zuccadev-labs/zuix-zudocs new -- <tipo> <area> "<título>" ["<descripción>"]
pnpm --filter @zuccadev-labs/zuix-zudocs new -- guia users "Cómo cambiar de marca"
```

El comando copia la plantilla del tipo a la carpeta del área, con el siguiente prefijo numérico y el
título ya puesto. Falla si el tipo o el área no existen, o si ya hay un documento con ese nombre.

A mano, el resultado es el mismo:

1. Elegir el área: `users`, `agents`, `investigations`, `development` o `package`.
2. Crear `NN-nombre.md` en la carpeta del área. El prefijo de dos dígitos fija el orden.
3. Empezar con un título `#` que enuncie la pregunta que responde el documento.
4. `README.md` es la portada del área.

## Plantillas por tipo

Están en `zudocs/templates/`. Cada una trae front matter, las secciones del tipo y un comentario por
sección que dice qué va en ella.

| Tipo | Plantilla | Responde | Área habitual |
|---|---|---|---|
| `tutorial` | `tutorial.md` | ¿Cómo empiezo? Lección guiada con resultado visible | `users` |
| `guia` | `guia.md` | ¿Cómo hago esta tarea? | `users`, `development` |
| `referencia` | `referencia.md` | ¿Qué campos, props u opciones tiene? | `users`, `development` |
| `explicacion` | `explicacion.md` | ¿Por qué funciona así? | `users`, `development` |
| `adr` | `adr.md` | ¿Qué se decidió y por qué? | `investigations` |
| `investigacion` | `investigacion.md` | ¿Qué se sabe antes de decidir? | `investigations` |
| `notas-de-version` | `notas-de-version.md` | ¿Qué cambia al actualizar? | `package` |
| `agente` | `agente.md` | Reglas → patrones → verificación | `agents` |

Reglas de uso:

1. Rellenar cada sección y borrar su comentario. Una sección que no aplica se borra entera.
2. No añadir secciones fuera de la plantilla sin motivo; si un tipo necesita otra, se cambia la plantilla.
3. Un ADR no se reescribe: si la decisión cambia, se crea otro y el anterior pasa a `sustituida`.
4. `description` del front matter es el resumen para buscadores; `tipo`, `estado` y `fecha` son metadatos
   propios que Docusaurus ignora.

Para añadir un tipo se crea `zudocs/templates/<tipo>.md`. Marcadores disponibles: `{{titulo}}`,
`{{descripcion}}` y `{{fecha}}`.

## Reglas de escritura

- Un documento responde una pregunta.
- Lo que no se verificó se dice.
- Lo que deja de estar vigente pasa a una sección de archivo; no se borra en silencio.

## Componentes dentro de un documento

En archivos `.mdx` están disponibles sin importar: `Icon`, `Alert`, `Badge`, `Button`, `Callout`, `Card`,
`CardHeader`, `Carousel`, `Kbd`, `Panel`, `StatTile`, `Stepper`, `Tabs`, `Grid`, `Inline` y `Stack`.

Los archivos `.md` se leen como Markdown normal; los `.mdx` admiten JSX.

## Diagramas

Con `"markdown": { "mermaid": true }` en `zudocs.config.json`, un bloque <code>```mermaid</code> se dibuja
como diagrama, en `.md` y en `.mdx`. Sin el campo queda como bloque de código y Mermaid no se carga.

- No se fijan colores en el diagrama (`style`, `classDef`, `%%{init}%%`): los pone la marca, en claro y
  oscuro, desde `zudocs/src/mermaid/tokens.ts`. Un color escrito a mano no cambia con el modo.
- Para cambiar cómo se ve un diagrama se edita ese mapa (variable de Mermaid → token `--z-*`), nunca con
  un color literal.
- Antes de usar un diagrama en un proyecto, comprueba que su configuración lo tiene activo.
- Un diagrama con un error de sintaxis no detiene el build: se ve el error en la página. Ábrela.

## Verificación

```
pnpm --filter @zuccadev-labs/zuix-zudocs verify
pnpm --filter @zuccadev-labs/zuix-zudocs build
```

En otro proyecto, los mismos comandos con `-- --config <ruta a su zudocs.config.json>`.

`verify` se ejecuta también al principio de `build`. Comprueba:

| Comprobación | Resultado si falla |
|---|---|
| `zudocs.config.json` cumple `zudocs.schema.json` | Error |
| `brand` existe en `tokens/brands/` | Error |
| Los iconos de las áreas existen en `zicon/manifest.json` | Error |
| El logo existe en la carpeta de estáticos | Error |
| La navbar no enlaza a una página de catálogo desactivada | Error |
| `llms.append` existe | Error |
| Cada área declarada tiene carpeta y `README.md` | Error |
| Los enlaces relativos entre documentos resuelven | Error |
| Nombres `NN-nombre.md` o `README.md`, prefijos sin repetir, título `#` | Aviso |

Los avisos no detienen el build; `node scripts/verify.mjs --strict` los convierte en errores. Hoy hay
documentos anteriores a la convención (`docs/users/*.md` sin prefijo), por eso son avisos.

El build falla además con enlaces rotos entre páginas, regenera `llms.txt` (el mapa de la documentación
para modelos) y genera el índice del buscador.
