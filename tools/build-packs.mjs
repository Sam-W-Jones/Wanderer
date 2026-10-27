/**
 * Build the module's compendium pack (packs/runes, LevelDB) from scripts/runes.mjs.
 *
 *   node tools/build-packs.mjs                      # uses classic-level from ./node_modules
 *   node tools/build-packs.mjs --modules <dir>      # dir whose node_modules holds classic-level,
 *                                                   # e.g. Foundry's own "resources/app" folder
 *
 * Foundry's bundled Node runs it too (no separate Node install needed):
 *   ELECTRON_RUN_AS_NODE=1 "<Foundry Virtual Tabletop.exe>" tools/build-packs.mjs --modules "<.../resources/app>"
 */
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const modulesDir = args.includes("--modules") ? path.resolve(args[args.indexOf("--modules") + 1]) : root;

function loadClassicLevel() {
  for (const base of [modulesDir, root]) {
    try {
      const require = createRequire(path.join(base, "package.json"));
      return require("classic-level").ClassicLevel;
    } catch (err) {
      if (err.code !== "MODULE_NOT_FOUND") throw err;
    }
  }
  throw new Error("classic-level not found. Run `npm install classic-level` or pass --modules <dir with node_modules>.");
}

const ClassicLevel = loadClassicLevel();
const { BUILTIN_RUNES } = await import(pathToFileURL(path.join(root, "scripts/runes.mjs")).href);
const { BUILTIN_CORES } = await import(pathToFileURL(path.join(root, "scripts/cores.mjs")).href);
const { buildRuneItemData, buildCoreItemData } = await import(pathToFileURL(path.join(root, "scripts/items.mjs")).href);

const packDir = path.join(root, "packs", "runes");
fs.rmSync(packDir, { recursive: true, force: true });
fs.mkdirSync(packDir, { recursive: true });

const db = new ClassicLevel(packDir, { keyEncoding: "utf8", valueEncoding: "json" });
const batch = db.batch();
let items = 0;
let effects = 0;
const now = Date.now();

const entries = [
  ...BUILTIN_RUNES.map(rune => buildRuneItemData(rune)),
  ...BUILTIN_CORES.map(core => buildCoreItemData(core))
];
for (const item of entries) {
  const embedded = item.effects;
  item.effects = embedded.map(e => e._id);
  item.folder = null;
  item.sort = 0;
  item.ownership = { default: 0 };
  item._stats = { systemId: "dnd5e", coreVersion: "11.315", createdTime: now, modifiedTime: now, lastModifiedBy: null };
  batch.put(`!items!${item._id}`, item);
  items++;
  for (const effect of embedded) {
    batch.put(`!items.effects!${item._id}.${effect._id}`, effect);
    effects++;
  }
}

await batch.write();
await db.close();
console.log(`packs/runes: ${items} items, ${effects} effects written to ${packDir}`);
