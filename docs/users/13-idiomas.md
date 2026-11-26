# Idiomas

Cómo poner en otro idioma los textos que escriben los propios componentes: nombres accesibles, anuncios, botones
de cierre, «Hoy», «3 resultados». El texto de la aplicación (títulos, opciones, mensajes) sigue siendo cosa de la
aplicación.

Los componentes no fijan idioma. Cada uno tiene sus textos en inglés en una constante `*_LABELS` y acepta `labels`
por prop. Desde la 0.5 hay además paquetes de idioma para `en`, `es`, `pt`, `fr` y `de` que cubren todas esas
constantes de zui y de zout. El orden es siempre el mismo:

1. `labels` por prop;
2. el paquete del idioma vigente;
3. el inglés de la constante.

Así que lo que ya pasabas por `labels` sigue mandando: no hay que tocar nada para subir a la 0.5.

## Los paquetes

| Entrada | Qué trae |
|---|---|
| `@zuccadev-labs/zuix-zui/locales/<id>` | Los textos de zui: `/locales/en`, `/locales/es`, `/locales/pt` (de Brasil), `/locales/fr` y `/locales/de` |
| `@zuccadev-labs/zuix-zout/locales/<id>` | Los de zout (`ChatLayout`, `DocsLayout`), con los mismos cinco idiomas |
| `@zuccadev-labs/zuix/zui/locales/<id>` | Los de zui desde el paraguas: `/zui/locales/en`, `/zui/locales/es`, `/zui/locales/pt`, `/zui/locales/fr`, `/zui/locales/de` |
| `@zuccadev-labs/zuix/zout/locales/<id>` | Los de zout desde el paraguas: `/zout/locales/en`, `/zout/locales/es`, `/zout/locales/pt`, `/zout/locales/fr`, `/zout/locales/de` |

Cada paquete es un módulo aparte que solo exporta datos (`export default`), así que un empaquetador lo separa en su
propio trozo y solo se descarga el idioma que se usa. En el bundle de navegador (`zui/dist/zui.dom.js`) cada idioma
es un archivo hermano, `zui.locale.<id>.js`, que se pide al cargarlo.

Una etiqueta regional cae en su idioma: `pt-BR` y `pt-PT` usan `pt`, `es-MX` usa `es`. Una etiqueta sin paquete se
queda en inglés.

## Con React

```tsx
import { LocaleProvider } from "@zuccadev-labs/zuix-zui";
import es from "@zuccadev-labs/zuix-zui/locales/es";
import esLayouts from "@zuccadev-labs/zuix-zout/locales/es";

export function App({ children }) {
  return (
    <LocaleProvider locale="es" messages={[es, esLayouts]}>
      {children}
    </LocaleProvider>
  );
}
```

- Con `messages`, el primer pintado ya sale en su idioma, también en el servidor. Sin ellos,
  `<LocaleProvider locale="es">` carga los textos de zui al montar y, hasta que llegan, se ven en inglés; los
  layouts de zout cargan los suyos.
- Se puede anidar: un `LocaleProvider locale="fr"` dentro de otro en español pone en francés solo lo que envuelve.
- El proveedor también decide el formato de Intl: las piezas que tienen prop `locale` (fechas, números, horas) la
  toman de él si no se la pasas.
- `useLocale()` devuelve el idioma vigente y `messages(espacio, base)`, `formatNumber`, `formatDate` y
  `formatList` en ese idioma, para los textos de la propia aplicación.

Los componentes de solo marcado (los que se pueden pintar como Server Components: `MetricCard`, `ReviewSummary`,
`DeliveryStatus`, `Citation`…) no leen contexto. Toman el idioma por defecto: el del `LocaleProvider` exterior
(que lo fija al pintarse) o el de `setLocale()`. En un servidor que sirve varios idiomas a la vez, pásales
`labels` con `localize(espacio, textos en inglés, idioma)`:

```tsx
import { localize } from "@zuccadev-labs/zuix-zui";
import en from "@zuccadev-labs/zuix-zui/locales/en";

<MetricCard label="Ventas" value={1280} labels={localize("metricCard", en.messages.metricCard, lang)} />
```

## Sin React

```js
import { init, setLocale } from "@zuccadev-labs/zuix-zui/dom";
await setLocale("es"); // carga el paquete de zui y lo deja por defecto
init();
```

`setLocale()` acepta una etiqueta (carga el paquete bajo demanda), un paquete ya importado o una lista de paquetes.
Hace tres cosas: registra los textos, escribe `lang` en `<html>` (lo leen los lectores de pantalla y la traducción
automática para pronunciar y traducir bien) y vuelve a pintar las piezas montadas. Con `{ document: false }` no
toca `<html>`.

Dentro de la página manda el `lang` heredado: una sección `<section lang="fr">` pinta sus componentes en francés si
ese paquete está registrado, aunque el idioma por defecto sea otro. Por eso `setLocale()` escribe `lang` en
`<html>`: si la página dice `lang="en"`, los componentes de toda ella siguen en inglés.

```html
<html lang="es">
  …
  <section lang="fr">
    <div class="z-cascader" data-props>…</div> <!-- en francés si cargaste fr -->
  </section>
</html>
```

## Plurales, números y listas

Los textos con un número usan la sintaxis de plural de ICU cuando el idioma la necesita:

```
{n, plural, one {# mensaje sin leer} other {# mensajes sin leer}}
```

La forma sale de `Intl.PluralRules` del idioma del paquete (en francés el 0 es singular; en alemán, «1 Treffer» y
«5 Treffer» son la misma palabra) y `#` es el número escrito con `Intl.NumberFormat`. Admite `=0`, `zero`, `one`,
`two`, `few`, `many` y `other`; `other` es obligatoria. Tus propias `labels` pueden usar la misma sintaxis.

Las listas dentro de un texto («depende de A, B y C», «asignada a Ana y Luis») salen de `Intl.ListFormat` en el
idioma vigente. En inglés se mantiene la lista con comas que ya escribían los componentes.

Para los textos de la aplicación, la raíz exporta lo mismo que usan los componentes: `formatMessage(plantilla,
valores, { locale })`, `formatNumber`, `formatDate`, `formatList` y `pluralRules`, con los formateadores de Intl
en caché.

## Tu propio idioma

Un paquete es `{ id, messages }`, con los mismos espacios de nombres y claves que el inglés
(`@zuccadev-labs/zuix-zui/locales/en`). El tipo `LocaleMessages` obliga a que estén todas:

```ts
import { registerLocale, type LocaleMessages, type LocalePack } from "@zuccadev-labs/zuix-zui";
import type { ZuiMessages } from "@zuccadev-labs/zuix-zui/locales/en";

const it: LocalePack<LocaleMessages<ZuiMessages>> = { id: "it", messages: { /* … */ } };
registerLocale(it);
```

Puedes registrar también un paquete parcial: lo que falte sale en inglés. Una clave que el inglés no tiene se
ignora.

## Qué está comprobado

`pnpm locales` (dentro de `pnpm check`) falla si a un paquete le falta una clave o le sobra alguna, si un texto
usa huecos distintos que el inglés (`{name}`, `{count}`) o si un plural no tiene `other`, y marca los textos que
coinciden con el inglés sin estar declarados como iguales a propósito (`same`: «OK», «HEX», «Zoom»). Las pruebas
unitarias resuelven cada plantilla de cada idioma con 0, 1, 2, 5 y 21.

El contrato HTML (`html.json`) y los ejemplos de los manifiestos siguen en inglés de Estados Unidos.

## Lo que no cubre

- Los componentes que reciben sus textos sueltos por prop (`closeLabel`, `searchLabel`…) en lugar de una constante
  `*_LABELS` siguen con su valor en inglés si no se lo pasas.
- Ningún paquete es de un idioma que se escriba de derecha a izquierda. La dirección la pone la aplicación con
  `dir` ([Zui](./03-zui.md#dirección-de-escritura)).
