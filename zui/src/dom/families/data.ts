// @zuccadev-labs/zuix-zui/dom/data — Tree, CommandPalette, Table (orden), Pagination, DataTable y TransferList sin
// framework.
// Registro: init(dataModule) o use(dataModule) junto a @zuccadev-labs/zuix-zui/dom/core.
import * as collections from "../collections";
import * as datatable from "../datatable";
import type { DomModule } from "../shared";
import { dataWidgets } from "../widgets-data";

export {
  checkTreeItem,
  openPalette,
  renameTreeItem,
  selectTreeItem,
  toggleTreeItem,
  sortTable,
  setPage,
  type SortDirection,
} from "../collections";
export { dataTableCSVFromDom, dataTableSelection, setDataTablePage, setDataTableSelection } from "../datatable";
export { destroyWidget, setWidgetProps } from "../widgets";

export const dataModule: DomModule = {
  name: "data",
  parts: [
    { rank: 30, setup: collections.setup, hydrate: collections.hydrate },
    { rank: 31, setup: datatable.setup, hydrate: datatable.hydrate },
    dataWidgets,
  ],
};
