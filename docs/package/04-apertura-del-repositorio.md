# Apertura del repositorio

Qué se saneó para poder hacer público el repositorio, qué queda todavía en el historial y cómo hacer el
primer push sin publicarlo. Fecha del saneado: 2026-11-14.

El remoto es `https://github.com/zuccadev-labs/zuix`, público. El primer push se hizo el 2026-11-14 desde
un commit raíz limpio (`0d069bd`, "zuix 0.1.0"), y los cinco paquetes están publicados en npmjs.com en `0.1.0`.

> **Aviso: el historial local anterior no es publicable.** Los commits anteriores a la apertura (`eaa8eb3`,
> `b541f64` y los que les siguieron) contienen los datos que se retiraron del árbol de trabajo. Sanear los
> archivos no los borra de esos commits. Ese historial vive solo en local, en una rama aparte, y no se
> empuja nunca: ni `--all`, ni `--mirror`, ni esa rama.

## Criterio

En un archivo versionado no puede haber:

- rutas absolutas de una máquina ni nombres de usuario del sistema;
- nombres o rutas de proyectos privados o de clientes;
- rutas a carpetas de fuera del repositorio que revelen cómo está organizado el disco de alguien;
- credenciales, direcciones IP reales, dominios de despliegue ni correos personales.

Los proyectos propios del responsable (zutool, `ui-glass`, analizador-trafico, Zenith, DAZLABS) se pueden
nombrar. Sus archivos se citan con la ruta dentro de su propio repositorio. El proyecto privado del que
salieron el design system base y el carousel se cita como "proyecto de origen", sin nombre ni ruta.

Una herramienta que lee archivos de fuera del repositorio recibe la ruta por argumento o por variable de
entorno. No lleva una ruta de máquina como valor por defecto.

## Qué se saneó

| Archivo | Qué tenía | Qué tiene ahora |
|---|---|---|
| `docs/investigations/02-fuentes-de-estilo.md` | Ruta del proyecto de origen, nombres de sus aplicaciones, rutas de zutool y `ui-glass` desde la carpeta de trabajo, nombre de una aplicación propia anterior | "Proyecto de origen" sin ruta; rutas dentro de cada repositorio |
| `docs/investigations/04-componentes-de-referencia.md` | Ruta del carousel en el proyecto de origen, nombre del componente y del tipo de datos, clases y un texto del dominio | Descripción neutra; se conservan los nombres de archivo genéricos y las cifras |
| `docs/investigations/07-estado-de-construccion.md` | Ruta del proyecto de origen y rutas de zutool y `ui-glass` desde la carpeta de trabajo | Descripción neutra y rutas dentro de cada repositorio |
| `docs/investigations/03-zicon-dazicon.md` | Ruta del archivo `.fig` dentro de una carpeta de respaldo con el nombre de una persona | Solo el nombre del archivo; la ruta se pasa al extractor |
| `docs/investigations/01-estado-y-problematica.md` | Rutas de cuatro proyectos desde la carpeta de trabajo; nombres de dos proyectos no listados como citables | Nombre del proyecto o descripción neutra |
| `docs/investigations/05-zudocs-docusaurus.md`, `06-arquitectura-y-decisiones.md` | Ruta de Zenith desde la carpeta de trabajo; nombre de un proyecto no listado | Ruta dentro del repositorio de Zenith; descripción neutra |
| `docs/investigations/README.md` | Convención "rutas relativas a" una carpeta del disco del responsable | Convención nueva: rutas dentro de cada proyecto y descripción neutra para los privados |
| `docs/users/05-zudocs.md` | Ruta de Zenith desde la carpeta de trabajo | Ruta dentro del repositorio de Zenith |
| `docs/users/07-migracion.md` | Carpeta de worktrees fuera del repositorio | "Un worktree de git"; se documenta la variable de entorno de las fuentes |
| `AGENTS.md` | Nombre de la carpeta que contiene el repositorio | Rutas dentro del repositorio |
| `tokens/compat/zutool.json`, `tokens/compat/ui-glass.json` | `source.root`: ruta relativa que salía del repositorio hacia la carpeta de aplicaciones del responsable. Estos archivos se publican en `@zuccadev-labs/zuix-tokens` | `source.env`: nombre de una variable de entorno (`ZUIX_COMPAT_ZUTOOL_ROOT`, `ZUIX_COMPAT_UI_GLASS_ROOT`) |
| `tokens/schema/compat.schema.json`, `tokens/src/compat.mjs` | Leían `source.root` | Leen la variable de `source.env`. Sin ella usan la instantánea `compat/<proyecto>.inventory.json`; si la variable apunta a una carpeta sin las hojas, el build falla con un mensaje claro |
| `zicon/scripts/extract.py` | La ruta del `.fig` era solo el primer argumento, sin comprobación | Argumento o variable `DAZICON_FIG`; error claro si falta o no existe. Sin ruta por defecto |
| `zicon/scripts/__pycache__/figdecode.cpython-313.pyc` | Bytecode versionado por error, con la ruta absoluta del repositorio y el nombre de usuario del sistema | Borrado. `__pycache__/` y `*.pyc` están en `.gitignore` |
| `.gitignore` | No cubría bytecode de Python, tarballs ni archivos `.env` | Añadidos `__pycache__/`, `*.pyc`, `*.tgz`, `.env`, `.env.*` |

`pnpm tokens` genera exactamente los mismos archivos que antes del cambio: se comparó el contenido de
`tokens/dist/` antes y después.

### Revisado y dejado como está

| Archivo | Contenido | Por qué se queda |
|---|---|---|
| `LICENSE` (raíz y paquetes) | Nombre del titular del copyright | Es la atribución de la licencia. Decisión del responsable |
| `examples/zenith-docs/migrate.mjs` | Origen por defecto `../../../Zenith`: un repositorio hermano | Ruta relativa, con `--source` y `ZENITH_ROOT` documentados, y error claro si no existe |
| `examples/zenith-docs/zudocs.config.json` | Nombre de Zenith, áreas del piloto y su marca | Solo el nombre y que existe un piloto. El repositorio de Zenith es privado: se retiraron el enlace a GitHub y los textos que describían el producto |
| `examples/zenith-docs/migrate.mjs` | Reglas de clasificación por carpeta (`api/`, `tutorials/`, `runbooks/`…) y nombres de tres recursos estáticos del origen | Nombres genéricos de una documentación. Se retiraron las frases que describían el producto. Si no se quiere publicar la estructura de carpetas del origen, sacar el script del repositorio |
| `tokens/compat/*.inventory.json` | Nombres de variables CSS y rutas de archivo dentro de zutool y `ui-glass` | Proyectos propios, rutas internas a su repositorio. Se versionan, pero **no se publican** en `@zuccadev-labs/zuix-tokens` (`!compat/*.inventory.json` en `files`; `pnpm test:pack` lo comprueba) |
| `docs/users/07-migracion.md` | Nombres de rama y hashes cortos de commits de zutool y `ui-glass` | Proyectos propios; no dan acceso a nada |
| `stack.txt` | Seis enlaces a bibliotecas de terceros usadas como referencia | Son públicos |
| `127.0.0.1`, `example.com`, `zuix.local` en ejemplos y pruebas | Direcciones locales y de ejemplo | No son datos reales |

## Qué queda en el historial

Los commits de `main` local anteriores al saneado (`eaa8eb3`, `b541f64`) todavía contienen:

- la ruta y el nombre del proyecto privado de origen, en `docs/investigations/02`, `04` y `07`;
- la ruta de la carpeta de respaldo del `.fig`, con el nombre de una persona, en `docs/investigations/03`;
- la ruta absoluta del repositorio en esta máquina y el nombre de usuario del sistema, dentro del `.pyc`;
- las rutas relativas hacia la carpeta de aplicaciones, en `tokens/compat/*.json`;
- en los metadatos de los commits, el nombre y el correo personal del autor;
- `examples/zenith-docs/migration-report.json`, con nombres de archivo y enlaces de la documentación de
  Zenith (repositorio privado). Desde el 2026-11-14 está en `.gitignore` y fuera del índice.

Cualquier push de `main` tal como está publica todo eso, aunque el último commit esté saneado.

## Primer push público

Hecho el 2026-11-14. Se conserva el procedimiento por si hay que repetirlo en otro repositorio.

Con tan pocos commits no compensa reescribir el historial con `git filter-repo`: se publica un commit raíz
nuevo y el historial antiguo se queda fuera.

Antes de empezar:

- El árbol de trabajo contiene el saneado y pasa `pnpm verify`.
- Decidir la identidad pública del autor. El commit nuevo lleva `user.name` y `user.email`; si no se quiere
  publicar el correo personal, configurar antes la dirección `noreply` que da GitHub:

  ```
  git config user.name  "<nombre público>"
  git config user.email "<dirección pública o noreply>"
  ```

Procedimiento, desde la raíz del repositorio:

```
# 1. Copia de seguridad del historial privado, fuera del repositorio.
git bundle create ../zuix-historial-privado.bundle --all

# 2. Rama huérfana: conserva los archivos del árbol de trabajo y no tiene commits anteriores.
git checkout --orphan publico

# 3. Un único commit raíz con todo lo versionable. `git add -A` respeta .gitignore.
git add -A
git commit -m "zuix 0.1.0"

# 4. Comprobaciones. La primera debe imprimir 1; las dos siguientes no deben imprimir nada.
git rev-list --count publico
git grep -nIE '/(media|home|Users|mnt)/[A-Za-z0-9._-]+/' publico -- ':!pnpm-lock.yaml'
git grep -nIiE "$ZUIX_PRIVADO" publico

# 5. La rama pública pasa a ser main; la antigua queda solo en local.
git branch -m main historial-privado
git branch -m publico main

# 6. Primer push: solo main. Nunca --all, --mirror ni --tags en este paso.
git remote add origin https://github.com/zuccadev-labs/zuix.git
git push -u origin main
```

`ZUIX_PRIVADO` es una expresión regular con los nombres que no pueden aparecer (el proyecto de origen,
carpetas del disco). Se define en la terminal y no se escribe en ningún archivo del repositorio:

```
export ZUIX_PRIVADO='<nombre-1>|<nombre-2>'
```

Después del push:

1. Comprobar en el servidor que `main` tiene un solo commit y que no hay más ramas ni etiquetas.
2. Opcional, en local: borrar la rama antigua y sus objetos. La copia queda en el bundle.

   ```
   git branch -D historial-privado
   git reflog expire --expire=now --all
   git gc --prune=now
   ```

3. La etiqueta `v0.1.0` y su GitHub Release van sobre el commit público `0d069bd`
   ([Publicación](./02-publicacion.md#3-etiqueta-y-release-de-010)). De la versión siguiente en adelante las
   crea el workflow `release`. Una etiqueta creada sobre el historial antiguo no se empuja nunca.

Si por error se empuja el historial antiguo a un repositorio público: borrar el repositorio remoto y
crearlo de nuevo. Un `push --force` no basta, porque los commits antiguos siguen accesibles por su hash
durante un tiempo.

## Configuración del repositorio

Estado leído con la API de GitHub el 2026-11-16:

| Ajuste | Estado |
|---|---|
| Protección de `main` | Activa: exige las cuatro comprobaciones de `ci`, historial lineal, sin `force push` ni borrado, también para administradores. Sin aprobación obligatoria de otra persona |
| Alertas de secretos y protección de push | Activas |
| Dependabot | Alertas y actualizaciones de seguridad activas |
| Reporte privado de vulnerabilidades | Activo; es el canal de `SECURITY.md` |
| Entorno `npm` limitado a `main` | Creado; sin revisores obligatorios |
| Etiqueta `v0.1.0` y GitHub Release | Creados sobre el commit publicado |
| `CODEOWNERS` | Un mantenedor |
| Temas y página del repositorio | Puestos; la página enlaza a npm |
| Campos `repository`, `homepage` y `bugs` de los cinco `package.json` | Hechos |
| Publicador de confianza en npm | **Pendiente del responsable**: se registra en npmjs.com, paquete a paquete ([Publicación](./02-publicacion.md#configuración-de-una-sola-vez)) |

## Cómo se comprueba

Sobre los archivos versionados y los nuevos sin versionar, sin los ignorados:

```
git ls-files -z --cached --others --exclude-standard \
  | xargs -0 grep -nIE '/(media|home|Users|mnt)/[A-Za-z0-9._-]+/' -- 2>/dev/null \
  | grep -v '^pnpm-lock.yaml'
```

No debe imprimir nada. La misma orden con `-iE "$ZUIX_PRIVADO"` comprueba los nombres privados.

## Sin verificar

- El primer push lo hizo el responsable; aquí solo se comprobó el resultado: `main` remoto en `0d069bd`,
  un único commit, sin etiquetas.
- No se revisaron los metadatos de las imágenes ni de otros binarios: hoy no hay binarios versionados
  (los iconos y el logo de ejemplo son SVG de texto).
- El saneado cubre los archivos versionados. `docs/*.pptx` (manual de marca), `examples/zenith-docs/docs/`,
  `static/reference/` y `migration-report.json` están en `.gitignore` y no se publican; no se revisó su contenido.
