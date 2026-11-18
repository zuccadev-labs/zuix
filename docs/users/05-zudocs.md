# Zudocs

`@zuccadev-labs/zuix-zudocs` es el estándar de documentación de la suite y su plantilla: un sitio Docusaurus
con el estilo liquid glass, que se adapta a otro proyecto o marca editando un solo archivo. Este sitio está
hecho con ella, y la misma plantilla, sin copiarla, compila la documentación de cualquier otro proyecto.

El paquete es privado: no se publica en npm. Se usa desde una copia de este repositorio.

## El estándar

### Áreas

| Área | Para quién | Contenido |
|---|---|---|
| `users` | Quien usa el producto | Instalación, guías, buenas prácticas |
| `agents` | Agentes de IA | Reglas, patrones y verificación |
| `development` | Quien lo mantiene | Arquitectura, contratos, pruebas |
| `package` | Quien publica | Versionado, publicación, gobierno de versiones |
| `investigations` | Quien decide | Análisis previos y decisiones de arquitectura |

Cada área es una subcarpeta de la documentación. Solo aparecen en el sitio las que se declaran en la
configuración y existen.

### Reglas de escritura

- Un documento responde una pregunta. El título la enuncia.
- Prefijo numérico de dos dígitos para el orden de lectura; `README.md` es la portada del área.
- Lo que no se ha comprobado se dice, en una sección propia y con naturalidad.
- Lo que deja de estar vigente pasa a una sección de archivo; no se borra en silencio.
- Las fuentes externas que sostienen una decisión se citan con su URL.

### Voz

La documentación la firma quien mantiene el proyecto, y se nota:

| Qué se escribe | Cómo |
|---|---|
| Una decisión o una opinión | En primera persona: «Elegí X porque…», «Probé Y y lo descarté» |
| Referencia e instrucciones | Impersonal y directa: «Se importa…», «El comando falla si…» |
| Una investigación | Como notas propias: qué me planteé, qué comparé, qué medí, qué decidí y qué descarté |
| Lo que no se sabe | Sin rodeos: «No lo he probado en Safari real» |

Sin relleno, sin entusiasmo impostado y sin frases de marketing. Tablas para los datos enumerables y prosa
para el razonamiento. Los ejemplos de código llevan la interfaz en inglés.

## La plantilla

### Usarla

```
pnpm --filter @zuccadev-labs/zuix-zudocs start    # desarrollo
pnpm --filter @zuccadev-labs/zuix-zudocs build    # verifica y genera el sitio estático en zudocs/build
pnpm --filter @zuccadev-labs/zuix-zudocs verify   # configuración, áreas, documentos, enlaces, anclas e imágenes
pnpm --filter @zuccadev-labs/zuix-zudocs new -- guia users "Cómo cambiar de marca"   # documento nuevo desde plantilla
```

| Comando | Qué hace |
|---|---|
| `build [--out-dir <ruta>] [--strict] [--headers]` | Verifica, genera `llms.txt` y `robots.txt` y compila el sitio |
| `start [--port <n>] [--host <h>]` | Servidor de desarrollo |
| `serve [--out-dir <ruta>] [--port <n>]` | Sirve el sitio ya compilado |
| `verify [--strict]` | Comprueba la configuración y la documentación sin compilar |
| `new <tipo> <area> "<título>" ["<descripción>"]` | Documento nuevo desde una plantilla |
| `llms` | Solo regenera `llms.txt`, `llms-full.txt` y `robots.txt` |
| `headers [--out-dir <ruta>]` | Escribe `_headers` (política de contenido y caché) en el sitio compilado |
| `info` | Muestra las rutas y la URL que usará el proyecto |

Códigos de salida: 0 correcto, 1 fallo de verificación o de compilación, 2 uso incorrecto. Una opción mal
escrita o un `--config` sin valor son un error de uso, no se ignoran.

### Usarla en otro proyecto

La plantilla no se copia. El proyecto solo aporta un `zudocs.config.json` y su carpeta de documentación;
los comandos se ejecutan desde zuix apuntando a esa configuración.

```
# desde la raíz de zuix
pnpm --filter @zuccadev-labs/zuix-zudocs build  -- --config <ruta al proyecto>/zudocs.config.json
pnpm --filter @zuccadev-labs/zuix-zudocs start  -- --config <ruta al proyecto>/zudocs.config.json
pnpm --filter @zuccadev-labs/zuix-zudocs verify -- --config <ruta al proyecto>/zudocs.config.json
pnpm --filter @zuccadev-labs/zuix-zudocs new    -- --config <ruta al proyecto>/zudocs.config.json guia users "Título"
```

Formas equivalentes:

| Forma | Ejemplo |
|---|---|
| Variable de entorno | `ZUDOCS_CONFIG=<ruta>/zudocs.config.json pnpm --filter @zuccadev-labs/zuix-zudocs build` |
| El bin, desde cualquier carpeta | `node <ruta a zuix>/zudocs/bin/zudocs.mjs build --config ./zudocs.config.json` |
| El bin, dentro de la carpeta del proyecto | `node <ruta a zuix>/zudocs/bin/zudocs.mjs build` (usa el `zudocs.config.json` de la carpeta actual) |

La configuración se busca en este orden: `--config`, `ZUDOCS_CONFIG`, `zudocs.config.json` de la carpeta
desde la que se llama y, si no hay ninguna, la del sitio de zuix. Una ruta relativa se resuelve desde la
carpeta de llamada.

Qué va en cada sitio:

| Qué | Dónde | Notas |
|---|---|---|
| Documentación | `docs.path`, relativa a la configuración | Solo se escribe en ella con `new` |
| Logo e imágenes | `static` (por defecto `static/` junto a la configuración) | `logo.src` es una ruta dentro de esa carpeta |
| Sitio compilado | `outDir` (por defecto `build/` junto a la configuración) | `--out-dir <ruta>` lo cambia para una ejecución |
| Caché y archivos generados | `zudocs/.zudocs/<nombre>-<hash>/` dentro de zuix | Una carpeta por proyecto: no se pisan entre sí ni con el sitio de zuix |
| Marca | `tokens/brands/<marca>.json` en zuix | La marca se crea en zuix; ver [Cambiar de marca](../agents/01-marca.md) |

Dos proyectos se pueden compilar a la vez. El proyecto no necesita Node ni dependencias propias: las pone
zuix. Funciona también si el proyecto declara `"type": "module"` o si su ruta tiene espacios.

La compilación vacía la carpeta de salida antes de escribir, así que la plantilla se niega a usar una que no
sea segura: la raíz del sistema, la carpeta personal, una que contenga la documentación, la configuración,
los estáticos o la propia plantilla, o una carpeta con contenido que no parezca un sitio compilado.

### Adaptarla

Todo sale de `zudocs.config.json`, que tiene esquema (`zudocs/zudocs.schema.json`). La configuración se
valida al cargar, en todos los comandos: un campo desconocido es un error con sugerencia y un JSON inválido
se señala con su número de línea. El del sitio de zuix:

```json
{
  "$schema": "./zudocs.schema.json",
  "name": "Zuix",
  "brand": "dazlabs",
  "defaultTheme": "dark",
  "locale": "es",
  "url": "https://zuccadev-labs.github.io",
  "baseUrl": "/zuix/",
  "logo": { "src": "img/logo.svg" },
  "fonts": ["src/fonts/fonts.css"],
  "image": "img/social-card.png",
  "docs": {
    "path": "../docs",
    "areas": [{ "id": "users", "label": "Uso", "icon": "book", "description": "Qué es cada paquete y cómo se usa." }]
  },
  "pages": { "components": true, "icons": true, "tokens": true },
  "home": { "eyebrow": "Suite de UI/UX · marca {brand}", "title": "Un estándar.", "emphasis": "Cualquier marca.", "suite": true },
  "llms": { "append": "llms.append.md" },
  "search": { "enabled": true, "languages": ["es", "en"] },
  "navbar": [{ "label": "Componentes", "to": "/components" }]
}
```

Las rutas (`docs.path`, `static`, `outDir`, `llms.append`, las hojas locales de `fonts`) son relativas al
archivo de configuración. La tabla de campos está en [Documentar con zudocs](../agents/03-documentacion.md).

`pages` activa las páginas de catálogo de la suite (componentes, iconos y tokens). Están desactivadas por
defecto: un proyecto que solo documenta no las declara y el sitio no las genera. `home.suite` hace lo
mismo con las cifras y el carrusel de la portada. Sin `home`, la portada muestra el nombre, la frase y
las áreas.

Cambiar `brand` cambia colores, material y fuentes de todo el sitio. No se toca `docusaurus.config.ts` ni el
CSS del tema. `fonts` va con la marca: si no se actualiza, el sitio usa la fuente de reserva de la marca
nueva. Es el mismo modelo que usa Mintlify con su `docs.json`.

### Publicarlo

`url` y `baseUrl` dicen dónde vivirá el sitio; con ellos se escriben las canónicas, el sitemap, `robots.txt`
y los enlaces de `llms.txt`. `ZUDOCS_URL` y `ZUDOCS_BASE_URL` los sustituyen en una ejecución. Sin `url`,
`verify` avisa y el sitio se compila con `https://example.com`.

`trailingSlash` vale `false` por defecto: genera `docs/guia.html` y sirve `/docs/guia` sin redirección en
GitHub Pages y en cualquier alojamiento estático.

El sitio de zuix se publica en GitHub Pages (<https://zuccadev-labs.github.io/zuix/>) con el workflow
`pages`: compila con `--strict`, recorre el sitio compilado y lo despliega
([CI y cadena de suministro](../development/03-ci-y-cadena-de-suministro.md)).

### Plantillas de página

`zudocs/templates/` tiene una plantilla por tipo de documento, con sus secciones y un comentario que
explica qué va en cada una. `new` copia la plantilla al área, con el siguiente prefijo numérico.

| Tipo | Para qué |
|---|---|
| `tutorial` | Lección guiada para quien empieza |
| `guia` | Resolver una tarea concreta |
| `referencia` | Consultar campos, props u opciones |
| `explicacion` | Entender un concepto o un diseño |
| `adr` | Registrar una decisión de arquitectura |
| `investigacion` | Analizar antes de decidir |
| `notas-de-version` | Contar qué cambia al actualizar |
| `agente` | Guía para agentes: reglas → patrones → verificación |

### Fuentes

Las fuentes del sitio de zuix están autoalojadas (`zudocs/src/fonts/`, diez archivos `woff2` con licencia
OFL): ninguna visita hace una petición a un tercero, y eso permite además una política de contenido
estricta. Para otro proyecto hay dos caminos:

- **A mano.** Descarga los `.woff2` de la fuente oficial de la tipografía (su repositorio o la página de su
  autor), guárdalos junto a la configuración con el archivo de licencia y escribe una hoja con un `@font-face`
  por archivo, con `src: url("./archivo.woff2") format("woff2")`. `zudocs/src/fonts/fonts.css` sirve de
  modelo.
- **Con un paquete [`@fontsource/*`](https://fontsource.org/).** `pnpm add -D @fontsource/inter` trae los
  archivos y sus hojas por el gestor de paquetes: con la integridad anotada en el lockfile y sujeto a las
  políticas de `pnpm-workspace.yaml` (antigüedad mínima, procedencia, sin scripts de instalación). La hoja
  local es la del paquete, por ejemplo `node_modules/@fontsource/inter/latin-400.css`.

En los dos casos se declara la hoja en `fonts`, con la ruta relativa a la configuración:

```json
{ "fonts": ["fonts/fonts.css"] }
```

Una hoja local se empaqueta con el sitio y sus `url()` relativas se resuelven desde la carpeta de la hoja.
Una URL remota en `fonts` sigue funcionando, pero `verify` avisa.

Quité el descargador (`zudocs fonts`) antes de publicarlo. Bajaba una hoja de Google Fonts y sus archivos y
los escribía en el repositorio: un comando que trae archivos de internet y los deja versionados es justo lo
que las políticas de dependencias de este proyecto evitan, y ninguna validación cambia eso. Las fuentes
entran como cualquier otra dependencia, revisadas a mano o por el gestor de paquetes. Ningún comando de
zudocs usa la red.

### Buscador

Búsqueda local, sin servicio externo: el índice se genera en el build y se consulta en el navegador.
Está en la barra superior (`Ctrl K`) y tiene página de resultados en `/search`. Se configura con
`search` en `zudocs.config.json`; `languages` fija los idiomas del índice. Solo funciona en el sitio
compilado (`build`), no en `start`.

El buscador no pliega tildes: «documentacion» no encuentra «documentación». Es una limitación del índice
que usa (lunr) y el plugin no ofrece la opción.

### Mapa para modelos: `llms.txt`

Cada build regenera tres cosas, con el formato de [llmstxt.org](https://llmstxt.org/):

| Archivo | Contenido |
|---|---|
| `llms.txt` | Mapa de la documentación: una sección por área, la portada primero, cada documento con su URL absoluta y su primera frase |
| `llms-full.txt` | Toda la documentación en un archivo. Se desactiva con `llms.full: false` |
| `<ruta>.md` | Copia en Markdown de cada documento junto a su página |

`llms.append` añade un archivo propio al final de `llms.txt`. El de zuix está versionado en
`zudocs/static/llms.txt`; lo regeneran `build` y `llms`, y el cambio se incluye en el mismo commit que la
documentación.

### Documentos escritos por terceros

Un `.mdx` es código: se ejecuta al compilar y en el navegador. Un `.md` no evalúa JSX, pero su HTML llega
tal cual a la página, de modo que un `<script>` escrito en un documento se ejecutaría en el navegador del
visitante. Para contribuciones externas o contenido importado:

```json
{ "markdown": { "untrusted": true } }
```

Con el campo activo, `verify` rechaza los `.mdx` y el HTML activo en los `.md` (`script`, `iframe`, `object`,
`embed`, `style`, `link`, `meta`, `base`, `form` y atributos `on*`). Sin él, ese HTML es un aviso.

`build --headers` (o `zudocs headers` después de compilar) escribe un archivo `_headers` con una política de
seguridad de contenido que autoriza por su hash solo los scripts en línea de la plantilla, además de las
cabeceras de caché. Tiene el formato de Netlify y Cloudflare Pages y sirve de referencia para otro servidor.
GitHub Pages no aplica cabeceras propias: allí el archivo no tiene efecto.

### Diagramas

Los diagramas se escriben con [Mermaid](https://mermaid.js.org) en un bloque de código, y son opcionales:

```json
{ "markdown": { "mermaid": true } }
```

Con el campo activo, cada bloque <code>```mermaid</code> se dibuja en el navegador. Desactivado (por
defecto), el bloque se ve como código y el sitio no carga Mermaid: el sitio de zuix no lo usa.

Los colores salen de los tokens de la marca, en claro y en oscuro, y se leen del documento en el navegador:
cambiar de marca o de modo redibuja el diagrama. El mapa está en `zudocs/src/mermaid/tokens.ts`. Un diagrama
mal escrito no rompe el build: la página muestra el error de Mermaid en su lugar.

### Qué incluye

| Página | Contenido |
|---|---|
| Portada | Presentación y áreas; con `home.suite`, las cifras de la suite y el Carousel |
| Documentación | Una sección por área, con sidebar generada desde la carpeta y la portada del área en primer lugar |
| [Componentes](/components) | Catálogo en vivo de `zui` y `zout`, generado desde los manifiestos. Opcional: `pages.components` |
| [Iconos](/icons) | Buscador de `zicon` por forma o concepto. Opcional: `pages.icons` |
| [Tokens](/tokens) | Tokens de la marca activa, en vivo. Opcional: `pages.tokens` |
| Buscador | Índice local de toda la documentación |
| `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt` | Generados en cada build |

### Estilo

- Tokens de la suite aplicados sobre las variables del tema de Docusaurus.
- Cristal en navbar, sidebar, índice y tarjetas.
- Artículo sobre superficie opaca, para que el texto largo se lea bien.
- Temas claro y oscuro, estilos de impresión, `prefers-reduced-motion` y `forced-colors`.
- En archivos `.mdx`, los componentes de `zui`, `zout` y `zicon` están disponibles sin importarlos.
- El paquete común del sitio solo registra los iconos que el sitio puede dibujar; las páginas de iconos y de
  componentes cargan el set completo.

### Base técnica

Docusaurus 3.10.2 con `future.v4` y `future.faster` activados, React 19. Los `.md` se leen como
Markdown normal y los `.mdx` como MDX. No usa Tailwind: `zui` es CSS plano sobre tokens, así que no hay
conflicto con el tema clásico. Por qué Docusaurus y qué medí en el sitio:
[Zudocs: Docusaurus y estándar documental](../investigations/05-zudocs-docusaurus.md) y
[El sitio de documentación, medido](../investigations/12-el-sitio-medido.md).

## Migrar documentación existente

1. Clasificar cada documento en un área.
2. Renombrar según la convención.
3. Mover lo no vigente a archivo.
4. Escribir el `zudocs.config.json` del proyecto y apuntar `docs.path` a la carpeta.
5. Ejecutar `verify` y `build` con `--config`.

Lo probé con la documentación de Zenith, en un piloto que vive solo en mi máquina: Zenith es un repositorio
privado y el piloto no se versiona aquí. De él salió la marca `zenith` de los tokens.

## Lo que no he comprobado

- El despliegue en GitHub Pages lo verifiqué sirviendo el sitio compilado bajo `/zuix/` en local, no en el
  alojamiento real.
- El rendimiento del desenfoque en hardware real: las mediciones son de Lighthouse en móvil simulado.
- Safari real y lectores de pantalla. El sitio se recorre en Chromium, Firefox y el WebKit de Playwright.
- `prefers-reduced-transparency` solo se puede emular en Chromium.
- Un sitio con `locale: "en"` muestra en español los textos de las páginas propias (portada y catálogos):
  todavía no están traducidos.
- Usar el bin desde un proyecto que instale `@zuccadev-labs/zuix-zudocs` como dependencia publicada: el
  paquete no está publicado.
- El camino de `@fontsource/*` en un sitio real: las fuentes de zuix están copiadas a mano.
