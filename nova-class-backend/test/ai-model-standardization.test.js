const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("production AI code has no Claude or Llama model identifiers", () => {
  const names = ["ai", "kmate", "classroom", "assignment"];
  const sources = names.map(name => fs.readFileSync(
    path.join(__dirname, "..", "controllers", "victoria", `${name}.controller.js`),
    "utf8"
  ));
  const joined = sources.join("\n");
  assert.doesNotMatch(joined, /claude-|llama-/i);
  assert.doesNotMatch(joined, /@anthropic-ai\/sdk/);
});
