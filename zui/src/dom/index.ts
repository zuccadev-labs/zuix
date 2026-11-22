// @zuccadev-labs/zuix-zui/dom — comportamiento sin framework para el contrato HTML de zui.
// Mismo marcado, mismas clases y mismos atributos de estado que el binding de React; aquí los mueve el
// navegador (dialog, popover) y este módulo. Sirve en HTML plano, Vue, Svelte, Angular, Astro o plantillas de servidor.
//
// Uso declarativo:   import { init } from "@zuccadev-labs/zuix-zui/dom"; init();
// Uso imperativo:    openDialog(el), closeDialog(el), openPopover(el, anchor), openSubmenu(item), toast({...}), toastPromise(p, {...}), confirm({...}), startTour({...})
//
// Atributos:
//   data-z-open="#id"        abre el <dialog> o el [popover] indicado (el popover se ancla al disparador)
//   data-z-close             cierra el diálogo o popover que lo contiene
//   data-z-context="#id"     abre el menú indicado en la posición del puntero (clic derecho)
//   data-z-submenu="#id"     en un .z-menu__item: abre ese .z-menu[popover] como submenú, a su derecha
//   data-z-tooltip="texto"   tooltip al pasar el puntero o enfocar
//   data-z-placement         bottom-start (por defecto) | bottom | bottom-end | top-start | top | top-end | right | left
//   data-z-anchor="#id"      en un disparador data-z-open: coloca el popover junto a ese elemento (ancla distinta)
//   data-arrow               en un .z-popover: flecha hacia el centro del ancla
//   data-z-static            en un <dialog>: Escape y clic fuera no lo cierran
// Los atributos de referencia (`#id`) se resuelven con getElementById: valen ids con cualquier carácter y un valor
// que no sea un selector válido no lanza. Seguridad (CSP, Trusted Types, texto de la aplicación): ver ./shared.
// Tabs, Accordion, Switch, Checkbox, Radio, Toggle y SegmentedControl se activan solos dentro de un contenedor
// [data-z-dom]. Tras insertar marcado nuevo: hydrate(contenedor). Eventos: z:open, z:close, z:change, z:select.
//
// Esta entrada es la suite completa: reexporta ./core y todas las familias, e init() y hydrate() las registran
// todas, así que montan lo mismo que en 0.2.0. No hace nada al importarse: quien toma de aquí solo toast() no carga
// las familias. Para cargar solo lo que se usa: @zuccadev-labs/zuix-zui/dom/core más las familias que hagan falta
// (/dom/dates, /dom/data, /dom/content, /dom/agenda, /dom/charts, /dom/color, /dom/media, /dom/effects,
// /dom/time, /dom/terminal, /dom/dashboard, /dom/people),
// registradas con init(módulo, …) o use(módulo). Ver docs/users/06-frameworks.md.
import { hydrate as hydrateCore, init as initCore, use, type DomModule } from "./core";
import { agendaModule } from "./families/agenda";
import { chartsModule } from "./families/charts";
import { colorModule } from "./families/color";
import { contentModule } from "./families/content";
import { dashboardModule } from "./families/dashboard";
import { dataModule } from "./families/data";
import { datesModule } from "./families/dates";
import { effectsModule } from "./families/effects";
import { mediaModule } from "./families/media";
import { peopleModule } from "./families/people";
import { terminalModule } from "./families/terminal";
import { timeModule } from "./families/time";

export * from "./core";
export * from "./families/agenda";
export * from "./families/charts";
export * from "./families/color";
export * from "./families/content";
export * from "./families/dashboard";
export * from "./families/data";
export * from "./families/dates";
export * from "./families/effects";
export * from "./families/media";
export * from "./families/people";
export * from "./families/terminal";
export * from "./families/time";

const everything = (): DomModule[] => [
  datesModule,
  dataModule,
  contentModule,
  agendaModule,
  chartsModule,
  colorModule,
  mediaModule,
  effectsModule,
  timeModule,
  terminalModule,
  dashboardModule,
  peopleModule,
];

/**
 * Conecta el comportamiento de toda la suite (núcleo y todas las familias). Idempotente; llamar una vez al cargar.
 * Devuelve `destroy`, que retira todos los listeners del documento.
 */
export function init(...mods: DomModule[]): () => void {
  return initCore(...everything(), ...mods);
}

/** Prepara el marcado estático dentro de `[data-z-dom]` con todas las familias. Repetible. */
export function hydrate(root: ParentNode = document): void {
  use(...everything());
  hydrateCore(root);
}
