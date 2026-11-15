# Zudocs

`@zuccadev-labs/zuix-zudocs` es el estándar de documentación de la suite y su plantilla: un sitio Docusaurus con el
estilo liquid glass, que se adapta a otro proyecto o marca editando un solo archivo. Este sitio está
hecho con ella, y la misma plantilla, sin copiarla, compila la documentación de cualquier otro proyecto.

## El estándar

### Áreas

| Área | Para quién | Contenido |
|---|---|---|
| `users` | Quien usa el producto | Instalación, guías, buenas prácticas |
| `agents` | Agentes de IA | Reglas, patrones y verificación |
| `investigations` | Quien decide | Análisis previos y decisiones de arquitectura |
| `development` | Quien lo mantiene | Arquitectura, contratos, pruebas |
| `package` | Quien publica | Versionado, publicación, gobierno de versiones |

Cada área es una subcarpeta de la documentación. Solo aparecen en el sitio las que existen.

### Reglas de escritura

- Un documento responde una pregunta. El título la enuncia.
- Prefijo numérico de dos dígitos para el orden de lectura; `README.md` es la portada del área.
- Lo que no se verificó se dice.
- Lo que deja de estar vigente pasa a una sección de archivo; no se borra en silencio.

### Voz

Del manual de marca DAZLABS: visionaria, experta, educativa y accesible.

| Sí | No |
|---|---|
| Seguro y preciso | Dubitativo |
| Alentador | Condescendiente |
| Cercano | Elitista o distante |
| Ambicioso | Imprudente |

## La plantilla

### Usarla

```
pnpm --filter @zuccadev-labs/zuix-zudocs start    # desarrollo
pnpm --filter @zuccadev-labs/zuix-zudocs build    # verifica y genera el sitio estático en zudocs/build
pnpm --filter @zuccadev-labs/zuix-zudocs verify   # configuración, áreas, nombres, iconos, marca y enlaces
pnpm --filter @zuccadev-labs/zuix-zudocs new -- guia users "Cómo cambiar de marca"   # documento nuevo desde plantilla
```

### Usarla en otro proyecto

La plantilla no se copia. El proyecto solo aporta un `zudocs.config.json` y su carpeta de documentación;
los comandos se ejecutan desde zuix apuntando a esa configuración.

```
# desde la raíz de zuix
pnpm --filter @zuccadev-labs/zuix-zudocs build  -- --config /ruta/al/proyecto/zudocs.config.json
pnpm --filter @zuccadev-labs/zuix-zudocs start  -- --config /ruta/al/proyecto/zudocs.config.json
pnpm --filter @zuccadev-labs/zuix-zudocs verify -- --config /ruta/al/proyecto/zudocs.config.json
pnpm --filter @zuccadev-labs/zuix-zudocs new    -- --config /ruta/al/proyecto/zudocs.config.json guia users "Título"
pnpm --filter @zuccadev-labs/zuix-zudocs serve  -- --config /ruta/al/proyecto/zudocs.config.json
pnpm --filter @zuccadev-labs/zuix-zudocs info   -- --config /ruta/al/proyecto/zudocs.config.json   # rutas que usará
```

Formas equivalentes:

| Forma | Ejemplo |
|---|---|
| Variable de entorno | `ZUDOCS_CONFIG=/ruta/al/proyecto/zudocs.config.json pnpm --filter @zuccadev-labs/zuix-zudocs build` |
| El bin, desde cualquier carpeta | `node /ruta/a/zuix/zudocs/bin/zudocs.mjs build --config ./zudocs.config.json` |
| El bin, dentro de la carpeta del proyecto | `node /ruta/a/zuix/zudocs/bin/zudocs.mjs build` (usa el `zudocs.config.json` de la carpeta actual) |
| Como dependencia del workspace | `zudocs build` en un script del paquete que dependa de `@zuccadev-labs/zuix-zudocs` |

La configuración se busca en este orden: `--config`, `ZUDOCS_CONFIG`, `zudocs.config.json` de la carpeta
desde la que se llama y, si no hay ninguna, la del sitio de zuix. Una ruta relativa se resuelve desde la
carpeta de llamada.

Qué va en cada sitio:

| Qué | Dónde | Notas |
|---|---|---|
| Documentación | `docs.path`, relativa a la configuración | Solo se escribe en ella con `new` |
| Logo e imágenes | `static` (por defecto `static/` junto a la configuración) | `logo.src` es una ruta dentro de esa carpeta |
| Sitio compilado | `outDir` (por defecto `build/` junto a la configuración) | `--out-dir <ruta>` lo cambia para una ejecución |
| Caché y `llms.txt` generado | `zudocs/.zudocs/<nombre>-<hash>/` dentro de zuix | Una carpeta por proyecto: no se pisan entre sí ni con el sitio de zuix |
| Marca | `tokens/brands/<marca>.json` en zuix | La marca se crea en zuix; ver [Cambiar de marca](../agents/01-marca.md) |

Dos proyectos se pueden compilar a la vez. El proyecto no necesita Node ni dependencias propias: las pone
zuix.

### Adaptarla

Todo sale de `zudocs.config.json`, que tiene esquema (`zudocs/zudocs.schema.json`). El del sitio de zuix:

```json
{
  "$schema": "./zudocs.schema.json",
  "name": "Zuix",
  "brand": "dazlabs",
  "defaultTheme": "dark",
  "logo": { "src": "img/logo.svg" },
  "docs": {
    "path": "../docs",
    "areas": [{ "id": "users", "label": "Uso", "icon": "book" }]
  },
  "pages": { "components": true, "icons": true, "tokens": true },
  "home": { "eyebrow": "Suite de UI/UX · marca {brand}", "title": "Un estándar.", "emphasis": "Cualquier marca.", "suite": true },
  "markdown": { "mermaid": false },
  "search": { "enabled": true, "languages": ["es", "en"] },
  "navbar": [{ "label": "Componentes", "to": "/components" }]
}
```

Las rutas (`docs.path`, `static`, `outDir`, `llms.append`) son relativas al archivo de configuración.

`pages` activa las páginas de catálogo de la suite (componentes, iconos y tokens). Están desactivadas por
defecto: un proyecto que solo documenta no las declara y el sitio no las genera. `home.suite` hace lo
mismo con las cifras y el carrusel de la portada. Sin `home`, la portada muestra el nombre, la frase y
las áreas.

Cambiar `brand` cambia colores, material y fuentes de todo el sitio. No se toca
`docusaurus.config.ts` ni el CSS del tema. `fonts` va con la marca: si no se actualiza, el sitio usa la
fuente de reserva de la marca nueva. Es el mismo modelo que usa Mintlify con su `docs.json`.
Campos y pasos en [Documentar con zudocs](../agents/03-documentacion.md).

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

### Buscador

Búsqueda local, sin servicio externo: el índice se genera en el build y se consulta en el navegador.
Está en la barra superior (`Ctrl K`) y tiene página de resultados en `/search`. Se configura con
`search` en `zudocs.config.json`; `languages` fija los idiomas del índice. Solo funciona en el sitio
compilado (`build`), no en `start`.

### Diagramas

Los diagramas se escriben con [Mermaid](https://mermaid.js.org) en un bloque de código, y son opcionales:

```json
{ "markdown": { "mermaid": true } }
```

Con el campo activo, cada bloque <code>```mermaid</code> se dibuja en el navegador. Desactivado (por
defecto), el bloque se ve como código y el sitio no carga Mermaid: el sitio de zuix no lo usa.

Los colores salen de los tokens de la marca, en claro y en oscuro: nodos con `--z-accent-soft` y borde
`--z-accent`, texto `--z-fg`, líneas `--z-fg-muted`, grupos `--z-surface`, notas `--z-warning-soft` y
fuente `--z-font-sans`. Se leen del documento en el navegador, así que cambiar de marca o de modo
redibuja el diagrama sin tocar nada. El mapa completo está en `zudocs/src/mermaid/tokens.ts`.

Un diagrama mal escrito no rompe el build: la página muestra el error de Mermaid en su lugar.

### Qué incluye

| Página | Contenido |
|---|---|
| Portada | Presentación y áreas; con `home.suite`, las cifras de la suite y el Carousel |
| Documentación | Una sección por área, con sidebar generada desde la carpeta |
| [Componentes](/components) | Catálogo en vivo de `zui` y `zout`, generado desde los manifiestos. Opcional: `pages.components` |
| [Iconos](/icons) | Buscador de `zicon` por forma o concepto. Opcional: `pages.icons` |
| [Tokens](/tokens) | Tokens de la marca activa, en vivo. Opcional: `pages.tokens` |
| Buscador | Índice local de toda la documentación, en español e inglés |
| Diagramas | Bloques Mermaid con los colores de la marca. Opcional: `markdown.mermaid` |
| `llms.txt` | Mapa de la documentación para modelos, regenerado en cada build. `llms.append` le añade un archivo propio |

### Estilo

- Tokens de la suite aplicados sobre las variables del tema de Docusaurus.
- Cristal en navbar, sidebar, índice y tarjetas.
- Artículo sobre superficie opaca, para que el texto largo se lea bien.
- Temas claro y oscuro.
- En archivos `.mdx`, los componentes de `zui`, `zout` y `zicon` están disponibles sin importarlos.

### Base técnica

Docusaurus 3.10.2 con `future.v4` y `future.faster` activados, React 19. Los `.md` se leen como
Markdown normal y los `.mdx` como MDX. No usa Tailwind: `zui` es CSS plano sobre tokens, así que no hay
conflicto con el tema clásico.

## Migrar documentación existente

1. Clasificar cada documento en un área.
2. Renombrar según la convención.
3. Mover lo no vigente a archivo.
4. Escribir el `zudocs.config.json` del proyecto y apuntar `docs.path` a la carpeta.
5. Ejecutar `verify` y `build` con `--config`.

### Piloto: Zenith

Zenith publica su documentación con MkDocs Material (`site/mkdocs.yml` en su repositorio). El piloto
la monta con zudocs **sin tocar el repositorio de Zenith**: una copia de trabajo en
`examples/zenith-docs/`, generada por un script que lee del origen. Esa carpeta no está en el
repositorio público, porque Zenith es privado: existe solo en la máquina donde se hizo el piloto.

```
node examples/zenith-docs/migrate.mjs                # regenera docs/ desde ../Zenith (o --source <ruta>)
pnpm --filter @zuccadev-labs/zuix-zudocs verify -- --config examples/zenith-docs/zudocs.config.json
pnpm --filter @zuccadev-labs/zuix-zudocs build  -- --config examples/zenith-docs/zudocs.config.json
pnpm --filter @zuccadev-labs/zuix-zudocs serve  -- --config examples/zenith-docs/zudocs.config.json
```

| Pieza | Dónde |
|---|---|
| Script de migración, repetible | `examples/zenith-docs/migrate.mjs` (`--self-test` prueba los conversores) |
| Copia migrada | `examples/zenith-docs/docs/` (se borra y se regenera en cada ejecución) |
| Configuración | `examples/zenith-docs/zudocs.config.json` |
| Marca | `tokens/brands/zenith.json`: índigo, Inter y JetBrains Mono, del tema de MkDocs de Zenith |
| Informe de la última ejecución | `examples/zenith-docs/migration-report.json` (no se versiona, como la copia migrada: el repositorio de Zenith es privado) |

Qué hace el script:

| Paso | Resultado (2026-11-14) |
|---|---|
| Clasifica cada documento en un área | 121 documentos: `users` 53, `development` 35, `investigations` 31, `agents` 2 |
| Archiva lo que el `nav` de MkDocs marca como «Archivo (no vigente)» | 51 documentos en `<área>/archivo/` |
| Renombra a `NN-nombre.md`; el documento `00` de una carpeta pasa a `README.md` | 0 avisos de `verify` |
| Añade front matter: `sidebar_label` (título del `nav`), `estado` y `origen` | En todos |
| Reescribe los enlaces relativos a la ruta nueva | 152 |
| Convierte los enlaces que salen de `docs/` en enlaces al repositorio | 9 |
| Convierte avisos `!!!`, plegables `???`, pestañas `===`, teclas `++x++`, iconos y listas de atributos | 0: la documentación de Zenith no usa esa sintaxis. Los conversores se prueban con `--self-test` |
| Sustituye por un marcador lo que parece una credencial | 1: una API key de ejemplo en un ADR |
| Deja intactos los bloques <code>```mermaid</code>; el piloto los dibuja con `markdown.mermaid` | 8 diagramas en dos documentos de arquitectura archivados |
| Copia la referencia Redoc, `openapi.json` y la colección de Postman a `static/reference/` | 3 archivos |

Qué quedó sin convertir:

- **23 enlaces que ya estaban rotos en el origen** (casi todos en el índice antiguo de desarrollo). Quedan
  como texto sin enlace; la lista está en `migration-report.json`.
- **Las pestañas** pasarían a bloques con la etiqueta en negrita, no a un componente de pestañas: los
  documentos son `.md`, no `.mdx`. Zenith no tiene ninguna.
- **`TEMPLATE.md`** de los ADR no se migra: zudocs trae su plantilla de ADR.
- **Los documentos de fuera de `docs/`** (README de cada paquete, `CHANGELOG.md`, `ROADMAP.md`) no se
  migran: se enlazan en el repositorio. El área `package` queda vacía.
- **Las rutas escritas como texto** (nombres de archivo entre comillas invertidas)
  conservan el nombre del origen.

Zenith no tiene manual de marca ni logo. La marca `zenith` sale del tema de su MkDocs y el logo del
piloto es provisional.

## Sin verificar

- El rendimiento del desenfoque en páginas largas y en equipos modestos no se ha medido.
- La revisión en móvil se hizo con capturas a 390 px en Chrome; no se ha probado en dispositivos reales
  ni en Safari.
- El buscador se probó con consultas en español sobre el sitio compilado; no se ha medido el tamaño del
  índice con una documentación grande.
- Los diagramas Mermaid se revisaron en Chrome, en claro y oscuro, en un documento del piloto (diagramas
  de flujo y de secuencia). No se probaron en Firefox ni Safari, ni otros tipos de diagrama (estado,
  clases, Gantt, ER). El primer diagrama de ese documento sale con un nodo vacío porque en el origen un
  grupo y un nodo comparten identificador; el contenido no se corrige en la migración.
- Las fuentes se cargan de Google Fonts; sin red se usa la fuente del sistema.
- Del piloto Zenith se revisó a mano una muestra: portada, quickstart, una página de la referencia de la
  API, un ADR, una portada de área y un documento de arquitectura, a 1440 y 390 px en tema oscuro. Los
  121 documentos compilan sin enlaces rotos, pero no se leyeron uno a uno, ni se revisó el tema claro.
- La referencia Redoc copiada (`/reference/index.html`) carga su script de una CDN; no se abrió en el
  navegador.
- `start` (servidor de desarrollo) con `--config` se arrancó y respondió; no se probó la recarga en
  caliente al editar un documento de otro proyecto.
- Usar el bin desde un proyecto que instale `@zuccadev-labs/zuix-zudocs` como dependencia publicada no se ha probado:
  el paquete no está publicado.
