# Publicación

Cómo se publica la suite en npmjs.com: el flujo automático desde `main`, lo que hay que configurar una sola
vez y la vía manual de respaldo.

La `0.1.0` la publiqué a mano el 2026-11-14, con 2FA, desde los tarballs verificados; no lleva procedencia.
Desde entonces la publicación es automática: fusionar en `main` una subida de versión es lo que publica. Una
versión publicada no se puede reutilizar ni renombrar: ante un fallo se publica un `PARCHE`.

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

| # | Decisión | Qué elegí y por qué |
|---|---|---|
| 1 | Licencia de los paquetes | MIT. `LICENSE` en la raíz y en cada paquete, `"license": "MIT"` |
| 2 | Licencia del set de iconos | MIT también. Los dibujos salen del archivo Dazicon de DAZLABS, salvo 20 que dibujé yo para un proyecto propio |
| 3 | Registro | Público, npmjs.com. `publishConfig.access: "public"` en los cinco |
| 4 | Scope y nombres | La organización `zuccadev-labs` de npmjs.com, que es mía. Nombres: `@zuccadev-labs/zuix` y `@zuccadev-labs/zuix-<paquete>` |
| 5 | Repositorio y página | `https://github.com/zuccadev-labs/zuix`, público. `repository` (con `directory`), `homepage` y `bugs` están en los cinco `package.json` |
| 6 | Quién publica | El workflow `release`, al llegar la subida de versión a `main`, con publicación de confianza (OIDC) y sin token. No quiero un token de npm guardado en ningún sitio. La vía manual queda como respaldo |
| 7 | `zicon`: dependencia o peer de `zui` y `zout` | **Peer**, con rango `^`. Ver [Registro de iconos duplicado](#registro-de-iconos-duplicado) |
| 8 | Rango de las dependencias entre paquetes de la suite | `^X.Y.Z` (`workspace:^`), no la versión exacta. Ver [Versionado](./01-versionado.md) |
| 9 | Qué sube al registro | Los tarballs que la verificación generó y probó, nunca una carpeta |

## Lista previa

Es lo que comprueba el pull request de la subida de versión: el workflow `ci` lo ejecuta todo. En local,
desde la raíz y con el árbol limpio, `pnpm verify` encadena `check`, lint, pruebas unitarias, el build y la
prueba del sitio, `build`, `test:pack`, `test:html` y `test:browser` en Chromium; la lista completa añade
Firefox, WebKit y el consumidor Next.js.

```
pnpm install --frozen-lockfile
pnpm audit                                       # sin vulnerabilidades conocidas
pnpm lint && pnpm format:check                   # Biome y la regla de "use client"
pnpm test:unit                                   # lógica pura, con umbral de cobertura
pnpm check                                       # tokens, iconos, auditoría, manifiestos, contrato HTML, tipos
pnpm --filter @zuccadev-labs/zuix-zudocs build   # el sitio compila y no tiene enlaces rotos
pnpm test:site:all                               # el sitio compilado en Chrome, Firefox y WebKit
pnpm test:html:all                               # contrato HTML en Chrome, Firefox y WebKit
pnpm test:browser:all                            # aplicación de React en Chrome, Firefox y WebKit
pnpm build                                       # dist/ de publicación y comprobación del paraguas
pnpm test:pack:next                              # consumo externo desde los cinco tarballs, incluido Next.js
pnpm bump check                                  # versión única y CHANGELOG al día
```

Además:

- [ ] Cada cambio visible está en el `CHANGELOG.md` de su paquete, en la entrada de la versión.
- [ ] Los cambios incompatibles están en la guía de actualización de `docs/users/`.
- [ ] La versión subió según [Versionado](./01-versionado.md).
- [ ] `pnpm test:pack` no avisó de que `publint` o `attw` no pudieron ejecutarse.
- [ ] La versión no existe ya en el registro: `npm view @zuccadev-labs/zuix versions`.

## Publicación automática desde main

`.github/workflows/release.yml`. Subir la versión y fusionar en `main` es lo que publica; no hay que crear
etiquetas ni lanzar nada a mano.

```
pnpm bump minor            # o patch, major, X.Y.Z: sube los cinco y cierra "Sin publicar"
pnpm install               # actualiza el lockfile
git switch -c release/vX.Y.Z && git commit -am "release: vX.Y.Z"
# pull request → ci en verde → fusionar en main
```

Cada push a `main` lanza el workflow:

| Trabajo | Qué hace | Permisos |
|---|---|---|
| `detect` | `pnpm bump check` y, por cada paquete, `npm view <paquete>@<versión>`. Si los cinco están en el registro termina en verde y los demás trabajos se saltan. Un fallo de red al consultar detiene la ejecución: no se da una versión por pendiente sin un `E404`. Aplica además las guardas de `latest` | `contents: read` |
| `verify` | Llama a `ci.yml` (`workflow_call`) sin cachés: la misma verificación que cualquier cambio, en Node 22, 24 y 26 y en los tres navegadores, con el consumidor Next.js. Deja los cinco tarballs de `pnpm pack`, sus huellas y un SBOM por paquete | `contents: read` |
| `publish` | En el entorno `npm`. Descarga los tarballs, comprueba sus huellas y ejecuta `npm publish <tarball> --access public --tag <dist-tag>` en orden (`tokens`, `zicon`, `zui`, `zout`, `suite`), saltando lo que ya esté publicado. No descarga el repositorio ni instala dependencias | `id-token: write` |
| `attest` | Firma los cinco tarballs publicados (`actions/attest`); la atestación se comprueba con `gh attestation verify` | `id-token: write`, `attestations: write` |
| `release` | Crea la etiqueta `vX.Y.Z` sobre el commit publicado y el GitHub Release, con las notas de la entrada `[X.Y.Z]` de los cinco `CHANGELOG.md`, y adjunta los tarballs, `SHA256SUMS` y los SBOM. Si el Release ya existe no lo toca | `contents: write` |
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
- **Guardas de `latest`.** La etiqueta de distribución es `latest`, o `next` si la versión es preliminar
  (`0.2.0-beta.1`). Una versión preliminar no puede salir como `latest`, y una versión anterior a la que ya
  es `latest` tampoco: movería `latest` hacia atrás.
- **Un fork no publica.** `detect` solo corre en `zuccadev-labs/zuix`.

Ejecución manual (Actions → release → Run workflow):

| Entrada | Efecto |
|---|---|
| "dry-run" marcado (por defecto) | Desde cualquier rama: detecta, verifica y ensaya. No sube nada ni crea etiqueta |
| "dry-run" desmarcado | Solo desde `main`: lo mismo que un push. Sirve para repetir una publicación fallida |
| `dist-tag` | Sustituye la etiqueta de distribución calculada |

### Autenticación: publicación de confianza (OIDC)

El trabajo `publish` no usa ningún token de larga duración, y no hay vía alternativa con token. npm acepta
la publicación porque GitHub firma una identidad de corta duración (OIDC) que dice qué repositorio, workflow
y entorno la piden, y esa identidad coincide con el publicador de confianza registrado en cada paquete. La
procedencia se genera sola (repositorio público, paquete público). Requisitos de npm, según
[docs.npmjs.com/trusted-publishers](https://docs.npmjs.com/trusted-publishers):

| Requisito | Cómo se cumple |
|---|---|
| npm CLI 11.5.1 o posterior y Node 22.14.0 o posterior | `publish` usa Node 26 y falla con un mensaje claro si la versión de npm o de Node es menor |
| Runner alojado por GitHub (los propios no están admitidos) | `runs-on: ubuntu-latest` |
| Permiso `id-token: write` | Declarado solo en `publish` y en `attest` |
| El workflow registrado es el que contiene la orden de publicar. Con `workflow_call`, npm valida el workflow que llama | `npm publish` está en `release.yml`, no en `ci.yml`; `release.yml` es el que se registra |
| El entorno, si se registra, debe coincidir | `environment: npm` |
| `repository.url` del `package.json` coincide exactamente con el repositorio | Los cinco llevan `git+https://github.com/zuccadev-labs/zuix.git` |
| Todos los campos distinguen mayúsculas | `zuccadev-labs`, `zuix`, `release.yml`, `npm` |

## Configuración de una sola vez

Lo que no se puede dejar hecho desde el código y hago yo con mi cuenta.

| Paso | Estado |
|---|---|
| Entorno `npm` en GitHub, limitado a `main` | Hecho |
| Etiqueta `v0.1.0` y su Release, sobre el commit publicado | Hecho |
| Publicador de confianza en npmjs.com, en los cinco paquetes | Hecho. La `0.2.0` fue la primera versión publicada con él |
| Origen de GitHub Pages: "GitHub Actions" (Settings → Pages) | Hecho. El workflow `pages` despliega el sitio |

Mientras la versión de `main` sea una que ya está en el registro, el workflow se queda en `detect` (verde,
"nada que publicar").

### Entorno `npm` en GitHub

Con permiso de administración sobre el repositorio:

```
gh api -X PUT repos/zuccadev-labs/zuix/environments/npm --input - <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
gh api -X POST repos/zuccadev-labs/zuix/environments/npm/deployment-branch-policies -f name=main -f type=branch
gh api repos/zuccadev-labs/zuix/environments/npm/deployment-branch-policies --jq '.branch_policies[].name'   # main
```

Para exigir aprobación manual de cada publicación se añaden revisores al entorno (Settings → Environments →
npm → Required reviewers). No lo hago: con revisores, la publicación deja de ser desatendida.

### Publicador de confianza en npmjs.com, en cada uno de los cinco paquetes

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
publicación en un plazo de 2 días; si no, caduca y hay que crearla otra vez. Por eso la registré justo antes
de fusionar la subida a `0.2.0`, no semanas antes.

Después de la primera publicación automática correcta, npm recomienda cerrar la vía de los tokens: en la
misma página, **Publishing access** → *Require two-factor authentication and disallow tokens*. La
publicación de confianza sigue funcionando; la manual con 2FA también.

## Publicación manual, con 2FA

Así publiqué la `0.1.0` el 2026-11-14. Queda como respaldo si el workflow no puede publicar. Una versión
publicada a mano no lleva procedencia, y hay que crear después su etiqueta y su Release.

Se publican **los tarballs que generó y verificó `pnpm test:pack`**, con `npm publish <archivo>`. Así lo
que sube es byte a byte lo que se probó, y es el mismo procedimiento que ensayé contra un registro local.
Los tarballs los hace pnpm (`pnpm pack`): es quien aplica `publishConfig.exports` y sustituye `workspace:^`
por `^X.Y.Z`. No se ejecuta `npm publish` dentro de la carpeta de un paquete: subiría un `package.json`
que apunta a `src/`.

1. Verificar y empaquetar. `pnpm test:pack` deja los cinco tarballs en su carpeta de trabajo, que git ignora:

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
   cd <carpeta de los tarballs>
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
   mkdir zuix-check && cd zuix-check && npm init -y
   npm install @zuccadev-labs/zuix@0.1.0 react react-dom
   node --input-type=module -e 'import "@zuccadev-labs/zuix/zicon/all"; import { createElement as h } from "react"; import { renderToStaticMarkup } from "react-dom/server"; import { Button } from "@zuccadev-labs/zuix/zui"; console.log(renderToStaticMarkup(h(Button, { icon: "plus" }, "ok")).includes("<path") ? "ok" : "ICONO VACÍO")'
   ```

6. Etiqueta y Release sobre el commit publicado:
   `gh release create vX.Y.Z --repo zuccadev-labs/zuix --target <commit> --title "zuix X.Y.Z" --notes-file <notas>`.
   La etiqueta no lanza ninguna publicación.
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
mkdir -p registro-local && cd registro-local      # una carpeta de trabajo fuera del control de versiones
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
npm publish <carpeta de los tarballs>/zuccadev-labs-zuix-tokens-0.1.0.tgz --userconfig ./npmrc --registry http://127.0.0.1:4873/
# … los otros cuatro, en orden. Después, en proyectos vacíos:
pnpm add @zuccadev-labs/zuix react react-dom --registry http://127.0.0.1:4873/
```

Cada gestor guarda en caché los metadatos por dirección del registro: si se repite el ensayo con otros
tarballs, se usa otro puerto. Un proyecto de prueba creado dentro del repositorio necesita su propio
`pnpm-workspace.yaml` (pnpm) o su propio campo `packageManager` (yarn 1) para no tomarse por parte del workspace.

Lo ensayé el 2026-11-14 con la `0.1.0` (verdaccio 6.11.1; pnpm 12.18.0, npm 12.2.2, yarn 1.22.22 y bun 1.4.4;
Node 26.13.0). El resultado está en la tabla de [Empaquetado](./README.md#ensayo-con-registro-local).

## Si algo sale mal

- **El workflow falló a medias.** Corregir la causa y repetir la ejecución (Re-run, o manual sin "dry-run"
  desde `main`): salta lo publicado y sigue. Si falló solo `release`, repetir ese trabajo o crear el Release
  a mano con `gh release create`.
- **`publish` falla con `ENEEDAUTH`.** El publicador de confianza no coincide: nombre del workflow (`release.yml`),
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

Lo reproduje el 2026-11-14 en un registro local con dos versiones de la suite publicadas (`0.1.0` y una
`0.1.1` de prueba), instalando una y subiendo después solo una parte. Comparé dos diseños:

| Caso | Antes: `zicon` como dependencia exacta | Publicado: `zicon` como peer `^`, dependencias `^` |
|---|---|---|
| `zui` y `zicon` en la misma versión | 1 copia, iconos dibujados | 1 copia, iconos dibujados |
| Se sube solo `zicon` (pnpm y npm) | **2 copias, iconos vacíos** | 1 copia, iconos dibujados |
| Se sube solo `zui` (pnpm) | **2 copias, iconos vacíos** | 1 copia, iconos dibujados; pnpm avisa del peer |
| Se sube solo `zui` (npm) | 1 copia: npm sube también `zicon` | 1 copia: npm sube también `zicon` |
| Paraguas, y se añade un `zicon` suelto más nuevo que la aplicación importa directamente (pnpm y npm) | **2 copias, iconos vacíos** | 1 copia, iconos dibujados |
| Solo el paraguas, iconos por sus subrutas, y se sube el paraguas (pnpm) | no ensayado | 1 copia, iconos dibujados |
| Paraguas y un `zicon` suelto que la aplicación importa directamente; se sube solo el paraguas (pnpm) | **2 copias, iconos vacíos** | **2 copias, iconos vacíos** |

Decidí que `@zuccadev-labs/zuix-zicon` sea `peerDependency` de `zui` y `zout`, con rango `^X.Y.Z`, y que el resto de
dependencias entre paquetes de la suite lleven también rango `^`. La aplicación instala `zicon` de forma
explícita (ya lo hacía: es ella quien importa `@zuccadev-labs/zuix-zicon/all` o `/element`, y con pnpm un
paquete que se importa hay que declararlo). pnpm, npm y bun lo instalan solos si falta; yarn 1 no: avisa y
la importación falla. El paraguas lo trae como dependencia.

El último caso no lo evita ningún diseño: quien usa el paraguas importa los iconos por sus subrutas
(`@zuccadev-labs/zuix/zicon/all`) y, si además declara un paquete suelto, los actualiza juntos
(`pnpm up "@zuccadev-labs/*"`). Está escrito en el README del paraguas y en la [guía de uso](../users/README.md#instalar).

## Lo que no he comprobado

- **Reintentar una publicación que falló a medias.** La `0.2.0` y la `0.3.0` salieron por el workflow
  `release`, con procedencia SLSA en npm, etiqueta, Release con los tarballs y atestaciones. Si npm acepta
  unos paquetes y rechaza otros, el reintento salta los que ya están en el registro; no lo he visto ocurrir.
- **Versiones preliminares**: el cálculo de `next` como etiqueta de distribución no se ha estrenado.
- **CDN** (unpkg, jsDelivr): las rutas `dist/` existen en los tarballs; no las he probado servidas.
