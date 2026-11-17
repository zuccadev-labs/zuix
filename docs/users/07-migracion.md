# Migrar un proyecto con variables propias a los tokens de zuix

zutool y `ui-glass` llevaban cada uno su copia de los tokens liquid glass. Esta guía explica cómo pasa un
proyecto así a leerlos de `@zuccadev-labs/zuix-tokens` sin tocar sus componentes: se importa la marca, se
importa una **capa de compatibilidad** que conserva los nombres antiguos y se retira la hoja propia. Los dos
ejemplos son esos dos proyectos, que son míos; el método vale para cualquier otro.

## Qué es una capa de compatibilidad

Un archivo CSS generado que declara cada variable antigua como alias de un token:

```css
:root {
  --accent: var(--z-accent);
  --surface-2: var(--z-surface-2);
  --orange-500: var(--zp-orange-500);
}
```

El código del proyecto sigue escribiendo `var(--accent)`. El valor, el tema y la marca los pone zuix.

| Archivo | Qué contiene | De quién es |
|---|---|---|
| `@zuccadev-labs/zuix-tokens/compat/<proyecto>.css` | Alias de las variables antiguas con equivalente | De zuix. Se importa, no se copia |
| `@zuccadev-labs/zuix-tokens/compat/<proyecto>.app.css` | Las variables sin equivalente, con su valor original | Del proyecto. Se copia una vez y pasa a ser suya |
| `@zuccadev-labs/zuix-tokens/compat/<proyecto>.report.md` | Diferencias de valor, renombres y variables sin equivalente | Informe generado |

Los tres salen de un mapa declarativo, `tokens/compat/<proyecto>.json`, al ejecutar `pnpm tokens`. El informe
es la referencia de qué cambia de valor: lo genera el mismo build que los tokens, así que no se queda atrás
cuando una marca se ajusta.

### Qué valida el build

`pnpm tokens` falla si:

- una variable que declara la hoja antigua no está en `map` (tiene token), `rename` (hay que cambiarla
  en el código) ni `keep` (sin equivalente, con motivo). El error lista las que faltan y sus usos;
- un token destino no existe en la marca;
- una variable antigua se llama igual que un token de zuix y no está en `rename`;
- una variable que se queda en la app depende de otra que desaparece.

Las fuentes de cada proyecto viven fuera de este repositorio y su ruta no se escribe en el mapa. El build
usa la instantánea `tokens/compat/<proyecto>.inventory.json`, que se versiona pero no se publica. Para
releer las fuentes se pasa la ruta del proyecto en la variable de entorno que nombra `source.env`:

```
ZUIX_COMPAT_ZUTOOL_ROOT=<ruta a zutool> ZUIX_COMPAT_UI_GLASS_ROOT=<ruta a analizador-trafico> \
  pnpm --filter @zuccadev-labs/zuix-tokens compat:scan
```

Con la variable definida, `pnpm tokens` también lee las fuentes y avisa si difieren de la instantánea.

## Antes de empezar

1. Trabajar en una rama del proyecto que migra. Revertir es deshacer esa rama.
2. Instalar el paquete: `pnpm add @zuccadev-labs/zuix-tokens`.
3. Comprobar que `<html>` lleva `data-theme`. Sin ese atributo, zuix sigue la preferencia del sistema, y las
   hojas antiguas eran oscuras por defecto.

## zutool

Hojas: `apps/desktop/src/styles/tokens.css` y `apps/mobile/src/styles/tokens.css` (la de móvil es la de
escritorio sin las capas `--z-*`). Marca: `zutool`.

| | |
|---|---|
| Variables que declara la hoja antigua | 126 |
| Con alias a un token | 74 |
| Sin equivalente (se quedan en la app) | 51 |
| A renombrar en el código | 1 |
| Comparaciones de valor iguales | 105 |
| Con diferencia visible (oscuro y claro) | 46 |

### Pasos

1. Copiar `compat/zutool.app.css` a `src/styles/app-tokens.css` en escritorio y en móvil. Desde ese momento
   el archivo es de zutool: se edita allí.
2. En `src/styles/app.css` de cada aplicación, cambiar la importación de la hoja:

   ```css
   /* antes */
   @import "./tokens.css";

   /* después */
   @import "@zuccadev-labs/zuix-tokens/css/zutool.css";
   @import "@zuccadev-labs/zuix-tokens/compat/zutool.css";
   @import "./app-tokens.css";
   ```

   El orden importa: marca, capa y variables de la aplicación.
3. Renombrar en el código la variable de la tabla siguiente.
4. Borrar `src/styles/tokens.css`.
5. Verificar: compilar, abrir la aplicación en oscuro y en claro, y repasar las diferencias del informe.

El bloque `@theme inline` de Tailwind no cambia: sigue leyendo los nombres antiguos.

### A renombrar

| Variable | Sustituir por | Motivo |
|---|---|---|
| `--z-overlay` | `--z-layer-overlay` | En zuix `--z-overlay` es el color de las capas flotantes, no un z-index. La capa no puede redefinirlo sin romper `zui`. Son seis usos en `workspace.css` y `zutool.css` de escritorio; el informe los lista con su línea |

`--z-menu`, `--z-dialog`, `--z-popover`, `--z-toast` y `--z-top` no hay que tocarlos: la capa los apunta a
`--z-layer-*`, que valen lo mismo.

### Qué cambia de aspecto

La lista completa, variable a variable, está en `compat/zutool.report.md`. Por familias:

| Familia | Qué cambia | Por qué |
|---|---|---|
| Texto atenuado y sutil | `--fg-muted` y `--fg-subtle` son más opacos en los dos temas | Para que el texto llegue a 4.5:1 sobre todas las superficies |
| Cristal | `--glass-bg`, `--panel` y `--side-bg` pasan de 0.66 a 0.82 de opacidad en oscuro; el degradado del fondo se atenúa | El texto sobre cristal no llegaba al mínimo sobre las manchas claras del degradado |
| Acento en tema claro | `--accent` pasa de `#ff6118` a `#c2410c`, y con él `-hover`, `-soft` y el relleno de progreso | El naranja 500 no da contraste sobre blanco |
| Anillo de foco | `--accent-ring` deja de ser el acento al 45 % y pasa a un color opaco | Un indicador de foco necesita 3:1 |
| Botón primario y elemento activo del rail | De naranja 500 a naranja 700 en los dos temas | Llevan texto blanco: el 500 no da 4.5:1 |
| Estados en tema claro | `--success`, `--warning`, `--danger` e `--info` oscurecen; sus `-soft` los siguen | La hoja antigua conservaba en claro los valores del tema oscuro |
| Azul informativo | `--sky-500` e `--info` son algo más claros en oscuro | Para que la insignia informativa llegue a 4.5:1 |
| Lienzo y sombras en tema claro | El lienzo es claro y las sombras, más ligeras | La hoja antigua no redefinía el lienzo en claro: lo fijaba un preset en tiempo de ejecución |
| Tarjetas | Fondo, borde y sombra se unen a `surface`, `line` y `shadow-md` | Diferencias de un punto de opacidad |

### Sin equivalente

Se quedan en `app-tokens.css` con su valor de hoy. Son tokens de la aplicación, no del sistema: los tipos de
nodo y las aristas del grafo, el cromo de la ventana sin marco, las tarjetas KPI, el campo de búsqueda y los
iconos de la cabecera, los puntos del logotipo y las capas propias (`--z-popup`, `--z-tour`, `--z-drag`…).
El informe da el motivo de cada grupo.

## ui-glass (analizador-trafico)

Hoja: `packages/ui-glass/src/tokens.css`. Marca: `zutool` (misma paleta; `ui-glass` no tiene marca propia).
Solo tiene tema oscuro.

| | |
|---|---|
| Variables que declara la hoja antigua | 102 |
| Con alias a un token | 66 |
| Sin equivalente (se quedan en la app) | 36 |
| A renombrar en el código | 0 |
| Comparaciones de valor iguales | 49 |
| Con diferencia visible (oscuro) | 17 |

### Pasos

1. Copiar `compat/ui-glass.app.css` a `packages/ui-glass/src/app-tokens.css` y exportarlo en
   `packages/ui-glass/package.json` (`"./app-tokens.css": "./src/app-tokens.css"`).
2. Añadir el alias en `apps/dashboard/farm.config.ts`, junto a los de `tokens.css` y `glass.css`:
   `"@trafico/ui-glass/app-tokens.css": pkg("ui-glass", "app-tokens.css")`.
3. En `apps/dashboard/src/main.tsx`, cambiar la importación de la hoja:

   ```ts
   // antes
   import "@trafico/ui-glass/tokens.css";
   import "@trafico/ui-glass/glass.css";

   // después
   import "@zuccadev-labs/zuix-tokens/css/zutool.css";
   import "@zuccadev-labs/zuix-tokens/compat/ui-glass.css";
   import "@trafico/ui-glass/app-tokens.css";
   import "@trafico/ui-glass/glass.css";
   ```

4. Borrar `packages/ui-glass/src/tokens.css`, su entrada en `exports` y su alias en `farm.config.ts`.
5. Verificar: compilar el dashboard y repasar las diferencias del informe.

No hay nada que renombrar. Las diferencias visibles son las mismas familias que en zutool, solo en oscuro:
texto atenuado, cristal, anillo de foco, azul informativo, tarjetas, botón primario y elemento activo del
rail. Sin equivalente quedan los tokens de dominio y, propios de este proyecto, la paleta de gráficos de
tráfico (`--chart-*`; zuix no tiene tokens de gráficos) y `--sidebar-width` (el dashboard usa 264 px y el
token vale 224).

## Riesgos

| Riesgo | A quién afecta | Qué hacer |
|---|---|---|
| `--z-overlay` significa cosas distintas: z-index en zutool, color en zuix | zutool escritorio | Renombrar los seis usos antes de borrar la hoja. Si se olvida uno, ese `z-index` queda sin valor y no da error |
| zutool usa el prefijo `--z-` para sus capas; es el espacio de nombres de zuix | zutool | Las que se quedan (`--z-popup`, `--z-tour`, `--z-drag`…) funcionan hoy. Conviene renombrarlas a otro prefijo para que un token futuro no choque |
| El botón primario y el elemento activo del rail pasan de naranja 500 a naranja 700 | Los dos | Es intencionado. Para conservar el tono antiguo, redefinir `--brand-primary-bg` y `--rail-active-bg` en `app-tokens.css`, sabiendo que se pierde el contraste |
| El tema claro de zutool cambia de acento, colores de estado, lienzo y sombras | zutool | Revisar el tema claro completo; lo que se quiera como antes se redefine en `app-tokens.css` bajo `:root[data-theme="light"]` |
| `ui-glass` no tenía tema claro y la marca sí | ui-glass | Mantener `data-theme="dark"` en `<html>`. Si se quita, los tokens pasan a claro y las variables de `app-tokens.css` (gráficos, cabecera) siguen en oscuro |
| Los presets de tema de zutool escriben variables antiguas en `<html>` en tiempo de ejecución | zutool | Siguen funcionando: pisan el alias. Un componente de `zui`, que lee `--z-*`, no vería ese preset |
| Los alias se resuelven en `:root` | Los dos | Si una zona de la página redefine un token `--z-*`, las variables antiguas no lo siguen dentro de esa zona. Hoy ninguno de los dos lo hace |

## Cómo revertir

1. Restaurar `tokens.css` desde el control de versiones.
2. Devolver las importaciones a su forma anterior y borrar `app-tokens.css`.
3. En zutool, deshacer el renombre de `--z-overlay`.
4. Quitar la dependencia `@zuccadev-labs/zuix-tokens`.

Mientras no se borre la hoja antigua revertir es solo cambiar las importaciones.

## Mantener la capa

- Si el proyecto añade una variable a su hoja antes de migrar, `pnpm tokens` falla hasta que se
  clasifique en `tokens/compat/<proyecto>.json`.
- Después de migrar, las variables nuevas del proyecto van a su `app-tokens.css`; la capa no crece.
- La capa es un puente. El final del camino es que el código escriba `var(--z-accent)` directamente y
  la capa se retire.

## Dónde está la migración

La apliqué en los dos proyectos con la `0.1.0`, cada uno en una rama `chore/zuix-tokens` con commits locales.
No está integrada en sus ramas principales.

| | zutool | ui-glass |
|---|---|---|
| Tipos, pruebas y build | Igual que antes de migrar | Igual que antes de migrar |
| Tema oscuro, con la 0.1.0 | 10 de 11 pantallas idénticas al píxel | 7 vistas idénticas salvo datos de reloj |
| Cambio visible, con la 0.1.0 | Botón primario y rail activo más oscuros; tema claro entero | Azul de la insignia informativa |

Con la 0.2.0 el cambio visible es mayor que el de esa tabla: el texto atenuado, el cristal y el anillo de
foco también cambian, por el ajuste de contraste. Las dos ramas hay que resincronizarlas con la versión
nueva y volver a comparar pantallas antes de integrarlas.

En esas ramas los dos proyectos consumen una copia de los CSS en `vendor/zuix-tokens/`, con un script que la
sincroniza y la comprueba, porque su integración continua instalaba sobre un checkout sin zuix. Con el
paquete publicado, lo natural es instalar por versión y borrar `vendor/`.

Al integrar en zutool: si la rama destino cambió `tokens.css` habrá un conflicto de modificación contra
borrado, y las variables nuevas van a `app-tokens.css`. `apps/engine-hub/web/signin.html` lleva una copia en
línea de los tokens antiguos, sin migrar.

## Lo que no he comprobado

- La aplicación de escritorio real (Tauri) y la de Android de zutool, y el dashboard de ui-glass con datos
  reales: probé el renderer en Chrome y el modo demo.
- El tema claro de móvil de zutool, que es el que más cambia.
- Ninguno de los dos proyectos con los tokens de la 0.2.0.
- La búsqueda de usos reconoce `var(--x)`, nombres entre comillas y la forma corta de Tailwind
  (`bg-(--x)`). Un nombre construido en tiempo de ejecución no se detecta.
