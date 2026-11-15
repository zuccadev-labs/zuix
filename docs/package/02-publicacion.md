# Publicación

Pasos exactos para publicar la suite en npmjs.com. Última actualización: 2026-11-14.

> **Estado (2026-11-14):** los cinco paquetes están en `0.1.0`, verificados y sin publicar. La primera
> publicación es manual y la hace el responsable con su cuenta ([Primera publicación](#primera-publicación-manual-con-2fa)).
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

## Decisiones

Todas tomadas. Ninguna queda pendiente para publicar `0.1.0`.

| # | Decisión | Resultado |
|---|---|---|
| 1 | Licencia de los paquetes | MIT. `LICENSE` en la raíz y en cada paquete, `"license": "MIT"` |
| 2 | Licencia del set de iconos de origen (Dazicon) | MIT, fijada por el responsable. No se contrastó con el archivo de origen |
| 3 | Registro | Público, npmjs.com. `publishConfig.access: "public"` en los cinco |
| 4 | Scope y nombres | Organización `zuccadev-labs` de npmjs.com, de la que el responsable es propietario. Nombres: `@zuccadev-labs/zuix` y `@zuccadev-labs/zuix-<paquete>` |
| 5 | Repositorio y página | `https://github.com/zuccadev-labs/zuix`, público. `repository` (con `directory`), `homepage` y `bugs` están en los cinco `package.json` |
| 6 | Quién publica | La primera versión, el responsable a mano con 2FA. Las siguientes, a mano o con el workflow `release` cuando tenga su secreto |
| 7 | `@zuccadev-labs/zuix-zicon`: dependencia o peer de `zui` y `zout` | **Peer**, con rango `^`. Ver [Registro de iconos duplicado](#registro-de-iconos-duplicado) |
| 8 | Rango de las dependencias entre paquetes de la suite | `^X.Y.Z` (`workspace:^`), no la versión exacta. Ver [Versionado](./01-versionado.md) |
| 9 | Código heredado del proyecto de origen | Reutilización autorizada por el responsable ([estado de construcción](../investigations/07-estado-de-construccion.md)) |

## Lista previa

Todo desde la raíz, con el árbol limpio y en la rama principal. `pnpm verify` encadena `check`, el build
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
- [ ] La versión subió según [Versionado](./01-versionado.md). Para `0.1.0` no hay subida: es la primera.
- [ ] `pnpm test:pack` no avisó de que `publint` o `attw` no pudieron ejecutarse.
- [ ] Se revisó el contenido de cada tarball: `tar -tzf .tmp/pack/zuccadev-labs-zuix-zui-X.Y.Z.tgz`.
- [ ] La versión no existe ya en el registro: `npm view @zuccadev-labs/zuix versions` (la primera vez
  responde `404`: es lo esperado).

## Primera publicación, manual, con 2FA

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

6. Etiqueta `v0.1.0` sobre el commit publicado y push de la etiqueta. **Hasta que exista el secreto
   `NPM_TOKEN`**, el push de la etiqueta lanza el workflow `release`, que verifica y falla al publicar por
   falta de credencial, sin subir nada; cuando el secreto exista, el workflow salta las versiones ya publicadas.

Una versión preliminar se publica con `--tag next` para que no pase a ser `latest`.

### Versiones siguientes

```
pnpm bump patch            # o minor, major, X.Y.Z: sube los cinco y cierra "Sin publicar"
pnpm install               # actualiza el lockfile
```

Después, la lista previa, commit `release: vX.Y.Z`, y los pasos 1 a 6 con la versión nueva.

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

## Publicación desde GitHub Actions

`.github/workflows/release.yml`. **No se ha ejecutado nunca:** el repositorio remoto existe, pero no tiene
todavía el secreto ni el entorno.

| Cómo se lanza | Qué hace |
|---|---|
| Push de una etiqueta `vX.Y.Z` | Verifica y publica con la etiqueta de distribución `latest` |
| Manual (`workflow_dispatch`), por defecto | Verifica y ensaya: `publish --dry-run`, no sube nada |
| Manual sobre una etiqueta `vX.Y.Z`, con "dry-run" desmarcado | Verifica y publica. Permite elegir `dist-tag` (`next` para una preliminar) |

Una ejecución manual sin "dry-run" sobre una rama falla: solo se publica desde una etiqueta, y la etiqueta
debe coincidir con la versión de los `package.json`.

Tiene dos trabajos:

1. `verify`, sin credenciales: `pnpm check`, comprobación de que los archivos generados están al día
   (`git diff --exit-code`), build de zudocs, `pnpm build`, `pnpm test:pack --skip-build --next`, y
   `pnpm test:html` y `pnpm test:browser` en Chromium. Guarda los `dist/` como artefacto.
2. `publish`, en el entorno `npm`: descarga esos `dist/`, ejecuta `pnpm bump check` y publica las cinco
   carpetas, una a una y en orden (`tokens`, `zicon`, `zui`, `zout`, `suite`), con
   `pnpm publish --access public --no-git-checks`. Salta la versión que ya esté en el registro. No instala
   dependencias ni ejecuta código del repositorio aparte de `tools/version.mjs`, así que el token no queda
   al alcance de ninguna dependencia.

### Secretos y configuración necesarios

| Qué | Dónde | Detalle |
|---|---|---|
| `NPM_TOKEN` | Secreto del entorno `npm` del repositorio (o secreto del repositorio) | Token de acceso granular de npmjs.com con permiso de lectura y escritura sobre el scope `@zuccadev-labs`, sin exigir 2FA al publicar. Se pasa como `NODE_AUTH_TOKEN` |
| Entorno `npm` | Settings → Environments | El trabajo `publish` lo declara. Conviene exigir revisores para que cada publicación pida aprobación. Si no existe, GitHub lo crea sin protección |
| `id-token: write` | Ya declarado en el trabajo `publish` | Permite firmar la procedencia. No es un secreto |
| `repository` en los cinco `package.json` | Hecho | npm compara ese campo con el repositorio que firma la procedencia y rechaza la publicación si falta o no coincide |
| Repositorio público | Hecho | npm solo acepta procedencia desde repositorios públicos |

No hace falta ningún otro secreto. `GITHUB_TOKEN` solo tiene `contents: read`.

La procedencia se activa con `NPM_CONFIG_PROVENANCE=true` en la publicación real y se desactiva en el
ensayo. Una publicación manual desde un equipo no lleva procedencia. Alternativa sin token de larga
duración: la publicación de confianza de npm (OIDC), que se configura por paquete en npmjs.com una vez
publicado; no está configurada.

## Si algo sale mal

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

- La publicación en npmjs.com: nunca se ejecutó. Se ensayó `npm publish <tarball>` contra un registro
  local (verdaccio) y `pnpm publish --dry-run` en las cinco carpetas.
- El flujo de 2FA de npmjs.com (aprobación en el navegador, `--otp`): verdaccio no lo tiene.
- Que la cuenta del responsable tenga permiso de publicación en la organización `zuccadev-labs` y que los
  cinco nombres estén libres: se comprueba en el paso 2 y en la lista previa.
- El workflow `release`: nunca se ejecutó. En particular, que `pnpm publish` de pnpm 12 respete
  `NPM_CONFIG_PROVENANCE` y el `.npmrc` que escribe `actions/setup-node`, que el ensayo funcione sin token
  válido, y que los `dist/` restaurados desde el artefacto produzcan los mismos tarballs que `pnpm test:pack`.
- CDN (unpkg, jsDelivr): las rutas `dist/` existen en los tarballs; no se probaron servidas.
