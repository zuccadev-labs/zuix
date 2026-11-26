# Diagramas de infraestructura

Un diagrama de red o de homelab es un `NodeCanvas` con piezas propias: aristas que dicen la velocidad del enlace con
su grosor, troncales en línea doble, conectores de un switch con sus VLAN, tarjetas con pestaña, pools de discos,
zonas y una leyenda que sale del propio grafo. Se puede dibujar a mano o generar desde un inventario JSON, y se
exporta a SVG o PNG con los datos sensibles enmascarados. La pantalla `?screen=infra` de la aplicación de ejemplo
lo junta todo con un laboratorio inventado.

## Empezar

```tsx
import { DiagramLegend, NodeCanvas, diagramFromInventory, legendFromGraph } from "@zuccadev-labs/zuix-zui";

const lab = diagramFromInventory(inventory);

export function Lab() {
  return (
    <>
      <NodeCanvas aria-label="Home lab" readOnly edgeType="orthogonal" nodes={lab.nodes} edges={lab.edges} />
      <DiagramLegend title="Legend" entries={legendFromGraph(lab, lab.legend)} />
    </>
  );
}
```

`diagramFromInventory` coloca los equipos por niveles (internet → borde → núcleo → equipos → servidores) con
`layeredLayout`. Las tarjetas las pinta la aplicación con `renderNode`; el tamaño real se conoce después de
pintarlas, así que lo habitual es una segunda pasada con las medidas del lienzo:

```tsx
const canvas = useRef<NodeCanvasHandle>(null);
const [lab, setLab] = useState(() => diagramFromInventory(inventory));
useEffect(() => {
  requestAnimationFrame(() => setLab(diagramFromInventory(inventory, { sizes: canvas.current?.sizes })));
}, []);
```

## Aristas

Todo es opcional en `GraphEdge`: una arista sin estos campos se pinta como antes.

| Campo | Valores | Qué hace |
|---|---|---|
| `weight` | `"10G"`, `"2.5G"`, `"1G"`, `"100M"`, cualquier valor de la escala | Grosor según `edgeScale` del lienzo. Por defecto `SPEED_SCALE` (10M a 100G); un caudal que no está en la escala (`"4G"`, `"600 Mbit/s"`) se interpola en escala logarítmica |
| `width` | px | Grosor fijo. Gana a `weight` |
| `dash` | `solid`, `dashed`, `dotted` | Tipo de línea. El patrón se ajusta al grosor |
| `double` | `true` | Línea doble con núcleo: un troncal 802.1Q |
| `color` | tono (`accent`, `danger`…), token (`chart-3`) o color libre (`#58a6ff`, `oklch(…)`) | Color. Gana a `tone`. Una palabra suelta se lee como token; lo que no es ninguna de las tres cosas se descarta |
| `sourceLabel`, `targetLabel` | texto | Etiqueta junto a un extremo («10G» al lado del puerto) |
| `kind` | texto | Categoría para la leyenda (`trunk`, `wan`, `console`…) |
| `type: "orthogonal"` | | Ruta de tramos horizontales y verticales con esquinas redondeadas que esquiva los nodos |

El enrutado ortogonal calcula todas las aristas a la vez: prueba primero las formas sencillas (la escalonada de
siempre y sus variantes con el tramo central en los pasillos entre nodos) y, si ninguna queda libre, busca con A*
sobre la rejilla de los bordes de los obstáculos cercanos, con un coste por giro. Después abre en abanico los
tramos de aristas distintas que van por el mismo pasillo. Es determinista: el mismo grafo da las mismas rutas.
Con 300 nodos y 600 aristas tarda unos 330 ms en un portátil, sin que ninguna ruta atraviese un nodo; mientras se
arrastra un nodo se usa la escalonada simple y la buena llega al soltar. `routing` ajusta el margen alrededor de
los nodos, el radio y la separación de los carriles, y `routeOrthogonal(peticiones, obstáculos)` sirve fuera del
lienzo.

## Nodos y contenedores

| `type` | Qué pinta |
|---|---|
| `cloud` | Una nube con título y descripción (Internet, un proveedor) |
| `folder` | Una tarjeta con pestaña de carpeta: `data.label` · `data.kind` y borde de `data.color` |
| `zone` | Un grupo de borde discontinuo con etiqueta, nota (`data.description`) y color de zona; contiene nodos con `parentId` |
| `text` | Un rótulo sin caja: el título del póster, una nota |

Un puerto con `anchor: true` no pinta su asa: lo dibuja el cuerpo del nodo con un elemento `[data-port-anchor]
[data-port="id"]`, y la arista sale del centro de ese elemento. Es lo que hacen los conectores de `PortPanel`, así
un enlace sale del puerto 3 del switch y no del centro de la tarjeta. En una tarjeta con pestaña, las aristas que
entran por arriba llegan al borde de la tarjeta, no a la pestaña.

## Componentes

| Componente | Para qué |
|---|---|
| `FolderCard` | La tarjeta con pestaña, también fuera del lienzo |
| `PortPanel` | La cara del equipo: RJ45, SFP, QSFP o coaxial numerados, estado (libre, enlazado, deshabilitado, expuesto), marcas de VLAN (alta = sin etiquetar, cortas = etiquetadas) y destino |
| `StoragePool` | Un pool con sus vdevs (fila de discos HDD, SSD o NVMe), tipo, cuántos discos pueden fallar, uso y nota |
| `DiagramLegend` | La leyenda: categorías de arista, grosores, zonas y símbolos (`vlan`, `share`, `chip:LAN`, `text:app.example.net` o un icono) |
| `DeviceSummary` | Modelo, IP, host y versión de un equipo |
| `SpecList` | Losetas de hardware, servicios o redes, con color por VLAN |
| `Redact` | Un dato que se enmascara con el interruptor global |

En el modo DOM son el mismo marcado (`html.json`); `/dom/nodes` añade el teclado de `PortPanel` y el
enmascarado.

## Inventario

El inventario describe el laboratorio, no el dibujo. Su esquema es `INVENTORY_SCHEMA` (JSON Schema 2020-12) y
`validateInventory(inv)` devuelve las referencias rotas (un puerto, una red o un equipo que no existe).

```json
{
  "title": "Example lab",
  "networks": [
    { "id": "lan", "name": "LAN", "vlan": 10, "subnet": "10.0.10.0/24", "color": "chart-1" },
    { "id": "dmz", "name": "DMZ", "vlan": 20, "color": "chart-2", "zone": true }
  ],
  "internet": { "label": "Internet", "down": "1 Gbit/s", "up": "100 Mbit/s" },
  "externals": [{ "id": "dns", "name": "DNS provider" }],
  "devices": [
    { "id": "fw", "name": "Firewall", "role": "firewall", "ip": "10.0.99.1", "ports": [{ "id": "lan1", "tagged": ["lan", "dmz"] }] },
    { "id": "sw", "name": "Core switch", "role": "switch", "ports": [{ "id": "p1" }, { "id": "p2", "untagged": "lan" }] },
    {
      "id": "hv", "name": "Hypervisor", "role": "server",
      "hardware": [{ "kind": "CPU", "value": "16-core CPU", "note": "32 threads" }],
      "guests": [{ "id": "web", "name": "Web", "type": "ct", "network": "dmz", "hostname": "web.example.net" }],
      "pools": [{ "name": "tank", "used": 2e13, "size": 4e13, "vdevs": [{ "layout": "raidz2", "disks": 6, "disk": "hdd" }] }]
    }
  ],
  "links": [
    { "from": "internet", "to": "fw", "kind": "wan", "speed": "1G" },
    { "from": "fw:lan1", "to": "sw:p1", "kind": "trunk", "speed": "2.5G" },
    { "from": "sw:p2", "to": "hv", "speed": "10G", "network": "lan" }
  ],
  "services": [{ "name": "Web", "host": "web", "ports": "443", "protocol": "tcp", "public": true }]
}
```

| Clave | Contenido |
|---|---|
| `networks` | `id`, `name`, `vlan`, `subnet`, `color`, `note`; `zone: true` pinta una zona con los invitados de esa red |
| `devices` | `id`, `name`, `role` (`modem`, `router`, `firewall`, `switch`, `ap`, `workstation`, `server`, `nas`, `kvm`, `iot`, `other`), `model`, `os`, `ip`, `hostname`, `network`, `icon`, `color`, `ports`, `hardware`, `guests`, `pools`, `ssids` |
| `ports` | `id`, `label`, `connector`, `speed`, `untagged`, `tagged`, `state`, `to` (si falta, el nombre del equipo enlazado) |
| `links` | `from` y `to` como `equipo` o `equipo:puerto` (`internet` es la nube), `speed`, `kind` (`trunk`, `access`, `wan`, `console`, `internet`, `vpn`), `network`, `label` |
| `services` | `name`, `host` (un equipo o un invitado), `ports`, `protocol`, `public`, `note` |

Cada enlace sale del equipo de nivel más alto y entra por arriba en el otro; un puerto cuyo enlace sube lleva su
conector anclado arriba. El estilo sale de `kind`: `trunk` es doble, `access` toma el color de su red, `wan` va en
rojo, `console` discontinua e `internet` y `vpn` punteadas. El grosor sale de `speed`.

## Exportar

```ts
const svg = await canvas.current.exportSVG({ title: "Example lab", padding: 40 });
const png = await canvas.current.exportPNG({ scale: 2, redact: "all" });
```

`handle.exportSVG` pinta todo el diagrama (sin el recorte de lo que no se ve), lo encuadra al 100 % con un margen y
quita el cromo (controles, minimapa, selección). `exportSVG(el)` y `exportPNG(el)` hacen lo mismo con cualquier
elemento. El SVG lleva el HTML dentro de un `<foreignObject>` con cada estilo resuelto a su valor: no depende de las
hojas de la página y se ve igual fuera. Las imágenes del mismo origen se incrustan como `data:`.

Las fuentes son la parte delicada. Con `embedFonts` (por defecto) se incrustan las de las reglas `@font-face`
legibles de la página que usa el contenido; una hoja de otro origen sin CORS no se puede leer y su fuente queda
fuera. Para un SVG que se abrirá en otro programa, o con fuentes de un servicio externo, pasa `fontCSS` con tus
`@font-face` y `src: url(data:…)`. El PNG se rasteriza desde ese SVG en un `<canvas>`: sin las fuentes incrustadas,
el navegador usa las del sistema. Con una CSP estricta, el PNG necesita `img-src data:`.

No uso la API de HTML en canvas (`drawElement`): hoy solo está en un motor y detrás de una bandera.

## Enmascarar datos sensibles

```tsx
import { Redact, setRedaction } from "@zuccadev-labs/zuix-zui";

<Redact kind="domain">git.mylab.example</Redact>;
setRedaction(true, { domain: "redacted.example", privateIps: true });
```

Con el interruptor encendido, `Redact` no pone el valor real en el documento: sale uno genérico y estable
(`git.redacted.example`, una IP de los rangos de documentación). Los nombres internos (`.internal`, `.lan`,
`.local`) se conservan; las IP privadas también, salvo con `privateIps`. Sin React, cualquier elemento con
`data-sensitive="auto | domain | ip | email | text"` se enmascara igual, y un `<input type="checkbox"
data-z-redact-toggle>` hace de interruptor. `exportSVG({ redact: true })` enmascara solo lo marcado y
`redact: "all"` todo el texto de la exportación.

## Iconos de marca

zuix no trae logotipos de terceros. La aplicación registra los suyos con `registerAppIcons` (trazados, un SVG
como texto o una imagen) y los usa por nombre en `data.icon`, `DeviceSummary` o `<z-icon>`. Ver
[Zicon](./02-zicon.md#iconos-propios-de-la-aplicación).

## Accesibilidad

- El lienzo sigue siendo una sola parada de Tab, con su descripción de nodos y conexiones. Dentro de una tarjeta
  (Intro), `PortPanel` es una lista de opciones con foco itinerante: flechas, Inicio y Fin; cada puerto se anuncia
  entero con su estado, destino y VLAN.
- Ninguna diferencia depende solo del color: el tipo de línea, el grosor y los textos de la leyenda llevan la misma
  información, y la leyenda anuncia «Dashed line», «Double line» o «Zone» delante de cada fila.
- Con `forced-colors` las aristas, bordes y marcas se pintan con `CanvasText`; las marcas de VLAN conservan su
  altura y el núcleo de las líneas dobles el color del fondo.
- Con `prefers-reduced-motion` las aristas animadas no se mueven.
