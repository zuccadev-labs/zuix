# Zicon

`@zuccadev-labs/zuix-zicon` es el estándar iconográfico de la suite. La mayor parte sale de Dazicon, el set de
iconos de DAZLABS. El resto son dibujos míos: los hice para un proyecto propio con el mismo lenguaje de línea y
los añadí cuando eché en falta esos conceptos en Dazicon.

## Qué incluye

- **366 iconos** en dos variantes: `outline` y `solid`. 346 de Dazicon y 20 propios.
- Caja de 24 × 24 y color heredado (`currentColor`).
- 22 categorías con etiqueta en español e inglés.
- Palabras clave en ambos idiomas, por forma y por concepto de uso.
- Tabla de sustitución de 177 emojis.

### Los iconos propios

| Categoría | Iconos |
|---|---|
| Clima | `cloud-rain`, `cloud-sun`, `snowflake`, `sunset`, `waves`, `wind` |
| Transporte | `anchor`, `car`, `fuel`, `ship` |
| Mapas | `compass`, `navigation` |
| Seguridad | `shield`, `siren` |
| Otros | `first-aid`, `fish`, `utensils` |
| Gráficos, Símbolos, Dispositivos | `gauge`, `target`, `tv` |

Los dibujé con trazo. Para que encajen con Dazicon los convertí a forma rellena con el mismo grosor (1,5 en la
caja de 24) y los escalé a su mismo tamaño. Los comparé a 16, 20 y 24 px con iconos de Dazicon, en claro y
oscuro. Las fuentes con trazo están en `zicon/own/`.

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
| `label` | Nombre accesible. Sin él, el icono es decorativo y se oculta a lectores de pantalla | — |

Un `aria-label` o `aria-labelledby` pasado directamente también vale como nombre: el icono deja de ir con
`aria-hidden`.

## Uso sin React

```html
<script type="module">import "@zuccadev-labs/zuix-zicon/element";</script>

<z-icon name="magnifying-glass"></z-icon>
<z-icon name="trash" size="20" label="Delete"></z-icon>
<z-icon name="bookmark" variant="solid"></z-icon>
```

Los atributos son los de las props. El elemento se dibuja también si se conecta antes de que su icono esté
registrado (lo hace al registrarlo), y respeta `hidden`.

| Forma | Uso | Cuándo |
|---|---|---|
| Elemento | `<z-icon name="bell" variant="solid" size="20" label="Alerts"></z-icon>` | Marcado escrito a mano o en una plantilla |
| Nodo | `iconElement("bell", { size: 20 })` desde `@zuccadev-labs/zuix-zicon/dom` | Código que construye el DOM. No pasa por `innerHTML` |
| Cadena | `iconSvg("bell", { size: 20 })` desde `@zuccadev-labs/zuix-zicon/dom` | Render en servidor o plantillas de texto |
| Sprite | `<svg class="z-icon" width="16" height="16"><use href="sprite.svg#bell"/></svg>` (`#bell-solid` para la variante sólida) | Páginas estáticas con muchos iconos repetidos |
| Archivo | `@zuccadev-labs/zuix-zicon/svg/outline/bell.svg` | Una imagen suelta |

- El color se hereda del texto que lo rodea.
- Tamaños recomendados: 16 en texto y botones, 20 a 22 en recuadros, 28 en estados vacíos.
- `<z-icon>` e `iconElement()` funcionan con Trusted Types activos. `iconSvg()` devuelve una cadena con todos
  sus valores escapados; insertarla con `innerHTML` en una página con Trusted Types exige una política propia
  ([CSP y Trusted Types](./11-csp-y-trusted-types.md)).
- `<use>` hacia un `sprite.svg` externo solo funciona si el sprite se sirve desde el mismo origen que la
  página: es una restricción del navegador. Desde un CDN hay que incrustar el sprite en el documento.

## Incluir solo algunos iconos

`@zuccadev-labs/zuix-zicon`, `/all` y `/element` registran el set completo: unos 580 kB de trazados sin
comprimir. Una aplicación que necesite menos registra solo los que usa:

```tsx
import { Icon, registerIcons } from "@zuccadev-labs/zuix-zicon/core";
import { trash } from "@zuccadev-labs/zuix-zicon/icons/trash";

registerIcons([trash]);
```

`zui` y `zout` importan desde `@zuccadev-labs/zuix-zicon/core`, así que no arrastran el set. La aplicación
decide: `import "@zuccadev-labs/zuix-zicon/all"` una vez, o un registro parcial. Con registro parcial hay que
incluir también los iconos que dibujan los propios componentes (`x-mark`, `chevron-down`, `check`…): un
icono sin registrar sale vacío y la consola lo avisa.

`onIconsRegistered(fn)` avisa cada vez que se registran iconos, por si una aplicación los carga bajo demanda.

## Nombres

- En inglés, minúsculas y con guiones: `arrow-down`, `shopping-cart`.
- El nombre describe la forma. El concepto de uso está en las palabras clave: `trash` responde a
  "delete", "eliminar" y "borrar".

## Limitaciones conocidas

- La variante `outline` está dibujada como forma rellena. El grosor del trazo no se puede ajustar.
- Hay una sola caja de 24 px; no existen versiones optimizadas para 16 o 20.
- **105 de los 366 iconos son iguales en `outline` y en `solid`**: el dibujo de origen no distingue las dos
  variantes en ellos (101 de Dazicon; de los propios, `snowflake`, `utensils`, `waves` y `wind`, que no tienen
  un macizo natural). Algunos `solid` no están rellenos (`magnifying-glass`, `power`). No lo corrijo en el
  código porque la regla del paquete es no dibujar SVG a mano: se arregla en el archivo de Figma y se vuelve a
  extraer.
- Algunas categorías son muy cortas (Tiempo tiene un icono, Diseño dos).
- Cuatro dibujos del archivo original estaban rotos (`currency_dollar` y `document_currency_dollar`, en
  ambas variantes). Los sustituí por las versiones corregidas que el propio archivo trae al final de la
  categoría.

## Regenerar desde Figma

No hace falta Figma: el extractor lee el archivo `.fig` directamente.

```
cd zicon
python3 -I scripts/extract.py "<ruta a Dazicon.fig>"
pnpm icons
```

La tabla de renombrado está en `zicon/scripts/rename.json`. La extracción falla si un icono queda sin
pareja outline/solid, y la generación valida cada icono: trazados dentro de la caja, identificador de módulo
único y categoría existente.

La extracción solo reescribe los iconos de Dazicon (`icons.json`). Los propios están aparte, en
`icons-own.json`, y la generación une las dos fuentes. Si un nombre está en las dos, falla.

## Regenerar los iconos propios

```
pnpm icons:own
pnpm icons
```

`icons:own` lee los dibujos con trazo de `zicon/own/`, los convierte en contornos rellenos con CanvasKit (uniones
y terminaciones redondeadas, grosor 1,5), los escala y centra al tamaño de Dazicon y escribe `icons-own.json` y
los SVG de `zicon/svg/`. Solo hace falta al añadir o retocar un icono propio: el resultado está en el
repositorio, y `pnpm icons` no usa CanvasKit.

## Licencia de los dibujos

Decidí publicar el set bajo MIT, igual que el código. Los trazados salen del archivo Dazicon de DAZLABS; los
nombres siguen la nomenclatura de Heroicons, que también es MIT. Los dibujos que revisé al extraer son los
del archivo; no he comparado los 346 uno a uno con otro set. Los 20 iconos propios los dibujé yo y entran bajo
la misma licencia MIT. Cómo lo extraje:
[Zicon: extracción de Dazicon](../investigations/03-zicon-dazicon.md).
