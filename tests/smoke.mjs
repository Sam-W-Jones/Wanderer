/**
 * Headless smoke test for the Wanderer module.
 * Stubs the Foundry globals the module touches, imports the module, and drives the
 * crafting / disenchant / slot / rider flows with a fake actor.
 *
 * Run: node tests/smoke.mjs .   (any Node 18+; Foundry itself is not needed)
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.argv[2];
if (!ROOT) throw new Error("module root required");

let failures = 0;
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
const moduleRecord = {};
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
  modules: { get: () => moduleRecord },
  packs: { get: () => null }
};
globalThis.fromUuid = async () => null;
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
globalThis.CONFIG = {};
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
class FakeEffect {
  constructor(data, parent) { this._id = data._id ?? newId(); Object.assign(this, deepClone(data)); this._id = this._id; this.parent = parent; }
  get id() { return this._id; }
  getFlag(s, k) { return getProp(this.flags ?? {}, `${s}.${k}`); }
}
globalThis.Item = class {
  constructor(data, parent = null) {
    this._id = data._id ?? newId();
    this.name = data.name; this.type = data.type; this.img = data.img;
    this.system = deepClone(data.system ?? {}); this.flags = deepClone(data.flags ?? {});
    this.effects = deepClone(data.effects ?? []).map(e => ({ _id: e._id ?? newId(), ...e }));
    this.parent = parent;
  }
  async updateEmbeddedDocuments(type, arr) {
    if (type !== "ActiveEffect") throw new Error("unsupported");
    for (const u of arr) { const e = this.effects.find(x => x._id === u._id); if (e) Object.assign(e, deepClone(u)); }
    return arr;
  }
  static get implementation() { return Item; }
  get id() { return this._id; }
  get uuid() { return `Actor.${this.parent?.id}.Item.${this.id}`; }
  get sheet() { return { render() {} }; }
  getFlag(s, k) { return getProp(this.flags, `${s}.${k}`); }
  toObject() { return deepClone({ _id: this._id, name: this.name, type: this.type, img: this.img, system: this.system, flags: this.flags, effects: this.effects }); }
  toDragData() { return { type: "Item", uuid: this.uuid }; }
  async update(changes) {
    const data = this.toObject();
    mergeInto(data, changes);
    Object.assign(this, { name: data.name, img: data.img, system: data.system, flags: data.flags });
    Hooks.callAll("updateItem", this, changes, {}, game.user.id);
    return this;
  }
  async delete() {
    if (Hooks.call("preDeleteItem", this, {}, game.user.id) === false) return;
    this.parent?.items.delete(this.id);
    Hooks.callAll("deleteItem", this, {}, game.user.id);
  }
};
globalThis.Actor = class {
  constructor() {
    this.id = "a1"; this.name = "The Wanderer"; this.type = "character"; this.flags = {};
    this.system = { abilities: { int: { value: 12 }, wis: { value: 14 } } };
    this.items = new Coll(); this.effects = new Coll();
  }
  get isOwner() { return true; }
  get uuid() { return `Actor.${this.id}`; }
  getFlag(s, k) { return getProp(this.flags, `${s}.${k}`); }
  async setFlag(s, k, v) { setProp(this.flags, `${s}.${k}`, deepClone(v)); Hooks.callAll("updateActor", this, { flags: { [s]: { [k]: v } } }); }
  async unsetFlag(s, k) { setProp(this.flags, `${s}.-=${k}`, null); Hooks.callAll("updateActor", this, { flags: { [s]: { [`-=${k}`]: null } } }); }
  async createEmbeddedDocuments(type, arr) {
    if (type === "ActiveEffect") return arr.map(d => { const e = new FakeEffect(d, this); this.effects.set(e.id, e); return e; });
    return arr.map(d => { const it = new Item(d, this); this.items.set(it.id, it); Hooks.callAll("createItem", it, {}, game.user.id); return it; });
  }
  async updateEmbeddedDocuments(type, arr) {
    if (type !== "ActiveEffect") throw new Error("unsupported");
    return arr.map(d => { const e = this.effects.get(d._id); Object.assign(e, deepClone(d)); return e; });
  }
  async deleteEmbeddedDocuments(type, ids) {
    if (type !== "ActiveEffect") throw new Error("unsupported");
    for (const id of ids) this.effects.delete(id);
    return ids;
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
const slotItems = () => api.slots.items(actor);
const riderEffects = () => actor.effects.filter(e => e.getFlag("wanderer", "rider"));

/* ---------------- Rune library & items ---------------- */
console.log("\nLibrary");
const lib = api.runes.library();
const count = r => lib.filter(x => x.rarity === r).length;
check(lib.length === 51, `51 runes (${lib.length})`);
check(count("uncommon") === 20 && count("rare") === 19 && count("veryRare") === 12, `20 / 19 / 12 by rarity (${count("uncommon")}/${count("rare")}/${count("veryRare")})`);
check(lib.filter(r => r.tags?.includes("utility")).length === 14, `14 utility-tagged runes (${lib.filter(r => r.tags?.includes("utility")).length})`);
check(!lib.some(r => ["return-of-mind", "recall", "deadweight"].includes(r.id)), "Return of Mind, Recall and Deadweight removed");
check(lib.some(r => r.id === "bedrock") && lib.some(r => r.id === "mortar"), "Bedrock and Mortar added");
check(!lib.some(r => /teleport(?!ation\b)/i.test(r.effect) && !/except by teleportation/i.test(r.effect)), "no rune denies teleportation");
check(new Set(lib.map(r => r.id)).size === lib.length, "rune ids unique");
const ids = lib.map(r => api.items.id(r.id));
check(ids.every(id => /^[A-Za-z0-9]{16}$/.test(id)) && new Set(ids).size === ids.length, "compendium ids are 16-char and unique");
check(api.items.id("overload") === api.items.id("overload"), "compendium ids deterministic");
const builtAll = lib.map(r => api.items.build(r));
check(builtAll.every(d => d._id && d.name && ["feat", "weapon"].includes(d.type) && d.system.description.value.length > 0), "every rune builds into feat or weapon item data");
check(builtAll.filter(d => d.type === "weapon").length === 2, "Runic Fist and Wrecking Yard build as weapons");
check(builtAll.filter(d => d.system.activation.type).length === 31, `31 runes are activatable (${builtAll.filter(d => d.system.activation.type).length})`);
check(builtAll.filter(d => d.system.uses.max).length === 7, `7 runes have limited uses (${builtAll.filter(d => d.system.uses.max).length})`);
const burrow = builtAll.find(d => d.flags.wanderer.runeId === "moles-road");
check(burrow.effects[0].changes[0].key === "system.attributes.movement.burrow" && burrow.effects[0].changes[0].value === "20", "Mole's Road grants a burrow speed by effect");
const bedrock = builtAll.find(d => d.flags.wanderer.runeId === "bedrock");
check(bedrock.effects.length === 2 && bedrock.effects[0].disabled === true && bedrock.effects[0].transfer === true && bedrock.effects[1].flags.wanderer.attunement, "Bedrock ships a disabled toggle effect plus the attunement effect");
check(builtAll.every(d => d.type === "weapon" || d.effects.some(e => e.flags?.wanderer?.attunement)), "feature runes carry the attunement effect");
const customId = await api.runes.save({ name: "Test Rune", rarity: "rare", effect: "Does a thing." });
check(customId === "test-rune", `custom rune id slugified (${customId})`);
await api.runes.setDisabled("rooted", true);
check(!api.runes.library().some(r => r.id === "rooted") && api.runes.get("rooted")?.disabled === true, "disabled rune hidden but resolvable");
await api.runes.setDisabled("rooted", false);
await api.runes.save({ id: "overload", name: "Overload (edited)", rarity: "rare", effect: "x", flavor: "y", item: api.runes.get("overload").item });
check(api.runes.get("overload")?.source === "override" && api.runes.get("overload").item?.uses?.max === 1, "built-in override keeps mechanics");
await api.runes.remove("overload");
await api.runes.remove("test-rune");
check(api.runes.get("overload")?.source === "builtin" && !api.runes.get("test-rune"), "override reset and custom rune deleted");

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
Hooks.callAll("dnd5e.restCompleted", actor, { longRest: true });
check(api.crafting.projectStatus(actor).canWork, "long rest re-enables work");
await api.crafting.workDays(actor, 6, { ignoreDaily: true });
let st = api.crafting.projectStatus(actor);
check(st.done === 9 && st.pct === 90 && !st.complete, `bulk days: 9/10 at 90% (${st.done}/${st.total}, ${st.pct}%)`);
await api.crafting.grantNewDay(actor);
await api.crafting.workDays(actor, 1);
check(!api.crafting.getProject(actor), "project cleared after completion");
const rune = slotItems().node1;
check(!!rune && rune.type === "feat" && rune.system.type.value === "supernaturalGift", "rune installed in node1 as a supernatural gift feature");
check(rune?.flags?.wanderer?.runeId === "titans-grip" && rune.flags.wanderer.kind === "rune", "rune item flagged with slot/kind/runeId");
check(String(rune?.system?.requirements).includes("Node I"), "requirements names the node");
check(rune?.effects?.length === 1 && rune.effects[0].changes[0].key === "system.attributes.attunement.max" && rune.effects[0].changes[0].value === "-1", "feature rune spends one attunement slot via effect");
check(chat.some(c => c.includes("WANDERER.Chat.installed")), "install announced to chat");

warnings.length = 0;
await api.crafting.beginProject(actor, { slot: "node2", kind: "rune", runeId: "titans-grip" });
check(!api.crafting.getProject(actor) && warnings.at(-1)?.includes("runeTaken"), "duplicate rune refused");
warnings.length = 0;
await api.crafting.beginProject(actor, { slot: "node2", kind: "rune", runeId: "unstable-core-ii" });
check(!api.crafting.getProject(actor) && warnings.at(-1)?.includes("requiresRune"), "prerequisite (Overload) enforced");

// A weapon rune
await api.crafting.beginProject(actor, { slot: "node2", kind: "rune", runeId: "runic-fist" });
await api.crafting.finishNow(actor);
const fist = slotItems().node2;
check(fist?.type === "weapon" && fist.system.damage.parts[0][0] === "1d8 + @mod" && fist.system.attunement === 2 && fist.system.equipped === true, "Runic Fist is an attuned, equipped natural weapon");
check(fist?.system?.properties?.includes("mgc") && fist.system.actionType === "mwak", "Runic Fist magical melee weapon attack");

// Overload → Unstable Core II consumes Overload's use
await api.crafting.beginProject(actor, { slot: "node3", kind: "rune", runeId: "overload" });
await api.crafting.finishNow(actor);
const overload = slotItems().node3;
check(overload?.system?.uses?.max === "1" && overload.system.uses.per === "lr" && overload.system.save.ability === "dex" && overload.system.save.scaling === "con" && overload.system.damage.parts[0][0] === "5d8", "Overload: 1/LR, Dex save scaling Con, 5d8 force");
await api.crafting.beginProject(actor, { slot: "node2", kind: "rune", runeId: "unstable-core-ii" });
check(!!api.crafting.getProject(actor) && slotItems().node2?.flags?.wanderer?.runeId === "runic-fist", "starting a project on an occupied node keeps the occupant in place");
await api.crafting.finishNow(actor);
const uc2 = slotItems().node2;
check(uc2?.flags?.wanderer?.runeId === "unstable-core-ii" && !actor.items.find(i => i.getFlag("wanderer", "runeId") === "runic-fist"), "finished project replaces the occupant; the old rune is gone");
check(uc2?.system?.consume?.type === "charges" && uc2.system.consume.target === overload.id, "Unstable Core II consumes Overload's charge");
check(uc2?.system?.activation?.type === "bonus" && overload.system.uses.per === "sr", "Unstable Core II is a bonus action and makes Overload recharge on a short rest");

// Tremor Step: sense effect + attunement effect (replacing Unstable Core II restores Overload's recovery)
await api.crafting.beginProject(actor, { slot: "node2", kind: "rune", runeId: "tremor-step" });
await api.crafting.finishNow(actor);
const tremor = slotItems().node2;
check(tremor?.effects?.length === 2 && tremor.effects[0].changes[0].value === "30" && tremor.effects.every(e => e.transfer === true), "Tremor Step carries its 30 ft sense effect and the attunement effect");
check(overload.system.uses.per === "lr", "prying out Unstable Core II restores Overload to long-rest recovery");

// Attunement setting off → no attunement effect
await game.settings.set("wanderer", "runesConsumeAttunement", false);
await api.crafting.beginProject(actor, { slot: "node2", kind: "rune", runeId: "bedrock" });
await api.crafting.finishNow(actor);
check(slotItems().node2?.effects?.length === 1 && !slotItems().node2.effects.some(e => e.flags?.wanderer?.attunement), "attunement effect omitted when the setting is off");
await game.settings.set("wanderer", "runesConsumeAttunement", true);

/* ---------------- Disenchant, essences & riders ---------------- */
console.log("\nDisenchant & riders");
await game.settings.set("wanderer", "essenceInstant", true);
const [sword, dagger, plate, wand] = await actor.createEmbeddedDocuments("Item", [
  { name: "+2 Longsword", type: "weapon", img: "icons/sword.png", system: { rarity: "rare", attunement: 0, attackBonus: "2", damage: { parts: [["1d8 + @mod + 2", "slashing"]] }, description: { value: "<p>Shiny.</p>" }, equipped: false }, effects: [{ name: "Glow", transfer: true, changes: [] }] },
  { name: "Dagger +1", type: "weapon", system: { rarity: "uncommon", attackBonus: "1", damage: { parts: [["1d4 + @mod + 1", "piercing"]] } } },
  { name: "+1 Breastplate", type: "equipment", system: { rarity: "rare", type: { value: "medium" }, armor: { value: 14, dex: 2 }, equipped: true } },
  { name: "Wand of Magic Missiles", type: "consumable", system: { rarity: "uncommon", attunement: 1 } }
]);
check(api.riders.of(sword)?.bonus === 2 && api.riders.of(dagger)?.bonus === 1 && api.riders.of(plate)?.kind === "armor" && api.riders.of(plate).bonus === 1 && api.riders.of(wand) === null, "riders detected from attack bonus, name and armor name; none for a wand");
check(api.slots.disenchantables(actor).length === 4, "four magic items disenchantable");

const essSword = await api.slots.disenchantItem(actor, sword);
check(!actor.items.get(sword.id) && essSword.type === "loot" && essSword.getFlag("wanderer", "essence").rider?.bonus === 2, "sword destroyed; essence records the +2 rider");
await api.crafting.beginProject(actor, { slot: "node3", kind: "essence", essenceId: essSword.id });
await api.riders.request(actor);
let node3 = slotItems().node3;
check(node3?.type === "weapon" && node3.flags.wanderer.kind === "essence" && node3.system.attunement === 2 && node3.system.equipped === true, "instant essence slotted as the weapon, attuned and equipped");
check(node3?.system?.attackBonus === "" && node3.system.damage.parts[0][0] === "1d8 + @mod", "node copy has the +2 stripped from attack and damage");
check(node3?.effects?.length === 1, "original active effects preserved on the node item");
check(riderEffects().length === 1 && riderEffects()[0].getFlag("wanderer", "bonus") === 2 && riderEffects()[0].changes.some(c => c.key === "system.bonuses.mwak.attack" && c.value === "+2"), "actor carries one weapon rider effect at +2");

const essDagger = await api.slots.disenchantItem(actor, dagger);
await api.crafting.beginProject(actor, { slot: "node2", kind: "essence", essenceId: essDagger.id });
await api.riders.request(actor);
check(riderEffects().length === 1 && riderEffects()[0].getFlag("wanderer", "bonus") === 2, "a second +1 weapon does not stack: rider stays +2");

await api.slots.remove(actor, "node3");
await api.riders.request(actor);
check(riderEffects().length === 1 && riderEffects()[0].getFlag("wanderer", "bonus") === 1, "removing the +2 weapon drops the rider to the remaining +1");
const returned = api.slots.essences(actor).find(e => e.getFlag("wanderer", "essence").sourceName === "+2 Longsword");
check(returned?.getFlag("wanderer", "essence").sourceData.system.attackBonus === "2" && returned.getFlag("wanderer", "essence").rider?.bonus === 2, "returned essence keeps the original +2 data");

const essPlate = await api.slots.disenchantItem(actor, plate);
await api.crafting.beginProject(actor, { slot: "node3", kind: "essence", essenceId: essPlate.id });
await api.riders.request(actor);
node3 = slotItems().node3;
check(node3?.type === "equipment" && node3.system.equipped === false && node3.system.attunement === 2, "armor essence is attuned but not worn");
check(riderEffects().length === 2 && riderEffects().find(e => e.getFlag("wanderer", "rider") === "armor")?.changes[0].key === "system.attributes.ac.bonus", "armor rider adds to AC alongside the weapon rider");
check(api.riders.active(actor).weapon === 1 && api.riders.active(actor).armor === 1, "active riders: weapon +1, armor +1");

// Replacing a slotted essence through a finished project returns it to the inventory
await api.crafting.beginProject(actor, { slot: "node3", kind: "rune", runeId: "hurl" });
await api.crafting.finishNow(actor);
await api.riders.request(actor);
check(slotItems().node3?.flags?.wanderer?.runeId === "hurl", "finished project replaces the slotted essence");
check(api.slots.essences(actor).some(e => e.getFlag("wanderer", "essence").sourceName === "+1 Breastplate"), "replaced essence returns to the inventory");
check(riderEffects().length === 1 && riderEffects()[0].getFlag("wanderer", "rider") === "weapon", "armor rider removed with its node");
await game.settings.set("wanderer", "essenceInstant", false);

// Timed essence
const essWand = await api.slots.disenchantItem(actor, wand);
p = await api.crafting.beginProject(actor, { slot: "node3", kind: "essence", essenceId: essWand.id });
check(p?.daysRequired === 10 && slotItems().node3?.flags?.wanderer?.runeId === "hurl", "timed essence project queued; Hurl stays until it is done");
await api.crafting.abandonProject(actor, { ask: false });

/* ---------------- Core ---------------- */
console.log("\nCore");
const sidebarItem = new Item({ name: "Amulet of Health", type: "equipment", img: "icons/amulet.png", system: { rarity: "rare", attunement: 1 } }, null);
await api.slots.install(actor, "core", sidebarItem);
const core = slotItems().core;
check(!!core && core.id !== sidebarItem.id && core.system.attunement === 2 && core.flags.wanderer.kind === "core", "sidebar item copied onto the actor as the attuned core");
gmUser = false;
await core.delete();
check(!!slotItems().core, "player cannot delete the core item");
gmUser = true;
await api.slots.remove(actor, "core");
const leftover = actor.items.find(i => i.name === "Amulet of Health");
check(!slotItems().core && leftover && leftover.system.attunement === 1, "GM removal unflags, restores name and un-attunes");

/* ---------------- Core options ---------------- */
console.log("\nCore options");
const cores = api.cores.options();
check(cores.length === 1 && cores[0].id === "core-of-the-wanderer", "one built-in core option");
const builtCore = api.items.buildCore(cores[0]);
check(builtCore.type === "feat" && builtCore.system.type.value === "feat" && builtCore.system.requirements.includes("Kar"), "Core of the Wanderer builds as a feat with its prerequisite");
check(builtCore.system.uses.max === "1" && builtCore.system.uses.per === "lr" && builtCore.system.activation.type === "minute" && builtCore.system.activation.cost === 10, "Search the Core: 1/long rest over 10 minutes");
check(builtCore.effects.length === 2 && builtCore.effects.every(e => e.disabled && e.transfer) && builtCore.effects.map(e => e.flags.wanderer.awakened).join() === "int,wis", "two disabled Awakened Core effects (Int, Wis)");
check(/^[A-Za-z0-9]{16}$/.test(builtCore._id) && !ids.includes(builtCore._id), "core compendium id valid and distinct from rune ids");
const [rage] = await actor.createEmbeddedDocuments("Item", [{ name: "Rage", type: "feat", system: { uses: { value: 3, max: "3", per: "lr" } } }]);
const seated = await api.cores.seat(actor, "core-of-the-wanderer");
check(slotItems().core?.id === seated.id && seated.name === "Core of the Wanderer" && seated.flags.wanderer.kind === "core" && seated.flags.wanderer.coreId === "core-of-the-wanderer", "core seated without a name prefix and flagged as the core");
check(seated.system.consume?.type === "charges" && seated.system.consume.target === rage.id, "Search the Core spends a use of Rage");
check(!actor.items.find(i => i.name === "Amulet of Health" && i.getFlag("wanderer", "slot")), "seating replaced the previous core item");
const chosen = await api.cores.awakened(actor);
const eff = ab => seated.effects.find(e => e.flags.wanderer.awakened === ab);
check(chosen === "int" && eff("int").disabled === false && eff("wis").disabled === true, "long-rest choice enables Intelligence and disables Wisdom");
actor.system.abilities.int.value = 21; // 20 base + the active effect
const capped = await api.cores.awakened(actor);
check(capped === null && eff("int").disabled === true && eff("wis").disabled === true, "Awakened Core grants nothing once the score is 20");
actor.system.abilities.int.value = 12;
await Hooks.callAll("dnd5e.restCompleted", actor, { longRest: true });
await new Promise(r => setTimeout(r, 10));
check(eff("int").disabled === false, "long rest hook runs the Awakened Core choice");
// Dropping the compendium-style core item onto the core keeps its name and links Rage
const coreDoc = new Item(api.items.buildCore(cores[0]), null);
await api.slots.install(actor, "core", coreDoc);
check(slotItems().core?.name === "Core of the Wanderer" && slotItems().core.system.consume?.target === rage.id, "dropped core item keeps its name and is wired to Rage");
await api.slots.remove(actor, "core");
await api.slots.install(actor, "core", sidebarItem);

/* ---------------- Apps render data ---------------- */
console.log("\nApps");
const app = new api.apps.WandererCoreApp(actor);
const data = await app.getData();
check(data.slots.length === 4 && data.links.length === 3, "core app: 4 slots, 3 links");
check(data.riders.any && data.riders.summary.includes("+1"), `riders summary shown (${data.riders.summary})`);
check(data.slots.find(s => s.id === "node2").item?.riderLabel.includes("+1"), "slot view carries the rider label");
const picker = new api.apps.RunePicker(actor, "node1");
const pd = await picker.getData();
check(pd.groups.length === 3 && pd.groups[0].runes.every(r => r.packUuid?.startsWith("Compendium.wanderer.runes.Item.")), "picker rows link to the compendium");
check(pd.groups[0].runes.find(r => r.id === "titans-grip")?.taken === true, "picker marks carved rune");
const ld = await new api.apps.RuneLibraryEditor().getData();
check(ld.groups.flatMap(g => g.runes).length === 51, "library editor lists all runes");

console.log(`\n${failures ? `${failures} FAILURE(S)` : "ALL CHECKS PASSED"}; warnings seen: ${warnings.length}; chat lines: ${chat.length}`);
process.exit(failures ? 1 : 0);
