// DownloadTrigger (core/download): tipos por extensión, nombres seguros y contenido como Blob.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mimeFromName, safeFileName, toBlob } from "../../zui/src/core/download.ts";

describe("DownloadTrigger", () => {
  test("tipo por la extensión", () => {
    assert.equal(mimeFromName("qr.SVG"), "image/svg+xml");
    assert.equal(mimeFromName("data.json"), "application/json");
    assert.equal(mimeFromName("cal.ics"), "text/calendar");
    assert.equal(mimeFromName("archive"), "application/octet-stream");
    assert.equal(mimeFromName("x.unknown"), "application/octet-stream");
  });
  test("nombre seguro", () => {
    assert.equal(safeFileName("../../etc/passwd"), "-..-etc-passwd");
    assert.equal(safeFileName('a<b>:c"d|e?.txt'), "a-b-c-d-e-.txt");
    assert.equal(safeFileName("   "), "download");
    assert.equal(safeFileName("..."), "download");
    assert.equal(safeFileName("report 2026.csv"), "report 2026.csv");
  });
  test("contenido como Blob: texto, bytes, Blob con y sin tipo, función asíncrona", async () => {
    const a = await toBlob("hola", "text/plain");
    assert.equal(a.type, "text/plain");
    assert.equal(await a.text(), "hola");
    const b = await toBlob(new Uint8Array([104, 105]), "text/plain");
    assert.equal(await b.text(), "hi");
    const typed = new Blob(["x"], { type: "image/png" });
    assert.equal(await toBlob(typed, "text/plain"), typed);
    assert.equal((await toBlob(new Blob(["x"]), "text/csv")).type, "text/csv");
    assert.equal(await (await toBlob(async () => "later", "text/plain")).text(), "later");
    assert.equal((await toBlob(new ArrayBuffer(3), "application/octet-stream")).size, 3);
  });
});
