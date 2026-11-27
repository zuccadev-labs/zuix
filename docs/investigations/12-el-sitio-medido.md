# El sitio de documentación, medido

zudocs lo había tratado como una plantilla que funcionaba: compilaba y no tenía enlaces rotos. Antes de la
`0.2.0` lo revisé como lo que es, un producto que va a ejecutar la documentación de otros proyectos. Estas
son las notas de esa revisión, del 16 y 17 de noviembre de 2026. Las fuentes que contrasté: la
[documentación de Docusaurus](https://docusaurus.io/docs/api/docusaurus-config) 3.10.2,
[llmstxt.org](https://llmstxt.org/) y el código instalado de Docusaurus y del buscador.

## Lo grave

Tres cosas que no eran de aspecto.

| Qué encontré | Por qué importaba | Qué hice |
|---|---|---|
| `build` borraba la carpeta de salida sin comprobar cuál era. Con `outDir: "."` vaciaba el proyecto | Es un comando que ejecuto sobre proyectos ajenos | La plantilla se niega a usar una carpeta de salida que no sea segura: la raíz, la carpeta personal, una que contenga la documentación, la configuración, los estáticos o la plantilla, o una con contenido que no parezca un sitio compilado |
| `--config` sin valor compilaba en silencio el sitio de zuix en vez del pedido, y una opción mal escrita (`--strcit`) se ignoraba: la verificación pasaba sin modo estricto | Un error de tecleo daba un resultado verde | Cada comando declara sus opciones; lo demás es un error de uso, con código de salida 2 |
| Las casillas de las listas de tareas no tenían nombre accesible | axe lo marca como crítico | Reciben una etiqueta |

## La configuración

La configuración solo se validaba en `verify`, no al compilar, y el validador no aplicaba todo el esquema.
`brand` entraba sin filtrar en una ruta de archivo, y el identificador de un área, en rutas del sitio.

Ahora se valida al cargar, en todos los comandos, y el esquema tiene patrones para los campos que acaban en
una ruta o en una URL. Un campo desconocido es un error con sugerencia. Lo decidí así porque la configuración
la va a editar un agente, y un agente que se inventa un campo necesita que alguien se lo diga.

## Contenido que no escribo yo

Un `<script>` escrito en un `.md` llegaba tal cual al HTML y se ejecutaba en el navegador: el modo en que
Docusaurus lee los `.md` no sanea HTML. Para mi documentación no es un problema; para una plantilla que
compila la documentación de un tercero, sí.

Dos medidas, que se complementan:

- `markdown.untrusted`: `verify` rechaza los `.mdx`, que son código, y el HTML activo en los `.md`.
- `zudocs headers`: una política de seguridad de contenido que autoriza por su hash solo los scripts en línea
  que aparecen en todas las páginas, que son los de la plantilla. Uno que aparece solo en algunas viene del
  contenido y queda bloqueado. Comprobé con un documento hostil que el script no se ejecuta.

La segunda tiene un límite: GitHub Pages no aplica cabeceras propias. Allí solo vale la primera.

## Fuentes de terceros

Cada visita pedía la hoja y cinco archivos a Google Fonts. Eso es tres problemas a la vez: la dirección IP del
visitante llega a un tercero, la petición bloquea el pintado y obliga a abrir la política de contenido a otro
origen.

Las del sitio de zuix están autoalojadas: diez `woff2`, 173 kB, con licencia OFL, y `fonts` admite una hoja
local. Una URL remota sigue funcionando, con aviso.

Para bajarlas escribí un comando, `zudocs fonts`, que descargaba la hoja y sus archivos y escribía una hoja
local. Lo quité antes de publicarlo: un comando que trae archivos de internet y los escribe en el repositorio
es lo que las políticas de dependencias del proyecto evitan, y el análisis estático lo señalaba con razón
(una URL de la configuración llega a una petición, y lo descargado llega al disco). Las fuentes se autoalojan
a mano o con un paquete `@fontsource/*` ([Zudocs](../users/05-zudocs.md#fuentes)).

De paso encontré que las fuentes de menos de 10 kB se incrustaban en el CSS como `data:`, 73 kB más de CSS
bloqueante. Bajé ese límite.

## Peso

El paquete común del sitio llevaba los 346 iconos en sus dos variantes: 1.189 kB (340 kB con gzip) en todas
las páginas, para dibujar unos cuarenta. Ahora el paquete común registra solo los iconos que el sitio puede
dibujar, y las páginas de iconos y de componentes cargan el set completo. Quedó en 624 kB (196 kB con gzip).

Medidas con Lighthouse 13.6, en móvil simulado, sobre el sitio compilado y servido en estático con gzip:

| Página | Antes: rendimiento · LCP · TBT · JS | Después: rendimiento · LCP · TBT · JS |
|---|---|---|
| Portada | 91 · 1,6 s · 340 ms · 397 kB | 99 · 0,9 s · 150 ms · 260 kB |
| Un documento de uso | 93 · 1,6 s · 310 ms · 378 kB | 95 · 0,9 s · 250 ms · 237 kB |
| Un documento de investigación | 95 · 1,6 s · 230 ms · 373 kB | 99 · 0,9 s · 140 ms · 233 kB |
| Componentes | 78 · 1,8 s · 880 ms · 459 kB | 76 · 1,1 s · 1.210 ms · 421 kB |
| Iconos | 88 · 2,2 s · 360 ms · 371 kB | 92 · 1,5 s · 340 ms · 346 kB |
| Tokens | 90 · 1,6 s · 380 ms · 339 kB | 99 · 0,9 s · 130 ms · 200 kB |

El desplazamiento acumulado del diseño es 0 en todas, antes y después. Una primera tanda de medidas "antes"
la hice mientras corría otra suite de pruebas y dio entre 55 y 84 de rendimiento: la descarté por ruido.

La página de componentes no mejora: hidrata más de setenta demostraciones a la vez y su tiempo de bloqueo en
móvil simulado ronda 1,2 s. Arreglarlo exige cargar el catálogo por grupos, que es cambiar la página. No es
una regresión y lo dejé para después.

## Accesibilidad y medios

| Qué encontré | Qué hice |
|---|---|
| Texto con el color de acento por debajo de 4,5:1 en migas, paginación, enlaces e índice (de 3,76 a 3,96:1) | El token nuevo `--z-accent-text` |
| El tema claro del código con comentarios, cadenas y etiquetas entre 2,47 y 4,14:1 | Un tema claro propio con esos colores oscurecidos |
| Sin estilos de impresión: página oscura y con el cromo visible | Estilos de impresión |
| Sin `prefers-reduced-motion` ni `forced-colors` fuera de los componentes | Añadidos a la hoja del sitio |
| La etiqueta del buscador fija en inglés y la página de resultados sin región principal | Envolví los dos componentes del buscador |
| El logo con un texto alternativo igual al título contiguo, que se leía dos veces | Texto alternativo vacío por defecto |

La puntuación de accesibilidad de Lighthouse en los documentos pasó de 97 a 100. Vale lo que vale una
auditoría automática.

## Lo que ven los buscadores y los modelos

- El sitio se compilaba con un dominio inexistente: canónicas, sitemap y Open Graph apuntaban a él. Ahora
  `url` y `baseUrl` son campos de la configuración, hay imagen para compartir y se genera `robots.txt`.
- Sin `trailingSlash` fijado, en GitHub Pages cada página interior redirigía y la canónica no coincidía. El
  valor por defecto es `false`.
- `llms.txt` tenía rutas relativas, resúmenes cortados a mitad de palabra y la portada de cada área al final.
  Lo reescribí conforme a [llmstxt.org](https://llmstxt.org/): URL absolutas, la primera frase completa de
  cada documento y la portada primero. Añadí `llms-full.txt` y una copia `.md` de cada documento.

## Verificación

`verify` no veía anclas rotas, front matter inválido, imágenes inexistentes, rutas duplicadas, documentos
fuera de área, títulos repetidos ni marcadores de plantilla sin rellenar. Ahora sí. Lo probé con los
documentos de zuix y con los de mi piloto local, sin falsos positivos.

Y escribí una prueba del sitio compilado (`pnpm test:site`): sirve el sitio bajo su `baseUrl` con la política
de contenido activa y recorre todas las páginas del sitemap en dos temas y tres anchos, en tres motores.

## Rutas de la máquina en el sitio compilado

El 26 de noviembre me llegó un informe: compilando un proyecto con su configuración en `site/` y
`docs.path: "../docs"`, los `.js` del sitio llevaban `"source":"@site/../../../../media/<usuario>/…/docs/…"`.
`verify` no lo veía, y quien publicara ese sitio publicaba la ruta del disco de quien lo compiló: su nombre de
usuario y el nombre de sus proyectos, que pueden ser privados.

Lo reproduje con un proyecto en una carpeta temporal y busqué en todo `build/` las rutas de la máquina. Había
más de lo que decía el informe:

| Dónde | Qué llevaba | En qué sitios |
|---|---|---|
| `main.js`, la configuración del sitio | Docusaurus copia la configuración entera en el paquete del navegador, con las opciones de presets y temas (`docs.path`, `customCss`, `docsDir` del buscador), los módulos de cliente y las carpetas de estáticos | Todos, también el de zuix: rutas absolutas de la plantilla |
| Los datos de cada documento (`source`) y el registro de rutas | La ruta del documento relativa a la plantilla, que fuera de zuix sube hasta la raíz y baja por la del proyecto | Proyectos con la documentación fuera de zuix: 3 de 3 documentos |
| El registro de rutas | La ruta absoluta de la página de componente y de sus datos, una por componente | Los que activan `pages.components`, como el de zuix |

El sitio de zuix publicado en GitHub Pages llevaba así la ruta del runner, que no dice nada; compilado en mi
máquina, la mía. `llms.txt`, `llms-full.txt`, las copias `.md`, el `sitemap` y el índice del buscador estaban
limpios, y el sitio no tiene «Editar esta página»: zudocs no configura `editUrl`.

Lo arreglé en cada origen:

- La copia de la configuración que llega al navegador pasa por un cargador propio
  (`scripts/client-config-loader.cjs`) que vacía presets, plugins, temas, módulos de cliente y estáticos. El
  navegador no los usa; lo comprobé en el código de cliente de Docusaurus, del tema y del buscador. La
  configuración con la que compila Node no cambia. De `zudocs.config.json` solo llegan los campos que usa el
  tema, sin `docs.path`, `static`, `outDir`, `fonts` ni `llms.append`.
- La documentación de otro proyecto se compila desde una copia en su carpeta de trabajo, dentro de la
  plantilla: `"source":"@site/.zudocs/<nombre>-<hash>/docs/…"`. El hash sale de la ruta de la configuración y
  no se puede invertir; solo confirmaría una ruta que alguien ya supiera.
- Las páginas de componente se registran con alias (`@site/…`, `@generated/…`), como hacen los plugins de
  Docusaurus. A este lo encontró la salvaguarda del punto siguiente, no yo.

Descarté dos caminos. Un enlace simbólico a la documentación dentro de la plantilla no basta: el empaquetador
resuelve el enlace a la ruta real y la regla de Markdown de Docusaurus deja de reconocer los archivos; para
evitarlo habría que desactivar la resolución de enlaces en todo el empaquetado, y con pnpm, que instala con
enlaces, eso puede cargar dos copias de React. No lo probé: lo descarté antes.
Reescribir las rutas en el sitio ya compilado funciona, pero tapa el síntoma: cada plugin nuevo podría traer
otra forma de ruta. Prefiero que no se generen y que una comprobación falle si aparece una.

La copia tiene un precio: lo que un documento referencie fuera de su carpeta no está en ella. `verify` rechaza
ahora una imagen relativa que sale de la documentación, y un `.mdx` no puede importar archivos de fuera.
`start` lee la carpeta original, para que los cambios se vean al guardar; el servidor de desarrollo no publica
nada.

La salvaguarda: `build` recorre todos los archivos del sitio compilado y falla si alguno lleva la ruta de la
carpeta personal, la de trabajo, la de llamada, la plantilla, el repositorio o las del proyecto, tal cual,
con barras normales o escapada en JSON. El error nombra el archivo, y en otro proyecto el sitio no llega a la
carpeta de salida. `verify` hace lo mismo con un sitio ya compilado. No busca rutas de menos de dos niveles
(`/tmp`, `/root`): saldrían en cualquier texto. `pnpm test:site` compila un proyecto externo, con la
documentación fuera de su configuración, estáticos, una fuente local y espacios en la ruta, y comprueba que no
lleva ninguna ruta, que el buscador encuentra una palabra suya, que `llms.txt` y las copias `.md` están, que el
enlace con ancla se resuelve y que `verify` falla si se le mete una ruta en un archivo. Comprobé a mano que un
enlace y un ancla rotos siguen deteniendo el build.

## Lo que dejé sin arreglar

| Qué | Por qué |
|---|---|
| El buscador no encuentra «documentacion» sin tilde | El índice (lunr) no pliega diacríticos y el plugin no ofrece la opción |
| La página de componentes hidrata todo a la vez | Exige rehacer la página |
| Los textos de la portada y de los catálogos solo están en español | Un sitio con `locale: "en"` los muestra en español; falta traducirlos |
| La política de contenido no se aplica en GitHub Pages | El alojamiento no admite cabeceras propias |
| `robots.txt` bajo `/zuix/` | Los buscadores solo lo leen en la raíz del dominio |
| El icono de la pestaña solo existe en SVG | Sin `.ico` ni icono para iOS |
| Un `.mdx` de otro proyecto no puede importar archivos de fuera de su documentación | Se compila desde una copia de esa carpeta |

## Lo que no he comprobado

- El despliegue real en GitHub Pages. Compilé y recorrí el sitio servido bajo `/zuix/` en local.
- El rendimiento del desenfoque en hardware real: Lighthouse corre en un Chrome sin GPU y en móvil simulado.
- `prefers-reduced-transparency` fuera de Chromium.
- Safari real y lectores de pantalla.
