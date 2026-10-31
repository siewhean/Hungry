import assert from "node:assert/strict";
import test from "node:test";

import { deleteExportFile, writeExportFile } from "./exportFile";

test("on the web build there is no file system: delete is a quiet no-op and write refuses", () => {
  const scope = globalThis as { document?: unknown };
  const previous = scope.document;
  scope.document = {};
  try {
    assert.doesNotThrow(() => deleteExportFile());
    assert.throws(() => writeExportFile("{}"), /unavailable/);
  } finally {
    if (previous === undefined) delete scope.document;
    else scope.document = previous;
  }
});
