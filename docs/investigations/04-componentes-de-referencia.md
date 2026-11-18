# Componentes de referencia

Notas del 2026-11-12, antes de construir `zui`. Qué miré para decidir qué componentes hacer y cómo: un
carousel propio que quería rescatar, las bibliotecas que tenía apuntadas como inspiración y el código que ya
tenía escrito en otros proyectos.

## A. Carousel con efecto lente

Sale de la página de presentación del proyecto de origen (privado; no cito su nombre ni su ruta). Quería
traerlo a la suite sin su dominio.

| Archivo | Líneas | Papel |
|---|---|---|
| Componente principal | 953 | Estado, gestos, animación, accesibilidad |
| `lensRenderer.ts` | 396 | Dibujo WebGL2 de las zonas curvas |
| `cardRaster.ts` | 216 | Copia cada tarjeta HTML a una textura |
| `lens.ts` | 146 | Geometría pura de la lente |

### Comportamiento

- Tira infinita con tres copias del contenido.
- El centro queda plano y los bordes se curvan en S, con ampliación horizontal y refracción.
- Arrastre con inercia y avance ligado al desplazamiento de la página.
- Flechas, contador y anuncio para lectores de pantalla.

### Modos de dibujo

| Modo | Cuándo | Cómo |
|---|---|---|
| `gl` | Hay WebGL2 y las texturas cargaron | Centro en HTML real; bordes en WebGL |
| `css` | Sin WebGL2 o mientras carga | Cada tarjeta se deforma con `matrix3d` |
| `flat` | `prefers-reduced-motion` | Tira plana sin animación |

### Acoplamientos que tenía

- Una biblioteca de animación para la inercia y el desplazamiento.
- Los iconos y las clases del proyecto de origen, y un tipo de datos de su dominio.
- React 18.

### Cómo lo extraje

| Plan | Resultado |
|---|---|
| Un `Carousel` base: pista, bucle, arrastre, ajuste, teclado y anuncios | `zui/src/components/carousel/`, con el motor en un módulo sin React (`engine.ts`) que también usa el modo sin framework |
| El efecto lente como capa opcional; `lens.ts` tal cual | `effect="lens"` o `"none"`. La geometría pura se quedó casi igual y tiene pruebas unitarias |
| Contenido por slots | `renderItem`: la tarjeta la define quien lo usa |
| Estilos sobre tokens de la suite | Hecho; sin la biblioteca de animación ni dependencias del dominio |

Lo que no traje: el cursor propio y la apertura de la tarjeta a pantalla de sección, que eran de aquella
página.

## B. Las referencias que tenía apuntadas

Tenía apuntados unos enlaces a bibliotecas que me parecían bien resueltas. Estaban en un archivo suelto en
la raíz del repositorio; los dejo aquí, que es donde tienen sentido.

| Referencia | Qué es | Qué me aportó |
|---|---|---|
| [Shark UI](https://shark.vini.one/) | Biblioteca de componentes con tokens semánticos para varios frameworks | Lista de control de qué es un "sistema completo" |
| [NeonBlade UI](https://neonbladeui.neuronrush.com/) | Componentes de React con estética neón, por CLI o copiar y pegar | Efectos y variantes |
| [Dot Matrix](https://dotmatrix.zzzzshawn.cloud/) | Colección de loaders de matriz de puntos, distribuida como registro copiable | La idea de un paquete de loaders, que no he hecho |
| [remocn](https://remocn.dev/) | Componentes de movimiento para vídeo programático | Movimiento para vídeo, no interfaz de aplicación |
| [ArrowJS](https://arrow-js.com/play/) | Un framework reactivo mínimo, sin paso de compilación | La alternativa a React que consideré para el núcleo |
| [Radix Primitives](https://github.com/radix-ui/primitives) | Primitivos headless accesibles para React | La capa de lógica de `zui` en la `0.1.0`. La sustituí en la `0.2.0` ([Primitivas propias](./08-primitivas-propias.md)) |

### Qué hice con ellas

No copié código de ninguna. Me sirvieron de catálogo y de vara de medida: qué componentes tiene un sistema
completo y cómo se comporta cada uno. Los componentes de `zui` están reimplementados sobre los tokens de la
suite. Copiar código habría exigido revisar la licencia de cada una, y varias no la declaran con claridad en
su página.

Dos de ellas distribuyen sus componentes como un registro del que el código se copia al proyecto y se edita.
Lo consideré para los componentes con estilo de `zui` y al final lo distribuí todo por npm, con versión
([cómo quedó cada decisión](./06-arquitectura-y-decisiones.md#decisiones)).

De la `0.1.0` queda una deuda reconocida con una de estas referencias: la zona de gracia del puntero en los
submenús sigue la técnica de Radix Primitives, con código propio. Su aviso de licencia está en
`THIRD_PARTY_NOTICES.md`, dentro de `zui`.

## C. Código propio que ya existía

| Fuente | Qué aportó |
|---|---|
| zutool: `apps/desktop/src/ui/primitives` | Primitivos liquid glass y un `Popover` |
| zutool: `apps/desktop/src/ui/layout` | El shell: rail, sidebar, área principal, inspector, cajones |
| zutool: `apps/desktop/src/styles/zutool.css` | Pestañas, paneles divididos, divisores, cabecera de panel |
| analizador-trafico: `packages/ui-glass` | Panel de cristal, `StatTile`, `Badge`, `DataTable` |
| El design system del proyecto de origen | `Button`, `Input`, `Select`, `DateInput`, `Card`, `Avatar`, `Badge`, `Modal`, `Spinner`, `Tooltip`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`, `Rating` |

No traje los componentes de dominio de ese design system (pagos, reservas, clima, visor 3D, chat).
