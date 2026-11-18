# Compatibilidad

Qué navegadores, qué versiones de Node, de React y de TypeScript, y qué bundlers admite la suite.

## Navegadores

| Navegador | Versión mínima |
|---|---|
| Chrome y Edge | 116 |
| Firefox | 125 |
| Safari (macOS) | 17 |
| Safari (iOS) | 18.3 |

El mínimo lo marca la [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API): todas las
capas flotantes de la suite son elementos `popover`. Esas son las versiones desde las que la plataforma la
da por disponible en todos los motores, según los datos de
[Baseline](https://web-platform-dx.github.io/web-features-explorer/features/popover/) (desde enero de 2025).
El resto de lo que uso llegó antes: `<dialog>`, `inert`, `:has()`, `color-mix()`, consultas de contenedor y
propiedades lógicas.

No hay polyfills ni una ruta alternativa para navegadores anteriores. En uno sin Popover API los menús, los
selectores y los avisos no se abren.

Lo que pruebo en cada cambio es más estrecho que esa línea: el Chrome instalado en el sistema y los motores
Firefox y WebKit que trae Playwright, siempre en su versión actual. No ejecuto las suites en las versiones
mínimas.

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
| Versión | React 19 y React DOM 19, como peers opcionales |
| React 18 | No se admite |
| Sin React | Todo lo que no es el binding: contrato, `zui/dom`, `zout/dom`, `<z-icon>` |

Probé React 18 y no funciona: `inert` no se aplica como atributo booleano, y los componentes reciben `ref`
como prop, sin `forwardRef`, que es la forma de React 19. No voy a mantener dos caminos.

Con Server Components (Next.js App Router) funciona; los detalles están en
[Frameworks](./06-frameworks.md#con-nextjs-app-router).

## TypeScript

Las declaraciones se emiten con TypeScript 7 y se comprueban en cada cambio con TypeScript 5.9, 6 y 7, con
`skipLibCheck: false` y con `moduleResolution` `Bundler` y `NodeNext`. `IconName` es una unión de 346
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
