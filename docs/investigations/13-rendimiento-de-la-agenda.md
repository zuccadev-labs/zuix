# Rendimiento de la agenda, medido

La especificación de la agenda pide 5000 eventos en un mes y 500 recursos sin tareas largas al navegar (objetivo
de 50 ms por interacción; INP «bueno», por debajo de 200 ms, como mínimo). Tras la segunda oleada, la etapa de
rendimiento de la aplicación de ejemplo (`?screen=perf-stage`) daba entre 600 ms y 2 s por cambio de vista o de
periodo. Estas son las notas de la medida, del cambio y de la medida de después, del 20 de noviembre de 2026.

## Cómo medí

- Build de producción de `examples/app` (`vite build`), servido en local y abierto con Playwright en el Chrome del
  sistema, 1440 × 900. Los mismos datos que la etapa: 5000 eventos deterministas en noviembre de 2026, en Madrid.
- Por paso, un clic y dos fotogramas (`requestAnimationFrame` dos veces), entre dos `performance.mark`. De la
  traza de Chromium (categoría `blink.user_timing`) tomo el reloj de hilo (`tts`) de las dos marcas: es el tiempo
  de CPU del hilo principal (JavaScript, estilo, maquetación y pintado) y no cuenta las esperas del planificador.
- La máquina estaba cargada (carga media entre 15 y 25 en 8 núcleos, por otros procesos): el tiempo de pared
  variaba hasta un 100 % entre pasadas iguales. Por eso las cifras son de CPU, mediana de tres pasadas, y las del
  antes y el después salen de la misma ejecución, alternando los dos builds.
- Dónde iba el tiempo: perfil de CPU de V8 (CDP `Profiler`, muestreo de 100 µs) sobre un build sin minificar, y la
  traza de Chromium para separar maquetación, estilo y pintado (`Layout`, `UpdateLayoutTree`, `Paint`).

## Dónde iba el tiempo

| Paso | CPU | Lo que pesaba |
|---|---|---|
| Semana con 1156 eventos (7188 nodos) | 450–720 ms, una tarea de 380–620 ms | La maquetación (500–700 ms en la traza), forzada dentro del clic por la lectura de `getBoundingClientRect` con la que la rejilla vuelve a la hora inicial: es la maquetación de 1156 botones con sus textos. En JavaScript, el formato de los intervalos y crear el árbol |
| Lista de 30 días (3682 filas, 26 000 nodos) | 330–490 ms | Crear 26 000 nodos (React, `setAttribute`, `appendChild`), 180 ms de recolección de basura y 300 ms de maquetación |
| Mes con 5000 eventos | 100–120 ms | Filtrar la lista entera por cada celda (35 × 5000), los carriles de cada semana sobre todo el mes y, en el minicalendario, `hasEvents` recorriendo los 5000 eventos por cada uno de sus 42 días |
| Año | 125 ms | El mismo `hasEvents` y el recuento por día con aritmética de cadenas de fecha |
| Cualquier paso | — | `expandEvents` recorría y convertía los 5000 eventos en cada pintado, también al mover el foco |

La lectura de geometría tras pintar no era un bucle (se lee una vez y se escribe después), pero obligaba a hacer
dentro de la interacción una maquetación enorme. La causa real era pintar todo: el problema se resolvía pintando
menos, no moviendo la lectura.

## Qué cambié

- **Índice por intervalos** en `expandEvents`: por lista de eventos y zona, los sueltos ordenados por inicio con su
  intervalo ya convertido; una vista pide su rango con una búsqueda binaria. Con **memoria por rango**: el mismo
  rango devuelve la misma lista y las mismas ocurrencias. Se comprueba en cada consulta que la lista no ha cambiado
  en su sitio (mismos objetos y mismos campos, comparaciones directas).
- **Índice por día**: las vistas reparten las ocurrencias por día en una pasada; los carriles del mes reciben solo
  las de su semana y dejan de buscar más allá de `dayMaxEvents`.
- **Lo que cabe en la rejilla de horas**: cuatro solapes lado a lado en la semana (ocho en el día) y el resto en un
  «+N» por hora en la última columna del grupo, que abre el popover de ese intervalo (agenda.md §9, «a partir del
  quinto»). El «+N» lleva el tabulador y entra en la navegación espacial; lo oculto no puede llevar el foco; el
  evento que se mueve nunca se oculta.
- **Ventana virtual en la lista** a partir de 150 filas (`core/virtual` en espíritu: alturas de una medida, una
  lectura tras el primer pintado): de cada día, las filas que se ven más un margen, y rellenos del alto del resto;
  la fila con el foco siempre se pinta; Inicio y Fin salen del modelo, no del documento.
- **Memoria del marcado de cada evento** (por ocurrencia y por todo lo que lo cambia): React recibe el mismo
  elemento y no lo recorre; el modo DOM no lo parchea, y para el resto compara atributos con el pintado anterior
  en vez de leer el documento.
- **Trabajo no urgente después del pintado** (`core/idle`: `scheduler.postTask` o `setTimeout`, tras un
  fotograma): el aviso de rango, la carga por rango y la medida de la lista.

Guías aplicadas: «*the performance benefit comes entirely from the CSS containments*»
(`interactions-in-complex-layouts`, que ya seguía cada columna de día); «*high layout duration points to
expensive geometry calculations or synchronous layout thrashing (remediated by batching DOM reads before writes,
simplifying DOM structure, or using CSS containment)*» (`identify-inp-causes`: aquí, simplificar el DOM);
«*Skips rendering calculations when off-screen*» (`defer-rendering-heavy-content`, que se mantiene para listas de
menos de 150 filas); «*degrade gracefully to `setTimeout(callback, 0)` when `scheduler.postTask` is unavailable*»
(`schedule-tasks-by-priority`).

## Lo que no cambié, y por qué

- **Ventana vertical en la rejilla de horas.** Los datos de la etapa van de 07:00 a 21:45 y la rejilla enseña doce
  horas desde las 08:00: con una hora de margen, el 100 % de los eventos está dentro de la ventana. No ahorraba nada
  y complicaba el teclado. El tope de solapes sí reduce lo pintado (de 1156 a 254 eventos en la semana).
- **Ventana por días.** En la semana ancha se ven los siete días. Solo ahorraría en el contenedor estrecho, con
  días de 104 px y desplazamiento horizontal.
- **Contención de cada evento** (`contain: strict`) o quitar el contenedor de consulta de las columnas: medido con
  siete pasadas por variante, la diferencia quedó dentro del ruido de la máquina.

## Después

Las cifras finales están en el informe de la rama y se repiten en el `CHANGELOG.md` de zui. Para que no vuelvan a
subir, `tests/html/cases/15-agenda-perf.mjs` recorre mes, semana, día, lista y año con 5000 eventos en el modo sin
framework (el build publicado) y falla si un paso pasa de 300 ms de CPU en Chromium (`AGENDA_BUDGET`) o de 3000 ms
de pared en cualquier motor (`AGENDA_WALL`), con la mejor de tres vueltas.

## Sin comprobar

- Las cifras en una máquina sin carga: todas las de este documento son con otros procesos ocupando la CPU.
- El efecto en un teléfono real; la medida es de escritorio.
