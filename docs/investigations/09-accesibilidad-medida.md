# Accesibilidad medida

Cómo pasé de afirmar que la suite cumplía WCAG AA a medirlo, y lo que encontré al medir. Notas de noviembre
de 2026, previas a la `0.2.0`.

## El punto de partida

La `0.1.0` validaba el contraste: `pnpm tokens` comprobaba ocho pares de texto y fondo por marca y tema, y
pasaban todos. Las suites de navegador ejecutaban axe en cada pantalla. Con eso di por buena la
accesibilidad de color.

El fallo de ese razonamiento era simple: los ocho pares eran una lista escrita a mano. La pregunta que no me
había hecho era qué pares usan de verdad las hojas de estilo.

## Lo que medí

Escribí un lector de las hojas de `zui` y `zout` que extrae, regla a regla, qué color de texto va sobre qué
fondo, y medí cada par en las tres marcas y los dos temas, componiendo las superficies translúcidas sobre el
fondo de la aplicación. Con los tokens de la `0.1.0`:

| Qué | Lo que encontré | Mínimo |
|---|---|---|
| Comprobaciones por debajo del mínimo | 178 | — |
| `--z-fg-subtle` usado como texto | De 2,9 a 4,5:1 | 4.5:1 |
| `--z-control-border` (el borde de un campo) | De 1,19 a 1,29:1; al pasar el puntero, de 1,44 a 1,75:1 | 3:1 |
| Anillo de foco (`--z-accent-ring`) | De 1,38 a 2,21:1 | 3:1 |
| `accent`, `danger`, `success` y `warning` como texto y sobre su fondo suave | De 1,8 a 4,4:1 | 4.5:1 |
| Texto blanco sobre los colores de estado (insignia sólida) | De 2,04 a 4,02:1 | 4.5:1 |
| Marca `zutool`, tema oscuro: texto de la barra de título sobre el degradado | 2,51:1 | 4.5:1 |
| Marca `zutool`, tema oscuro: texto sobre cristal | De 2,2 a 4,8:1 | 4.5:1 |
| El botón primario al pasar el puntero | De 4,27 a 4,36:1: el hover aclaraba el fondo | 4.5:1 |

Los criterios son [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) para el texto y
[1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) para lo que no es texto: bordes
de control, indicadores y foco.

axe no había marcado la mayoría. Cuando no puede determinar el fondo de un texto (un degradado, una capa
translúcida) lo deja como «por revisar», no como violación, y buena parte de la suite es texto sobre cristal
encima de un degradado.

## Lo que decidí

### Un token por uso del color

El problema de fondo era pedirle al mismo color tres cosas incompatibles. Un naranja de marca que se ve bien
como relleno no puede dar 4.5:1 como texto sobre blanco y, a la vez, 4.5:1 como fondo de un texto blanco.
Separé los tres usos:

| Uso | Token | Cómo sale |
|---|---|---|
| Relleno, borde, icono | `accent`, `success`, `warning`, `danger`, `info` | El color de la marca, tal cual |
| Texto | `accent-text`, `success-text`… | El color mezclado con `fg` hasta llegar a 4.5:1 |
| Fondo con texto encima | `accent-solid`, `success-solid`… | El color mezclado con negro hasta que `fg-on-accent` llega a 4.5:1 |

Así una marca sigue definiendo un solo color por intención, y los derivados salen solos. Después cambié en
las hojas de `zui` los 18 pares que usaban el color sin sufijo donde correspondía uno de los otros dos.

### Ajustes de valor

- `fg-subtle` más opaco en las seis combinaciones.
- `control-border` pasa a `fg` al 50 %, y su hover a `fg-muted`.
- El anillo de foco pasa a `accent-text`, opaco.
- `accent-solid-hover` oscurece en lugar de aclarar.
- En `zutool` oscuro, el degradado del fondo se atenúa y el cristal sube de 0.66 a 0.82 de opacidad; en
  `dazlabs` oscuro, de 0.66 a 0.72.

Subir la opacidad del cristal cambia el aspecto del material, que era la seña de la suite. Lo hice igual: un
panel bonito que no se lee no sirve.

### Que no vuelva a pasar

La validación de `pnpm tokens` mide ahora cuatro cosas, y cualquiera hace fallar la generación:

1. La matriz completa: cada token de texto sobre cada superficie.
2. Los pares declarados en el contrato.
3. Los pares reales, leídos de las hojas en cada ejecución.
4. Lo que no es texto: bordes de control y foco contra lo que los rodea.

Dos decisiones de detalle. Las superficies translúcidas se componen sobre los extremos del degradado del
fondo, no sobre su media: es una cota conservadora, y prefiero un falso negativo a un panel ilegible sobre la
mancha más clara. Y un par que no se puede resolver a un color es un error, no un "revisar a mano", que era
lo que imprimía antes y nadie revisaba.

También corregí el umbral de la fórmula de luminancia relativa, que usaba 0,03928 en lugar del 0,04045 que
fija WCAG 2.2. La diferencia no cambia ningún resultado; lo cambié para que el número coincida con la norma.

A 2026-11-17 son 654 comprobaciones en tres marcas y dos temas, con 65 usos de texto leídos de 13 hojas, y
pasan todas. La lista de pares pendientes está vacía.

## Lo demás que no estaba mirando

El contraste me hizo desconfiar del resto. Repasé lo que la `0.1.0` no cubría:

| Qué | Estado en la 0.1.0 | Qué hice |
|---|---|---|
| Escritura de derecha a izquierda | Rota: alineación, botones de cierre, bordes, flechas, cajones y arrastre con coordenadas físicas | Propiedades lógicas en todas las hojas, iconos direccionales reflejados y teclado reflejado, leyendo la dirección del DOM |
| Colores forzados (contraste alto de Windows) | El foco, dibujado con `box-shadow`, desaparecía; los estados que solo cambiaban el fondo, también | Contorno del sistema para el foco y colores del sistema para seleccionado, marcado, resaltado y deshabilitado |
| `prefers-contrast: more` | Sin reglas | Cristal a superficie sólida, bordes reforzados, foco más grueso |
| Tooltip | La burbuja ignoraba el puntero y Escape no la cerraba | Cumple [1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) |
| Avisos | El cierre automático no se detenía con el puntero o el foco encima; la región no tenía nombre | Pausa, F8 y región con nombre ([2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)) |
| Objetivos pequeños | Estrellas de `Rating` de 18 y 22 px; cierre de pestaña de 18 px | 24 × 24 px ([2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) |
| Grupos sin nombre dentro de `Field` | `<label for>` no etiqueta un `RadioGroup` ni un `Slider` | `aria-labelledby` |
| Regiones en `zout` | Sin región `banner` ni enlace para saltar al contenido | `TitleBar` es `<header>`; `skipLinkLabel` |
| Botón en carga | `disabled`: el foco del teclado se perdía | `aria-disabled` |

## Lo que dejé como está, y por qué

| Qué | Por qué |
|---|---|
| El botón de cierre de una pestaña de `TabStrip` no entra en el orden de tabulación, y un lector de pantalla táctil no puede usarlo | Un `tablist` solo admite pestañas. El cierre va por Supr; quien necesite más lo ofrece dentro del panel |
| Los divisores de `SplitPane` miden menos de 24 px en su eje corto con ratón | Ampliarlos taparía las barras de desplazamiento vecinas. Con puntero grueso crecen a 40 px, y se manejan con teclado y con doble clic |
| El cajón del `Shell` es modal, pero la barra de título sigue operable | Es intencionado: sus botones son los que alternan los paneles |
| La alternativa de un solo toque al arrastre es parcial ([2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)) | El doble clic restablece o iguala; un tamaño arbitrario sigue pidiendo arrastre o teclado |
| `DataTable` muestra una fecha sin `render` con el formato del entorno | Cambiarlo altera lo que ve quien ya lo usa. Está documentado: para fechas, `render` |

## Lo que no he comprobado

- **Lectores de pantalla.** Nada de lo anterior sustituye a escuchar la interfaz con NVDA, VoiceOver o
  TalkBack, y no lo he hecho de forma sistemática.
- **`forced-colors` en Windows real.** Lo emulo en el navegador.
- **Safari real y dispositivos táctiles reales.**
- **El contraste de lo que no pasa por los tokens**: imágenes, gráficos y el contenido que ponga la
  aplicación.
