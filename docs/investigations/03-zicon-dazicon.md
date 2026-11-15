# 03 · Zicon: extracción de Dazicon

Fecha: 2026-11-12.

Fuente: `Dazicon.fig` (4,6 MB), el archivo de Figma del set de iconos de DAZLABS. No está en el repositorio;
el extractor recibe su ruta como argumento.

## Formato del archivo

Un `.fig` es un ZIP con:

- `canvas.fig`: el documento, en formato binario `fig-kiwi` (esquema y datos comprimidos);
- `images/`: diez imágenes incrustadas;
- `meta.json` y `thumbnail.png`.

Se decodificó sin Figma: 483 definiciones de esquema, 80.349 nodos y 6.466 blobs de geometría.

## Contenido

### Páginas

Presentación, Recursos, UX, UI, Prototipado, Responsive, Componentes, Descartes, PDF UX, PDF UI y
"Pruebas de íconos". Las páginas Prototipado, Componentes, PDF UX y PDF UI están vacías.

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

- Componentes dibujados: `Buttons/Button` (100 variantes), `Input Fields`, `Chips`, banderas e iconos de integraciones.
- Interfaces en modo claro y oscuro, y pies de página.
- 164 variables en 13 colecciones, con nombres de Untitled UI y Material 3.

## Prueba de extracción

Se exportaron cuatro iconos a SVG leyendo la geometría de los blobs y se renderizaron para comprobarlos:
`camera` (outline y solid), `shopping_cart` y `ant`. Las formas salen correctas.

## Problemas a resolver en la extracción

| Problema | Ejemplo | Tratamiento |
|---|---|---|
| Outline guardado como relleno | todos los outline | No hay grosor de trazo ajustable; se publican como formas |
| Curvas facetadas en la prueba | círculos de `camera` | Usar la red vectorial (`vectorData`) en lugar de la geometría aplanada |
| Erratas en nombres | `foward`, `glove_americas` | Tabla de renombrado revisada a mano |
| Erratas en categorías | "BULDINGS", "DIVICE", "DESING", "GRPH" | Normalizar a claves en inglés con etiqueta ES/EN |
| Sufijos sobrantes | `-268`, `-270`, ` 1`, ` 2` | Eliminar; resolver duplicados |
| Categoría sin nombre | "Group 31" en solid (equivale a Symbols) | Emparejar por posición con outline |
| Tamaños irregulares | Graph a 24 × 23 | Recentrar en caja de 24 × 24 |
| Mayúsculas | `Banknotes` | Pasar todo a kebab-case |

## Salida prevista

1. SVG normalizados por icono y variante, con `currentColor`.
2. Manifiesto JSON: nombre, categoría, variantes, palabras clave en español e inglés.
3. Componentes React y sprite.
4. Tabla de sustitución emoji → icono para agentes, generada desde el manifiesto.

## Sin verificar

- Si los 348 nombres de outline y solid coinciden uno a uno.
- La licencia y autoría de los dibujos. Los nombres siguen la nomenclatura de Heroicons, pero los
  trazados revisados son propios; conviene confirmarlo con el diseñador antes de publicar.
- Los archivos vecinos `SISTEMAS DE DISEÑO.fig` (110 MB) y
  `Design System - Proyectos Regulares (…).fig` (136 MB) no se abrieron.
