# Primitivas propias

Por qué quité la biblioteca de UI que había debajo del binding de React, cómo lo hice y qué medí. Es el
cambio más grande de la `0.2.0` y la causa de casi todos sus cambios incompatibles. Notas de noviembre de
2026.

## De dónde venía

En la `0.1.0` el binding de React estaba hecho sobre Radix Primitives: diálogos, menús, popovers, pestañas,
selectores y controles de formulario. Fue la decisión razonable para llegar rápido a un binding accesible, y
la tomé antes de decidir que la suite no era solo para React
([cómo cambió esa decisión](./06-arquitectura-y-decisiones.md#decisiones)).

Cuando el estándar pasó a ser HTML, CSS y tokens, escribí `zui/dom`: el mismo comportamiento sin framework,
sobre `<dialog>` y la Popover API. Desde ese momento tenía **dos implementaciones de cada widget**: una mía,
sobre la plataforma, y otra de una biblioteca, solo para React.

## Lo que me hizo replanteármelo

Al revisar `zui` componente a componente antes de la siguiente versión, fui apuntando los defectos. Una parte
no los podía arreglar yo, porque el comportamiento era de la biblioteca:

| Defecto | Por qué no tenía arreglo sin tocar la biblioteca |
|---|---|
| En RTL, `Tabs`, `Menu`, `Slider`, `RadioGroup` y `SegmentedControl` leían la dirección de una prop o de un proveedor, no del DOM | Exigía exponer un proveedor nuevo en mi API |
| En un `SearchInput` dentro de un `Modal`, Escape limpiaba el campo y además cerraba el diálogo | El diálogo escuchaba la tecla en fase de captura |
| El aviso de React emitía un `li` con `role="status"` dentro de un `ol`, que axe marca | Era el marcado interno del componente |
| `confirm()` sin React y `ConfirmDialog` con React no se comportaban igual con Escape | Dos implementaciones, dos criterios |

Y había tres costes que no eran defectos, sino consecuencias de la arquitectura:

1. **El marcado de React no era el del contrato.** Un diálogo de React era un `div[role=dialog]` con un velo
   aparte; el del contrato, un `<dialog>`. Dos hojas de estilo en una, y variables CSS con el prefijo de otra
   biblioteca dentro de las mías.
2. **Quien no usaba React lo pagaba igual.** La biblioteca era dependencia de `zui`, así que un proyecto que
   solo usaba el contrato HTML y `zui/dom` instalaba más de setenta paquetes que nunca importaba, y los
   gestores instalaban React porque la biblioteca lo pedía como peer.
3. **Cada corrección había que hacerla dos veces**, y comprobar que las dos coincidían.

## Lo que decidí

Quitar la biblioteca y escribir el binding de React sobre lo mismo que ya usaba el modo sin framework.

No lo decidí por purismo. Lo decidí porque la parte difícil ya estaba hecha: `zui/dom` ya resolvía cada
widget sobre la plataforma, con pruebas en tres motores. Lo que faltaba era ordenar esa lógica para que React
pudiera consumirla.

### Cómo quedó

| Capa | Qué es |
|---|---|
| `zui/src/core/` | La lógica, una sola vez y sin framework: colocación, pila de capas, foco, bloqueo de desplazamiento, foco itinerante, búsqueda por letra, dirección, presencia, fechas, paginación, Slider |
| `zui/src/primitives/` | Primitivas de React sobre `core`: diálogo, capa flotante, menú, campo nativo oculto, slot |
| `zui/src/dom/` | El modo sin framework, sobre el mismo `core` |

Lo modal es un `<dialog>` abierto con `showModal()`: la capa superior, el velo y la inercia del resto de la
página los pone el navegador. Lo flotante es un elemento `popover="manual"`. Cada widget sigue su patrón de
[WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/). El marcado que emite React es el del contrato, hasta el
punto de que se puede copiar a una página sin React.

Dos técnicas las adapté de trabajo publicado por terceros, con código propio: la zona de gracia del puntero
al ir hacia un submenú, que sigue la de Radix Primitives, y la prueba de punto dentro de un polígono en la
forma de PNPOLY. Sus avisos de licencia están en `THIRD_PARTY_NOTICES.md`, que se publica con el paquete.

### React 19, sin camino para React 18

Las primitivas usan `inert` y reciben `ref` como prop. Probé React 18 y no funciona: `inert` no se aplica
como atributo booleano y los componentes no reciben el `ref`. Podría haberlo resuelto con `forwardRef` y un
atributo escrito a mano, y decidí no hacerlo: el binding ya exigía React 19 en la `0.1.0`, y no voy a
mantener dos caminos.

## Qué medí

Medidas del 2026-11-17, con los paquetes empaquetados e instalados fuera del workspace, que es como los
consume una aplicación.

| Qué | Con la 0.1.0 | Sin la biblioteca |
|---|---|---|
| Proyecto sin React (`zui/dom`, `zout/dom`, `zicon`): tamaño de `node_modules` | 15,9 MB | 9,6 MB |
| Ese mismo proyecto: paquetes instalados | Más de setenta | Los cinco de la suite |
| Aplicación de React de prueba, compilada con Vite: JavaScript | 393 kB (121,6 kB con gzip) | 346 kB (107,5 kB con gzip) |
| Esa misma aplicación: CSS | 136 kB | 146 kB |
| Tarball de `zui` | 416,7 kB | 549,7 kB |

Lo que cuentan esas cifras, sin adornarlas: el JavaScript de una aplicación baja un 12 %, que está bien y no
es espectacular. El CSS sube, pero no por este cambio: en el mismo periodo entraron las propiedades lógicas,
los colores forzados y el contraste. El paquete de `zui` pesa más, porque ahora lleva dentro la lógica que
antes venía de fuera. La ganancia grande no es de tamaño: es que quien no usa React no instala nada que no
use, y que hay una sola implementación que mantener.

## Lo que cuesta

- **Cambios incompatibles.** El marcado de las capas, las variables CSS, varios tipos de props y algunos
  comportamientos cambian. Están todos en la [guía de actualización](../users/08-actualizar-de-0-1-a-0-2.md).
- **El código es mío.** Si un patrón de accesibilidad está mal, no hay una biblioteca con miles de usuarios
  que lo haya encontrado antes. Lo compenso con pruebas: la lógica de `core` tiene pruebas unitarias con
  umbral de cobertura y cada widget tiene casos de teclado y de foco en tres motores, con React y sin él.
- **La plataforma manda.** Dependo de `<dialog>` y de la Popover API. Eso fija la línea de navegadores
  ([Compatibilidad](../users/10-compatibilidad.md)) y no hay ruta alternativa.

Para que no vuelva a entrar por descuido, el linter rechaza la importación de la biblioteca que quité.

## Lo que arreglé por el camino en el modo sin framework

Al ordenar la lógica revisé también cómo trataba `zui/dom` los datos que recibe:

| Qué encontré | Qué hice |
|---|---|
| Atributos como `data-z-open` se pasaban a `querySelector`: un valor que no era un selector válido lanzaba una excepción en cada clic, y un selector arbitrario podía apuntar a cualquier elemento | Se resuelven por id (`core/ref`) |
| Asignaciones de marcado repartidas por varios módulos, incompatibles con Trusted Types | Un único punto que escribe marcado (`setMarkup`) y la política `zuix-zui` |
| El icono de la opción elegida en Select y Combobox se copiaba como cadena de marcado | Se copia nodo a nodo |
| `init()` no tenía forma de deshacerse | Devuelve `destroy` |

## Lo que no he comprobado

- **Lectores de pantalla** con las primitivas nuevas. Lo que tengo es axe y pruebas de teclado y de foco.
- **Navegadores en su versión mínima.** Las pruebas corren en las versiones actuales.
- **Una migración real.** La guía de actualización sale de repasar los cambios uno a uno, no de migrar una
  aplicación en producción de la `0.1.0` a la `0.2.0`.
