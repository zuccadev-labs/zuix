# Zicon: extracción de Dazicon

Notas de noviembre de 2026. Los iconos de la suite salen de `Dazicon.fig`, el archivo de Figma del set de
iconos de DAZLABS (4,6 MB). No está en el repositorio: el extractor recibe su ruta como argumento o en la
variable `DAZICON_FIG`. Quería poder regenerar los iconos sin abrir Figma ni depender de su API, así que
empecé por entender el archivo.

## El formato

Un `.fig` es un ZIP con:

- `canvas.fig`: el documento, en formato binario `fig-kiwi` (esquema y datos comprimidos);
- `images/`: las imágenes incrustadas;
- `meta.json` y `thumbnail.png`.

Lo decodifiqué sin Figma: 483 definiciones de esquema, 80.349 nodos y 6.466 blobs de geometría.

## Qué hay dentro

### Páginas

Presentación, Recursos, UX, UI, Prototipado, Responsive, Componentes, Descartes, dos de PDF y "Pruebas de
íconos". Varias están vacías.

### Sets de iconos

En la página "Pruebas de íconos" hay dos marcos, `DAZICON / OUTLINE` y `DAZICON / SOLID`, con
**348 iconos cada uno**, a 24 px, en 20 categorías:

| Categoría | Iconos | Categoría | Iconos |
|---|---|---|---|
| Arrows / Flechas | 44 | Misc / Misceláneos | 28 |
| Documents / Documentos | 27 | System / Sistema | 12 |
| Math / Matemática | 30 | Design / Diseño | 2 |
| Sort / Organización | 30 | Graph / Gráficos | 6 |
| Buildings / Edificios | 6 | Others / Otros | 23 |
| E-commerce | 9 | Time / Tiempo | 1 |
| Media | 21 | Device / Dispositivos | 9 |
| Symbols / Símbolos | 48 | Maps / Mapas | 5 |
| Communication / Comunicación | 23 | Security / Seguridad | 10 |
| Editor / Edición | 7 | User / Usuario | 7 |

Los nombres siguen el patrón `Íconos_Dazlabs_Categorías_Individuales_<Outlines|Sólidos>_<nombre>`.

### Otros recursos del archivo

- Componentes dibujados: botones (100 variantes), campos, chips, banderas e iconos de integraciones.
- Interfaces en modo claro y oscuro.
- 164 variables en 13 colecciones.

No usé nada de eso: los componentes de `zui` no salen de Figma.

## La prueba

Exporté cuatro iconos a SVG leyendo la geometría de los blobs y los rendericé para comprobarlos: `camera`
(outline y solid), `shopping_cart` y `ant`. Las formas salían correctas. Los círculos de `camera` se veían
facetados y pensé que tendría que usar la red vectorial en lugar de la geometría aplanada; resultó ser el
renderizador de la prueba, no los datos. La geometría de relleno tiene curvas reales y es la que uso.

## Lo que hubo que arreglar al extraer

| Problema | Ejemplo | Tratamiento |
|---|---|---|
| Outline guardado como relleno | todos los outline | No hay grosor de trazo ajustable; los publico como formas |
| Curvas facetadas en la prueba | círculos de `camera` | Era el renderizador de la prueba: la geometría de relleno tiene curvas reales |
| Erratas en nombres | `foward`, `glove_americas` | Tabla de renombrado revisada a mano |
| Erratas en categorías | "BULDINGS", "DIVICE", "DESING", "GRPH" | Normalizar a claves en inglés con etiqueta ES/EN |
| Sufijos sobrantes | `-268`, `-270`, ` 1`, ` 2` | Eliminar; resolver duplicados |
| Categoría sin nombre | "Group 31" en solid (equivale a Symbols) | Emparejar por posición con outline |
| Tamaños irregulares | Graph a 24 × 23 | Recentrar en caja de 24 × 24 |
| Mayúsculas | `Banknotes` | Pasar todo a kebab-case |

## Qué salió

| Previsto | Resultado |
|---|---|
| 348 iconos | 346. Dos dibujos estaban rotos en ambas variantes (`currency_dollar` y `document_currency_dollar`); los sustituí por la versión corregida que el propio archivo trae al final de la categoría |
| SVG normalizados por icono y variante, con `currentColor` | `zicon/svg/outline/` y `zicon/svg/solid/` |
| Manifiesto con nombre, categoría y palabras clave en dos idiomas | `zicon/manifest.json`, con 20 categorías |
| Componentes de React y sprite | `Icon`, además de `<z-icon>`, `iconSvg()`, `iconElement()` y `sprite.svg` |
| Tabla de emoji a icono para agentes | 152 emojis, generada desde el manifiesto |

Revisé a ojo hojas de contacto con los 692 dibujos.

## Lo que la extracción no puede arreglar

- **El outline está guardado como relleno.** No hay grosor de trazo ajustable.
- **101 iconos son iguales en las dos variantes**, y algunos `solid` no están rellenos. Es el dibujo de
  origen. Mi regla para este paquete es no dibujar SVG a mano, así que no lo corrijo en el código: se arregla
  en Figma y se vuelve a extraer.
- **Una sola caja de 24 px.**

## Iconos propios

Más tarde eché en falta conceptos que Dazicon no tiene (clima, transporte, náutica, comida) y que yo ya había
dibujado para un proyecto propio, con el mismo lenguaje de línea: trazo de 1,5 a 1,75 en la caja de 24,
uniones y terminaciones redondeadas. Añadí 20 de esos dibujos. Dejé fuera los que repetían un concepto que
Dazicon ya cubre con otro nombre (`log-out`, `menu`, `zap`, `flame`, `filter`, `refresh`, `image`,
`download`…), los de pura interfaz de esa aplicación (un panel con cuatro baldosas desiguales) y una casilla
marcada que no casaba con `x-square`.

| Problema | Tratamiento |
|---|---|
| Están dibujados con trazo y zicon guarda formas rellenas | `zicon/scripts/own.mjs` convierte cada trazo en su contorno con Skia (`canvaskit-wasm`), con uniones y terminaciones redondeadas, y une las piezas en una sola forma |
| Grosor distinto (1,75 en la mayoría) | Todos a 1,5, el de Dazicon |
| Ocupaban más caja (de 2 a 22 por la línea central) | Cada icono se escala y centra para ocupar lo mismo que uno de Dazicon: de 2,36 a 21,64 por fuera |
| No tenían variante `solid` | La dibujé en `own/solid/` con el criterio de Dazicon: la forma cerrada rellena y los detalles interiores recortados (la cruz de `first-aid`, la aguja de `compass`). Cuatro sin macizo natural (`snowflake`, `utensils`, `waves`, `wind`) repiten el dibujo |

Las fuentes con trazo quedan en `zicon/own/` y el resultado convertido en `zicon/icons-own.json` y
`zicon/svg/`. `build.mjs` une las dos fuentes y falla si un nombre o una categoría está en las dos, así que
volver a extraer Dazicon no los borra. Los revisé en una lámina junto a `bell`, `cloud`, `sun`, `truck` y
otros de Dazicon, a 16, 20 y 24 px, en las dos variantes y en claro y oscuro, y ajusté el `solid` de `car`
(las ruedas recortadas pesaban demasiado; quedaron como anillos, igual que en `truck`).

## Licencia

Publico el set bajo MIT, igual que el código. Los nombres siguen la nomenclatura de Heroicons, que también es
MIT; los trazados que revisé son los del archivo de DAZLABS. No he comparado los 346 uno a uno con otro set.
Los 20 iconos propios los dibujé yo y van bajo la misma licencia MIT.

## Lo que no he comprobado

- Otros dos archivos de Figma de DAZLABS con sistemas de diseño completos, que podrían servir de fuente para
  componentes. No los abrí.
