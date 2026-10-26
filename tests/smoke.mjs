/**
 * Headless smoke test for the Wanderer module.
 * Stubs the Foundry globals the module touches, imports the module, and drives the
 * crafting / disenchant / slot flows with a fake actor.
 *
 * Run: node tests/smoke.mjs .   (any Node 18+; Foundry itself is not needed)
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.argv[2];
if (!ROOT) throw new Error("module root required");

let failures = 0;
const log = [];
function check(cond, msg) {
  if (cond) console.log(`  ok   ${msg}`);
  else { failures++; console.log(`  FAIL ${msg}`); }
}

/* ---------------- foundry.utils ---------------- */
const deepClone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
function mergeInto(target, other) {
  for (const [k, v] of Object.entries(other ?? {})) {
    if (k.startsWith("-=")) { delete target[k.slice(2)]; continue; }
    if (k.includes(".")) { setProp(target, k, v); continue; }
    if (isObj(v) && isObj(target[k])) mergeInto(target[k], v);
    else target[k] = isObj(v) ? deepClone(v) : v;
  }
  return target;
}
function setProp(obj, key, value) {
  const parts = key.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isObj(cur[parts[i]])) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  const last = parts.at(-1);
  if (last.startsWith("-=")) delete cur[last.slice(2)];
  else cur[last] = value;
}
function getProp(obj, key) {
  return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function expandObject(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) setProp(out, k, v);
  return out;
}
function isNewerVersion(v1, v0) {
  const a = String(v1).split(".").map(Number), b = String(v0).split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}
globalThis.foundry = {
  utils: {
    deepClone,
    mergeObject(orig, other = {}, { inplace = true } = {}) { return mergeInto(inplace ? orig : deepClone(orig), other); },
    expandObject,
    hasProperty: (o, k) => getProp(o, k) !== undefined,
    getProperty: getProp,
    isNewerVersion,
    isEmpty: v => v == null || (typeof v === "object" && Object.keys(v).length === 0)
  }
};
String.prototype.slugify = function ({ strict = false } = {}) {
  return this.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 -]/g, "").trim().replace(/\s+/g, "-");
};

/* ---------------- Hooks ---------------- */
const hooks = new Map();
globalThis.Hooks = {
  on(n, f) { if (!hooks.has(n)) hooks.set(n, []); hooks.get(n).push(f); },
  once(n, f) { this.on(n, f); },
  callAll(n, ...a) { for (const f of hooks.get(n) ?? []) f(...a); return true; },
  call(n, ...a) { for (const f of hooks.get(n) ?? []) if (f(...a) === false) return false; return true; }
};

/* ---------------- game / ui ---------------- */
const settingsStore = new Map();
const settingsCfg = new Map();
let gmUser = true;
globalThis.game = {
  i18n: { localize: k => k, format: (k, d) => `${k}|${JSON.stringify(d)}` },
  settings: {
    register(m, k, cfg) { settingsCfg.set(`${m}.${k}`, cfg); },
    registerMenu() {},
    get(m, k) { const key = `${m}.${k}`; if (!settingsCfg.has(key)) throw new Error(`unregistered setting ${key}`); return settingsStore.has(key) ? deepClone(settingsStore.get(key)) : deepClone(settingsCfg.get(key).default); },
    async set(m, k, v) { settingsStore.set(`${m}.${k}`, deepClone(v)); settingsCfg.get(`${m}.${k}`).onChange?.(v); }
  },
  user: { id: "u1", get isGM() { return gmUser; }, character: null },
  users: { get: () => ({ get isGM() { return gmUser; } }) },
  system: { id: "dnd5e", version: "3.0.4" },
  time: { worldTime: 0 },
  actors: { get: () => null, getName: () => null, filter: () => [] },
  modules: { get: () => moduleRecord }
};
const moduleRecord = {};
const warnings = [];
globalThis.ui = {
  notifications: { warn: m => warnings.push(m), info: () => {}, error: m => warnings.push(m) },
  windows: {},
  controls: { initialize() {} }
};
const chat = [];
globalThis.ChatMessage = { create: async d => { chat.push(d.content); return d; }, getSpeaker: () => ({}) };
globalThis.TextEditor = { enrichHTML: async s => s, getDragEventData: ev => JSON.parse(ev.dataTransfer.getData("text/plain")) };
globalThis.Handlebars = { registerHelper() {} };
globalThis.loadTemplates = async () => {};
globalThis.renderTemplate = async () => "<form></form>";
globalThis.CONST = {};
globalThis.FilePicker = class {};
globalThis.FormDataExtended = class { constructor() { this.object = {}; } };

/* ---------------- Applications ---------------- */
const fakeJq = { find: () => fakeJq, removeClass: () => fakeJq, addClass: () => fakeJq, filter: () => fakeJq, on: () => fakeJq, each: () => fakeJq, val: () => "3", length: 0, 0: null };
globalThis.Application = class {
  constructor(options = {}) { this.options = foundry.utils.mergeObject(this.constructor.defaultOptions, options, { inplace: false }); }
  static get defaultOptions() { return { classes: [], dragDrop: [], tabs: [], scrollY: [] }; }
  render() { return this; }
  close() { return Promise.resolve(); }
  get element() { return fakeJq; }
};
globalThis.FormApplication = class extends Application {
  constructor(object, options) { super(options); this.object = object; }
  static get defaultOptions() { return { ...super.defaultOptions, closeOnSubmit: true, submitOnChange: false, submitOnClose: false }; }
};
globalThis.Dialog = class extends Application {
  constructor(data, options) { super(options); this.data = data; }
  static async confirm() { return true; }
  render() {
    // Auto-press the default (or first) button so promise-based dialogs resolve.
    const buttons = this.data.buttons ?? {};
    const key = this.data.default && buttons[this.data.default] ? this.data.default : Object.keys(buttons)[0];
    buttons[key]?.callback?.(fakeJq);
    return this;
  }
};

/* ---------------- Documents ---------------- */
let idCounter = 0;
const newId = () => `id${++idCounter}`;
class Coll extends Map {
  filter(fn) { return [...this.values()].filter(fn); }
  map(fn) { return [...this.values()].map(fn); }
  find(fn) { return [...this.values()].find(fn); }
  [Symbol.iterator]() { return this.values(); }
}
globalThis.Item = class {
  constructor(data, parent = null) {
    this._id = data._id ?? newId();
    this.name = data.name; this.type = data.type; this.img = data.img;
    this.system = deepClone(data.system ?? {}); this.flags = deepClone(data.flags ?? {}); this.effects = deepClone(data.effects ?? []);
    this.parent = parent;
  }
  static get implementation() { return Item; }
  get id() { return this._id; }
  get sheet() { return { render() {} }; }
  getFlag(s, k) { return getProp(this.flags, `${s}.${k}`); }
  toObject() { return deepClone({ _id: this._id, name: this.name, type: this.type, img: this.img, system: this.system, flags: this.flags, effects: this.effects }); }
  toDragData() { return { type: "Item", uuid: `Actor.${this.parent?.id}.Item.${this.id}` }; }
  async update(changes) {
    const data = this.toObject();
    mergeInto(data, changes);
    Object.assign(this, { name: data.name, img: data.img, system: data.system, flags: data.flags });
    Hooks.callAll("updateItem", this, changes);
    return this;
  }
  async delete() {
    if (Hooks.call("preDeleteItem", this, {}, game.user.id) === false) return;
    this.parent?.items.delete(this.id);
    Hooks.callAll("deleteItem", this);
  }
};
globalThis.Actor = class {
  constructor() { this.id = "a1"; this.name = "The Wanderer"; this.type = "character"; this.flags = {}; this.items = new Coll(); }
  get isOwner() { return true; }
  getFlag(s, k) { return getProp(this.flags, `${s}.${k}`); }
  async setFlag(s, k, v) { setProp(this.flags, `${s}.${k}`, deepClone(v)); Hooks.callAll("updateActor", this, { flags: { [s]: { [k]: v } } }); }
  async unsetFlag(s, k) { setProp(this.flags, `${s}.-=${k}`, null); Hooks.callAll("updateActor", this, { flags: { [s]: { [`-=${k}`]: null } } }); }
  async createEmbeddedDocuments(type, arr) {
    const out = arr.map(d => { const it = new Item(d, this); this.items.set(it.id, it); Hooks.callAll("createItem", it); return it; });
    return out;
  }
};

/* ---------------- Load the module ---------------- */
const entry = pathToFileURL(path.join(ROOT, "scripts", "wanderer.mjs")).href;
await import(entry);
Hooks.callAll("init");
Hooks.callAll("ready");
const api = moduleRecord.api;
check(!!api && api === game.wanderer, "API exposed on module record and game.wanderer");

const actor = new Actor();
await api.designate(actor);
check(api.isWanderer(actor), "actor designated");

/* ---------------- Rune library ---------------- */
console.log("\nLibrary");
const lib = api.runes.library();
const count = r => lib.filter(x => x.rarity === r).length;
check(lib.length === 41, `41 runes (${lib.length})`);
check(count("uncommon") === 15 && count("rare") === 17 && count("veryRare") === 9, `15 / 17 / 9 by rarity (${count("uncommon")}/${count("rare")}/${count("veryRare")})`);
check(new Set(lib.map(r => r.id)).size === lib.length, "rune ids unique");
check(lib.every(r => r.img?.endsWith(".svg")), "every rune has an icon");
const customId = await api.runes.save({ name: "Test Rune", rarity: "rare", effect: "Does a thing." });
check(customId === "test-rune", `custom rune id slugified (${customId})`);
check(api.runes.library().some(r => r.id === "test-rune" && r.source === "custom"), "custom rune appears in library");
await api.runes.setDisabled("rooted", true);
check(!api.runes.library().some(r => r.id === "rooted"), "disabled rune hidden from library");
check(api.runes.get("rooted")?.disabled === true, "disabled rune still resolvable by id");
await api.runes.setDisabled("rooted", false);
await api.runes.save({ id: "rooted", name: "Rooted (edited)", rarity: "uncommon", effect: "x", flavor: "y" });
check(api.runes.get("rooted")?.source === "override" && api.runes.get("rooted").name === "Rooted (edited)", "built-in override applied");
await api.runes.remove("rooted");
check(api.runes.get("rooted")?.source === "builtin", "override reset to built-in");
await api.runes.remove("test-rune");
check(!api.runes.get("test-rune"), "custom rune deleted");

/* ---------------- Crafting a rune ---------------- */
console.log("\nCrafting");
let p = await api.crafting.beginProject(actor, { slot: "node1", kind: "rune", runeId: "titans-grip" });
check(p?.daysRequired === 10 && p.daysDone === 0, `uncommon project needs 10 days (${p?.daysRequired})`);
await api.crafting.workDays(actor, 1);
check(api.crafting.getProject(actor).daysDone === 1, "one day of work recorded");
warnings.length = 0;
await api.crafting.workDays(actor, 1);
check(api.crafting.getProject(actor).daysDone === 1 && warnings.length === 1, "second work the same day refused");
await api.crafting.grantNewDay(actor);
await api.crafting.workDays(actor, 1);
check(api.crafting.getProject(actor).daysDone === 2, "GM new day allows another work action");
game.time.worldTime = 86400 * 3;
check(api.crafting.projectStatus(actor).canWork, "world time rollover re-enables work");
await api.crafting.workDays(actor, 1);
check(api.crafting.getProject(actor).daysDone === 3, "work after world day change");
Hooks.callAll("dnd5e.restCompleted", actor, { longRest: true });
check(api.crafting.projectStatus(actor).canWork, "long rest re-enables work");
await api.crafting.workDays(actor, 6, { ignoreDaily: true });
let st = api.crafting.projectStatus(actor);
check(st.done === 9 && st.pct === 90 && !st.complete, `bulk days: 9/10 at 90% (${st.done}/${st.total}, ${st.pct}%)`);
await api.crafting.grantNewDay(actor);
await api.crafting.workDays(actor, 1);
check(api.crafting.getProject(actor) === undefined || api.crafting.getProject(actor) === null, "project cleared after completion");
let slots = api.slots.items(actor);
const rune = slots.node1;
check(!!rune, "rune installed in node1");
check(rune?.flags?.wanderer?.runeId === "titans-grip" && rune.flags.wanderer.kind === "rune", "rune item flagged with slot/kind/runeId");
check(rune?.system?.attunement === 2, `dnd5e 3.0 attunement = 2 (${rune?.system?.attunement})`);
check(rune?.system?.type?.value === "trinket", "equipment type trinket (3.x shape)");
check(Array.isArray(rune?.system?.properties) && rune.system.properties.includes("mgc"), "magical property set");
check(rune?.system?.equipped === true, "rune equipped");
check(chat.some(c => c.includes("WANDERER.Chat.installed")), "install announced to chat");

warnings.length = 0;
await api.crafting.beginProject(actor, { slot: "node2", kind: "rune", runeId: "titans-grip" });
check(!api.crafting.getProject(actor) && warnings.at(-1)?.includes("runeTaken"), "duplicate rune refused");
warnings.length = 0;
await api.crafting.beginProject(actor, { slot: "node2", kind: "rune", runeId: "unstable-core-ii" });
check(!api.crafting.getProject(actor) && warnings.at(-1)?.includes("requiresRune"), "prerequisite (Overload) enforced");

// A rune with uses + effects
p = await api.crafting.beginProject(actor, { slot: "node2", kind: "rune", runeId: "return-of-mind" });
check(p?.daysRequired === 125, `very rare needs 125 days (${p?.daysRequired})`);
await api.crafting.finishNow(actor);
const rom = api.slots.items(actor).node2;
check(rom?.system?.uses?.max === "1" && rom.system.uses.per === "lr" && rom.system.activation?.type === "special", "uses/activation set on Return of Mind");
check(rom?.effects?.length === 1 && rom.effects[0].changes.length === 3 && rom.effects[0].transfer === true, "active effect attached to Return of Mind");

/* ---------------- Disenchant & essence ---------------- */
console.log("\nDisenchant");
const [sword] = await actor.createEmbeddedDocuments("Item", [{
  name: "Flame Tongue", type: "weapon", img: "icons/sword.png",
  system: { rarity: "rare", attunement: 1, description: { value: "<p>Burns.</p>" }, equipped: false },
  effects: [{ name: "Glow", transfer: true, changes: [] }]
}]);
check(api.slots.disenchantables(actor).length === 1, "magic weapon listed as disenchantable");
const essence = await api.slots.disenchantItem(actor, sword);
check(!actor.items.get(sword.id), "original item destroyed");
check(essence.getFlag("wanderer", "essence")?.sourceName === "Flame Tongue" && essence.type === "loot", "essence created as loot with source data");
check(api.slots.essences(actor).length === 1 && api.slots.disenchantables(actor).length === 0, "essence not itself disenchantable");
p = await api.crafting.beginProject(actor, { slot: "node3", kind: "essence", essenceId: essence.id });
check(p?.daysRequired === 50, `rare essence needs 50 days (${p?.daysRequired})`);
await api.crafting.finishNow(actor);
const slotted = api.slots.items(actor).node3;
check(slotted?.type === "weapon" && slotted.system.attunement === 2 && slotted.system.equipped === true, "essence installed as the original weapon, attuned and equipped");
check(slotted?.effects?.length === 1, "original active effects preserved");
check(slotted?.flags?.wanderer?.kind === "essence" && slotted.flags.wanderer.slot === "node3", "slotted essence flagged");
check(api.slots.essences(actor).length === 0, "essence consumed on install");
await api.slots.remove(actor, "node3");
check(!api.slots.items(actor).node3 && api.slots.essences(actor).length === 1, "removing a slotted essence returns it to the inventory");
check(api.slots.essences(actor)[0].getFlag("wanderer", "essence").sourceName === "Flame Tongue", "returned essence keeps its source name");

// Instant essences setting
await game.settings.set("wanderer", "essenceInstant", true);
const ess2 = api.slots.essences(actor)[0];
await api.crafting.beginProject(actor, { slot: "node3", kind: "essence", essenceId: ess2.id });
check(!api.crafting.getProject(actor) && api.slots.items(actor).node3?.type === "weapon", "instant essence slots immediately");
await game.settings.set("wanderer", "essenceInstant", false);

// Replacing an occupied node through a finished project (Dialog.confirm → true)
await api.crafting.beginProject(actor, { slot: "node3", kind: "rune", runeId: "hurl" });
await api.crafting.finishNow(actor);
check(api.slots.items(actor).node3?.flags?.wanderer?.runeId === "hurl", "finished project replaces the occupant");
check(api.slots.essences(actor).length === 0, "replaced essence item (slotted) was destroyed, not returned");

/* ---------------- Core ---------------- */
console.log("\nCore");
const sidebarItem = new Item({ name: "Amulet of Health", type: "equipment", img: "icons/amulet.png", system: { rarity: "rare", attunement: 1 } }, null);
await api.slots.install(actor, "core", sidebarItem);
const core = api.slots.items(actor).core;
check(!!core && core.id !== sidebarItem.id, "sidebar item copied onto the actor as the core");
check(core?.system?.attunement === 2 && core.flags.wanderer.kind === "core", "core item attuned (required) and flagged");
gmUser = false;
await core.delete();
check(!!api.slots.items(actor).core, "player cannot delete the core item");
gmUser = true;
await api.slots.remove(actor, "core");
const leftover = actor.items.find(i => i.name === "Amulet of Health");
check(!api.slots.items(actor).core && leftover && leftover.system.attunement === 1, "GM removal unflags, restores name and un-attunes");

// Own-inventory item flagged in place
const [ring] = await actor.createEmbeddedDocuments("Item", [{ name: "Ring of Protection", type: "equipment", system: { rarity: "rare", attunement: 1 } }]);
await api.slots.install(actor, "core", ring);
check(api.slots.items(actor).core?.id === ring.id, "own item flagged in place as core");

/* ---------------- Apps render data ---------------- */
console.log("\nApps");
const app = new api.apps.WandererCoreApp(actor);
const data = await app.getData();
check(data.slots.length === 4 && data.links.length === 3, "core app: 4 slots, 3 links");
check(Math.abs(data.image.widthPct - (1440 / 497) * 100) < 0.01, `image width ${data.image.widthPct.toFixed(2)}%`);
check(data.slots.find(s => s.id === "core").item?.kind === "core", "core slot view carries kind");
check(data.slots.find(s => s.id === "node1").item?.effect?.length > 0, "rune slot view carries effect text");
await api.crafting.beginProject(actor, { slot: "node1", kind: "rune", runeId: "capacitor" });
const data2 = await app.getData();
check(data2.project.project && data2.slots.find(s => s.id === "node1").isProject && data2.links[0].forging, "forging state shown on slot and link");
const picker = new api.apps.RunePicker(actor, "node1");
const pd = await picker.getData();
check(pd.groups.length === 3 && pd.groups[0].key === "uncommon", "picker groups uncommon/rare/veryRare");
check(pd.groups[0].runes.find(r => r.id === "titans-grip")?.taken === true, "picker marks carved rune");
check(pd.groups[2].runes.find(r => r.id === "unstable-core-ii")?.locked === true, "picker locks prerequisite rune");
const ld = await new api.apps.RuneLibraryEditor().getData();
check(ld.groups.flatMap(g => g.runes).length === 41, "library editor lists all runes");
const lay = new api.apps.LayoutEditor().getData();
check(lay.slots.length === 4 && lay.layout.crop.w === 497, "layout editor data");
await new api.apps.LayoutEditor()._updateObject(null, { "slots.core.x": "48.5", "slots.core.label": "Heart", "crop.w": "500" });
check(api.layout().slots.core.x === 48.5 && api.layout().slots.core.label === "Heart" && api.layout().crop.w === 500, "layout editor saves");

console.log(`\n${failures ? `${failures} FAILURE(S)` : "ALL CHECKS PASSED"}; warnings seen: ${warnings.length}; chat lines: ${chat.length}`);
process.exit(failures ? 1 : 0);
