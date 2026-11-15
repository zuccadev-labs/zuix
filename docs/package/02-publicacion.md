# Publicación

Cómo se publica la suite en npmjs.com. Última actualización: 2026-11-14.

Flujo automático desde `main`, configuración de una sola vez y vía manual de respaldo.

> **Estado (2026-11-14):** los cinco paquetes están publicados en npmjs.com en `0.1.0`. Esa primera versión
> la publicó el responsable a mano, con 2FA, desde los tarballs verificados; no lleva procedencia. Desde
> entonces la publicación es automática al fusionar en `main` una subida de versión
> ([Publicación automática](#publicación-automática-desde-main)), con publicación de confianza de npm (OIDC).
> Falta la [configuración de una sola vez](#configuración-de-una-sola-vez) en npmjs.com y en GitHub: hasta
> que esté hecha, el workflow no puede publicar.
> Una versión publicada no se puede reutilizar ni renombrar: ante un fallo se publica un `PARCHE`.

## Qué se publica

Cinco paquetes, siempre con la misma versión y en este orden (cada uno después de los que necesita):

| Orden | Paquete | Carpeta | Tarball de `pnpm pack` |
|---|---|---|---|
| 1 | `@zuccadev-labs/zuix-tokens` | `tokens/` | `zuccadev-labs-zuix-tokens-X.Y.Z.tgz` |
| 2 | `@zuccadev-labs/zuix-zicon` | `zicon/` | `zuccadev-labs-zuix-zicon-X.Y.Z.tgz` |
| 3 | `@zuccadev-labs/zuix-zui` | `zui/` | `zuccadev-labs-zuix-zui-X.Y.Z.tgz` |
| 4 | `@zuccadev-labs/zuix-zout` | `zout/` | `zuccadev-labs-zuix-zout-X.Y.Z.tgz` |
| 5 | `@zuccadev-labs/zuix` (paraguas) | `suite/` | `zuccadev-labs-zuix-X.Y.Z.tgz` |

La raíz, `zudocs` y `examples/app` llevan `"private": true` y no se publican. Los cinco de la tabla no lo
llevan: `pnpm publish` en una de esas carpetas publica de verdad.

En npm: [`@zuccadev-labs/zuix`](https://www.npmjs.com/package/@zuccadev-labs/zuix),
[`-tokens`](https://www.npmjs.com/package/@zuccadev-labs/zuix-tokens),
[`-zicon`](https://www.npmjs.com/package/@zuccadev-labs/zuix-zicon),
[`-zui`](https://www.npmjs.com/package/@zuccadev-labs/zuix-zui) y
[`-zout`](https://www.npmjs.com/package/@zuccadev-labs/zuix-zout). En el registro cada uno tiene además una
versión `0.0.0-stage`, anterior a `0.1.0`; `latest` apunta a `0.1.0`.

## Decisiones

Todas tomadas.

| # | Decisión | Resultado |
|---|---|---|
| 1 | Licencia de los paquetes | MIT. `LICENSE` en la raíz y en cada paquete, `"license": "MIT"` |
| 2 | Licencia del set de iconos de origen (Dazicon) | MIT, fijada por el responsable. No se contrastó con el archivo de origen |
| 3 | Registro | Público, npmjs.com. `publishConfig.access: "public"` en los cinco |
| 4 | Scope y nombres | Organización `zuccadev-labs` de npmjs.com, de la que el responsable es propietario. Nombres: `@zuccadev-labs/zuix` y `@zuccadev-labs/zuix-<paquete>` |
| 5 | Repositorio y página | `https://github.com/zuccadev-labs/zuix`, público. `repository` (con `directory`), `homepage` y `bugs` están en los cinco `package.json` |
| 6 | Quién publica | `0.1.0`, el responsable a mano con 2FA. Las siguientes, el workflow `release` al llegar la subida de versión a `main`, con publicación de confianza (OIDC) y sin token. La vía manual queda como respaldo |
| 7 | `@zuccadev-labs/zuix-zicon`: dependencia o peer de `zui` y `zout` | **Peer**, con rango `^`. Ver [Registro de iconos duplicado](#registro-de-iconos-duplicado) |
| 8 | Rango de las dependencias entre paquetes de la suite | `^X.Y.Z` (`workspace:^`), no la versión exacta. Ver [Versionado](./01-versionado.md) |
| 9 | Código heredado del proyecto de origen | Reutilización autorizada por el responsable ([estado de construcción](../investigations/07-estado-de-construccion.md)) |

## Lista previa

Es lo que comprueba el pull request de la subida de versión (el workflow `ci` ejecuta todo menos el
consumidor Next.js, que añade `release`). En local, desde la raíz y con el árbol limpio: `pnpm verify` encadena `check`, el build
de zudocs, `build`, `test:pack`, `test:html` y `test:browser` en Chromium; la lista completa añade Firefox,
WebKit y el consumidor Next.js.

```
pnpm install --frozen-lockfile
pnpm check                                       # tokens, iconos, auditoría, manifiestos, contrato HTML, tipos
pnpm --filter @zuccadev-labs/zuix-zudocs build   # el sitio compila y no tiene enlaces rotos
pnpm test:html:all                               # contrato HTML en Chrome, Firefox y WebKit
pnpm test:browser:all                            # aplicación de React en Chrome, Firefox y WebKit
pnpm build                                       # dist/ de publicación y comprobación del paraguas
pnpm test:pack:next                              # consumo externo desde los cinco tarballs, incluido Next.js
pnpm bump check                                  # versión única y CHANGELOG al día
```

Además:

- [ ] Cada cambio visible está en el `CHANGELOG.md` de su paquete, en la entrada de la versión.
- [ ] La versión subió según [Versionado](./01-versionado.md).
- [ ] `pnpm test:pack` no avisó de que `publint` o `attw` no pudieron ejecutarse.
- [ ] Se revisó el contenido de cada tarball: `tar -tzf .tmp/pack/zuccadev-labs-zuix-zui-X.Y.Z.tgz`.
- [ ] La versión no existe ya en el registro: `npm view @zuccadev-labs/zuix versions`.

## Publicación automática desde main

`.github/workflows/release.yml`. Subir la versión y fusionar en `main` es lo que publica; no hay que crear
etiquetas ni lanzar nada a mano.

```
pnpm bump patch            # o minor, major, X.Y.Z: sube los cinco y cierra "Sin publicar"
pnpm install               # actualiza el lockfile
git switch -c release/vX.Y.Z && git commit -am "release: vX.Y.Z"
# pull request → ci en verde → fusionar en main
```

Cada push a `main` lanza el workflow:

| Trabajo | Qué hace | Permisos |
|---|---|---|
| `detect` | `pnpm bump check` y, por cada paquete, `npm view <paquete>@<versión>`. Si los cinco están en el registro termina en verde y los demás trabajos se saltan. Un fallo de red al consultar detiene la ejecución: no se da una versión por pendiente sin un `E404` | `contents: read` |
| `verify` | Llama a `ci.yml` (`workflow_call`): la misma verificación que cualquier cambio, en los tres navegadores, más el consumidor Next.js (`pnpm test:pack --skip-build --next`). Deja los cinco tarballs de `pnpm pack` en el artefacto `tarballs` | `contents: read` |
| `publish` | En el entorno `npm`. Descarga `tarballs` y ejecuta `npm publish <tarball> --access public --tag <dist-tag>` en orden (`tokens`, `zicon`, `zui`, `zout`, `suite`), saltando lo que ya esté publicado. No descarga el repositorio ni instala dependencias | `id-token: write` |
| `release` | Crea la etiqueta `vX.Y.Z` sobre el commit publicado y el GitHub Release, con las notas de la entrada `[X.Y.Z]` de los cinco `CHANGELOG.md` y enlaces a npm. Si el Release ya existe no lo toca | `contents: write` |
| `rehearse` | Solo en una ejecución manual con "dry-run": el mismo bucle con `npm publish --dry-run`, sin entorno ni credenciales | ninguno |

Reglas:

- **Lo que sube es lo que se probó.** Se publican los tarballs que generó y verificó `pnpm test:pack` en la
  misma ejecución, nunca `npm publish` dentro de una carpeta. `publish` comprueba además que cada tarball es
  del paquete y la versión esperados, que no es privado y que no lleva rangos `workspace:`.
- **Idempotente.** Una versión que ya está en el registro se salta, en `detect` y otra vez justo antes de
  cada `npm publish`. Si la ejecución se queda a medias se repite (Re-run) y continúa por el paquete que falta.
- **Sin carreras.** `concurrency: release` sin cancelación: una publicación en curso termina, y la siguiente
  ejecución vuelve a consultar el registro.
- **La etiqueta no publica.** El workflow solo escucha pushes a `main`. La etiqueta la crea él mismo por la
  API con `GITHUB_TOKEN`, que además no dispara workflows.
- **Etiqueta de distribución.** `latest`, o `next` si la versión es preliminar (`0.2.0-beta.1`). Una
  ejecución manual puede fijar otra.
- **Un fork no publica.** `detect` solo corre en `zuccadev-labs/zuix`.

Ejecución manual (Actions → release → Run workflow):

| Entrada | Efecto |
|---|---|
| "dry-run" marcado (por defecto) | Desde cualquier rama: detecta, verifica y ensaya. No sube nada ni crea etiqueta |
| "dry-run" desmarcado | Solo desde `main`: lo mismo que un push. Sirve para repetir una publicación fallida |
| `dist-tag` | Sustituye la etiqueta de distribución calculada |

### Autenticación: publicación de confianza (OIDC)

El trabajo `publish` no usa ningún token de larga duración. npm acepta la publicación porque GitHub firma
una identidad de corta duración (OIDC) que dice qué repositorio, workflow y entorno la piden, y esa
identidad coincide con el *trusted publisher* registrado en cada paquete. La procedencia se genera sola
(repositorio público, paquete público). Requisitos de npm, leídos en
[docs.npmjs.com/trusted-publishers](https://docs.npmjs.com/trusted-publishers) el 2026-11-14:

| Requisito | Cómo se cumple |
|---|---|
| npm CLI 11.5.1 o posterior y Node 22.14.0 o posterior | `publish` usa Node 24 y falla con un mensaje claro si la versión de npm o de Node es menor |
| Runner alojado por GitHub (los propios no están admitidos) | `runs-on: ubuntu-latest` |
| Permiso `id-token: write` | Declarado solo en `publish` |
| El workflow registrado es el que contiene la orden de publicar. Con `workflow_call`, npm valida el workflow que llama | `npm publish` está en `release.yml`, no en `ci.yml`; `release.yml` es el que se registra |
| El entorno, si se registra, debe coincidir | `environment: npm` |
| `repository.url` del `package.json` coincide exactamente con el repositorio | Los cinco llevan `git+https://github.com/zuccadev-labs/zuix.git` |
| Todos los campos distinguen mayúsculas | `zuccadev-labs`, `zuix`, `release.yml`, `npm` |

Alternativa: si el entorno `npm` tiene un secreto `NPM_TOKEN` (token granular con escritura sobre
`@zuccadev-labs`, sin exigir 2FA al publicar), `publish` lo usa en lugar de OIDC y pide la procedencia con
`NPM_CONFIG_PROVENANCE=true`. Sin el secreto, OIDC. No hace falta crearlo.

## Configuración de una sola vez

Nada de esto se puede dejar hecho desde el código: lo hace el responsable con su cuenta. Hasta entonces el
workflow se queda en `detect` (verde, "nada que publicar") mientras la versión siga en `0.1.0`.

### 1. Entorno `npm` en GitHub, limitado a `main`

Con permiso de administración sobre el repositorio:

```
gh api -X PUT repos/zuccadev-labs/zuix/environments/npm --input - <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
gh api -X POST repos/zuccadev-labs/zuix/environments/npm/deployment-branch-policies -f name=main -f type=branch
gh api repos/zuccadev-labs/zuix/environments/npm/deployment-branch-policies --jq '.branch_policies[].name'   # main
```

Para exigir aprobación manual de cada publicación, añadir revisores al entorno (Settings → Environments →
npm → Required reviewers). Con revisores, la publicación deja de ser desatendida: espera la aprobación.

### 2. Trusted publisher en npmjs.com, en cada uno de los cinco paquetes

Con la cuenta propietaria de la organización `zuccadev-labs`, con 2FA. En cada página de ajustes:

| Paquete | Ajustes |
|---|---|
| `@zuccadev-labs/zuix-tokens` | <https://www.npmjs.com/package/@zuccadev-labs/zuix-tokens/access> |
| `@zuccadev-labs/zuix-zicon` | <https://www.npmjs.com/package/@zuccadev-labs/zuix-zicon/access> |
| `@zuccadev-labs/zuix-zui` | <https://www.npmjs.com/package/@zuccadev-labs/zuix-zui/access> |
| `@zuccadev-labs/zuix-zout` | <https://www.npmjs.com/package/@zuccadev-labs/zuix-zout/access> |
| `@zuccadev-labs/zuix` | <https://www.npmjs.com/package/@zuccadev-labs/zuix/access> |

1. Sección **Trusted Publisher** → **GitHub Actions**.
2. Rellenar, exactamente así (distingue mayúsculas; npm no valida nada al guardar, el error aparece al publicar):

   | Campo | Valor |
   |---|---|
   | Organization or user | `zuccadev-labs` |
   | Repository | `zuix` |
   | Workflow filename | `release.yml` (solo el nombre, con extensión; sin `.github/workflows/`) |
   | Environment name | `npm` |
   | Allowed actions | Marcar **`npm publish`**. En las configuraciones creadas desde el 2026-09-03 solo viene activo `npm stage publish`, y el workflow publica directamente |

3. Guardar (pide el segundo factor). Repetir en los otros cuatro.

Lo mismo desde la terminal, con npm 11.15.0 o posterior y sesión iniciada con 2FA (`npm login`):

```
for p in zuix-tokens zuix-zicon zuix-zui zuix-zout zuix; do
  npm trust github "@zuccadev-labs/$p" --file release.yml --repo zuccadev-labs/zuix --env npm --allow-publish
done
for p in zuix-tokens zuix-zicon zuix-zui zuix-zout zuix; do npm trust list "@zuccadev-labs/$p"; done
```

**Cuándo hacerlo.** Según la documentación de npm, una configuración nueva debe completar su primera
publicación en un plazo de 2 días; si no, caduca y hay que crearla otra vez. Conviene registrarla justo
antes de fusionar la primera subida de versión (`0.1.1` o `0.2.0`), no semanas antes.

Después de la primera publicación automática correcta, npm recomienda cerrar la vía de los tokens: en la
misma página, **Publishing access** → *Require two-factor authentication and disallow tokens*. La
publicación de confianza sigue funcionando; la manual con 2FA también.

### 3. Etiqueta y Release de `0.1.0`

`0.1.0` se publicó a mano, antes de existir este flujo, y no tiene etiqueta ni Release. El commit publicado
es `0d069bd`. Las notas están preparadas con el mismo guion que usa el workflow (se regeneran con el paso
"Notas desde los CHANGELOG" de `release.yml` y `VERSION=0.1.0`):

```
gh release create v0.1.0 --repo zuccadev-labs/zuix --target 0d069bd \
  --title "zuix 0.1.0" --notes-file .tmp/ci-release-notes-0.1.0.md
gh release view v0.1.0 --repo zuccadev-labs/zuix --json tagName,targetCommitish,url
```

`gh release create` crea la etiqueta `v0.1.0` sobre ese commit. Crear la etiqueta no lanza ninguna
publicación.

## Publicación manual, con 2FA

Así se publicó `0.1.0` el 2026-11-14. Queda como respaldo si el workflow no puede publicar. Una versión
publicada a mano no lleva procedencia, y hay que crear después su etiqueta y su Release (como en
[Etiqueta y Release de `0.1.0`](#3-etiqueta-y-release-de-010)).

Se publican **los tarballs que generó y verificó `pnpm test:pack`**, con `npm publish <archivo>`. Así lo
que sube es byte a byte lo que se probó, y es el mismo procedimiento que se ensayó contra un registro local.
Los tarballs los hace pnpm (`pnpm pack`): es quien aplica `publishConfig.exports` y sustituye `workspace:^`
por `^X.Y.Z`. No se ejecuta `npm publish` dentro de la carpeta de un paquete: subiría un `package.json`
que apunta a `src/`.

1. Verificar y empaquetar. Deja los cinco tarballs en `.tmp/pack/`:

   ```
   pnpm install --frozen-lockfile
   pnpm verify
   pnpm test:pack:next
   ```

2. Iniciar sesión en npmjs.com y comprobar la cuenta y la organización:

   ```
   npm login                    # abre el navegador; pide el segundo factor
   npm whoami
   npm org ls zuccadev-labs     # la cuenta debe figurar como owner
   ```

3. Publicar en orden. Cada orden pide el segundo factor: npm abre una página para aprobarlo en el navegador
   (allí se puede marcar que no vuelva a preguntar durante cinco minutos), o se le pasa el código de la
   aplicación con `--otp=<código>`. El código caduca a los 30 segundos: va uno por orden.

   ```
   cd .tmp/pack
   npm publish zuccadev-labs-zuix-tokens-0.1.0.tgz --access public
   npm publish zuccadev-labs-zuix-zicon-0.1.0.tgz  --access public
   npm publish zuccadev-labs-zuix-zui-0.1.0.tgz    --access public
   npm publish zuccadev-labs-zuix-zout-0.1.0.tgz   --access public
   npm publish zuccadev-labs-zuix-0.1.0.tgz        --access public
   ```

   Si una orden falla, se corrige la causa y se repite desde esa: las anteriores ya están publicadas y npm
   rechaza subir dos veces la misma versión (`403`/`409`), sin efecto.

4. Comprobar en el registro:

   ```
   for p in zuix-tokens zuix-zicon zuix-zui zuix-zout zuix; do npm view "@zuccadev-labs/$p@0.1.0" name version dist.tarball; done
   npm view @zuccadev-labs/zuix@0.1.0 dependencies
   npm view @zuccadev-labs/zuix-zui@0.1.0 dependencies peerDependencies
   ```

   El paraguas debe depender de los otros cuatro con `^0.1.0`, y `zui` debe declarar
   `@zuccadev-labs/zuix-zicon` como peer.

5. Comprobar desde fuera, en una carpeta vacía (los metadatos pueden tardar un minuto en propagarse):

   ```
   mkdir /tmp/zuix-check && cd /tmp/zuix-check && npm init -y
   npm install @zuccadev-labs/zuix@0.1.0 react react-dom
   node --input-type=module -e 'import "@zuccadev-labs/zuix/zicon/all"; import { createElement as h } from "react"; import { renderToStaticMarkup } from "react-dom/server"; import { Button } from "@zuccadev-labs/zuix/zui"; console.log(renderToStaticMarkup(h(Button, { icon: "plus" }, "ok")).includes("<path") ? "ok" : "ICONO VACÍO")'
   ```

6. Etiqueta y Release sobre el commit publicado, con `gh release create` (ver
   [Etiqueta y Release de `0.1.0`](#3-etiqueta-y-release-de-010)). La etiqueta no lanza ninguna publicación.
   Al llegar ese commit a `main`, el workflow `release` encuentra las versiones en el registro y no hace nada.

Una versión preliminar se publica con `--tag next` para que no pase a ser `latest`.

Alternativa con pnpm, que empaqueta y publica en un paso (`pnpm publish` acepta `--otp`):

```
for d in tokens zicon zui zout suite; do (cd "$d" && pnpm publish --access public --dry-run); done   # ensayo
for d in tokens zicon zui zout suite; do (cd "$d" && pnpm publish --access public); done
```

No se usa `pnpm -r publish`: publicaría cualquier paquete del workspace que dejara de ser privado.

## Ensayo contra un registro local

Valida lo que `pnpm test:pack` no cubre: que los paquetes se resuelven entre sí por versión desde un
registro, sin `overrides`, con varios gestores. No toca `~/.npmrc`: usa su propia configuración.

```
mkdir -p .tmp/registry && cd .tmp/registry
cat > config.yaml <<'EOF'
storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
    max_users: 10
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@zuccadev-labs/*':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
  '**':
    access: $all
    proxy: npmjs
EOF
pnpm dlx verdaccio@6 --config ./config.yaml --listen 127.0.0.1:4873 &   # anotar el PID y cerrarlo al terminar
curl -s -X PUT -H 'Content-Type: application/json' -d '{"name":"local","password":"local-local-1"}' \
  http://127.0.0.1:4873/-/user/org.couchdb.user:local        # devuelve un token
printf 'registry=http://127.0.0.1:4873/\n//127.0.0.1:4873/:_authToken=<token>\n' > npmrc
npm publish ../pack/zuccadev-labs-zuix-tokens-0.1.0.tgz --userconfig ./npmrc --registry http://127.0.0.1:4873/
# … los otros cuatro, en orden. Después, en proyectos vacíos:
pnpm add @zuccadev-labs/zuix react react-dom --registry http://127.0.0.1:4873/
```

Cada gestor guarda en caché los metadatos por dirección del registro: si se repite el ensayo con otros
tarballs, se usa otro puerto. Un proyecto de prueba creado dentro del repositorio necesita su propio
`pnpm-workspace.yaml` (pnpm) o su propio campo `packageManager` (yarn 1) para no tomarse por parte del workspace.

Resultado del ensayo del 2026-11-14 (verdaccio 6.11.1; pnpm 12.18.0, npm 12.2.2, yarn 1.22.22 y bun 1.4.4;
Node 26.13.0): ver la tabla de [Empaquetado](./README.md#ensayo-con-registro-local).

## Si algo sale mal

- **El workflow falló a medias.** Corregir la causa y repetir la ejecución (Re-run, o manual sin "dry-run"
  desde `main`): salta lo publicado y sigue. Si falló solo `release`, repetir ese trabajo o crear el Release
  a mano con `gh release create`.
- **`publish` falla con `ENEEDAUTH`.** El trusted publisher no coincide: nombre del workflow (`release.yml`),
  entorno (`npm`), organización o repositorio mal escritos, `npm publish` sin marcar en *Allowed actions*,
  o la configuración caducó sin estrenarse. Se borra y se crea de nuevo; no se puede editar.
- **Se publicaron solo algunos paquetes.** Repetir desde el que falló. Mientras falte alguno, el paraguas
  no se puede instalar; los ya publicados sí, salvo `zout` sin `zui`.
- **La versión publicada está rota.** Corregir y publicar un `PARCHE` de los cinco. Marcar la rota:
  `npm deprecate "@zuccadev-labs/zuix-zui@X.Y.Z" "Usar X.Y.Z+1"`. No reutilizar un número de versión.
- **Retirar una versión.** npmjs.com solo permite `npm unpublish` durante 72 horas y si nada depende de
  ella; el número queda quemado igualmente. Después, solo `deprecate`.

## Registro de iconos duplicado

Los iconos se registran en un mapa dentro de `@zuccadev-labs/zuix-zicon`. Si en un proyecto acaban instaladas
dos copias, la aplicación registra en una y los componentes leen de la otra: los iconos salen vacíos y la
consola avisa de que no están registrados.

Se reprodujo el 2026-11-14 en un registro local con dos versiones de la suite publicadas (`0.1.0` y una
`0.1.1` de prueba), instalando una y subiendo después solo una parte. Se compararon dos diseños:

| Caso | Antes: `zicon` como dependencia exacta | Publicado: `zicon` como peer `^`, dependencias `^` |
|---|---|---|
| `zui` y `zicon` en la misma versión | 1 copia, iconos dibujados | 1 copia, iconos dibujados |
| Se sube solo `zicon` (pnpm y npm) | **2 copias, iconos vacíos** | 1 copia, iconos dibujados |
| Se sube solo `zui` (pnpm) | **2 copias, iconos vacíos** | 1 copia, iconos dibujados; pnpm avisa del peer |
| Se sube solo `zui` (npm) | 1 copia: npm sube también `zicon` | 1 copia: npm sube también `zicon` |
| Paraguas, y se añade un `zicon` suelto más nuevo que la aplicación importa directamente (pnpm y npm) | **2 copias, iconos vacíos** | 1 copia, iconos dibujados |
| Solo el paraguas, iconos por sus subrutas, y se sube el paraguas (pnpm) | no ensayado | 1 copia, iconos dibujados |
| Paraguas y un `zicon` suelto que la aplicación importa directamente; se sube solo el paraguas (pnpm) | **2 copias, iconos vacíos** | **2 copias, iconos vacíos** |

Decisión: `@zuccadev-labs/zuix-zicon` es `peerDependency` de `zui` y `zout`, con rango `^X.Y.Z`, y el resto de
dependencias entre paquetes de la suite llevan también rango `^`. La aplicación instala `zicon` de forma
explícita (ya lo hacía: es ella quien importa `@zuccadev-labs/zuix-zicon/all` o `/element`, y con pnpm un
paquete que se importa hay que declararlo). pnpm, npm y bun lo instalan solos si falta; yarn 1 no: avisa y
la importación falla. El paraguas lo trae como dependencia.

El último caso no lo evita ningún diseño: quien usa el paraguas importa los iconos por sus subrutas
(`@zuccadev-labs/zuix/zicon/all`) y, si además declara un paquete suelto, los actualiza juntos
(`pnpm up "@zuccadev-labs/*"`). Está escrito en el README del paraguas y en la [guía de uso](../users/README.md#instalar).

## Sin verificar

- **El workflow `release` no se ha ejecutado nunca en GitHub.** Se validó en local: sintaxis YAML,
  `actionlint` 1.7.12 (sin `shellcheck`), y los guiones de `detect`, del bucle de publicación y de las notas
  extraídos del propio archivo y ejecutados contra el registro real en solo lectura (2026-11-14: concluye
  "nada que publicar"; con copias de los tarballs en una versión que no existe, `npm publish <tarball>
  --dry-run` recorre los cinco en orden y sin sesión iniciada). No se ha comprobado en un runner: que el artefacto `tarballs` llegue a `publish`, que
  `ci.yml` llamado con `workflow_call` no comparta grupo de concurrencia con el `ci` del mismo push, ni el
  consumidor Next.js en el runner.
- **La publicación de confianza.** No hay ningún trusted publisher registrado todavía. No se ha comprobado
  que npm acepte la identidad OIDC al publicar un tarball con `npm publish <archivo>`, ni la procedencia
  resultante. Los requisitos son los de la documentación de npm del 2026-11-14.
- **La alternativa con `NPM_TOKEN`**: no existe el secreto y no se probó.
- **La publicación manual de `0.1.0`** la hizo el responsable; aquí solo se comprobó el resultado en el
  registro (`npm view`: los cinco en `0.1.0`, `latest` → `0.1.0`).
- Versiones preliminares: el cálculo de `next` como etiqueta de distribución no se ha estrenado.
- CDN (unpkg, jsDelivr): las rutas `dist/` existen en los tarballs; no se probaron servidas.
