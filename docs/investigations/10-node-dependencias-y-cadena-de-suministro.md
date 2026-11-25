# Node, dependencias y cadena de suministro

Qué versiones admito y por qué, cómo protejo la instalación de dependencias y cómo publico sin guardar un
token en ningún sitio. Notas de noviembre de 2026.

## Qué versión de Node

La `0.1.0` declaraba `node >=20` en los paquetes. Al revisarlo, Node 20 ya había terminado su soporte: el
2026-04-30, según el [calendario de versiones de Node](https://nodejs.org/en/about/previous-releases).

| Línea | Situación a noviembre de 2026 | Qué hago con ella |
|---|---|---|
| 20 | Sin soporte desde el 2026-04-30 | La retiro de `engines` y de la matriz de CI |
| 22 | Con soporte hasta el 2027-04-30 | Mínimo de los paquetes (22.12) y matriz de CI |
| 24 | Con soporte | Matriz de CI |
| 26 | La LTS más reciente | Desarrollo, CI y publicación |

Declarar compatible una versión sin soporte es prometer algo que no puedo comprobar: no recibe correcciones
de seguridad y las herramientas van dejando de admitirla. Subir el mínimo es un cambio incompatible, y por
eso va en una versión `MENOR` mientras la suite está en `0.x`.

El mínimo es 22.12 y no 22.0 por dos motivos: es lo que exige Vite 8 dentro de la rama 22, y es la versión
desde la que `require()` carga módulos ESM sin opciones, que importa porque los paquetes solo publican ESM.

## Últimas versiones estables, en todo

Aproveché la revisión para subir cada dependencia a su última versión estable. A 2026-11-17:

| Herramienta | Versión |
|---|---|
| TypeScript | 7.0.2 |
| React y React DOM | 19.3.1 |
| Vite | 8.3.8 |
| Docusaurus | 3.10.2, la última de la rama 3 |
| Biome | 2.6.8 |
| esbuild | 0.28.2 |
| playwright-core | 1.65.1 |
| axe-core | 4.14.1 |
| pnpm | 12.21.0 |

TypeScript 7 condicionó otras decisiones: es la razón por la que el linter es Biome
([Lint, pruebas y por qué no Barrits](./11-lint-pruebas-y-barrits.md)). Las declaraciones se emiten con 7 y
compruebo en cada cambio que sirven a quien sigue en 5.9 o en 6.

Los paquetes publicados no tienen dependencias de terceros en ejecución desde que quité la biblioteca de UI
([Primitivas propias](./08-primitivas-propias.md)). Todo lo que sigue protege las herramientas con las que
se construyen, que es por donde entra un ataque a la cadena de suministro.

## Instalar dependencias sin fiarse

pnpm 12 trae políticas de [seguridad de la cadena de suministro](https://pnpm.io/supply-chain-security). Las
activé todas en `pnpm-workspace.yaml` y las hice estrictas.

| Política | Qué decidí |
|---|---|
| Scripts de instalación | Ninguno se ejecuta. Tres paquetes del árbol declaran uno (esbuild, `@swc/core` y core-js) y los tres funcionan sin él: los dos primeros traen su binario como dependencia opcional de plataforma, y el del tercero es un mensaje. Con `strictDepBuilds`, un paquete nuevo con script detiene la instalación hasta que lo reviso |
| Antigüedad mínima | Un día. Es el valor por defecto de pnpm, pero escrito de forma explícita pasa a ser estricto: si ninguna versión del rango cumple, la resolución falla en vez de instalar la reciente |
| `trustPolicy: no-downgrade` | Una versión que pierde la procedencia o la publicación de confianza que tenían las anteriores no se instala |
| `blockExoticSubdeps` | Las dependencias transitivas solo vienen del registro: ni git ni tarballs por URL |

`trustPolicy` me obligó a revisar a mano cuatro paquetes. Eran retroportes de seguridad de ramas antiguas,
publicados a mano por el mismo mantenedor mientras la rama nueva ya salía con publicación de confianza. Los
dejé como excepciones por versión exacta, cada una con el commit del repositorio de origen al que
corresponde, comprobado. Prefiero una lista corta de excepciones revisadas a una política relajada.

Tres dependencias transitivas del sitio de documentación arrastraban avisos de seguridad porque Docusaurus
3.10.2 fija rangos antiguos. Las corregí con `overrides`, cada uno con el identificador del aviso y la nota
de retirarlo cuando Docusaurus publique el rango corregido. `pnpm audit` forma parte de la CI y tiene que
quedar en cero.

Dependabot propone las actualizaciones una vez por semana, agrupadas, y espera siete días desde que una
versión se publica; catorce si es una versión mayor. Las de seguridad no esperan.

## Los workflows

Seguí la guía de GitHub para el
[uso seguro de Actions](https://docs.github.com/en/actions/reference/security/secure-use):

- Acciones fijadas por el SHA completo, con la versión en un comentario.
- `GITHUB_TOKEN` de solo lectura; permisos de escritura solo en el trabajo que los necesita.
- Sin credenciales de git en disco, sin secretos, sin `pull_request_target`.
- Ninguna expresión `${{ }}` dentro de un `run:`.

Y añadí tres análisis que para un repositorio público no cuestan nada: CodeQL sobre el código y sobre los
propios workflows, revisión de dependencias en cada pull request (falla con un aviso de gravedad moderada o
con una licencia copyleft fuerte) y [OpenSSF Scorecard](https://scorecard.dev/).

## Publicar sin tokens

La `0.1.0` la publiqué a mano, con 2FA. Funciona, pero depende de mi máquina y no deja prueba de qué se
construyó ni dónde. Para lo siguiente tenía dos opciones:

| Opción | A favor | En contra |
|---|---|---|
| Un token de npm guardado como secreto del repositorio | Sencillo | Un secreto de larga duración que alguien puede robar, y que hay que rotar |
| [Publicación de confianza](https://docs.npmjs.com/trusted-publishers) por OIDC | No hay secreto: npm acepta una identidad de corta duración que firma GitHub. La procedencia se genera sola | Hay que registrar el workflow en cada paquete, y solo funciona en runners alojados por GitHub |

Elegí la segunda y no dejé la primera ni como respaldo: el respaldo es la publicación manual con 2FA. Un
token que existe "por si acaso" es un token que se puede filtrar.

Alrededor de eso:

- **Se publica lo que se probó.** El trabajo que publica no descarga el repositorio ni instala nada: recibe
  los tarballs que la verificación generó y probó en esa misma ejecución, y comprueba sus huellas.
- **Guardas de `latest`.** Una versión preliminar no puede salir como `latest`, y una versión anterior a la
  que ya es `latest` tampoco.
- **Atestaciones y SBOM.** Cada tarball publicado se firma, y el Release adjunta los tarballs, sus huellas y
  un inventario CycloneDX por paquete.
- **`main` protegida**, también para mí: todo entra por pull request con la CI en verde.

El funcionamiento día a día está en [CI y cadena de suministro](../development/03-ci-y-cadena-de-suministro.md)
y el procedimiento, en [Publicación](../package/02-publicacion.md).

Cuando escribí estas notas, la publicación de confianza solo estaba validada en local y en ensayo. La
comprobé de principio a fin el 2026-11-19: la `0.2.0` salió por el workflow, sin token y con procedencia.

## Lo que no he comprobado

- **Node 22 y 24 con las suites de navegador.** En esas dos líneas la CI ejecuta la generación, el build y la
  prueba de empaquetado; las suites de navegador corren con Node 26.
- **La puntuación de Scorecard** con todo esto ya en `main`.
