# Zicon

`@zuccadev-labs/zuix-zicon` es el estándar iconográfico de la suite. Sale de Dazicon, el set de iconos de DAZLABS.

## Qué incluye

- **346 iconos** en dos variantes: `outline` y `solid`.
- Caja de 24 × 24.
- 20 categorías con etiqueta en español e inglés.
- Palabras clave en ambos idiomas, por forma y por concepto de uso.
- Tabla de sustitución de 152 emojis.

Se pueden explorar en la página [Iconos](/icons).

## Uso con React

```tsx
import { Icon } from "@zuccadev-labs/zuix-zicon";

<Icon name="magnifying-glass" />                 // 16 px, decorativo
<Icon name="trash" size={20} label="Delete" />   // con nombre accesible
<Icon name="bookmark" variant="solid" />
```

| Prop | Valores | Por defecto |
|---|---|---|
| `name` | Un nombre de `manifest.json`; uno inexistente no compila | — |
| `variant` | `outline`, `solid` | `outline` |
| `size` | Número (px) o longitud CSS | `16` |
| `label` | Nombre accesible. Sin él, el icono es decorativo | — |

## Uso sin React

```html
<script type="module">import "@zuccadev-labs/zuix-zicon/element";</script>

<z-icon name="magnifying-glass"></z-icon>
<z-icon name="trash" size="20" label="Delete"></z-icon>
<z-icon name="bookmark" variant="solid"></z-icon>
```

Mismos atributos que las props. También hay `iconSvg(name, options)` en `@zuccadev-labs/zuix-zicon/dom` (devuelve
el SVG como cadena), un `sprite.svg` con un símbolo por icono y los archivos sueltos en `svg/`.
Detalle en [Frameworks](./06-frameworks.md).

- El color se hereda del texto que lo rodea.
- Tamaños recomendados: 16 en texto y botones, 20 a 22 en recuadros, 28 en estados vacíos.

## Incluir solo algunos iconos

`@zuccadev-labs/zuix-zicon` registra el set completo: unos 580 kB de trazados sin comprimir. Una aplicación que
necesite menos puede registrar solo los que usa:

```tsx
import { Icon, registerIcons } from "@zuccadev-labs/zuix-zicon/core";
import { trash } from "@zuccadev-labs/zuix-zicon/icons/trash";

registerIcons([trash]);
```

`zui` y `zout` importan desde `@zuccadev-labs/zuix-zicon/core`, así que no arrastran el set. La aplicación decide:
`import "@zuccadev-labs/zuix-zicon/all"` una vez, o un registro parcial.

## Nombres

- En inglés, minúsculas y con guiones: `arrow-down`, `shopping-cart`.
- El nombre describe la forma. El concepto de uso está en las palabras clave: `trash` responde a
  "delete", "eliminar" y "borrar".

## Limitaciones conocidas

- La variante `outline` está dibujada como forma rellena. El grosor del trazo no se puede ajustar.
- Hay una sola caja de 24 px; no existen versiones optimizadas para 16 o 20.
- Algunas categorías son muy cortas (Tiempo tiene un icono, Diseño dos).
- Cuatro dibujos del archivo original estaban rotos (`currency_dollar` y `document_currency_dollar`, en
  ambas variantes). Se sustituyeron por las versiones corregidas que el propio archivo trae al final de
  la categoría.

## Regenerar desde Figma

No hace falta Figma: el extractor lee el archivo `.fig` directamente.

```
cd zicon
python3 -I scripts/extract.py "<ruta a Dazicon.fig>"
pnpm icons
```

La tabla de renombrado está en `zicon/scripts/rename.json`. La extracción falla si un icono queda sin
pareja outline/solid.

## Sin verificar

- Licencia: el responsable fijó MIT para el set (2026-11-14). La autoría de los dibujos no se
  contrastó; los nombres siguen la nomenclatura de Heroicons.

Detalle de la extracción en
[`../investigations/03-zicon-dazicon.md`](../investigations/03-zicon-dazicon.md).
