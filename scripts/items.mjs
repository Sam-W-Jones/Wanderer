/**
 * Turns rune and core definitions (scripts/runes.mjs, scripts/cores.mjs) into complete dnd5e item data.
 *
 * This file has no Foundry dependencies so the same code builds the shipped compendium
 * (tools/build-packs.mjs, run under Node) and the items carved or seated at the table.
 *
 * dnd5e 4.0 moved activation, targeting, damage, saves and consumption out of the item into
 * Activities, and reshaped limited uses. The builders take a `shape`:
 *   "legacy"      the dnd5e 3.x fields (activation, actionType, damage.parts, save, consume ...)
 *   "activities"  dnd5e 4.x activities plus the 4.x uses structure
 *   "both"        both at once, for the shipped compendium: each system keeps the fields it knows and
 *                 cleans the rest away (4.x migrates the shared ones, e.g. uses.per and damage.parts).
 */
import { MODULE_ID, ICONS } from "./constants.mjs";
import { runeIcon } from "./library.mjs";

export const PACK_ID = `${MODULE_ID}.runes`;
export const SHAPES = ["legacy", "activities", "both"];

const ADD = 2;
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const str = v => (v === null || v === undefined ? "" : String(v));
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ABILITY_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const AREA_TARGETS = new Set(["circle", "cone", "cube", "cylinder", "line", "radius", "sphere", "square", "wall"]);
const DIE_STEPS = [4, 6, 8, 10, 12];
const DAMAGE_RE = /^\s*(\d+)d(\d+)(?:\s*([+-])\s*(@?[\w\d.-]+))?\s*$/i;
const ACTIVITY_TYPES = { mwak: "attack", rwak: "attack", msak: "attack", rsak: "attack", abil: "check", save: "save", heal: "heal" };

/** A deterministic 16-character Foundry id derived from a string, so pack ids survive rebuilds. */
export function stableId(seed) {
  let a = 0x811c9dc5;
  let b = 0x9747b28c;
  for (const ch of String(seed)) {
    const c = ch.codePointAt(0);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 16; i++) {
    a ^= a << 13; a >>>= 0;
    a ^= a >>> 17;
    a ^= a << 5; a >>>= 0;
    b = (Math.imul(b, 1664525) + 1013904223) >>> 0;
    out += ID_ALPHABET[((a ^ b) >>> 0) % ID_ALPHABET.length];
  }
  return out;
}

/** The compendium id of a built-in rune's item. */
export function runeItemId(runeId) {
  return stableId(`wanderer:rune:${runeId}`);
}

/** The compendium UUID of a built-in rune's item. */
export function runePackUuid(runeId) {
  return `Compendium.${PACK_ID}.Item.${runeItemId(runeId)}`;
}

/** The compendium id of a built-in core option's item. */
export function coreItemId(coreId) {
  return stableId(`wanderer:core:${coreId}`);
}

export function corePackUuid(coreId) {
  return `Compendium.${PACK_ID}.Item.${coreItemId(coreId)}`;
}

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

export function runeDescription(rune) {
  const parts = [];
  if (rune.effect) parts.push(`<p>${escape(rune.effect)}</p>`);
  if (rune.flavor) parts.push(`<p><em>${escape(rune.flavor)}</em></p>`);
  return parts.join("");
}

const DEFAULT_LABELS = {
  requirements: "Carved into the Wanderer's core",
  attunement: "Attunement (carved rune)"
};

/* -------------------------------------------- */
/*  dnd5e 3.x item fields                        */
/* -------------------------------------------- */

/** The activation / action fields shared by features and weapons, from a mechanics block. */
function legacySystem(m) {
  return {
    activation: { type: m.activation ?? "", cost: m.activation ? (m.cost ?? 1) : null, condition: m.condition ?? "" },
    duration: { value: m.duration?.value ?? null, units: m.duration?.units ?? "" },
    target: { value: m.target?.value ?? null, width: m.target?.width ?? null, units: m.target?.units ?? "", type: m.target?.type ?? "" },
    range: { value: m.range?.value ?? null, long: m.range?.long ?? null, units: m.range?.units ?? "" },
    consume: { type: "", target: null, amount: null, scale: false },
    ability: m.ability ?? "",
    actionType: m.actionType ?? "",
    attackBonus: "",
    chatFlavor: m.chatFlavor ?? "",
    critical: { threshold: null, damage: "" },
    damage: { parts: clone(m.damage ?? []), versatile: "" },
    formula: "",
    save: { ability: m.save?.ability ?? "", dc: null, scaling: m.save?.scaling ?? "spell" }
  };
}

/* -------------------------------------------- */
/*  dnd5e 4.x activities                         */
/* -------------------------------------------- */

/** A 4.x damage part from a legacy [formula, type] pair, the way dnd5e's own migration parses it. */
export function damagePart(part = ["", ""], { dropMod = false } = {}) {
  const [formula, type] = part;
  const data = {
    number: null, denomination: null, bonus: "",
    types: type ? [type] : [],
    custom: { enabled: false, formula: "" },
    scaling: { mode: "", number: null, formula: "" }
  };
  const m = String(formula ?? "").match(DAMAGE_RE);
  if (m && DIE_STEPS.includes(Number(m[2]))) {
    data.number = Number(m[1]);
    data.denomination = Number(m[2]);
    if (m[4]) data.bonus = m[3] === "-" ? `-${m[4]}` : m[4];
  } else if (formula) {
    data.custom.enabled = true;
    data.custom.formula = String(formula);
  }
  if (dropMod && data.bonus === "@mod") data.bonus = ""; // weapon attacks add the ability modifier themselves
  return data;
}

/** A consumption target spending one use of an item (blank target = the activity's own item). */
export function itemUsesTarget(target = "") {
  return { type: "itemUses", target, value: "1", scaling: { mode: "", formula: "" } };
}

function targetData(t = {}) {
  const type = t.type ?? "";
  const data = {
    template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: t.units || "ft" },
    affects: { count: "", type: "", choice: false, special: "" },
    prompt: true,
    override: false
  };
  if (AREA_TARGETS.has(type)) Object.assign(data.template, { type, size: str(t.value), width: str(t.width) });
  else Object.assign(data.affects, { type, count: str(t.value) });
  return data;
}

function activityBase(id, kind, m, effects, sort) {
  return {
    _id: id,
    type: kind,
    sort,
    activation: { type: m.activation ?? "", value: m.cost ?? null, condition: m.condition ?? "", override: false },
    consumption: { scaling: { allowed: false, max: "" }, spellSlot: false, targets: m.uses?.max ? [itemUsesTarget("")] : [] },
    description: { chatFlavor: m.chatFlavor ?? "" },
    duration: { value: str(m.duration?.value), units: m.duration?.units || "inst", special: "", concentration: false, override: false },
    effects: effects.filter(e => e.transfer === false).map(e => (kind === "save" ? { _id: e._id, onSave: false } : { _id: e._id })),
    range: { value: str(m.range?.value), units: m.range?.units || "self", special: "", override: false },
    target: targetData(m.target),
    uses: { spent: 0, max: "", recovery: [] }
  };
}

function saveFields(m, parts) {
  let calculation = m.save?.scaling ?? "";
  if (calculation === "flat") calculation = "";
  else if (calculation === "spell") calculation = "spellcasting";
  return {
    damage: { onSave: parts.length ? "half" : "none", parts },
    save: {
      ability: m.save?.ability ? [m.save.ability] : [],
      dc: { calculation, formula: m.save?.dc != null ? String(m.save.dc) : "" }
    }
  };
}

/**
 * The activities for a mechanics block: one primary activity by action type (attack, save, heal, check,
 * damage or utility) and, as dnd5e's own migration does, a second save activity when an attack or
 * utility also carries a save. Returns { activities, primary } where primary is the id to wire uses to.
 */
function activityData(seed, m, type, effects) {
  if (!(m.activation || m.actionType || type === "weapon")) return { activities: {}, primary: null };
  const parts = (m.damage ?? []).map(p => damagePart(p));
  let kind = type === "weapon" ? "attack" : (ACTIVITY_TYPES[m.actionType] ?? "utility");
  if (kind === "utility" && parts.length) kind = "damage";

  const primary = activityBase(stableId(`${seed}:${kind}`), kind, m, effects, 0);
  switch (kind) {
    case "attack":
      Object.assign(primary, {
        attack: {
          ability: m.ability ?? "", bonus: "", critical: { threshold: null }, flat: false,
          type: { value: String(m.actionType ?? "").startsWith("r") ? "ranged" : "melee", classification: "weapon" }
        },
        damage: { critical: { bonus: "" }, includeBase: true, parts: type === "weapon" ? parts.slice(1) : parts }
      });
      break;
    case "save":
      Object.assign(primary, saveFields(m, parts));
      break;
    case "heal":
      primary.healing = parts[0] ?? damagePart();
      break;
    case "damage":
      primary.damage = { critical: { allow: false, bonus: "" }, parts };
      break;
    case "check":
      primary.check = { ability: m.ability ?? "", associated: [], dc: { calculation: "", formula: "" } };
      break;
    default:
      primary.roll = { formula: "", name: "", prompt: false, visible: false };
  }

  const activities = { [primary._id]: primary };
  if (kind !== "save" && m.save?.ability) {
    const extra = activityBase(stableId(`${seed}:save`), "save", m, effects, 1);
    Object.assign(extra, saveFields(m, []));
    extra.consumption.targets = []; // the primary activity spends the uses
    activities[extra._id] = extra;
  }
  return { activities, primary: primary._id };
}

/**
 * Limited uses in the requested shape. 3.x: value/max/per (a numeric max fills the current value, a
 * formula such as @prof is resolved on carving). 4.x: spent/max/recovery with max as a live formula.
 * "both" carries the 3.x fields plus `spent`; 4.x turns `per` into a recovery profile on load.
 */
function usesData(m, shape) {
  const max = m.uses?.max ? String(m.uses.max) : "";
  const per = m.uses?.per ?? "";
  const numeric = max && Number.isFinite(Number(max)) ? Number(max) : null;
  if (shape === "activities") return { spent: 0, max, recovery: per ? [{ period: per, type: "recoverAll", formula: "" }] : [] };
  const legacy = { value: numeric, max, per, recovery: "" };
  return shape === "legacy" ? legacy : { ...legacy, spent: 0 };
}

/** The mechanics part of an item's system data in the requested shape, plus the primary activity id. */
function mechanicsSystem(m, { type, effects, seed, shape }) {
  if (!SHAPES.includes(shape)) throw new Error(`Unknown item shape "${shape}"`);
  const system = {};
  let primary = null;
  if (shape !== "activities") Object.assign(system, legacySystem(m));
  if (shape !== "legacy") {
    const built = activityData(seed, m, type, effects);
    system.activities = built.activities;
    primary = built.primary;
  }
  system.uses = usesData(m, shape);
  return { system, primary };
}

/** Active Effect data. `icon` is the v11 field, `img` the v12 one; each version drops the other. */
function effectData(id, { name, img, transfer = true, disabled = false, duration = {}, changes = [], flags = {} }) {
  return { _id: id, name, icon: img, img, transfer, disabled, duration: clone(duration), changes: clone(changes), flags };
}

/* -------------------------------------------- */
/*  Builders                                    */
/* -------------------------------------------- */

/**
 * Build item data for a rune.
 * @param {object} rune
 * @param {object} [options]
 * @param {object} [options.attunement]   system fields marking the item attuned (weapon runes only)
 * @param {boolean} [options.consumeAttunement=true]  add the effect that spends one attunement slot
 * @param {object} [options.labels]       text overrides (requirements, attunement)
 * @param {boolean} [options.withIds=true] include the deterministic item _id (needed for the compendium)
 * @param {string} [options.shape="both"] "legacy" (dnd5e 3.x), "activities" (dnd5e 4.x) or "both"
 */
export function buildRuneItemData(rune, {
  attunement = { attunement: 2 }, consumeAttunement = true, labels = {}, withIds = true, shape = "both"
} = {}) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const m = { ...(rune.item ?? {}) };
  m.activation ??= rune.activation;
  m.uses ??= rune.uses;
  const type = m.type === "weapon" ? "weapon" : "feat";
  const img = runeIcon(rune);

  const effects = (rune.effects ?? []).map((e, i) =>
    effectData(stableId(`wanderer:effect:${rune.id}:${i}`), { ...e, name: e.name ?? rune.name, img })
  );
  if (consumeAttunement && type !== "weapon") {
    effects.push(effectData(stableId(`wanderer:effect:${rune.id}:attunement`), {
      name: text.attunement, img,
      changes: [{ key: "system.attributes.attunement.max", mode: ADD, value: "-1", priority: 20 }],
      flags: { [MODULE_ID]: { attunement: true } }
    }));
  }

  const { system, primary } = mechanicsSystem(m, { type, effects, seed: `wanderer:activity:${rune.id}`, shape });
  Object.assign(system, {
    description: { value: runeDescription(rune), chat: "" },
    source: { custom: "The Wanderer" }
  });

  if (type === "weapon") {
    Object.assign(system, {
      type: { value: m.weapon?.type ?? "natural", baseItem: "" },
      properties: [...new Set(["mgc", ...(m.weapon?.properties ?? [])])],
      proficient: 1,
      equipped: true,
      quantity: 1,
      rarity: rune.rarity ?? "",
      identified: true,
      ...attunement
    });
    if (shape === "activities") {
      system.range = { value: m.range?.value ?? null, long: m.range?.long ?? null, units: m.range?.units ?? "" };
    }
    if (shape !== "legacy") {
      system.damage = { ...(system.damage ?? {}), base: damagePart(m.damage?.[0], { dropMod: true }) };
    }
  } else {
    Object.assign(system, {
      type: { value: "supernaturalGift", subtype: "" },
      requirements: text.requirements
    });
  }

  return {
    ...(withIds ? { _id: runeItemId(rune.id) } : {}),
    name: rune.name,
    type,
    img,
    system,
    effects,
    flags: {
      [MODULE_ID]: {
        runeId: rune.id,
        rarity: rune.rarity ?? "",
        effect: rune.effect ?? "",
        flavor: rune.flavor ?? "",
        requires: rune.requires ?? null,
        consumeOf: m.consumeOf ?? null,
        targetUses: m.targetUses ? clone(m.targetUses) : null,
        sourceName: rune.name,
        activityId: primary
      }
    }
  };
}

/**
 * Build item data for a core option: a feat with its activated part (if any) and one disabled
 * Active Effect per Awakened Core ability, toggled by the long-rest choice.
 */
export function buildCoreItemData(core, { withIds = true, shape = "both" } = {}) {
  const m = core.item ?? {};
  const img = core.img || ICONS.core;

  const effects = (core.awakened ?? []).map(ab => effectData(stableId(`wanderer:core-effect:${core.id}:${ab}`), {
    name: `Awakened Core (${ABILITY_NAMES[ab] ?? ab})`, img,
    disabled: true,
    changes: [{ key: `system.abilities.${ab}.value`, mode: ADD, value: "1", priority: 20 }],
    flags: { [MODULE_ID]: { awakened: ab } }
  }));

  const { system, primary } = mechanicsSystem(m, { type: "feat", effects, seed: `wanderer:activity:core:${core.id}`, shape });
  Object.assign(system, {
    description: { value: core.description ?? "", chat: "" },
    source: { custom: "The Wanderer" },
    type: { value: "feat", subtype: "" },
    requirements: core.requirements ?? ""
  });

  return {
    ...(withIds ? { _id: coreItemId(core.id) } : {}),
    name: core.name,
    type: "feat",
    img,
    system,
    effects,
    flags: {
      [MODULE_ID]: {
        coreId: core.id,
        sourceName: core.name,
        consumeNamed: m.consumeNamed ?? null,
        awakened: clone(core.awakened ?? []),
        activityId: primary
      }
    }
  };
}
