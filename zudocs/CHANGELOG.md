# Cambios de @zuccadev-labs/zuix-zudocs

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

zudocs es un paquete privado: no se publica en npm y se usa desde una copia del repositorio. Sus cambios se
anotan aquí por versión de la suite: `pnpm bump` cierra esta sección y sube su versión con las demás.

## [Sin publicar]

### Añadido

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

- Auditoría visual del sitio:
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
