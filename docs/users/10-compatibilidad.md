# Compatibilidad

Qué navegadores, qué versiones de Node, de React y de TypeScript, y qué bundlers admite la suite.

## Navegadores

| Navegador | Hoja normal | Modo compat |
|---|---|---|
| Chrome y Edge | 116 | 109 |
| Firefox | 125 | 115 |
| Safari (macOS) | 17 | 15.4 |
| Safari (iOS) | 18.3 | 15.4 |

El mínimo de la hoja normal lo marca la [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API):
todas las capas flotantes de la suite son elementos `popover`. Esas son las versiones desde las que la plataforma la
da por disponible en todos los motores, según los datos de
[Baseline](https://web-platform-dx.github.io/web-features-explorer/features/popover/) (desde enero de 2025).

Para navegadores anteriores hay un [modo compat](#modo-compat): otras hojas CSS, generadas en el build, y la Popover
API puesta por un polyfill que carga la aplicación. Llega hasta Chromium 109, Firefox 115 y Safari 15.4.

Lo que pruebo en cada cambio es más estrecho que esa línea: el Chrome instalado en el sistema y los motores
Firefox y WebKit que trae Playwright, siempre en su versión actual. No ejecuto las suites en las versiones
mínimas.

### Matriz de soporte

Qué uso de la plataforma, desde qué versión lo tiene cada navegador y qué pasa por debajo. La tabla la genera
`pnpm matrix` (`tools/compat-matrix.mjs`) con los datos del paquete
[web-features](https://github.com/web-platform-dx/web-features), que salen de
[@mdn/browser-compat-data](https://github.com/mdn/browser-compat-data). El generador cuenta los usos de cada
característica en el código: si una deja de aparecer, falla y la fila se quita. Lo que escribo a mano es la columna
de uso y la de lo que pasa por debajo.

Lo de debajo es de cuatro tipos: **roto** (la pieza no funciona), **modo compat** (la hoja compat lo resuelve),
**alternativa** (la suite hace otra cosa que funciona igual o casi) y **degradación** (se pierde un detalle, no la
función).

<!-- matriz: la genera tools/compat-matrix.mjs (pnpm matrix); no se edita a mano -->

| | Chrome y Edge | Firefox | Safari | Safari iOS |
|---|---|---|---|---|
| Hoja normal y `/dom` | 116 | 125 | 17 | 18.3 |
| Hoja compat y `/dom` con `@oddbird/popover-polyfill` | 109 | 115 | 15.4 | 15.4 |

| Característica | Qué la usa | Chrome | Firefox | Safari | Safari iOS | Por debajo |
|---|---|---|---|---|---|---|
| [Popover](https://web-platform-dx.github.io/web-features-explorer/features/popover/) | Todas las capas flotantes: menús, selectores, tooltips, popovers, toasts, submenús (174) | 116 | 125 | 17 | 18.3 | **Roto.** No se abren. Ni el `/dom` ni el binding de React lanzan: comprueban que existe `showPopover` y leen el estado sin `:popover-open`. Con `@oddbird/popover-polyfill` funcionan, y la hoja compat entiende su clase `.\:popover-open` |
| [`<dialog>`](https://web-platform-dx.github.io/web-features-explorer/features/dialog/) | Modal, Drawer, AlertDialog, Palette y `confirm()` (30) | 37 (Edge 79) | 98 | 15.4 | 15.4 | **Roto.** No se abren. Es el suelo de Safari en el modo compat (15.4) |
| [Cascade layers](https://web-platform-dx.github.io/web-features-explorer/features/cascade-layers/) | El orden de las hojas: `zui.material`, `zui.base` y una capa por grupo; `zout` después (57) | 99 | 97 | 15.4 | 15.4 | **Modo compat.** Con la hoja normal, el navegador descarta todo lo que hay dentro de `@layer`: la página sale sin estilos. La hoja compat aplana las capas en su orden |
| [color-mix()](https://web-platform-dx.github.io/web-features-explorer/features/color-mix/) | Tonos suaves, bordes y estados de los tokens y de los componentes (132) | 111 | 113 | 16.2 | 16.2 | **Modo compat.** La declaración no vale: fondos y bordes de estado transparentes, tonos de texto heredados. La hoja compat escribe el color ya mezclado para cada marca y tema |
| [Nesting](https://web-platform-dx.github.io/web-features-explorer/features/nesting/) | Reglas anidadas que quedan después de empaquetar: hoy, `@starting-style` dentro de la regla que anima (3) | 120 | 117 | 17.2 | 17.2 | **Modo compat.** La regla anidada se pierde (aquí, solo la animación de entrada). La hoja compat la desanida |
| [:has()](https://web-platform-dx.github.io/web-features-explorer/features/has/) | Anillo de foco en el contenedor de un enlace o control, columna plegada del Shell, media estrella del Rating, ajustes de espaciado (59) | 105 | 121 | 15.4 | 15.4 | **Degradación.** La regla se ignora. Casi todo es espaciado. Los anillos de foco de contenedor pasan a `:focus-within` en la hoja compat. Sin alternativa: la columna del Shell no se estrecha al plegar la Sidebar y una media estrella se ve entera |
| [:dir()](https://web-platform-dx.github.io/web-features-explorer/features/dir-pseudo/) | Espejo en RTL de flechas, gráficos, marquesinas y cajones (24) | 120 | 49 | 16.4 | 16.4 | **Modo compat.** La regla se ignora: esas piezas no se invierten en RTL. La hoja compat mira `[dir="rtl"]` en el elemento o en un ancestro |
| [Registered custom properties](https://web-platform-dx.github.io/web-features-explorer/features/registered-custom-properties/) | Variables animables: progreso del anillo, avance del carrusel, lienzo de nodos (9) | 85 | 128 | 16.4 | 16.4 | **Modo compat.** La variable no tiene valor inicial ni se interpola. La hoja compat le da su valor inicial; la animación salta sin interpolar |
| [Container queries (size)](https://web-platform-dx.github.io/web-features-explorer/features/container-queries/) | Disposición según el ancho del contenedor (tarjetas, cabeceras, paneles, dashboard) (78) | 105 | 110 | 16 | 16 | **Degradación.** Se queda la disposición base, la de ancho amplio. Afecta a Safari 15.4 a 15.6 en el modo compat |
| [@starting-style](https://web-platform-dx.github.io/web-features-explorer/features/starting-style/) | Entrada animada de capas, diálogos y avisos (9) | 117 | 129 | 17.5 | 17.5 | **Degradación.** Aparecen sin transición |
| [inert](https://web-platform-dx.github.io/web-features-explorer/features/inert/) | Fondo inerte con el cajón del Shell abierto, copias de las diapositivas del carrusel (6) | 102 | 112 | 15.5 | 15.5 | **Degradación.** El foco con Tab puede llegar a lo que está detrás. Afecta a Safari 15.4 en el modo compat |
| [Anchor positioning](https://web-platform-dx.github.io/web-features-explorer/features/anchor-positioning/) | Colocación de popovers con CSS, como mejora progresiva (5) | 157 | — | 27 | 27 | **Alternativa.** Se colocan con JavaScript (`place()`), que mide y vuelve a colocar al desplazar |
| [moveBefore()](https://web-platform-dx.github.io/web-features-explorer/features/move-before/) | Reordenar nodos sin perder foco ni estado (dashboard, listas de transferencia) (6) | 133 | 144 | — | — | **Alternativa.** `append()`: el orden es el mismo, pero el nodo movido se desconecta y vuelve (un iframe se recarga, una animación empieza de nuevo) |
| [Scroll-driven animations](https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations/) | Efectos ligados al desplazamiento (carrusel, lector, sombras de los bordes) (18) | 115 | 159 | 26 | 26 | **Degradación.** Están dentro de `@supports`: sin efecto |
| [`Customizable <select>`](https://web-platform-dx.github.io/web-features-explorer/features/customizable-select/) | Selector de mes y año del Calendar (2) | 135 | — | 27 | 27 | **Degradación.** `<select>` nativo del sistema |
| [field-sizing](https://web-platform-dx.github.io/web-features-explorer/features/field-sizing/) | Altura del Composer según su texto (3) | 123 | 152 | 26.2 | 26.2 | **Alternativa.** La mide JavaScript en cada entrada |
| [hidden="until-found"](https://web-platform-dx.github.io/web-features-explorer/features/hidden-until-found/) | Texto plegado de ReviewCard que encuentra Buscar en la página (1) | 102 | 148 | — | — | **Degradación.** Es `hidden` normal: Buscar en la página no lo encuentra |
| [scrollend](https://web-platform-dx.github.io/web-features-explorer/features/scrollend/) | Fin del desplazamiento del carrusel (4) | 114 | 109 | 26.2 | 26.2 | **Alternativa.** Se detecta con un temporizador tras el último `scroll` |
| [Intl.Segmenter](https://web-platform-dx.github.io/web-features-explorer/features/intl-segmenter/) | Grafemas de las iniciales del Avatar y de los efectos de texto (12) | 87 | 125 | 14.1 | 14.5 | **Alternativa.** Por puntos de código: un emoji compuesto puede partirse |
| [checkVisibility()](https://web-platform-dx.github.io/web-features-explorer/features/check-visibility/) | Saber si un elemento enfocable se ve (3) | 105 | 106 | 17.4 | 17.4 | **Alternativa.** Se usa `getClientRects()` |
| [backdrop-filter](https://web-platform-dx.github.io/web-features-explorer/features/backdrop-filter/) | Cristal de superficies y capas (`.z-liquid`) (74) | 76 (Edge 79) | 103 | 18 | 18 | **Degradación.** Sin desenfoque: queda el fondo translúcido del token. Safari lo tiene con prefijo desde la 9 y la suite escribe también `-webkit-backdrop-filter` |
| [text-wrap: balance](https://web-platform-dx.github.io/web-features-explorer/features/text-wrap-balance/) | Títulos repartidos en líneas parejas (10) | 114 | 121 | 17.5 | 17.5 | **Degradación.** Corte de línea normal |

Versiones de web-features 3.47.0. Entre paréntesis, los usos que cuenta el generador en el CSS empaquetado o en el código sin framework.

<!-- fin de la matriz -->

Lo que no está en la tabla (`:is()`, `:where()`, `:focus-visible`, las propiedades lógicas, `aspect-ratio`, `gap`
en flex, las unidades `dvh`) llegó antes que el objetivo del modo compat en todos los motores.

### Modo compat

Una hoja alternativa por paquete, para navegadores entre el objetivo (Chromium 109, Firefox 115, Safari 15.4) y el
mínimo de la hoja normal. La genera `tools/compat.mjs` en cada `pnpm build` (y en `pnpm dist`), con
[lightningcss](https://lightningcss.dev/) para ese objetivo.

| Paquete | Hoja normal | Hoja compat |
|---|---|---|
| `@zuccadev-labs/zuix-tokens` | `tokens.css`, `css/<marca>.css` | `tokens.compat.css`, `css/<marca>.compat.css` |
| `@zuccadev-labs/zuix-zui` | `styles.css` (`dist/zui.css`) | `styles.compat.css` (`dist/zui.compat.css`) |
| `@zuccadev-labs/zuix-zout` | `styles.css` (`dist/zout.css`) | `styles.compat.css` (`dist/zout.compat.css`) |
| `@zuccadev-labs/zuix` | `tokens.css`, `styles.css` | `tokens.compat.css`, `styles.compat.css` |

Se cambian todas juntas: la hoja compat de componentes lee colores que solo definen los tokens compat. Con bundler:

```css
@import "@zuccadev-labs/zuix/styles.compat.css";
```

Sin bundler, los mismos tres `<link>` de siempre con el nombre compat, y el polyfill antes del `/dom`:

```html
<link rel="stylesheet" href="/node_modules/@zuccadev-labs/zuix-tokens/dist/tokens.compat.css">
<link rel="stylesheet" href="/node_modules/@zuccadev-labs/zuix-zui/dist/zui.compat.css">
<link rel="stylesheet" href="/node_modules/@zuccadev-labs/zuix-zout/dist/zout.compat.css">
<script type="module">
  if (!Object.hasOwn(HTMLElement.prototype, "popover")) await import("/node_modules/@oddbird/popover-polyfill/dist/popover.min.js");
  const { init } = await import("/node_modules/@zuccadev-labs/zuix-zui/dist/zui.dom.js");
  init();
</script>
```

La hoja compat sirve también en un navegador moderno: la prueba de `pnpm test:html` carga la página de ejemplo
con ella en Chrome y compara el color de fondo, de texto, de borde y de sombra de cada elemento con la hoja normal.
Si un proyecto tiene que admitir los dos tramos, puede servir solo la compat.

Qué hace con la hoja normal:

- **`color-mix()`.** En los tokens se calcula para cada marca, cada tema (`data-theme`, y sin atributo con
  `prefers-color-scheme`) y cada preferencia (`prefers-contrast: more`), y se escribe el color resultante. En los
  componentes, cada mezcla pasa a ser una variable `--z-compat-<hash>` que los tokens compat definen ya resuelta en
  `:root`. Una mezcla sobre una variable propia del componente (el tono de un Chip, el color de un evento) se
  resuelve para cada valor que el CSS asigna a esa variable, al lado de la asignación.
- **`@layer`.** Se aplana en el orden de las capas: las subcapas antes que las reglas propias de su capa, y lo que no
  tiene capa, al final. Las declaraciones `!important` van en una copia de su regla, en orden inverso de capas,
  que es como las ordena la cascada.
- **Anidado, consultas de rango, `oklch()`.** Los baja lightningcss al objetivo.
- **`:popover-open`** admite también la clase `.\:popover-open` del polyfill, y una capa cerrada se oculta mientras
  el polyfill carga. **`:dir(rtl)`** pasa a `[dir="rtl"]` en el elemento o un ancestro. Cada **`@property`** deja su
  valor inicial en una regla normal.
- **`:has()`.** Se queda (Chromium 109 y Safari 15.4 lo tienen; Firefox 115, no). Los anillos de foco de contenedor
  que dependen de él tienen un respaldo con `:focus-within` solo para navegadores sin `:has()`. El resto es
  estético y está en la matriz.

Límites que conozco:

- **Los colores mezclados son estáticos.** Si la aplicación redefine un token base (`--z-accent`) en tiempo de
  ejecución, los derivados (`--z-accent-soft`, `--z-accent-hover`, los tonos de los componentes) no lo siguen. Las
  hojas compat cubren las marcas que trae el paquete (dazlabs, zenith y zutool); con los tokens de otra marca, cada
  mezcla de los componentes cae en su respaldo.
- **Respaldo de una mezcla que no se puede calcular.** Cuando la variable llega de otro sitio que el CSS (un estilo
  en línea, como el color de un calendario elegido por la persona), queda el color que más pesa en la mezcla: un
  fondo al 15 % de un color queda transparente.
- **Especificidad entre capas.** Con capas, una regla de una capa posterior gana a otra de una capa anterior aunque
  tenga menos especificidad; aplanadas, gana la más específica. Lo comparo elemento a elemento en `pnpm test:html`
  y hoy las dos hojas coinciden en toda la página de ejemplo. Una aplicación con su propio CSS sin capas compite
  ahora por especificidad con la suite.
- **Tokens redefinidos por la aplicación.** Los tokens compat escriben los derivados con selectores de
  especificidad (0,6,0): `:root` con la marca y el tema, rellenos con `:root` repetido para que todos pesen igual.
  Para pisar uno desde la aplicación hace falta más.
- **Container queries** en Safari 15.4 a 15.6 y el resto de filas de degradación de la matriz.
- **Peso.** `tokens.compat.css` pesa unas 2,3 veces `tokens.css` (cada marca por tema y preferencia); las de
  componentes, lo mismo que las normales.

### Popover API en navegadores anteriores

La suite no trae polyfill ni lo declara como dependencia. Sin Popover API, `@zuccadev-labs/zuix-zui/dom` y
`@zuccadev-labs/zuix-zout/dom` no lanzan: comprueban que existe `showPopover` antes de llamarlo y leen el estado de
la capa sin el selector `:popover-open`, que en esos navegadores no es válido y haría fallar `matches()`. Los
menús, selectores, tooltips y avisos no se abren, y la hoja compat los mantiene ocultos.

Para que se abran, la aplicación carga [`@oddbird/popover-polyfill`](https://github.com/oddbird/popover-polyfill)
solo donde falta la API, antes de `init()`:

```js
if (!Object.hasOwn(HTMLElement.prototype, "popover")) await import("@oddbird/popover-polyfill");
```

El polyfill pone `showPopover`, `hidePopover` y `togglePopover`, parchea `matches()`, `closest()` y
`querySelector()` para que entiendan `:popover-open`, y marca la capa abierta con la clase `:popover-open`, que la
hoja compat también reconoce. Lo que no puede imitar: la capa superior (`top layer`) real, así que un popover
compite por `z-index` con el resto de la página; y su hoja propia va en la capa `popover-polyfill`, que queda por
debajo de la suite compat (sin capas).

Con el polyfill va la hoja compat, aunque el navegador entienda `color-mix()`: la normal escribe `:popover-open`, que
el polyfill no puede añadir al CSS, y las reglas que lo llevan no se aplican a sus capas.

El binding de React usa las mismas comprobaciones (`zui/src/core/popover.ts`, y una copia en `zout`): sin polyfill
sus capas no se abren, pero nada lanza; con el polyfill se abren por él y se reconocen abiertas por su clase. Lo
pruebo en la suite de navegador con la API quitada a la página y con un polyfill simulado que hace lo mismo que
`@oddbird/popover-polyfill` (`tests/popover-api.mjs`); el polyfill de verdad no lo he cargado en el binding.

## Node

| Uso | Versión |
|---|---|
| Mínimo de los paquetes publicados (`engines`) | 22.12 |
| Desarrollo, integración continua y publicación | 26 |
| Matriz de compatibilidad en CI | 22 y 24, además de 26 |

Los paquetes son código de navegador; Node importa para el render en servidor, para las herramientas y para
quien los empaqueta. Subí el mínimo a 22.12 porque Node 20 terminó su soporte el 2026-04-30
([calendario de versiones de Node](https://nodejs.org/en/about/previous-releases)) y no quiero declarar
compatible una versión que ya no recibe correcciones de seguridad ni puedo seguir probando.

Los paquetes solo publican ESM. `require("@zuccadev-labs/zuix-zui")` funciona en un Node que carga ESM con
`require`, que es el caso desde 22.12.

## React

| | |
|---|---|
| Versión | React y React DOM 18.2 o posterior, o 19, como peers opcionales (`^18.2.0 \|\| ^19.0.0`) |
| Tipos | `@types/react` 18 o 19 para consumir los paquetes |
| Sin React | Todo lo que no es el binding: contrato, `zui/dom`, `zout/dom`, `<z-icon>` |

Hasta la 0.3 el binding pedía React 19. Hay proyectos que siguen en React 18 y no quiero dejarlos fuera, así que
el binding funciona con las dos. Lo que cambia entre ellas lo resuelvo en un módulo interno de cada paquete
(`react-compat.ts`), que lee la versión de React una vez, al cargarse:

| Diferencia | React 19 | React 18 | Qué hago |
|---|---|---|---|
| `ref` en un componente de función | Llega como una prop más | No llega; hace falta `forwardRef` | Los componentes que aceptan `ref` pasan por `withRef`: en 19 es la misma función; en 18 la envuelve en `forwardRef` y devuelve la ref a las props |
| Ref de un hijo (`trigger`, `asChild`) | `element.props.ref` (leer `element.ref` avisa) | `element.ref` | Se lee de donde esté |
| Una ref de función devuelve una limpieza | Se llama al desmontar | Aviso; se llama a la ref con `null` | La fusión de refs no devuelve limpieza en 18 |
| `inert` | Booleano | Atributo desconocido: solo se escribe con una cadena | `inert=""` en 18 |
| `popoverTarget` | Prop conocida, en camelCase | Desconocida: aviso con camelCase | `popovertarget` en minúsculas en 18 |
| `useLayoutEffect` en el servidor | Sin aviso | Aviso en cada render de servidor | `useEffect` cuando no hay `document` |

En React 18 los componentes que aceptan `ref` son objetos de `forwardRef`, no funciones: se usan con JSX igual,
pero no se llaman como función. `useId` da identificadores como `:r1:`; los dos puntos no valen en un selector CSS
sin escapar (`CSS.escape`), pero sí en `id`, `aria-*` y en un enlace `#…`.

Lo pruebo en cada cambio: la suite de navegador entera con la aplicación de ejemplo servida con React 18
(`REACT=18 pnpm test:browser`, que usa `examples/react18`) y `pnpm test:pack`, que instala los tarballs en un
proyecto con React 19 y otro con React 18, cada uno con sus `@types/react`, y comprueba render en servidor, render
en un DOM con refs y sin avisos de React en la consola, `tsc` y Vite.

Un límite de la prueba, no del paquete: la pantalla de la aplicación de ejemplo que renderiza en servidor dentro del
navegador (`?screen=audit-ssr`) recibe con React 18 el aviso de `useLayoutEffect`, porque allí sí hay `document`;
ese caso lo acepta solo con `REACT=18`. En Node, sin `document`, `pnpm test:pack` comprueba que no hay aviso.

Límite: el fuente de la suite compila con `@types/react` 19. Con los tipos de 18 da errores propios del fuente
(`useRef(null)` era de solo lectura en 18); las declaraciones publicadas sí compilan con los dos.

Con Server Components (Next.js App Router) funciona; los detalles están en
[Frameworks](./06-frameworks.md#con-nextjs-app-router).

## TypeScript

Las declaraciones se emiten con TypeScript 7 y se comprueban en cada cambio con TypeScript 5.9, 6 y 7, con
`skipLibCheck: false` y con `moduleResolution` `Bundler` y `NodeNext`. `IconName` es una unión de 366
literales: un nombre de icono que no existe no compila.

## Bundlers y gestores de paquetes

| Herramienta | Estado |
|---|---|
| Vite 8 | Probado en cada cambio, con los paquetes sueltos y con el paraguas |
| Next.js (última estable, App Router, Turbopack) | Probado en cada cambio |
| Rspack | Es el que usa el sitio de documentación, contra el fuente del workspace |
| webpack, Parcel | No los he probado contra el paquete publicado |
| pnpm, npm, bun | Instalan el peer `zuix-zicon` solos si falta |
| yarn 1 | No instala peers: hay que añadir `@zuccadev-labs/zuix-zicon` a mano |

Sin bundler, cada paquete trae en `dist/` un CSS y un módulo listos para enlazar
([Frameworks](./06-frameworks.md#empezar-sin-bundler)).

## Lo que no he comprobado

- Safari real, en macOS y en iOS. WebKit de Playwright en Linux comparte motor, no la integración con el
  sistema (foco de los botones al hacer clic, teclado en pantalla, VoiceOver).
- Las versiones mínimas de cada navegador: la línea sale de los datos de compatibilidad, no de ejecutar las
  pruebas en Chrome 116 o Firefox 125.
- Dispositivos táctiles reales.
- WebGL con GPU física para el modo `gl` del Carousel: los tres motores lo prueban por software.
- Yarn Berry (PnP).
- Servir los archivos de `dist/` desde un CDN público.
