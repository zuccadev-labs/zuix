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
| `scorecard` | Push a `main` y una vez por semana | [OpenSSF Scorecard](https://scorecard.dev/): evalúa las prácticas de seguridad del repositorio y publica el resultado |
| `pages` | Push a `main` que toque la documentación, la plantilla o los paquetes del catálogo | Compila el sitio con `--strict`, lo recorre y lo publica en GitHub Pages |
| `release` | Cada push a `main` | Publica en npm si la versión de los `package.json` no está en el registro |

### `ci`

| Trabajo | Qué ejecuta |
|---|---|
| Contrato, auditoría y tipos (Node 26) | `pnpm install --frozen-lockfile`, `pnpm audit`, lint, formato, pruebas unitarias con umbral, `pnpm check`, comprobación de que lo generado está al día (`git status --porcelain` no devuelve nada), build del sitio y `pnpm test:site`, `pnpm build`, `pnpm test:pack --skip-build --next`, y genera el SBOM y las huellas de los tarballs |
| Node 22 y Node 24 | `pnpm check`, `pnpm build` y la prueba de empaquetado sin Next.js |
| Navegador (Chromium, Firefox, WebKit) | `pnpm test:html` y `pnpm test:browser` en cada motor. Si fallan, sube las capturas |
| Windows | `pnpm check`, que lo generado sale igual, byte a byte, que en Linux, y las pruebas unitarias. Las suites de navegador y el empaquetado se quedan en Linux |

El primer trabajo deja tres artefactos: `dist`, `tarballs` (los cinco paquetes de `pnpm pack` con su
`SHA256SUMS`) y `sbom` (un CycloneDX por paquete). Los tarballs que publica `release` son esos, no otros
generados después.

Probé Node 22 y 24 además de 26 porque son las líneas con soporte que admiten los paquetes
([calendario de Node](https://nodejs.org/en/about/previous-releases)). Node 20 terminó el suyo el
2026-04-30 y lo retiré de la matriz y de `engines`.

### Endurecimiento de los workflows

Sigo la guía de GitHub para el
[uso seguro de Actions](https://docs.github.com/en/actions/reference/security/secure-use):

- Cada acción está fijada por el SHA completo de su commit, con la versión en un comentario. Dependabot
  actualiza los dos.
- `GITHUB_TOKEN` de solo lectura por defecto. Un permiso de escritura se declara solo en el trabajo que lo
  necesita: `id-token` para publicar, `attestations` para firmar, `contents` para crear el Release, `pages`
  para desplegar, `security-events` para subir resultados.
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

- `pnpm audit` es un paso de `ci`: una vulnerabilidad conocida en el árbol hace fallar el pull request.
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
despliega con `actions/deploy-pages`. `url` y `baseUrl` salen de `zudocs/zudocs.config.json`
(`https://zuccadev-labs.github.io` y `/zuix/`). GitHub Pages no aplica cabeceras propias, así que la política
de contenido que genera `zudocs headers` no tiene efecto allí; sirve en un alojamiento que lea `_headers`.

## Lo que no he comprobado

- El workflow `release` no ha publicado todavía ninguna versión: la primera será la `0.2.0`. Lo validé en
  local y con la ejecución de ensayo.
- El despliegue de `pages` en el alojamiento real.
- La puntuación de Scorecard con estos cambios ya en `main`.
