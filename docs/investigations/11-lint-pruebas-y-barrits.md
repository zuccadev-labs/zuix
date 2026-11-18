# Lint, pruebas y por qué no Barrits

La `0.1.0` salió sin linter, sin formateador y sin pruebas unitarias: tenía auditoría de estilo, tipos y
pruebas de navegador. Estas son las notas de cómo cerré ese hueco en noviembre de 2026, y de por qué no usé
aquí Barrits, que es un proyecto mío.

## Linter: Biome y no ESLint

Lo que necesitaba: reglas de TypeScript y de hooks de React, accesibilidad en JSX, CSS y JSON, y formato.
Todo rápido, porque quiero ejecutarlo en cada cambio.

| | ESLint con typescript-eslint | Biome |
|---|---|---|
| TypeScript 7 | No lo admite todavía ([versiones que admite](https://typescript-eslint.io/users/dependency-versions/)) | No depende del compilador de TypeScript |
| Formato | Otra herramienta | Incluido |
| CSS y JSON | Con complementos | Incluidos |
| Velocidad | — | Una pasada completa de lint sobre el repositorio tarda menos de medio segundo |
| Configuración | Varios paquetes y sus versiones | Un archivo |

La primera fila decidió. El repositorio ya estaba en TypeScript 7, y no iba a bajar de versión del compilador
para poder pasar un linter. Lo que pierdo es el ecosistema de complementos de ESLint y las reglas que
necesitan información de tipos; para lo que tengo aquí, las reglas de [Biome](https://biomejs.dev/) bastan.

### Cómo lo configuré

- Base: las reglas recomendadas, el dominio de React y el grupo de accesibilidad.
- Como error: importaciones y variables sin usar, dependencias de hooks, `any` explícito, `import type`,
  el protocolo `node:` y `console` salvo `warn` y `error`.
- Como informativas: la aserción no nula, `!important` y la especificidad descendente. Tienen usos legítimos
  aquí (el reset, el movimiento reducido, los estados) y prefiero verlas a prohibirlas.
- Desactivada: la regla que pide elementos semánticos en lugar de roles. Pide un `<hr>` donde hay un
  `role="separator"` interactivo, que es exactamente el patrón de APG para un divisor redimensionable. En una
  biblioteca que implementa patrones ARIA es un falso positivo.
- Las reglas de hooks no se aplican al código sin React: `gl.useProgram` de WebGL no es un hook.
- Formato: 2 espacios y 140 columnas, lo mismo que uso en Barrits.
- Markdown se queda fuera: el formateador realinea las tablas.

El lint falla con errores y con avisos (`--error-on-warnings`). Un aviso que no bloquea acaba siendo ruido.

### Lo que encontró

La primera pasada, sobre 368 archivos, dio 94 errores, 39 avisos y 166 notas informativas, y el formateador
cambiaba 229 archivos. Lo que más pesaba:

| Regla | Casos | Qué era |
|---|---|---|
| Aserción no nula | 78 | Informativa. Habitual con acceso indexado comprobado |
| `!important` | 53 | Informativa. Casi todos en la hoja base, para las preferencias del sistema |
| Funciones que devuelven un valor en un tipo `void` | 17 | Limpiezas de efectos mal tipadas |
| Índice del array como clave de React | 15 | Listas sin identificador propio. Escribí un generador de claves estables |
| Retorno en un callback de iteración | 10 | `forEach` con flecha de expresión |
| Dependencias de hooks | 9 | Varias eran errores reales |
| Reglas de accesibilidad | Unas veinte entre todas | Atributos ARIA no admitidos por el rol, elementos estáticos con manejadores |

Corregí los errores a mano, uno a uno. No apliqué las correcciones "inseguras" en bloque: una de ellas
rompía una herramienta que necesita una función construible. El formato lo apliqué en un commit aparte.

### La regla que ningún linter trae

Un módulo de React con hooks, contexto o manejadores propios tiene que empezar por `"use client"`, o un
Server Component que lo importe falla al compilar en Next.js. Ningún linter lo comprueba, así que es un
script propio dentro de `pnpm lint` (`tools/use-client.mjs`), con sus pruebas. En su primera pasada encontró
un módulo sin la directiva.

## Pruebas unitarias: `node:test`

Las pruebas de navegador ejercitan la interfaz, pero son lentas para lo que es pura aritmética: fechas,
paginación, orden de tabla, colocación de una capa, contraste de color. Quería pruebas que tardaran segundos.

Elegí el runner nativo de Node, con `tsx` para importar el TypeScript real y `happy-dom` donde hace falta un
documento. El motivo es el mismo que con el resto del repositorio: menos dependencias y menos configuración.
`node:test` trae cobertura de V8 y umbrales, que es todo lo que necesitaba.

La cobertura se mide sobre una lista explícita de módulos de lógica, no sobre todo el código, con umbral del
80 % de líneas, 70 % de ramas y 75 % de funciones. Una cobertura global habría mezclado la lógica pura con
componentes que solo se prueban bien en un navegador.

Escribir esas pruebas encontró siete fallos que las suites de navegador no habían visto:

| Dónde | Qué |
|---|---|
| Paginación (tres) | Una página no entera, un total de páginas no numérico, `setPage` con `NaN` |
| Orden de tabla (dos) | Los `NaN` y las celdas sin cifras en una columna numérica contaban como cero |
| Lógica del modo sin framework (dos) | Valores no numéricos en el Slider, y fechas con año menor que 100 |

Todos son casos límite de entrada, que es justo lo que una prueba de navegador con datos de ejemplo no
alcanza.

## Barrits

[Barrits](https://github.com/zuccadev-labs/Barrits) es un motor mío que analiza el código por su árbol
sintáctico, descubre lo que cada módulo exporta y genera a partir de ahí manifiestos y puntos de entrada.
zuix tiene justo ese problema en pequeño: cada grupo de componentes tiene un `index.ts` que reexporta sus
piezas, y un componente que no llega a ese índice no existe para quien usa el paquete. Antes de escribir una
comprobación a mano quise ver si Barrits la daba hecha.

### El prototipo

Copié el fuente de `zui`, `zout` y `zicon` a una carpeta de pruebas con la estructura que Barrits espera y le
pedí el inventario, con la versión 0.3.1.

| Qué probé | Resultado |
|---|---|
| Instalarlo junto a TypeScript 7 | Barrits declara `typescript >=5.0.0 <7.0.0` como peer. Con TypeScript 7, que es la versión de este repositorio, no encaja |
| El inventario de `zui` | Correcto: 89 archivos, 515 exportaciones, 10 índices, sin colisiones |
| Añadir un componente y no reexportarlo desde su índice | El inventario cambia, pero nada falla: describe lo que hay, no comprueba que falte algo |
| Declarar dos componentes con el mismo nombre en dos grupos | Tampoco lo señaló. Eso sí lo detecta ya el compilador (`TS2308`) |

### Por qué no lo uso aquí

1. **Exige TypeScript anterior a la 7.** No voy a bajar el compilador de la suite por una herramienta, ni
   siquiera mía.
2. **No valida índices.** Barrits está pensado para descubrir y orquestar lo que un proyecto declara, no para
   fallar cuando un índice escrito a mano se queda incompleto. Lo que yo necesitaba era lo segundo.
3. **Pide su propia estructura de carpetas.** Adoptarlo habría significado reorganizar tres paquetes para
   resolver una comprobación de pocas líneas.

No es un defecto de Barrits: resuelve otro problema, y lo resuelve bien donde lo uso. Para zuix escribí la
comprobación que quería, sin dependencias: `tools/check-barrels.mjs` falla si un componente con manifiesto no
se puede importar desde la raíz de su paquete, y forma parte de `pnpm check` (`pnpm barrels`). La dirección
contraria, un componente exportado sin manifiesto, ya la comprobaba `pnpm manifest`, y las colisiones de
nombres las detecta el compilador.

Lo que sí me llevo es una tarea para Barrits: admitir TypeScript 7.

## Lo que no he comprobado

- Reglas con información de tipos (promesas sin esperar, comparaciones imposibles). Biome no las tiene todas
  y no las echo de menos todavía, pero es un hueco.
- La cobertura de los componentes de React, que no entra en el umbral: su prueba es la de navegador.
