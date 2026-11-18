# Apertura del repositorio

Qué saneé para poder hacer público el repositorio y cómo se publica un repositorio sin arrastrar su historial
privado. Lo hice el 2026-11-14; dejo el procedimiento escrito porque lo voy a necesitar en otros proyectos.

El remoto es `https://github.com/zuccadev-labs/zuix`, público. El primer push salió de un commit raíz limpio
(`0d069bd`, "zuix 0.1.0").

## El problema

Empecé zuix como una carpeta de trabajo, no como un proyecto público. Los primeros commits tenían lo que
tiene cualquier repositorio privado: rutas absolutas de mi máquina, el nombre de un proyecto privado del
que reutilicé código, rutas hacia otras carpetas de mi disco y mi correo personal en los metadatos. Sanear
los archivos no borra nada de eso de los commits anteriores, así que el historial antiguo no se podía
publicar tal cual.

## Criterio

En un archivo versionado no puede haber:

- rutas absolutas de una máquina ni nombres de usuario del sistema;
- nombres o rutas de proyectos privados o de clientes;
- rutas a carpetas de fuera del repositorio que revelen cómo está organizado el disco de alguien;
- credenciales, direcciones IP reales, dominios de despliegue ni correos personales.

Mis proyectos propios (zutool, `ui-glass`, analizador-trafico, Barrits, DAZLABS) se pueden nombrar, y sus
archivos se citan con la ruta dentro de su propio repositorio. De Zenith, que es privado, solo se nombra que
existe y que hice un piloto local con su documentación. El proyecto privado del que salieron el design
system base y el carousel se cita como "proyecto de origen", sin nombre ni ruta.

Una herramienta que lee archivos de fuera del repositorio recibe la ruta por argumento o por variable de
entorno. No lleva una ruta de máquina como valor por defecto.

## Qué saneé

| Dónde | Qué tenía | Qué tiene ahora |
|---|---|---|
| Las investigaciones (`docs/investigations/`) | Rutas y nombres del proyecto de origen, rutas de otros proyectos desde mi carpeta de trabajo, la ruta del archivo de Figma | Descripciones neutras y rutas dentro de cada repositorio |
| `tokens/compat/*.json` (se publican en `zuix-tokens`) | `source.root`: una ruta relativa que salía del repositorio | `source.env`: el nombre de una variable de entorno (`ZUIX_COMPAT_ZUTOOL_ROOT`, `ZUIX_COMPAT_UI_GLASS_ROOT`). Sin ella se usa una instantánea versionada |
| `zicon/scripts/extract.py` | La ruta del `.fig`, sin comprobación | Argumento o variable `DAZICON_FIG`; error claro si falta. Sin ruta por defecto |
| Un `.pyc` versionado por error | La ruta absoluta del repositorio y mi usuario del sistema | Borrado; `__pycache__/` y `*.pyc` están en `.gitignore` |
| `.gitignore` | No cubría bytecode de Python, tarballs ni `.env` | Añadidos |
| El piloto de zudocs sobre Zenith | Estaba dentro del repositorio | Fuera del control de versiones: vive solo en mi máquina |

Comprobé que `pnpm tokens` generaba exactamente los mismos archivos antes y después del cambio.

Lo que revisé y dejé como está:

| Archivo | Contenido | Por qué se queda |
|---|---|---|
| `LICENSE` (raíz y paquetes) | Mi nombre como titular del copyright | Es la atribución de la licencia |
| `tokens/compat/*.inventory.json` | Nombres de variables CSS y rutas de archivo dentro de zutool y `ui-glass` | Son proyectos míos y las rutas son internas a su repositorio. Se versionan, pero **no se publican** en el paquete (`!compat/*.inventory.json` en `files`; `pnpm test:pack` lo comprueba) |
| `127.0.0.1`, `example.com` en ejemplos y pruebas | Direcciones locales y de ejemplo | No son datos reales |

## Cómo publiqué sin el historial

Con tan pocos commits no compensaba reescribir el historial con `git filter-repo`: publiqué un commit raíz
nuevo y el historial antiguo se quedó fuera.

Antes de empezar:

- El árbol de trabajo contiene el saneado y pasa `pnpm verify`.
- Decidir la identidad pública del autor. El commit nuevo lleva `user.name` y `user.email`; para no publicar
  el correo personal se configura antes la dirección `noreply` que da GitHub:

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

3. Una etiqueta creada sobre el historial antiguo no se empuja nunca.

Si por error se empuja el historial antiguo a un repositorio público, hay que borrar el repositorio remoto y
crearlo de nuevo. Un `push --force` no basta: los commits antiguos siguen accesibles por su hash durante un
tiempo.

## Configuración del repositorio

| Ajuste | Estado |
|---|---|
| Protección de `main` | Activa: exige la CI en verde, historial lineal, sin `force push` ni borrado, también para administradores. Sin aprobación obligatoria de otra persona |
| Alertas de secretos y protección de push | Activas |
| Dependabot | Alertas y actualizaciones de seguridad activas |
| Reporte privado de vulnerabilidades | Activo; es el canal de `SECURITY.md` |
| Entorno `npm` limitado a `main` | Creado, sin revisores obligatorios |
| Etiqueta `v0.1.0` y GitHub Release | Creados sobre el commit publicado |
| `CODEOWNERS` | Un mantenedor |
| Campos `repository`, `homepage` y `bugs` de los cinco `package.json` | Puestos |

Leí ese estado con la API de GitHub el 2026-11-16.

## Cómo lo compruebo

Sobre los archivos versionados y los nuevos sin versionar, sin los ignorados:

```
git ls-files -z --cached --others --exclude-standard \
  | xargs -0 grep -nIE '/(media|home|Users|mnt)/[A-Za-z0-9._-]+/' -- 2>/dev/null \
  | grep -v '^pnpm-lock.yaml'
```

No debe imprimir nada. La misma orden con `-iE "$ZUIX_PRIVADO"` comprueba los nombres privados.

## Lo que no he comprobado

- Los metadatos de imágenes y otros binarios. Los únicos binarios versionados son las fuentes `woff2` del
  sitio de documentación y la imagen para compartir; los iconos y el logo son SVG de texto.
- El saneado cubre los archivos versionados. Lo que está en `.gitignore` (el manual de marca, el piloto local)
  no se publica y no lo revisé con el mismo criterio.
