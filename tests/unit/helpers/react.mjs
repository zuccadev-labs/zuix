// React y el render estático, resueltos desde zui/: la misma copia que usan los componentes bajo prueba
// (la raíz del workspace no depende de React).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(fileURLToPath(new URL("../../../zui/package.json", import.meta.url)));
export const React = require("react");
export const { renderToStaticMarkup } = require("react-dom/server");

/** Marcado estático de un componente con sus props. */
export const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
