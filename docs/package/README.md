# Empaquetado y publicación

Cómo se versionan, se construyen y se publican los paquetes de la suite. Para quien publica.
Última actualización: 2026-11-14.

> **Estado (2026-11-14):** los cinco paquetes están **publicados en npmjs.com en `0.1.0`**, bajo el scope
> `@zuccadev-labs`, con licencia MIT y acceso público. `0.1.0` la publicó el responsable a mano, con 2FA y
> sin procedencia. Las siguientes se publican solas al fusionar en `main` una subida de versión
> ([Publicación automática](./02-publicacion.md#publicación-automática-desde-main)); antes hay que registrar
> el trusted publisher en npmjs.com y crear el entorno `npm` en GitHub
> ([Configuración de una sola vez](./02-publicacion.md#configuración-de-una-sola-vez)).

## Documentos

| # | Documento | Qué responde |
|---|---|---|
| 01 | [Versionado](./01-versionado.md) | Qué número sube con cada cambio, cómo se sube y cómo llega a publicarse |
| 02 | [Publicación](./02-publicacion.md) | Publicación automática desde `main` con OIDC, configuración de una sola vez en npmjs.com y GitHub, vía manual con 2FA y ensayo con registro local |
| 03 | [Contrato público](./03-contrato-publico.md) | Qué es superficie pública y qué cuenta como cambio incompatible |
| 04 | [Apertura del repositorio](./04-apertura-del-repositorio.md) | Qué se saneó para hacerlo público y cómo hacer el primer push sin publicar el historial |

## Qué se publica

| Paquete | Contenido | Tarball (0.1.0) |
|---|---|---|
| `@zuccadev-labs/zuix-tokens` (`tokens/`) | CSS y JSON generados, marcas, capas de compatibilidad y esquemas | 20,9 kB · 24 archivos |
| `@zuccadev-labs/zuix-zicon` (`zicon/`) | ESM por icono, declaraciones, sprite, SVG sueltos, `<z-icon>` para navegador | 715,1 kB · 1425 archivos |
| `@zuccadev-labs/zuix-zui` (`zui/`) | ESM de componentes y `dom`, declaraciones, CSS, contrato HTML, bundles de navegador | 416,7 kB · 292 archivos |
| `@zuccadev-labs/zuix-zout` (`zout/`) | ESM de layouts y `dom`, declaraciones, CSS, contrato HTML, bundles de navegador | 69,1 kB · 44 archivos |
| `@zuccadev-labs/zuix` (`suite/`) | Paraguas: depende de los otros cuatro y los reexporta bajo subrutas. Sin código propio | 4,1 kB · 26 archivos |

Tamaño del tarball comprimido y número de archivos. Ninguno incluye `src/`, pruebas ni
`compat/*.inventory.json`; todos llevan `README.md`, `CHANGELOG.md` y `LICENSE`.

`@zuccadev-labs/zuix-zudocs` es la plantilla del sitio: lleva `"private": true` y no se publica. Tampoco
`examples/app` ni la raíz.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm build` | Genera `dist/` de `zicon`, `zui` y `zout`: ESM, declaraciones, sourcemaps, CSS y bundles de navegador. Comprueba que cada reexportación del paraguas apunta a una entrada publicada |
| `pnpm test:pack` | Empaqueta los cinco paquetes en `.tmp/pack/` y los prueba en tres proyectos fuera del workspace |
| `pnpm test:pack:next` | Lo anterior más un consumidor Next.js (App Router): build, marcado de servidor, hidratación e interacción en Chrome. Necesita red |
| `pnpm verify` | Puerta previa a una release: `check`, build de zudocs, `build`, `test:pack`, `test:html` y `test:browser` en Chromium |
| `pnpm bump check` | Comprueba que la versión es la misma en los cinco y que cada `CHANGELOG.md` la recoge |
| `pnpm bump patch` (o `minor`, `major`, `X.Y.Z`) | Sube la versión y cierra la sección "Sin publicar" de cada `CHANGELOG.md` |

Ninguno publica, crea etiquetas ni hace commits. Publica el workflow `release` cuando una subida de versión
llega a `main`, y es él quien crea la etiqueta y el GitHub Release.

## Estructura de `dist/`

```
zui/dist/
  esm/            ESM compilado por tsc, un archivo por módulo, con .d.ts y .js.map al lado
  styles/         hojas CSS sueltas (solo zui: @zuccadev-labs/zuix-zui/styles/<grupo>.css)
  zui.css         bundle de navegador: todos los estilos en un archivo
  zui.dom.js      bundle de navegador: @zuccadev-labs/zuix-zui/dom autocontenido y minificado
  zui.dom.carousel-gl.js  shaders del Carousel en modo WebGL; zui.dom.js lo carga solo si se usa
```

`zout/dist/` tiene `esm/`, `zout.css` y `zout.dom.js`; `zicon/dist/` tiene `esm/` y `zicon.element.js`.
`tokens/dist/` lo genera `pnpm tokens`. El paraguas no tiene `dist/`: sus archivos (`suite/*.js`, `*.d.ts`,
`*.css`) son reexportaciones de una línea escritas a mano. `dist/` está en `.gitignore`: se genera, no se edita.

Los bundles de navegador se quedan en la raíz de `dist/`. Sus rutas ya estaban en uso
(`examples/html`, `tests/html`, la guía de frameworks) y serán direcciones públicas en un CDN
(`…/@zuccadev-labs/zuix-zui/dist/zui.css`); `esm/` y `styles/` son carpetas nuevas que no chocan con ellas.

## Cómo funciona

### El workspace usa el fuente; el paquete publicado usa `dist/`

Cada `package.json` tiene dos mapas de entradas. `exports` apunta a `src/` y es el que ven `zudocs`,
`examples/app` y las pruebas: no hace falta compilar para desarrollar. `publishConfig.exports` apunta a
`dist/`, y pnpm lo copia sobre `main`, `types` y `exports` al empaquetar (`pnpm pack`, `pnpm publish`).
También sustituye `workspace:^` por `^X.Y.Z`.

Añadir una entrada nueva exige escribirla en los dos mapas. `pnpm test:pack` falla si un destino de
`exports` no está en el tarball.

### Compilación módulo a módulo, sin empaquetar

`tools/build.mjs` ejecuta `tsc -p tsconfig.build.json` en cada paquete, en orden (`zicon`, `zui`, `zout`),
y deja un `.js` por cada archivo fuente. Motivos:

- **Iconos.** Cada icono sigue siendo un módulo (`@zuccadev-labs/zuix-zicon/icons/bell`). Quien registra dos iconos
  carga dos. La prueba de Vite falla si el set completo entra en el bundle.
- **Un solo registro.** `zui` importa `@zuccadev-labs/zuix-zicon/core` y la aplicación `@zuccadev-labs/zuix-zicon/all`; ambos llegan
  al mismo `registry.js`. Empaquetar cada entrada por separado duplicaría el registro y los iconos
  registrados por la aplicación no se verían desde los componentes.
- **`"use client"` por archivo.** Un bundle único perdería la directiva o marcaría todo como cliente.

`tsc` no completa los especificadores relativos (`"./core"`), y Node los exige con extensión. El build
los reescribe a `"./core.js"` o `"./dir/index.js"` en `.js` y `.d.ts`. Por eso las declaraciones valen
con `moduleResolution` `Bundler` y `NodeNext`.

`zui` compila contra las declaraciones ya generadas de `zicon`, y `zout` contra las de `zui` (`paths` en
su `tsconfig.build.json`). Sin eso `tsc` seguiría el enlace del workspace hasta el fuente del otro paquete.

Los sourcemaps llevan el fuente dentro (`inlineSources`), así que `src/` no se publica. Los módulos de
icono no llevan sourcemap: son datos generados y duplicaría el tamaño del paquete.

No se añadió ninguna dependencia: `typescript` y `esbuild` ya estaban.

### `"use client"`

Va en el fuente, en la primera línea, y `tsc` lo conserva. El build falla si un archivo lo declara y su
salida no. Lo llevan 53 archivos: los que usan hooks, contexto, clases de React, Radix o manejadores de
eventos propios. No lo llevan los componentes que solo producen marcado (`Button`, `Badge`, `Card`,
`Icon`, `Page`, `Stack`…), que así pueden renderizarse en un Server Component.

Regla al crear o cambiar un componente: si usa un hook, contexto, Radix o un `onX={…}` propio, la
primera línea del archivo es `"use client";`.

Consecuencias en Next.js App Router, comprobadas con `pnpm test:pack:next` (Next 16, Turbopack):

- De un módulo cliente solo se pueden usar componentes desde el servidor, no funciones ni constantes.
- El registro de iconos es estado de módulo. `import "@zuccadev-labs/zuix-zicon/all"` debe ejecutarse en el servidor
  (por ejemplo en `app/layout.tsx`) y también en algún módulo cliente, porque los componentes cliente
  dibujan sus iconos con la copia del registro del navegador.

### `sideEffects`

| Paquete | Con efectos | Por qué |
|---|---|---|
| `zicon` | `index`, `all`, `element` y `dist/zicon.element.js` | Registran el set o definen `<z-icon>` al importarse |
| `zui`, `zout` | Todo `.css`, los módulos de `dom/` y `dist/*.dom.js` | Los estilos se importan por su efecto; los módulos `dom` registran sus iconos al cargarse |
| `tokens` | Todo `.css` | Solo publica CSS y JSON |
| Paraguas | `zicon.js`, `zicon-all.js`, `zicon-element.js`, `zui-dom.js`, `zout-dom.js` y todo `.css` | Reexportan entradas que tienen efectos |

El resto se declara sin efectos para que el bundler descarte los componentes que no se usan. La lista
nombra las rutas de `src/` y las de `dist/` porque `publishConfig` no puede reescribir este campo.

### Dependencias y peers

| Paquete | `dependencies` | `peerDependencies` |
|---|---|---|
| `tokens` | — | — |
| `zicon` | — | `react` (opcional) |
| `zui` | `tokens`, `radix-ui` | `zicon`; `react` y `react-dom` (opcionales) |
| `zout` | `tokens`, `zui` | `zicon`; `react` y `react-dom` (opcionales) |
| Paraguas | `tokens`, `zicon`, `zui`, `zout` | `react` y `react-dom` (opcionales) |

Las dependencias entre paquetes de la suite llevan rango `^X.Y.Z`. `zicon` es peer de `zui` y `zout` para
que el registro de iconos sea una sola copia: con dependencia exacta se reprodujeron dos copias e iconos
vacíos ([Publicación](./02-publicacion.md#registro-de-iconos-duplicado)).

`react` y `react-dom` son peers opcionales. `@zuccadev-labs/zuix-zicon/dom`, `@zuccadev-labs/zuix-zui/dom` y `@zuccadev-labs/zuix-zout/dom` no
importan React; `pnpm test:pack` lo comprueba cargándolos en un proyecto donde React no está instalado.
`radix-ui` es dependencia directa de `zui`: se instala siempre, aunque solo lo usa el binding de React.

## Verificación

```
pnpm build
pnpm test:pack
```

`pnpm test:pack` hace esto y sale con código distinto de 0 si algo falla:

1. `pnpm build` (se salta con `--skip-build`), `pnpm bump check` y `pnpm pack` de los cinco paquetes a `.tmp/pack/`.
2. Revisa cada tarball: sin `src/`, sin `workspace:`, sin archivos internos (`*.inventory.json`, pruebas,
   `tsconfig`), con `README.md`, `LICENSE`, `CHANGELOG.md`, nombre, licencia MIT, `description`, `keywords`,
   `repository`, `homepage`, `bugs` y `engines`, con cada destino de `exports` dentro, con rango `^` entre
   paquetes de la suite y con `zicon` como peer de `zui` y `zout`.
3. `.tmp/consumer/umbrella`: instala los cinco y comprueba que cada subruta del paraguas es el mismo módulo
   que la del paquete que reexporta, y que un `Button` con icono se dibuja a través de él.
4. `.tmp/consumer/react`: instala los tarballs con React, renderiza `Button`, `Badge`, `Stack` e `Icon`
   con `react-dom/server` y compara el marcado, resuelve 29 entradas de `exports`, pasa
   `tsc --noEmit` con `skipLibCheck: false` en `Bundler` y `NodeNext` (también importando por el paraguas),
   y compila con Vite dos veces: con los paquetes sueltos y con `@zuccadev-labs/zuix/styles.css` y las
   subrutas del paraguas.
5. `.tmp/consumer/dom`: instala los tarballs sin React e importa los módulos `dom`, sueltos y por el
   paraguas, en Node.
6. `publint` en los cinco y `@arethetypeswrong/cli` en los cuatro con JavaScript, con `pnpm dlx`. Sin red se avisa y no cuenta como fallo;
   `--skip-lint` los omite.

Los proyectos de prueba tienen su propio `pnpm-workspace.yaml`, que los convierte en raíz independiente.
No se usa `pnpm install --ignore-workspace`: en pnpm 12 esa opción también ignora ese archivo, que es
donde van los `overrides` que dirigen cada paquete `@zuccadev-labs/zuix…` a su tarball. Por esos `overrides`
esta prueba no ejercita la resolución por versión desde un registro: eso lo cubre el ensayo de abajo.

Resultado del 2026-11-14 (pnpm 12.18.0, Node 26.13.0): todo correcto, incluidos `publint` en los cinco
paquetes y `attw` (perfil `esm-only`) en `zicon`, `zui`, `zout` y el paraguas.

### Ensayo con registro local

`pnpm test:pack` instala con `overrides` hacia los tarballs. Para comprobar la instalación real (resolución
entre paquetes por versión, sin `overrides`) los cinco tarballs se publicaron el 2026-11-14 en un registro
local efímero (verdaccio 6.11.1, en `.tmp/`, sin tocar `~/.npmrc`) y se instalaron en proyectos vacíos con
pnpm 12.18.0, npm 12.2.2, yarn 1.22.22 y bun 1.4.4 (Node 26.13.0). El procedimiento está en
[Publicación](./02-publicacion.md#ensayo-contra-un-registro-local).

| Proyecto | pnpm | npm | yarn 1 | bun |
|---|---|---|---|---|
| `@zuccadev-labs/zuix` + React: `Button` con icono con `react-dom/server`, por las subrutas del paraguas; una copia de `zicon` | pasa | pasa | pasa | pasa |
| `@zuccadev-labs/zuix` sin pedir React: `zui/dom`, `zout/dom`, `zicon/dom` y `zicon/element` por el paraguas | pasa | pasa | pasa | pasa |
| `zui` + `zout` + `zicon` + `tokens` + React: el mismo render con los paquetes sueltos; una copia de `zicon` | pasa | pasa | pasa | pasa |
| Solo `tokens`: resuelven `tokens.css`, `css/<marca>.css`, `tokens.json`, `compat/<proyecto>.css`, `tailwind.css` | pasa | pasa | pasa | pasa |
| Solo `zicon`, sin React: `zicon/dom` y `zicon/element` | pasa | pasa | pasa | pasa |
| Solo `zui` (sin declarar `zicon`): `zui/dom` | pasa: instala el peer | pasa: instala el peer | **falla**: yarn 1 no instala peers; hay que añadir `zicon` | pasa: instala el peer |
| Solo `zout` (sin declarar `zicon`): `zout/dom` | pasa | pasa | **falla**, por lo mismo | pasa |

Además, con pnpm: los bloques de código `tsx` y `js` de los cinco README se extrajeron tal cual a un
proyecto y pasan `tsc --noEmit` (`strict`, `skipLibCheck: false`) con `moduleResolution` `Bundler` y
`NodeNext`; y Vite 7 compila el ejemplo de React y el ejemplo sin framework del README del paraguas, con
`@zuccadev-labs/zuix/styles.css` resuelto a una hoja con tokens, `zui` y `zout`.

Lo que se vio y no es un fallo:

- pnpm, npm y bun instalan `react` y `react-dom` aunque el proyecto no los pida: son peers de `radix-ui`,
  dependencia de `zui`. Las entradas sin framework no los importan. Con yarn 1 no se instalan y avisa de
  peers sin cumplir de `radix-ui`.
- Vite avisa de que ignora `"use client"` al empaquetar. Es lo esperado fuera de Next.js.

No cubierto por el ensayo: el flujo de 2FA y la procedencia de npmjs.com, Yarn Berry (PnP), y un navegador
sobre los proyectos instalados desde el registro (el navegador se prueba con `pnpm test:pack:next`,
`pnpm test:html` y `pnpm test:browser`).

## Sin verificar

- **Publicación automática.** `0.1.0` está en npmjs.com, publicada a mano. El workflow `release` no ha
  publicado nunca: se validó en local y contra el registro en solo lectura
  ([Publicación](./02-publicacion.md#sin-verificar)).
- **Next.js con el paraguas.** `pnpm test:pack:next` usa los paquetes sueltos; el paraguas se probó con Vite
  y en Node.
- **webpack, Rspack, Parcel y Turbopack contra el paquete publicado.** Solo Vite (7 en el ensayo con registro;
  8, con Rolldown, en `pnpm test:pack`). `zudocs` usa Rspack,
  pero contra el fuente.
- **`attw` en modo estricto.** Se ejecuta con el perfil `esm-only`: los paquetes no tienen salida CommonJS
  y `require("@zuccadev-labs/zuix-zui")` solo funciona en un Node que cargue ESM con `require`.
- **CDN.** Las rutas `dist/*.css` y `dist/*.js` existen en el tarball; no se probaron desde unpkg o jsDelivr.
- **El workflow `ci`** se ejecuta en cada push y pull request desde el 2026-11-14. Su uso como verificación
  de una publicación (`workflow_call` desde `release`) no se ha ejecutado todavía.
