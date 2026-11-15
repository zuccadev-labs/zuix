# Versionado

Qué número sube con cada cambio y cómo se sube.

## Reglas

1. **Semver.** `MAYOR.MENOR.PARCHE`. Qué es incompatible lo define el
   [contrato público](./03-contrato-publico.md).
2. **Una versión para toda la suite.** `@zuccadev-labs/zuix-tokens`, `@zuccadev-labs/zuix-zicon`, `@zuccadev-labs/zuix-zui`,
   `@zuccadev-labs/zuix-zout` y el paraguas `@zuccadev-labs/zuix` llevan siempre el mismo número. Si un paquete no cambia, sube igual y su `CHANGELOG.md` lo dice.
3. **Dependencias internas con rango `^`.** Entre paquetes publicables se escribe `workspace:^`, que se publica
   como `^X.Y.Z`: `@zuccadev-labs/zuix-zout 0.2.0` depende de `@zuccadev-labs/zuix-zui ^0.2.0`. En `0.x` ese rango solo
   admite parches de la misma `MENOR`, que por la tabla de abajo son compatibles. Una versión exacta obligaría
   a instalar dos copias de un paquete en cuanto la aplicación subiera uno solo. `@zuccadev-labs/zuix-zicon` es
   `peerDependency` de `zui` y `zout`, con el mismo rango: el registro de iconos debe ser una sola copia
   ([Publicación](./02-publicacion.md#registro-de-iconos-duplicado)). `pnpm test:pack` falla si un tarball
   declara otra cosa.
4. **Un `CHANGELOG.md` por paquete**, en español, con formato Keep a Changelog. Cada cambio visible se
   anota en "Sin publicar" en el mismo cambio que lo introduce.

Por qué una sola versión: los paquetes comparten un contrato (`zui` lee tokens, `zout` usa clases de
`zui`, todos comparten el registro de `zicon`). Quien instala la suite necesita saber qué versiones van
juntas, y con un número lo sabe.

## Qué sube

| Cambio | Mientras sea `0.x` | Desde `1.0.0` |
|---|---|---|
| Incompatible con el contrato | `MENOR` (0.1.0 → 0.2.0) | `MAYOR` |
| Añade sin romper: componente, prop, variante, icono, token, evento | `PARCHE` o `MENOR` | `MENOR` |
| Corrige sin cambiar el contrato | `PARCHE` | `PARCHE` |

En `0.x` un rango `^0.1.0` no acepta `0.2.0`, así que una subida de `MENOR` es la señal de cambio
incompatible. `1.0.0` se declara cuando el contrato se considere estable; es decisión del responsable.

## Cómo se anota un cambio

En el `CHANGELOG.md` del paquete, bajo `## [Sin publicar]`:

```md
## [Sin publicar]

### Cambiado

- **Incompatible:** `Button` deja de aceptar `variant="link"`. Usar `Link`.

### Añadido

- `Badge` acepta `size="lg"`.
```

Secciones: `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado`, `Corregido`. Un cambio incompatible empieza por
`**Incompatible:**` y dice cómo migrar.

## Cómo se sube la versión

```
pnpm bump check            # misma versión en los cinco y entrada en cada CHANGELOG.md
pnpm bump minor --dry-run  # muestra lo que haría
pnpm bump minor            # o patch, major, 0.3.0
pnpm install               # actualiza el lockfile
```

`pnpm bump` cambia `version` en los cinco `package.json` y convierte "Sin publicar" en
`## [X.Y.Z] - fecha`. Un paquete sin cambios anotados recibe la línea "Sin cambios en este paquete". Si
ningún paquete tiene cambios anotados, se niega a subir.

No crea commits ni etiquetas. La etiqueta es `vX.Y.Z` sobre el commit de la
subida ([Publicación](./02-publicacion.md)).

## Obsolescencia

Lo que se va a retirar se marca primero: `@deprecated` en el tipo, nota en `Obsoleto` del `CHANGELOG.md`
y, si es una clase o un token, se mantiene como alias durante al menos una versión `MENOR` antes de
eliminarlo.

## Por qué un script propio y no Changesets

Changesets resuelve versiones independientes por paquete y se apoya en git para saber qué cambió. Aquí la
versión es única. `tools/version.mjs` son unas 80 líneas sin dependencias. Si la suite pasa a versiones independientes o a publicar desde CI, Changesets es el
reemplazo natural.

## Sin verificar

- `pnpm bump` se probó sobre una copia de los paquetes, antes de existir el paraguas (subida `minor` con y sin
  cambios anotados).
  En el repositorio real solo se ejecutó `check` y `--dry-run`: la versión sigue en `0.1.0`.
- Versiones preliminares (`0.2.0-beta.1`): el script las acepta como versión explícita; no se probó el
  flujo completo con `--tag`.
