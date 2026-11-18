# Investigación inicial

Antes de escribir una línea de zuix quise tener claro cómo se arma un sistema de diseño que aguante muchos
proyectos y más de una marca. Estas son las notas de esa primera vuelta, de noviembre de 2026: qué leí, qué
alternativas pesé y qué me llevé. Al final digo en qué acabó cada idea, porque no todas sobrevivieron.

## La pregunta

Quería un "Material UI propio": un sistema de componentes que sirviera para todos mis proyectos, que una
marca distinta pudiera adoptar cambiando solo estilos, y que no me obligara a elegir entre mantenibilidad a
largo plazo y velocidad al construir una pantalla.

## Tres capas, no una

El error que más veces he visto, y cometido, es acoplar la lógica de accesibilidad y de estado con las
clases visuales. La separación que me convenció es de tres capas:

| Capa | Qué contiene |
|---|---|
| Tokens | Valores agnósticos (color, espaciado, tipografía) en un formato de datos, como fuente única |
| Lógica | Comportamiento sin estilos: accesibilidad, teclado, estado |
| Estilos | La piel que se aplica encima |

Con esa separación, cambiar de marca es cambiar tokens, y cambiar de framework no obliga a rehacer la
apariencia.

## CSS a mano o Tailwind

Comparé las dos opciones para la capa de estilos pensando en un sistema grande.

| Criterio | CSS propio (hojas por componente) | Tailwind con variables CSS |
|---|---|---|
| Personalización | Máxima: control de cada selector y pseudo-elemento | Alta, pero acotada por la configuración; hay que resolver conflictos de clases |
| Tamaño del CSS | Crece con cada componente | Se estabiliza: las utilidades se reutilizan |
| Gobierno | Fácil escribir valores arbitrarios fuera del sistema | Empuja a usar la escala definida |
| Otras plataformas | Solo web | Hay puentes a nativo que reutilizan los conceptos |

Mi primera conclusión fue Tailwind con una condición: que sus valores consumieran variables CSS, y que esas
variables salieran de los tokens. Así un cambio de tema es inyectar otros valores, sin tocar componentes.
También anoté dos piezas habituales de ese camino: una herramienta de tokens que exporte a varias
plataformas, y variantes tipadas para los componentes.

## Funciones y mixins nativos de CSS

Miré la especificación de funciones y mixins nativos (`@function`, `@mixin`), que llevan al navegador lo que
antes pedía un preprocesador.

```css
@function --px-to-rem(--px) {
  result: calc(var(--px) / 16 * 1rem);
}

.card {
  padding: --px-to-rem(32);
}
```

Me gustó lo que simplifican: menos herramientas de compilación, y lógica que se puede inspeccionar en el
navegador. Las descarté para el núcleo por tres motivos:

1. **Soporte.** Estaban en adopción; no quería que la interfaz dependiera de una función que un navegador
   todavía no procesa.
2. **Gobierno.** Lógica arbitraria dentro del CSS es justo lo que acabó mal con los mixins anidados de los
   preprocesadores.
3. **Coste en ejecución.** Una utilidad se resuelve al compilar; una función nativa la evalúa el navegador
   en cada elemento.

## Lo que el CSS ya hace sin JavaScript

Esta fue la parte que más cambió el diseño. Mucho de lo que antes exigía un script hoy es plataforma:

| Antes hacía falta JavaScript para | Hoy |
|---|---|
| Dar estilo a un contenedor según lo que tiene dentro | `:has()` |
| Animar según el desplazamiento | Animaciones ligadas al scroll (`animation-timeline`) |
| Colocar un menú o un tooltip junto a su disparador | Posicionamiento por ancla en CSS |
| Abrir y cerrar modales y menús por encima de todo | `<dialog>` y el atributo `popover`: capa superior, cierre con Escape, foco |
| Reaccionar al foco dentro de un grupo | `:focus-within` |

```html
<button popovertarget="menu">Open menu</button>
<div id="menu" popover>…</div>
```

La consecuencia para un sistema de diseño es que puede ser mucho más ligero: el JavaScript se queda para lo
que de verdad es comportamiento, no para mover clases.

## Diseño intrínseco

La otra idea que adopté entera: en lugar de forzar a un componente a cambiar según el tamaño de la pantalla,
darle reglas para que se adapte al espacio de su contenedor.

| Técnica | Para qué |
|---|---|
| `grid-template-columns: repeat(auto-fit, minmax(…, 1fr))` | Rejillas que deciden solas cuántas columnas caben |
| Consultas de contenedor (`@container`) | Que un componente responda al ancho de su padre, no al de la ventana |
| `flex-wrap` con `flex-basis` | Filas que bajan de línea cuando no caben |
| `clamp()` | Tipografía y espacios fluidos, sin saltos |

Un componente que usa `@media` asume que sabe cuánto mide la pantalla, y se rompe en cuanto alguien lo mete
en una barra lateral estrecha. Con consultas de contenedor se escribe una vez y sirve en cualquier sitio.

## En qué acabó cada idea

| Idea de partida | Qué hice | Por qué |
|---|---|---|
| Tres capas | Las mantengo: tokens, comportamiento sin framework y binding | Es la base de todo lo demás |
| Tailwind como motor de estilos | No lo uso. `zui` es CSS plano sobre tokens | Al separar el contrato del framework, las clases `z-*` son el contrato; no necesitaba utilidades. Publico un puente para quien sí use Tailwind |
| Una herramienta de tokens multiplataforma | Un script propio de Node, sin dependencias | El contrato es pequeño y la validación de contraste es mía. Añadí una salida en formato DTCG para interoperar |
| Variantes tipadas con una biblioteca | Clases BEM y atributos de estado | El estado vive en el marcado (`data-size`, `data-state`), que es lo que comparte cualquier framework |
| Una biblioteca headless para la lógica | La usé en la `0.1.0` y la quité en la `0.2.0` | [Primitivas propias](./08-primitivas-propias.md) |
| `<dialog>` y `popover` | Adoptados: todas las capas de la suite van sobre ellos | Capa superior, velo e inercia sin código propio |
| Posicionamiento por ancla en CSS | No lo uso todavía: la colocación es una función propia | No está disponible en toda la línea de navegadores que admito |
| `:has()`, consultas de contenedor, `clamp()`, `auto-fit` | Adoptados | `Grid` es `auto-fit` con `minmax`; `Shell` decide con una consulta de contenedor qué paneles caben; el título mayor usa `clamp()` |
| `@function` y `@mixin` nativos | No los uso | Los tres motivos de arriba siguen valiendo |
| Animaciones ligadas al scroll | No las uso | No tuve un caso que las pidiera |

## Lo que no miré entonces

No me pregunté por el contraste real de los colores, por la escritura de derecha a izquierda ni por los
colores forzados. Lo pagué después: [Accesibilidad medida](./09-accesibilidad-medida.md).
