// Accesibilidad automática (axe-core) de la página sin framework, en tema oscuro y claro.
// Falla con violaciones `serious` o `critical`; las leves y moderadas solo se cuentan.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const axeSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../node_modules/axe-core/axe.min.js"), "utf8");

export default async function ({ page, test, ok, settle }) {
  for (const theme of ["dark", "light"]) {
    await test(`axe: sin violaciones graves (tema ${theme})`, async () => {
      const original = await page.evaluate(() => document.documentElement.dataset.theme);
      if (original !== theme) await page.locator("#theme").click();
      await page.mouse.move(5, 5);
      await settle();
      try {
        if (!(await page.evaluate(() => typeof window.axe !== "undefined"))) await page.evaluate(axeSource);
        const violations = await page.evaluate(async () => {
          const result = await window.axe.run(document, { resultTypes: ["violations"] });
          return result.violations
            .filter((v) => v.impact === "serious" || v.impact === "critical")
            .map(
              (v) =>
                `[${v.impact}] ${v.id}: ${v.nodes
                  .slice(0, 6)
                  .map((n) => `${n.target.join(" ")} (${(n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 160)})`)
                  .join("; ")}${v.nodes.length > 6 ? ` … y ${v.nodes.length - 6} más` : ""}`,
            );
        });
        ok(violations.length === 0, `${violations.length} reglas con violaciones graves:\n  ${violations.join("\n  ")}`);
      } finally {
        if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== original) await page.locator("#theme").click();
      }
    });
  }
}
