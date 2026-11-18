# Zicon · guía para agentes

Guía para los agentes de IA que usan `@zuccadev-labs/zuix-zicon`: 346 iconos en dos variantes (`outline`,
`solid`), caja de 24 × 24, extraídos de Dazicon. Formato: reglas → patrones → verificación.

## Reglas

1. **Un icono se pide por nombre.** `<Icon name="magnifying-glass" />`. Los nombres válidos están en
   `manifest.json` y en el tipo `IconName`; un nombre que no existe no compila.
2. **Sin emojis como iconos.** Se sustituyen con la tabla de abajo.
3. **Sin SVG a mano.** Si no existe un icono para el concepto, se informa. No se inventa uno ni se toma de
   otra biblioteca. Tampoco se retoca un trazado en el código: se corrige en el archivo de origen.
4. **El color se hereda.** El icono usa `currentColor`; el color lo pone el texto que lo rodea, con tokens.
5. **Decorativo o informativo.** Sin `label` el icono se oculta a lectores de pantalla. Si comunica algo por
   sí solo (un botón sin texto), lleva `label`.
6. **`outline` por defecto.** `solid` se reserva para el estado activo o seleccionado. En 101 iconos las dos
   variantes son el mismo dibujo: no cuentes con `solid` como única señal de estado.
7. **Sin `innerHTML`.** En código que construye el DOM se usa `iconElement()`; `iconSvg()` devuelve una
   cadena y es para render en servidor o plantillas de texto.

## Patrones

### React

```tsx
import { Icon } from "@zuccadev-labs/zuix-zicon";

<Icon name="magnifying-glass" />                       // 16 px, decorativo
<Icon name="trash" size={20} label="Delete" />         // informativo
<Icon name="bookmark" variant={saved ? "solid" : "outline"} />
```

Tamaños: 16 dentro de texto y botones, 20 a 22 en recuadros, 28 en estados vacíos.

### Sin React

```html
<z-icon name="trash" variant="solid" size="20" label="Delete"></z-icon>
```

```js
import "@zuccadev-labs/zuix-zicon/element";                       // define <z-icon> con el set completo
import { iconElement, iconSvg } from "@zuccadev-labs/zuix-zicon/dom";

button.append(iconElement("plus", { size: 16 }));                 // nodo SVG, sin innerHTML
const markup = iconSvg("plus", { size: 16 });                     // cadena, para render en servidor
```

Mismas reglas y nombres que en React.

### Buscar un icono

`manifest.json` → `icons[]`. Cada entrada tiene `name`, `category` y `keywords` en inglés y español, con
conceptos de uso además de la forma: `trash` responde a "delete", "eliminar" y "borrar".

```
node -e 'const m=require("./zicon/manifest.json");const q=process.argv[1];console.log(m.icons.filter(i=>i.keywords.some(k=>k.includes(q))).map(i=>i.name).join("\n"))' buscar
```

### Solo algunos iconos

`@zuccadev-labs/zuix-zicon` registra el set completo (unos 580 kB de trazados sin comprimir). Para incluir solo
los necesarios:

```tsx
import { Icon, registerIcons } from "@zuccadev-labs/zuix-zicon/core";
import { trash } from "@zuccadev-labs/zuix-zicon/icons/trash";
import { plus } from "@zuccadev-labs/zuix-zicon/icons/plus";

registerIcons([trash, plus]);
```

Con registro parcial hay que incluir los iconos que dibujan los componentes de `zui` y `zout`. Un icono sin
registrar sale vacío y la consola lo avisa.

## Categorías

<!-- categories:start -->
| Clave | Categoría | Iconos |
|---|---|---|
| `arrows` | Flechas | 44 |
| `documents` | Documentos | 27 |
| `math` | Matemática | 28 |
| `sort` | Organización | 30 |
| `buildings` | Edificios | 6 |
| `ecommerce` | Comercio | 9 |
| `media` | Multimedia | 21 |
| `symbols` | Símbolos | 48 |
| `communication` | Comunicación | 23 |
| `editor` | Edición | 7 |
| `misc` | Misceláneos | 28 |
| `system` | Sistema | 12 |
| `design` | Diseño | 2 |
| `charts` | Gráficos | 6 |
| `others` | Otros | 23 |
| `time` | Tiempo | 1 |
| `devices` | Dispositivos | 9 |
| `maps` | Mapas | 5 |
| `security` | Seguridad | 10 |
| `user` | Usuario | 7 |
<!-- categories:end -->

## Sustitución de emojis

<!-- emoji:start -->
| Emoji | Icono |
|---|---|
| 🎓 | `academic-cap` |
| 🐛 🐞 | `ant` |
| 📦 | `archive-box` |
| 🗄️ | `archive-drawer` |
| ⬇️ | `arrow-down` |
| ↘️ | `arrow-down-right` |
| 💾 | `arrow-down-tray` |
| ⬅️ | `arrow-left` |
| 🔄 🔃 | `arrow-path` |
| ➡️ | `arrow-right` |
| 📉 | `arrow-trending-down-right` |
| 📈 | `arrow-trending-up-right` |
| ⬆️ | `arrow-up` |
| ↗️ | `arrow-up-right` |
| 📤 | `arrow-up-tray` |
| ↩️ | `arrow-uturn-down-left` |
| ↪️ | `arrow-uturn-down-right` |
| ⏪ | `backward` |
| 💰 💵 | `banknotes` |
| 🔋 | `battery-100` |
| 🧪 | `beaker` |
| 🔔 | `bell` |
| 🔕 | `bell-slash` |
| ⚡ | `bolt` |
| 📖 📚 | `book` |
| 🔖 | `bookmark` |
| 💼 | `briefcase` |
| 🏦 | `building-library` |
| 🏢 | `building-office` |
| 🏪 | `building-storefront` |
| 🎂 | `cake` |
| 🧮 | `calculator` |
| 📅 | `calendar` |
| 📆 | `calendar-days` |
| 📷 📸 | `camera` |
| 📊 | `chart-bar` |
| 🗨️ | `chat-bubble-bottom-left` |
| 💬 | `chat-bubble-oval-left` |
| ✔️ | `check` |
| ✅ ☑️ | `check-circle` |
| 📋 | `clipboard` |
| 🕐 ⏰ ⏱️ | `clock` |
| ☁️ | `cloud` |
| 💻 | `computer` |
| 🖥️ | `computer-desktop` |
| 💳 | `credit-card` |
| 💲 | `currency-dollar` |
| ➗ | `divide` |
| 📄 | `document` |
| 📃 | `document-text` |
| ✉️ 📧 | `envelope` |
| 📨 | `envelope-open` |
| 🟰 | `equal` |
| ❗ | `exclamation-circle` |
| ⚠️ | `exclamation-triangle` |
| 👁️ | `eye` |
| ☹️ 🙁 | `face-frown` |
| 😀 🙂 | `face-smile` |
| 🎬 | `film` |
| 🔥 | `fire` |
| 🚩 | `flag` |
| 📁 | `folder` |
| 📂 | `folder-open` |
| ⏩ | `forward` |
| ⚙️ | `gear` |
| 🎁 | `gift` |
| 🌐 | `globe-alt` |
| 🌎 | `globe-americas` |
| 🌏 | `globe-asia-australia` |
| 🌍 | `globe-europe-africa` |
| ✋ | `hand` |
| 👎 | `hand-thumb-down` |
| 👍 | `hand-thumb-up` |
| ❤️ | `heart` |
| 🏠 | `home` |
| 🆔 | `identification` |
| 📥 | `inbox-arrow-down` |
| ℹ️ | `information-circle` |
| 🔑 | `key` |
| 💡 | `light-bulb` |
| 🔗 | `link` |
| 🔒 | `lock-closed` |
| 🔓 | `lock-open` |
| 🔍 🔎 | `magnifying-glass` |
| 🗺️ | `map` |
| 📍 📌 | `map-pin` |
| 📢 📣 | `megaphone` |
| 🎤 | `microphone` |
| ➖ | `minus` |
| 📱 | `mobile` |
| 🌙 | `moon` |
| 🎵 | `musical-note` |
| 📰 | `newspaper` |
| 🚫 ⛔ | `no-circle` |
| 🖌️ | `paint-brush` |
| 📎 | `paper-clip` |
| ⏸️ | `pause` |
| ✏️ | `pencil` |
| 📝 | `pencil-square` |
| 📞 ☎️ | `phone` |
| 🖼️ | `photo` |
| ▶️ | `play` |
| ➕ | `plus` |
| 🔌 | `power` |
| 🖨️ | `printer` |
| 🧩 | `puzzle-piece` |
| ❓ | `question-mark-circle` |
| 📻 | `radio` |
| 🗂️ | `rectangle-stack` |
| 🚀 | `rocket-launch` |
| ⚖️ | `scale` |
| ✂️ | `scissors` |
| 🛡️ | `shield-check` |
| 🛍️ | `shopping-bag` |
| 🛒 | `shopping-cart` |
| 📶 | `signal` |
| ✨ | `sparkles` |
| 🔊 | `speaker-wave` |
| 🔇 | `speaker-x-mark` |
| ⭐ 🌟 | `star` |
| ⏹️ | `stop` |
| ☀️ | `sun` |
| 🎨 | `swatch` |
| 🏷️ | `tag` |
| 🎫 | `ticket` |
| 🗑️ | `trash` |
| 🏆 | `trophy` |
| 🚚 | `truck` |
| 👤 | `user` |
| 👥 | `users` |
| 🎥 | `video-camera` |
| 🔧 | `wrench` |
| 🛠️ | `wrench-screwdriver` |
| ❌ ✖️ | `x-mark` |
<!-- emoji:end -->

## Añadir o corregir un icono

1. Dibujarlo en Dazicon, en la caja de 24 × 24 y en ambas variantes.
2. Si el nombre del archivo no es kebab-case en inglés, añadirlo a `scripts/rename.json`.
3. `python3 -I scripts/extract.py <ruta a Dazicon.fig>` (o la variable `DAZICON_FIG`) y después `pnpm icons`.
4. Añadir alias de uso en `scripts/keywords.json` si el concepto no coincide con la forma.

La extracción falla si un icono queda sin pareja outline/solid o con nombre sin normalizar. La generación
valida cada icono: trazados dentro de la caja, identificador de módulo único y no reservado, categoría
existente, y que el sprite no repita ids.

Las tablas de categorías y de emojis de este archivo las escribe `pnpm icons` entre sus marcadores: no se
editan a mano.

## Verificación

```
pnpm icons       # regenera; falla si un icono no es válido o un alias o emoji apunta a uno inexistente
pnpm typecheck
pnpm test:unit icon
```
