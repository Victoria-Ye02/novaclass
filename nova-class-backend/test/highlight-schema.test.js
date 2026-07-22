const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("setup creates cascading material highlight tables", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "setup_db.js"), "utf8");
  for (const table of ["material_highlight_analyses", "material_highlight_pages", "material_pdf_highlights"]) {
    assert.match(source, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(source, /UNIQUE KEY unique_material_highlight_analysis/);
  assert.match(source, /ON DELETE CASCADE/);
});
