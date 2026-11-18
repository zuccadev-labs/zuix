# Accesibilidad

El objetivo de la suite es [WCAG 2.2](https://www.w3.org/TR/WCAG22/) nivel AA, y lo trato como algo que se
mide: lo que se puede comprobar con una máquina se comprueba en cada cambio y hace fallar la verificación.
Esta página dice qué garantiza la suite, cómo se mide y qué queda en manos de la aplicación.

## Qué se mide en cada cambio

| Qué | Cómo | Criterio |
|---|---|---|
| Contraste del texto | `pnpm tokens` cruza cada token de texto con cada superficie, en las tres marcas y los dos temas | 1.4.3, 4.5:1 |
| Contraste de los pares reales | El mismo comando lee de las hojas de `zui` y `zout` qué color va sobre qué fondo y mide cada par | 1.4.3 (4.5:1) y 1.4.11 (3:1) |
| Bordes de control y anillo de foco | Medidos contra la superficie que los rodea | 1.4.11 y 2.4.7, 3:1 |
| Roles, nombres y estados | axe-core en cada pantalla de las suites de navegador, en claro y oscuro, también con menús, diálogos y selectores abiertos. Las violaciones graves y críticas hacen fallar | Reglas WCAG 2 A y AA de axe |
| Teclado y foco | Casos de navegador por componente: abrir, recorrer, cerrar, y dónde queda el foco | Patrones de [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) |
| El sitio de documentación | Todas las páginas, en dos temas y tres anchos, con axe | WCAG 2.2 A y AA |

Las superficies translúcidas se componen sobre el fondo de la aplicación, incluidos los extremos de su
degradado, antes de medir. Si un par de color baja del mínimo, la generación de tokens falla y dice la marca,
el tema, el par y la razón obtenida.

## Color

El color de marca y los de estado tienen un token por uso ([Tokens](./01-tokens.md#qué-token-de-color-va-en-cada-sitio)):

- `--z-accent`, `--z-success`, `--z-warning`, `--z-danger`, `--z-info`: rellenos, bordes e iconos (3:1).
- `--z-*-text`: texto y enlaces (4.5:1 sobre cualquier superficie y sobre su fondo `-soft`).
- `--z-*-solid`: fondos con texto encima (4.5:1 con `--z-fg-on-accent`).

## Preferencias del sistema

| Preferencia | Qué hace la suite |
|---|---|
| `prefers-color-scheme` | Sin `data-theme`, el tema sigue al sistema |
| `prefers-contrast: more` | El cristal pasa a superficie sólida, los bordes se refuerzan, el texto atenuado pasa a normal y el foco es más grueso |
| `forced-colors: active` (contraste alto de Windows) | El foco sigue visible (contorno además del anillo), y los estados seleccionado, marcado, resaltado y deshabilitado usan colores del sistema. Se retiran el degradado y el destello del cristal |
| `prefers-reduced-motion` | Sin transiciones ni animaciones, también dentro de las capas; el Carousel pasa a tira plana |
| `prefers-reduced-transparency` | El cristal pasa a superficie opaca y los velos dejan de desenfocar |
| `pointer: coarse` | Los controles crecen a 40 px y las zonas de agarre se amplían |
| `hover: none` | No se aplican estilos de `:hover`: no hay hover pegajoso tras un toque |

## Teclado

Cada componente interactivo sigue el patrón de APG que le corresponde. Lo que más se nota:

| Componente | Teclado |
|---|---|
| Diálogos | El foco entra al abrir, Tab da la vuelta dentro, Escape cierra y el foco vuelve al disparador |
| Menús | Flechas con vuelta, Inicio y Fin, búsqueda por letra; flecha derecha abre un submenú y la izquierda lo cierra |
| Pestañas, grupos de radio, control segmentado | Un solo punto de tabulación; las flechas mueven foco y selección |
| Select, Combobox | Flechas, Inicio y Fin, Intro elige, Escape cierra. Select busca por letra; Combobox filtra al escribir |
| Calendario | Flechas por día y semana, Re Pág y Av Pág por mes, Inicio y Fin por semana |
| Slider | Flechas, Re Pág y Av Pág, Inicio y Fin |
| Árbol | Flechas para moverse, expandir y plegar; letra para saltar |
| Avisos | F8 lleva el foco al más reciente; Escape lo descarta; el cierre automático se detiene con el foco o el puntero encima |
| Tooltip | Aparece al enfocar; la burbuja admite el puntero; Escape la cierra |
| Divisores y tiradores de `zout` | Flechas, Inicio y Fin |

Escape cierra solo la capa de arriba. En escritura de derecha a izquierda las flechas horizontales se
invierten.

## Escritura de derecha a izquierda

Con `dir="rtl"` en `<html>` o en un contenedor, las hojas se reflejan porque usan propiedades lógicas, los
iconos direccionales se voltean, los popovers alinean con el borde correcto y los cajones del `Shell` entran
por el lado que toca. No hay prop ni proveedor: la dirección se lee del DOM.

## Táctil

- Objetivo de 40 px con puntero grueso en botones, campos, pestañas, filas de menú y de árbol y opciones de
  lista; `--z-touch-target: 0px` lo desactiva.
- Las estrellas de `Rating` y el cierre de pestaña de `TabStrip` miden 24 × 24 px con cualquier puntero, el
  mínimo de [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Los divisores de
  `SplitPane` miden menos en su eje corto con ratón, porque ampliarlos taparía las barras de desplazamiento
  vecinas; se manejan también con teclado y con doble clic, y con puntero grueso crecen a 40 px.
- Lo que se arrastra tiene alternativa de un solo toque o de teclado (2.5.7): doble clic en un tirador lo
  restablece y en un divisor reparte a partes iguales.

## Qué queda en manos de la aplicación

- **Nombres accesibles.** Un `IconButton`, un `Popover` o un `Icon` informativo necesitan su `label`. Los tipos
  lo exigen donde pueden.
- **Idioma de los textos.** Los componentes traen etiquetas por defecto en inglés (`Close`, `Next slide`,
  `Notifications (F8)`); se traducen por props.
- **Jerarquía de encabezados.** `PageHeader`, `PageSection` y `Accordion` aceptan `headingLevel`.
- **Una región principal.** Con varios `Shell`, solo uno lleva `<main>` (`mainAs` en los demás).
- **Contenido propio.** El contraste de una imagen, de un gráfico o de un color que la aplicación ponga por su
  cuenta no lo mide nadie más.
- **Cerrar pestañas con un lector de pantalla táctil.** `TabStrip` cierra con Supr; su botón de cierre es
  una ayuda de puntero. Si tu aplicación se usa así, ofrece el cierre también dentro del panel.

## Lo que no he comprobado

- **Lectores de pantalla.** axe comprueba roles, nombres y contraste, no la experiencia hablada. No he hecho
  una pasada completa con NVDA, JAWS, VoiceOver ni TalkBack.
- **Safari real y dispositivos reales.** Las suites usan el WebKit de Playwright en Linux y táctil emulado.
- **`prefers-reduced-transparency`** solo se puede emular en Chromium y Firefox.
- **`forced-colors`** lo pruebo emulado en el navegador, no en Windows con un tema de contraste real.
- **Zoom al 400 % y espaciado de texto** (1.4.10 y 1.4.12): compruebo que no hay desbordamiento a 390 px de
  ancho, no una pasada específica de reflujo con cada componente.

Cómo llegué a esta forma de medir, y las cifras de partida: [Accesibilidad medida](../investigations/09-accesibilidad-medida.md).
