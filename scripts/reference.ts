// Copies LumiRPEngine's reference (docs/REFERENCE.md of the pinned engine in node_modules) to
// assets/REFERENCE.md, which the backend bundles for the assistant's reference_lookup. With
// `--check`, fails when the copy differs from the pinned engine's, as after moving the pin.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const source = readFileSync(join(root, "node_modules", "lumi-rp-engine", "docs", "REFERENCE.md"), "utf8");
const target = join(root, "assets", "REFERENCE.md");
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    current = "";
  }
  if (current !== source) {
    console.error("assets/REFERENCE.md differs from the pinned engine's; run `bun run reference`");
    process.exit(1);
  }
  console.log("assets/REFERENCE.md is current");
} else {
  writeFileSync(target, source);
  console.log(`wrote assets/REFERENCE.md (${source.length} characters)`);
}
