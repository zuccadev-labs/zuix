# Cambios de @zuccadev-labs/zuix-zudocs

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

zudocs es un paquete privado: no se publica en npm y se usa desde una copia del repositorio. Sus cambios se
anotan aquí por versión de la suite: `pnpm bump` cierra esta sección y sube su versión con las demás.

## [Sin publicar]

### Añadido

- Páginas del catálogo para `ScatterChart`, `RadarChart`, `ComboChart`, `HeatmapChart`, `BulletChart`,
  `CategoryBar` y `AnimatedNumber`, con su vista previa sin framework, y `llms.txt` al día.

## [0.4.0] - 2026-11-23

### Añadido

- `/carousels`: galería de carruseles en vivo (Prisma y coverflow, layouts de Material 3, pantalla completa con
  parallax o fundido, mazo, rueda, `Stories`, `Gallery` con visor y dos recetas: logos en marquesina y testimonios).
  Se activa con `pages.carousels` y va en la navegación de referencia.
- `/loaders` enseña los ocho patrones de `Skeleton` dentro de un `SkeletonGroup`.
- Ilustraciones SVG propias en `static/img/carousel/` para las demos.
- Vista previa en vivo de todos los ejemplos de las páginas de componente. Los que no tienen marcado estático en
  `html.json` (necesitan datos, estado o una capa por portal) llevan su demo de React en `ComponentPage/examples/`:
  Carousel, Gallery, Lightbox, Stories, Calendar, DataTable, NodeCanvas, Shell, las capas (con su disparador a la
  vista) y otros 40 componentes. Un ejemplo sin vista previa detiene el build con su nombre, y `pnpm test:site`
  comprueba cada ejemplo de cada página.

### Cambiado

- La portada sustituye la tira con lente por Prisma: una pieza de la suite por slide, con una composición en vivo de
  los componentes reales, pase automático con progreso y botón de pausa. Sube justo debajo del titular.
- Grupos «Tiempo» y «Terminal y código» en el catálogo de componentes, con su icono.
- El escenario de la vista previa se ajusta a su contenido (alto mínimo de 160 px en lugar de 380): una pieza pequeña
  ya no queda perdida en el centro. IconButton, Toggle, CopyButton y Swap enseñan sus variantes y tamaños arriba.

### Corregido

- La página de `DataTable` daba un error de hidratación (React #418) cuando el sitio se compilaba con una
  configuración regional distinta de la del navegador: la fecha de «Ordenable» se formateaba con la del entorno. El
  ejemplo la formatea con `en-US` y UTC.
- A 390 px la vista previa de `Stories` cortaba el visor (551 px de alto en un escenario de 256) y no se veían sus
  controles. El escenario apila en columna con `flex-wrap: wrap`, y en una columna de varias líneas el navegador mide
  la altura de cada pieza con su ancho ajustado al contenido; el visor 9:16 se medía con 118 px de ancho. En el
  teléfono la columna va ahora en una sola línea.
- Navegación: el nombre de un grupo («Dashboard y tableros») pasa a dos líneas antes de cortarse con elipsis.
- Navegación lateral e índice de la página: más altos que la ventana, difuminan el borde con entradas ocultas en vez
  de cortar una a media altura.
- Navegación lateral: con un grupo de nombre largo en dos líneas («Dashboard y tableros») el icono iba entre las
  dos líneas; ahora sigue a la primera, y el contador y el chevrón quedan al centro de la fila.

## [0.3.0] - 2026-11-21

### Añadido

- Grupo «Medios» en el catálogo (QRCode, CompareSlider, ImageCropper, SignaturePad) y vistas previas de React de
  ColorPicker y ColorPickerTrigger.
- Galerías `/loaders` (Spinner con sus formas y los 12 patrones de DotMatrix con tamaño, tono, rejilla y baldosa, y
  código para copiar) y `/effects` (Backdrop, BorderBeam, Glow, AttentionRing y TextEffect en vivo, con sus
  variantes), con el armazón del sitio. Se activan con `pages.loaders` y `pages.effects` y aparecen en la sección
  Referencia de la barra lateral; «Efectos» va también en la barra superior. Grupo «Efectos» en el índice de
  componentes.
- Una página por componente de `zui` y `zout` (`/components/<grupo>/<componente>`), generada en el build desde
  `manifest.json` y `html.json`: título, entradilla, enlaces (APG, manifiesto, HTML sin React), vista previa en
  vivo sobre el lienzo de la marca, instalación, ejemplos con pestañas Vista previa / Código y conmutador
  React / HTML (el HTML se pinta con `zui/dom`), API, accesibilidad y teclado, tokens y clases, y
  relacionados. Un componente nuevo aparece solo con existir su manifiesto. `/components` pasa a ser el
  índice, con tarjetas por categoría y buscador.
- «Copiar página» en cada documento y página de componente: copia el Markdown de la página (con menú para
  verlo y para copiar el enlace). `llms.txt` lista también los componentes y cada uno tiene su copia `.md`.
- Bloques de instalación con pestañas pnpm, npm, yarn y bun que recuerdan la elección; una orden de
  instalación en un bloque `bash` se convierte sola.
- Campos `repository` y `cta` en `zudocs.config.json`.

### Cambiado

- Tema rehecho con el estándar liquid glass: barra superior flotante en dos barras de cristal, barra lateral
  de cristal con pestañas de sección, grupos plegables, contadores y filtro, artículo sobre superficie de
  lectura con anterior/siguiente, migas, entradilla, fecha y tiempo de lectura, rail «En esta página» con la
  sección visible resaltada, bloques de código con cabecera y portada nueva. Nada del aspecto del tema
  clásico de Docusaurus queda a la vista.
- El buscador local se abre como paleta de cristal (`⌘K` / `Ctrl K` o `/`) en un `<dialog>` modal.
- En pantallas estrechas la navegación va en un cajón (`<dialog>` modal), que se abre desde la barra o desde
  las migas del artículo.
- El código se colorea con los tokens de texto de la marca, los mismos en claro y oscuro; el validador de
  contraste de `@zuccadev-labs/zuix-tokens` mide ahora también la hoja del sitio.
- El sitio deja de cargar Poppins: con la base visual nueva, la marca `dazlabs` usa DM Sans también en los
  titulares. Quedan autoalojadas DM Sans y JetBrains Mono.

### Corregido

- Código en línea de los documentos: una ruta larga parte tras `/`, `.`, `-` o `_`, no dentro de una palabra.
- Tablas de los documentos: el código de una celda no parte palabras («README.m/d» a 390); la tabla se desplaza en
  su marco y el lado con contenido oculto se difumina.
- Las vistas previas HTML ejecutan el script de su ejemplo (el de html.json) tras hidratar: los lienzos del
  carrusel WebGL se pintan (antes salían negros) y el tour, los avisos o el diálogo de confirmación responden.
- Tabla de API de cada componente: si no cabe en su caja, cada prop pasa a una tarjeta (nombre y tipo arriba, valor
  por defecto y descripción debajo); si cabe, sigue siendo tabla. Antes, a 390, el tipo se partía letra a letra
  («str/ing») y la descripción quedaba cortada por el borde. Los tipos y valores largos parten entre piezas (tras
  `<`, `,`, `|`, `:`), nunca dentro de un nombre, y el nombre de la prop es la cabecera de su fila.
- Galería de cargadores: el nombre de cada patrón parte línea en vez de cortarse junto al botón de copiar («Onda
  de es…» a 390).
- Vistas previas: el restablecimiento de estilos del navegador ya no anula el atributo `hidden`; las filas ocultas
  de una `DataTable` paginada se veían todas.
- Aspecto y medidas del sitio:
  - Rellenos, huecos, interlineados y pesos en tokens: tabla de props y de Markdown a 14/20 (antes 13/18 y
    10/18), índice con interlineado `leading-ui` y sangrías de la escala, código en línea con peso regular,
    titular de portada con `text-hero` y `leading-tight`.
  - Los chips (enlaces de la cabecera de componente) usaban Arial: heredan la fuente de la marca. El buscador de la
    barra, el filtro de la barra lateral y los chips pierden el relleno por defecto del navegador.
  - Página de búsqueda: titular con la escala de la suite y campo de 48 px.
  - El enlace de cada diapositiva de la portada mide 24 px de alto (objetivo de WCAG 2.5.8).
  - La 404 dice «Página no encontrada» (el tema traía «Página No Encontrada», con mayúsculas a la inglesa).
  - La búsqueda ya no desborda 2 px a 390 (la fila de Infima salía por los lados) y las casillas de las listas de
    tareas usan un hueco de la escala.
  - Los bloques de código no registran la escucha de `resize` del ajuste de línea del tema (el sitio no muestra
    ese botón): en un teléfono lanzaba «Cannot destructure property 'scrollWidth'» en algunas páginas.
  - Las vistas previas en columna centran un `Calendar` (ahora mide su contenido) en vez de dejarlo a la izquierda.
  - Las cabeceras de las tablas pueden partir línea: con una fuente más ancha la tabla de props desbordaba 3–4 px.
  - La barra lateral centra en su área con desplazamiento la página actual si quedaba fuera o a medias (al final de
    una lista larga).

## [0.2.0] - 2026-11-18

### Cambios incompatibles

- La configuración se valida al cargar, en todos los comandos, y un campo desconocido es un error. Una
  configuración con campos de más que antes pasaba ahora falla, con una sugerencia del campo correcto.
- `brand`, `url`, `baseUrl`, `locale`, `docs.areas[].id`, `logo.src` y los enlaces de `navbar` tienen patrón en
  el esquema.
- Una opción desconocida o un `--config` sin valor son un error de uso (código de salida 2). Antes se
  ignoraban.
- `build` se niega a usar una carpeta de salida que no sea segura: la raíz, la carpeta personal, una que
  contenga la documentación, la configuración, los estáticos o la plantilla, o una con contenido que no
  parezca un sitio compilado.
- `trailingSlash` vale `false` por defecto: las rutas se generan como `docs/guia.html`.
- Enlaces, anclas e imágenes rotos, rutas duplicadas y front matter inválido son errores de `verify`; el
  build falla también con anclas rotas y rutas duplicadas.
- Node 22.12 o posterior.

### Añadido

- Campos de configuración: `url`, `baseUrl`, `locale`, `image`, `favicon`, `trailingSlash`, `llms.full` y
  `markdown.untrusted`. `ZUDOCS_URL` y `ZUDOCS_BASE_URL` sustituyen `url` y `baseUrl` en una ejecución.
- `fonts` admite hojas locales, que se empaquetan con el sitio. Las fuentes se autoalojan a mano o con un
  paquete `@fontsource/*`: zudocs no trae un comando que las descargue.
- `zudocs headers` y `build --headers`: archivo `_headers` con una política de seguridad de contenido que
  autoriza por su hash solo los scripts en línea de la plantilla.
- `markdown.untrusted`: `verify` rechaza los `.mdx` y el HTML activo en los `.md`.
- `llms.txt` conforme a llmstxt.org (URL absolutas, primera frase completa, portada primero), `llms-full.txt`
  y una copia `.md` de cada documento. `zudocs llms` los regenera sin compilar.
- `verify`: anclas, imágenes, front matter, rutas duplicadas, documentos fuera de área, títulos repetidos,
  marcadores de plantilla sin rellenar, imágenes sin texto alternativo e iconos de `.mdx`.
- `robots.txt` generado, imagen para compartir y `og:site_name`.
- Estilos de impresión, `prefers-reduced-motion` y `forced-colors` en la hoja del sitio.
- `--help` y `--version`; `info` muestra la URL pública y las fuentes.

### Cambiado

- Las fuentes del sitio de zuix están autoalojadas: ninguna visita hace una petición a un tercero.
- El paquete común solo registra los iconos que el sitio puede dibujar; las páginas de iconos y de
  componentes cargan el set completo.
- La portada de cada área es la primera de su barra lateral.
- El texto con color de acento y el tema claro del código cumplen 4.5:1.
- La compilación se hace siempre en la carpeta de trabajo de zudocs y se mueve a su destino: funciona dentro
  de un proyecto con `"type": "module"` y con rutas con espacios.
- La plantilla `investigacion` se organiza como notas de quien decide: qué me planteé, qué comparé, qué medí,
  qué decidí y qué descarté.

### Corregido

- Las casillas de las listas de tareas tienen nombre accesible.
- La etiqueta del buscador se traduce y la página de resultados tiene región principal.
- El buscador ya no recupera el foco cuando termina de descargar su índice si para entonces el foco está en
  otro control. Con la red lenta, quien recorría la barra con Tab veía saltar el foco de vuelta al campo de
  búsqueda.
- `start` y `serve` reenvían las señales al servidor: terminar zudocs ya no deja el puerto ocupado.
- `new`: un título con `$&` o con saltos de línea ya no rompe el documento generado.
- Las plantillas `agente` y `tutorial` ya no traen títulos vacíos.
- El logo no repite el nombre del sitio como texto alternativo.

## [0.1.0] - 2026-11-14

Primera versión de la plantilla, publicada con la suite.

### Añadido

- Sitio Docusaurus con el estilo liquid glass sobre los tokens de la suite, adaptable con
  `zudocs.config.json` y su esquema.
- Áreas de documentación, plantillas por tipo de documento y el comando `new`.
- Páginas de catálogo opcionales: componentes, iconos y tokens.
- Buscador local, diagramas Mermaid con los colores de la marca y `llms.txt`.
- Uso desde otro proyecto con `--config`, sin copiar la plantilla.
