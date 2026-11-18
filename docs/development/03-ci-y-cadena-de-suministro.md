# CI y cadena de suministro

Qué hacen los workflows del repositorio, cómo se protegen las dependencias y cómo comprobar desde fuera que
una versión publicada salió de aquí. El procedimiento de publicación está en
[Publicación](../package/02-publicacion.md).

## Workflows

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `ci` | Cada push a `main` y cada pull request; también lo llama `release` | La verificación completa |
| `codeql` | Push a `main`, pull requests y una vez por semana | Análisis estático de seguridad del TypeScript y JavaScript y de los propios workflows, con las consultas `security-extended` |
| `dependency-review` | Cada pull request | Falla si el cambio introduce una dependencia con un aviso de gravedad moderada o superior, o con licencia copyleft fuerte |
| `scorecard` | Push a `main` y una vez por semana | [OpenSSF Scorecard](https://scorecard.dev/): evalúa las prácticas de seguridad del repositorio, publica el resultado en scorecard.dev y lo guarda como artefacto |
| `pages` | Push a `main` que toque la documentación, la plantilla o los paquetes del catálogo | Compila el sitio con `--strict`, lo recorre y lo publica en GitHub Pages, si Pages está activado |
| `release` | Cada push a `main` | Publica en npm si la versión de los `package.json` no está en el registro |

### `ci`

| Trabajo | Qué ejecuta |
|---|---|
| Contrato, auditoría y tipos (Node 26) | `pnpm install --frozen-lockfile`, `pnpm audit`, lint, formato, pruebas unitarias con umbral, `pnpm check`, comprobación de que lo generado está al día (`git status --porcelain` no devuelve nada), build del sitio y `pnpm test:site`, `pnpm build`, `pnpm test:pack --skip-build --next`, y genera el SBOM y las huellas de los tarballs |
| Node 22 y Node 24 | `pnpm check`, `pnpm build` y la prueba de empaquetado sin Next.js |
| Navegador (Chromium, Firefox, WebKit) | `pnpm test:html` y `pnpm test:browser` en cada motor. Si fallan, sube las capturas |
| Windows | `pnpm check`, que lo generado sale igual, byte a byte, que en Linux, y las pruebas unitarias. Las suites de navegador y el empaquetado se quedan en Linux. No corre en la verificación de una publicación |

Son siete trabajos en un pull request (el primero, dos de Node, tres de navegador y Windows) y seis cuando
lo llama `release`: lo que se publica se construye y se prueba en Linux, así que un fallo propio de Windows
se ve en el pull request sin detener una versión. Para fusionar en `main` son obligatorios el primero y los
tres de navegador.

El primer trabajo deja tres artefactos: `dist`, `tarballs` (los cinco paquetes de `pnpm pack` con su
`SHA256SUMS`) y `sbom` (un CycloneDX por paquete). Los tarballs que publica `release` son esos, no otros
generados después.

Probé Node 22 y 24 además de 26 porque son las líneas con soporte que admiten los paquetes
([calendario de Node](https://nodejs.org/en/about/previous-releases)). Node 20 terminó el suyo el
2026-04-30 y lo retiré de la matriz y de `engines`.

### `scorecard`

La puntuación es pública: <https://scorecard.dev/viewer/?uri=github.com/zuccadev-labs/zuix>. El workflow la
publica firmada (`publish_results: true`) y guarda el SARIF como artefacto de la ejecución, treinta días.

No subo ese SARIF a Code scanning. Lo hice al principio y cada comprobación por debajo de 10 aparecía allí
como una alerta abierta, mezclada con las de CodeQL. Varias no miden el código sino el proyecto, y ningún
cambio en el repositorio las cierra: solo se podían descartar a mano. Prefiero que esa pestaña contenga
únicamente lo que se corrige con un cambio y que la evaluación del proyecto se lea donde está completa.

Lo que el proyecto no cumple hoy, con la puntuación del 2026-11-18 (Scorecard 5.6.0, total 7 sobre 10):

| Comprobación | Puntuación | Por qué | Qué la cambia |
|---|---|---|---|
| `Maintained` | 0 | El repositorio se creó el 2026-11-14 y Scorecard puntúa con 0 a todo repositorio con menos de 90 días | El tiempo: a partir del 2027-02-12 cuenta la actividad semanal |
| `Code-Review` | 0 | Ningún cambio fusionado tiene la aprobación de otra persona (0 de 7): soy el único mantenedor | Una segunda persona que revise |
| `CII-Best-Practices` | 0 | El proyecto no está registrado en [bestpractices.dev](https://www.bestpractices.dev/) | Registrarlo y completar el cuestionario; no lo he hecho todavía |
| `SAST` | 7 | Cuenta los pull requests fusionados cuyo último commit pasó un análisis estático, y `codeql` entró en el sexto (1 de 6) | Cada pull request nuevo: `codeql` ya se ejecuta en todos |
| `Fuzzing` | 0 | No había ninguna prueba con entradas generadas | Las [pruebas basadas en propiedades](02-calidad-y-pruebas.md#pruebas-basadas-en-propiedades): Scorecard las reconoce por la importación de `fast-check` en un archivo `.ts` o `.js` ([`fuzzing.go`](https://github.com/ossf/scorecard/blob/main/checks/raw/fuzzing.go)) |

Tres comprobaciones salen sin puntuación: `Branch-Protection`, porque el `GITHUB_TOKEN` del workflow no puede
leer las reglas de protección de rama; `Packaging` y `Signed-Releases`, porque todavía no hay ninguna
publicación hecha desde un workflow. La definición de cada una está en la
[documentación de Scorecard](https://github.com/ossf/scorecard/blob/main/docs/checks.md).

### Endurecimiento de los workflows

Sigo la guía de GitHub para el
[uso seguro de Actions](https://docs.github.com/en/actions/reference/security/secure-use):

- Cada acción está fijada por el SHA completo de su commit, con la versión en un comentario. Dependabot
  actualiza los dos.
- `GITHUB_TOKEN` de solo lectura por defecto. Un permiso de escritura se declara solo en el trabajo que lo
  necesita: `id-token` para publicar, `attestations` para firmar, `contents` para crear el Release, `pages`
  para desplegar, `security-events` para subir los resultados de CodeQL.
- `persist-credentials: false` en cada `checkout`: no quedan credenciales de git en disco.
- Sin secretos y sin `pull_request_target`.
- Ninguna expresión `${{ }}` dentro de un bloque `run:`; los valores entran por variables de entorno.
- En una verificación lanzada por `release` no se restaura ni se guarda caché: lo publicado no depende de una
  caché que otra ejecución pudo escribir.

## Dependencias

Las políticas están en `pnpm-workspace.yaml` y las aplica pnpm 12 en cada instalación, también con el
lockfile congelado ([seguridad de la cadena de suministro en pnpm](https://pnpm.io/supply-chain-security)).

| Política | Valor | Qué evita |
|---|---|---|
| Scripts de instalación | Ninguno se ejecuta (`allowBuilds` en `false` para los tres paquetes que declaran uno, y `strictDepBuilds`) | Que instalar ejecute código de un tercero. Un paquete nuevo con script detiene la instalación hasta que lo reviso |
| Antigüedad mínima | 1440 minutos (un día), escrita de forma explícita para que sea estricta | Instalar una versión recién publicada, que es donde aparecen los paquetes comprometidos |
| `trustPolicy: no-downgrade` | Una versión que pierde la procedencia o la publicación de confianza que tenían las anteriores no se instala | Una publicación hecha con credenciales robadas, fuera del flujo habitual del paquete |
| `blockExoticSubdeps` | Las dependencias transitivas solo pueden venir del registro | Dependencias por URL o por git |
| `overrides` | Tres rangos corregidos de dependencias transitivas del sitio de documentación | Avisos de seguridad que Docusaurus 3.10.2 todavía arrastra por fijar rangos antiguos |

Las excepciones a `trustPolicy` están escritas por versión exacta, cada una con la comprobación que la
justifica (qué mantenedor la publicó y a qué commit del repositorio de origen corresponde). Cada `override`
lleva el identificador del aviso que corrige y se retira cuando la dependencia publique el rango corregido.

Además:

- `pnpm audit` es un paso de `ci`: una vulnerabilidad conocida en el árbol hace fallar el pull request. Un
  aviso sin versión corregida no se puede resolver con un `override`: lo reviso y, si no afecta a lo que se
  publica, lo anoto por su identificador en `auditConfig.ignoreGhsas`, con el motivo. Hay uno: el ReDoS de
  `picomatch` (GHSA-fc5q-39xc-vjpf), que solo llega por herramientas de desarrollo. GitHub retiró ese aviso el
  2026-11-18, porque el autor de la librería no lo considera una vulnerabilidad; `pnpm audit` todavía lo
  marcaba ese día, y quito la línea en cuanto deje de hacerlo.
- Dependabot propone actualizaciones una vez por semana, agrupadas, y espera siete días desde que una versión
  se publica (catorce para una versión mayor). Las de seguridad no esperan.
- Todas las dependencias están en su última versión estable. Los paquetes publicados no tienen dependencias
  de terceros en ejecución; estas políticas protegen las herramientas con las que se construyen.

## Publicación

Publica solo el workflow `release`, cuando llega a `main` una versión que no está en el registro.

| Qué | Cómo |
|---|---|
| Autenticación | [Publicación de confianza de npm](https://docs.npmjs.com/trusted-publishers) por OIDC. No hay token de npm en el repositorio ni en ningún secreto |
| Qué se sube | Los tarballs que el trabajo de verificación generó y probó en la misma ejecución, comprobados contra su `SHA256SUMS` |
| Procedencia | npm la genera sola al publicar por OIDC desde un repositorio público |
| Atestación | Un trabajo aparte firma los cinco tarballs con `actions/attest` |
| Guardas de `latest` | Una versión preliminar no puede publicarse como `latest`, y una versión anterior a la que ya es `latest` tampoco |
| Dónde | Solo desde `main` y solo en `zuccadev-labs/zuix`: un fork no publica |
| Release | Etiqueta `vX.Y.Z`, notas tomadas de los `CHANGELOG.md`, y como adjuntos los tarballs, `SHA256SUMS` y los SBOM |

## Verificar una versión desde fuera

```
npm audit signatures                                             # en un proyecto que tenga instalada la suite
gh attestation verify zuccadev-labs-zuix-zui-X.Y.Z.tgz --repo zuccadev-labs/zuix
sha256sum --check SHA256SUMS                                     # con los adjuntos del Release
```

La `0.1.0` la publiqué a mano, antes de existir este flujo: no lleva procedencia ni atestación. Las
siguientes sí.

## El repositorio

| Ajuste | Estado |
|---|---|
| `main` | Protegida: todo entra por pull request con la CI en verde, historial lineal, sin `force push` ni borrado. Vale también para administradores |
| Revisión obligatoria de otra persona | No: soy el único mantenedor (`.github/CODEOWNERS`) |
| Alertas de secretos y protección de push | Activas |
| Dependabot | Alertas y actualizaciones de seguridad activas |
| Reporte privado de vulnerabilidades | Activo; es el canal de `SECURITY.md` |
| Entorno `npm` | Limitado a `main` |

## El sitio de documentación

`pages` compila el sitio con `--strict`, ejecuta `tests/site/run.mjs --quick` sobre el resultado y lo
despliega con `actions/deploy-pages`. Antes consulta a la API si GitHub Pages está activado en el
repositorio: mientras no lo esté, el sitio se compila y se recorre igual, el despliegue se omite y el resumen
de la ejecución dice cómo activarlo (Settings → Pages → Source: «GitHub Actions»). Así un ajuste pendiente no
deja en rojo cada cambio que toca la documentación. `url` y `baseUrl` salen de `zudocs/zudocs.config.json`
(`https://zuccadev-labs.github.io` y `/zuix/`). GitHub Pages no aplica cabeceras propias, así que la política
de contenido que genera `zudocs headers` no tiene efecto allí; sirve en un alojamiento que lea `_headers`.

## Lo que no he comprobado

- El workflow `release` no ha publicado todavía ninguna versión: la primera será la `0.2.0`. Lo validé en
  local y con la ejecución de ensayo.
- El trabajo de Windows no ha corrido todavía en ningún runner: repasé los scripts que ejecuta (rutas,
  finales de línea, procesos hijos) sin tener un Windows donde probarlos. Por eso se ve en el pull request
  y no forma parte de la verificación de una publicación.
- El despliegue de `pages` en el alojamiento real: Pages no está activado todavía. La consulta que lo detecta
  la probé en local contra la API, no en un runner.
- La puntuación de Scorecard con estos cambios ya en `main`; en particular, que `Fuzzing` pase a 10.
