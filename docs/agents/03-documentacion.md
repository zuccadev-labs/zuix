# Documentar con zudocs

Cómo se escribe, se organiza y se verifica la documentación de un proyecto que usa la plantilla. Vale para
este repositorio y para cualquier otro.

## Reglas

1. **Un documento responde una pregunta.** El título `#` la enuncia. No hay dos documentos con el mismo título.
2. **Cada documento va en un área**: `users`, `agents`, `development`, `package` o `investigations`.
3. **Nombre `NN-nombre-en-minusculas.md`.** El prefijo de dos dígitos fija el orden; `README.md` es la portada
   del área y lista sus documentos con la pregunta que responde cada uno.
4. **Se escribe en la voz de quien mantiene el proyecto.** Primera persona para decisiones y opiniones
   («Elegí…», «Probé… y lo descarté»); impersonal directa para referencia e instrucciones. Nunca la voz de un
   asistente: sin narrar el proceso de trabajo, sin «se solicitó», sin disculpas ni coletillas.
5. **Solo hechos comprobables.** Lo que afirmas está en el código, en un `CHANGELOG.md` o en una fuente citada
   con su URL. No se inventan cifras, enlaces ni compromisos.
6. **Lo que no se ha comprobado se dice**, en una sección «Lo que no he comprobado», con naturalidad.
7. **Lo que deja de estar vigente pasa a una sección de archivo**; no se borra en silencio.
8. **Sin datos privados**: ni rutas absolutas, ni nombres de proyectos privados, ni correos.
9. **Los enlaces entre documentos son relativos** y se quedan dentro de la carpeta de documentación. A un
   archivo de fuera se le nombra entre comillas invertidas o se enlaza con su URL del repositorio.
10. Tablas para datos enumerables, prosa para el razonamiento. Los ejemplos de código llevan la interfaz en
    inglés.

Las guías de `agents` son la excepción de la regla 4: se dirigen al agente, en imperativo.

## Patrones

### Adaptar el sitio a otro proyecto o marca

Se edita un solo archivo: `zudocs.config.json`. Tiene esquema (`zudocs/zudocs.schema.json`), así que un
editor o un agente ven los campos válidos; un campo desconocido es un error. El del sitio de zuix está en
`zudocs/`; otro proyecto tiene el suyo en su carpeta y lo pasa con `--config`
(ver [Zudocs](../users/05-zudocs.md#usarla-en-otro-proyecto)). Las rutas del archivo son relativas a él.

| Campo | Qué cambia |
|---|---|
| `name`, `tagline` | Título, navbar, portada y descripción para buscadores |
| `brand` | Marca de `@zuccadev-labs/zuix-tokens` (colores, material, fuentes) |
| `defaultTheme` | Tema inicial |
| `locale` | Idioma del sitio (`lang`, textos del tema). Por defecto `es` |
| `url`, `baseUrl` | Origen público y ruta bajo la que se sirve. De ellos salen canónicas, sitemap, `robots.txt` y los enlaces de `llms.txt` |
| `trailingSlash` | Barra final en las rutas. `false` por defecto |
| `logo` | Logo de la navbar: `src`, `srcDark`, `alt`. Rutas dentro de la carpeta de estáticos |
| `favicon`, `image` | Icono de la pestaña e imagen para compartir (1200 × 630 px), dentro de los estáticos |
| `static` | Carpeta de estáticos del proyecto (por defecto `static`, junto a la configuración) |
| `outDir` | Carpeta de salida del build (por defecto `build`, junto a la configuración) |
| `fonts` | Hojas de estilo de las fuentes. Una ruta local se empaqueta con el sitio; una URL remota funciona, con aviso |
| `docs.path` | Carpeta de documentación |
| `docs.areas` | Áreas: cada una es una subcarpeta, una entrada de navbar y una sidebar. `id`, `label`, `icon` y `description` |
| `pages` | Páginas de catálogo de la suite: `components`, `icons`, `tokens`. Desactivadas por defecto |
| `home` | Portada: `eyebrow`, `title`, `emphasis` y `suite` (cifras y carrusel de la suite zuix) |
| `llms` | `append`: archivo que se añade al final de `llms.txt`. `full`: genera `llms-full.txt` y una copia `.md` por documento (activo por defecto) |
| `markdown` | `mermaid: true` dibuja los bloques <code>```mermaid</code>. `untrusted: true` rechaza `.mdx` y HTML activo |
| `search` | Buscador local: `enabled` e idiomas del índice (`languages`) |
| `navbar` | Enlaces adicionales, cada uno con `to` o con `href` |
| `footer` | Texto del pie |

No se toca `docusaurus.config.ts` ni el CSS del tema.

### Añadir un documento

```
pnpm --filter @zuccadev-labs/zuix-zudocs new -- <tipo> <area> "<título>" ["<descripción>"]
pnpm --filter @zuccadev-labs/zuix-zudocs new -- guia users "Cómo cambiar de marca"
```

El comando copia la plantilla del tipo a la carpeta del área, con el siguiente prefijo numérico y el
título ya puesto. Falla si el tipo o el área no existen, o si ya hay un documento con ese nombre.

A mano, el resultado es el mismo:

1. Elegir el área.
2. Crear `NN-nombre.md` en la carpeta del área.
3. Empezar con un título `#` que enuncie la pregunta que responde el documento.
4. Añadirlo a la tabla del `README.md` del área.

### Añadir un área

1. Crear la carpeta con su `README.md`.
2. Declararla en `docs.areas` de `zudocs.config.json`, con un `icon` que exista en `zicon/manifest.json`.

Un documento en una carpeta que no está declarada se publica, pero ninguna barra lateral lo enlaza: `verify`
lo avisa.

### Plantillas por tipo

Están en `zudocs/templates/`. Cada una trae front matter, las secciones del tipo y un comentario por
sección que dice qué va en ella.

| Tipo | Plantilla | Responde | Área habitual |
|---|---|---|---|
| `tutorial` | `tutorial.md` | ¿Cómo empiezo? Lección guiada con resultado visible | `users` |
| `guia` | `guia.md` | ¿Cómo hago esta tarea? | `users`, `development` |
| `referencia` | `referencia.md` | ¿Qué campos, props u opciones tiene? | `users`, `development` |
| `explicacion` | `explicacion.md` | ¿Por qué funciona así? | `users`, `development` |
| `adr` | `adr.md` | ¿Qué decidí y por qué? | `investigations` |
| `investigacion` | `investigacion.md` | ¿Qué sé antes de decidir? | `investigations` |
| `notas-de-version` | `notas-de-version.md` | ¿Qué cambia al actualizar? | `package`, `users` |
| `agente` | `agente.md` | Reglas → patrones → verificación | `agents` |

1. Rellenar cada sección y borrar su comentario. Una sección que no aplica se borra entera.
2. No añadir secciones fuera de la plantilla sin motivo; si un tipo necesita otra, se cambia la plantilla.
3. Un ADR no se reescribe: si la decisión cambia, se crea otro y el anterior pasa a `sustituida`.
4. `description` del front matter es el resumen para buscadores; `tipo`, `estado` y `fecha` son metadatos
   propios que Docusaurus ignora.

Para añadir un tipo se crea `zudocs/templates/<tipo>.md`. Marcadores disponibles: `{{titulo}}`,
`{{descripcion}}` y `{{fecha}}`. Un marcador sin rellenar en un documento es un aviso de `verify`.

### Una investigación

Se lee como las notas de quien decide: qué me planteé, qué comparé, qué medí, qué decidí y por qué, y qué
descarté. Las cifras llevan su fecha y cómo se obtuvieron. Las fuentes externas, su URL.

### Componentes dentro de un documento

En archivos `.mdx` están disponibles sin importar: `Icon`, `Alert`, `Badge`, `Button`, `Callout`, `Card`,
`CardHeader`, `Carousel`, `Kbd`, `Panel`, `StatTile`, `Stepper`, `Tabs`, `Grid`, `Inline` y `Stack`.

Los archivos `.md` se leen como Markdown normal; los `.mdx` admiten JSX. En `.mdx`, `<Icon name="…">` lleva
el nombre literal: el sitio solo empaqueta los iconos que encuentra escritos así.

### Diagramas

Con `"markdown": { "mermaid": true }` en `zudocs.config.json`, un bloque <code>```mermaid</code> se dibuja
como diagrama, en `.md` y en `.mdx`. Sin el campo queda como bloque de código y Mermaid no se carga.

- No se fijan colores en el diagrama (`style`, `classDef`, `%%{init}%%`): los pone la marca, en claro y
  oscuro, desde `zudocs/src/mermaid/tokens.ts`. Un color escrito a mano no cambia con el modo.
- Antes de usar un diagrama en un proyecto, comprueba que su configuración lo tiene activo.
- Un diagrama con un error de sintaxis no detiene el build: se ve el error en la página. Ábrela.

## No hacer

| En lugar de | Escribe |
|---|---|
| «Se decidió usar Biome» | «Elegí Biome porque…» |
| «Pendiente de verificar por el equipo» | «No lo he probado en Safari real» |
| Una cifra sin origen | La cifra, la fecha y el comando que la da |
| Un enlace a un archivo de trabajo o a una carpeta temporal | El hecho, comprobado en el código |
| Un `<script>` o un `<iframe>` en un `.md` | Un bloque de código, o un `.mdx` si el proyecto lo admite |
| Editar `zudocs/static/llms.txt` | `pnpm check` o el build de zudocs, que lo regeneran |

## Verificación

```
pnpm --filter @zuccadev-labs/zuix-zudocs verify -- --strict
pnpm --filter @zuccadev-labs/zuix-zudocs build     # también regenera zudocs/static/llms.txt
```

En otro proyecto, los mismos comandos con `-- --config <ruta a su zudocs.config.json>`.

`verify` se ejecuta también al principio de `build`. Comprueba:

| Comprobación | Resultado si falla |
|---|---|
| `zudocs.config.json` cumple su esquema | Error |
| `brand` existe en `tokens/brands/` | Error |
| Los iconos de las áreas, y los de `<Icon>` en `.mdx`, existen en `zicon/manifest.json` | Error |
| Logo, favicon, imagen social, `llms.append` y hojas locales de `fonts` existen | Error |
| La navbar no enlaza a una página de catálogo desactivada | Error |
| Cada área declarada tiene carpeta y `README.md` | Error |
| Front matter válido; dos documentos no se publican en la misma ruta | Error |
| Enlaces relativos, anclas e imágenes resuelven, dentro de la carpeta de documentación | Error |
| `.mdx` o HTML activo con `markdown.untrusted` | Error |
| Nombres `NN-nombre.md` o `README.md`, prefijos sin repetir | Aviso |
| Un título `#` por documento, sin títulos vacíos ni repetidos entre documentos | Aviso |
| Documento fuera de toda área; marcador de plantilla sin rellenar; imagen sin texto alternativo | Aviso |
| HTML activo en un `.md`; fuentes servidas por un tercero; sitio sin `url` o sin `image` | Aviso |

Los avisos no detienen el build; `--strict` los convierte en errores. La documentación de zuix se mantiene
con 0 errores y 0 avisos, y el sitio publicado se compila con `--strict`.

El build falla además con enlaces o anclas rotos entre páginas, regenera `llms.txt` y `llms-full.txt` y
genera el índice del buscador.

## Cuando falta algo

| Falta | Qué hacer |
|---|---|
| Un dato que no encuentras en el código | No lo escribas. Dilo en tu informe |
| Un tipo de documento | Proponer una plantilla nueva |
| Un área | Proponerla; no se crea una carpeta suelta |
