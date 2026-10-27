/**
 * Turns rune and core definitions (scripts/runes.mjs, scripts/cores.mjs) into complete dnd5e item data.
 *
 * This file has no Foundry dependencies so the same code builds the shipped compendium
 * (tools/build-packs.mjs, run under Node) and the items carved or seated at the table.
 */
import { MODULE_ID, ICONS } from "./constants.mjs";
import { runeIcon } from "./library.mjs";

export const PACK_ID = `${MODULE_ID}.runes`;

const ADD = 2;
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ABILITY_NAMES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };

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

/** The activation / action fields shared by features and weapons, from a mechanics block. */
function actionSystem(m) {
  return {
    activation: { type: m.activation ?? "", cost: m.activation ? (m.cost ?? 1) : null, condition: m.condition ?? "" },
    duration: { value: m.duration?.value ?? null, units: m.duration?.units ?? "" },
    target: { value: m.target?.value ?? null, width: m.target?.width ?? null, units: m.target?.units ?? "", type: m.target?.type ?? "" },
    range: { value: m.range?.value ?? null, long: m.range?.long ?? null, units: m.range?.units ?? "" },
    uses: { value: m.uses?.max ? Number(m.uses.max) : null, max: m.uses?.max ? String(m.uses.max) : "", per: m.uses?.per ?? "", recovery: "" },
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

/**
 * Build item data for a rune.
 * @param {object} rune
 * @param {object} [options]
 * @param {object} [options.attunement]   system fields marking the item attuned (weapon runes only)
 * @param {boolean} [options.consumeAttunement=true]  add the effect that spends one attunement slot
 * @param {object} [options.labels]       text overrides (requirements, attunement)
 * @param {boolean} [options.withIds=true] include deterministic _id values (needed for the compendium)
 */
export function buildRuneItemData(rune, { attunement = { attunement: 2 }, consumeAttunement = true, labels = {}, withIds = true } = {}) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const m = { ...(rune.item ?? {}) };
  m.activation ??= rune.activation;
  m.uses ??= rune.uses;
  const type = m.type === "weapon" ? "weapon" : "feat";
  const img = runeIcon(rune);

  const system = {
    description: { value: runeDescription(rune), chat: "" },
    source: "The Wanderer",
    ...actionSystem(m)
  };

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
  } else {
    Object.assign(system, {
      type: { value: "supernaturalGift", subtype: "" },
      requirements: text.requirements
    });
  }

  const effects = (rune.effects ?? []).map((e, i) => ({
    ...(withIds ? { _id: stableId(`wanderer:effect:${rune.id}:${i}`) } : {}),
    name: e.name ?? rune.name,
    icon: img,
    transfer: e.transfer ?? true,
    disabled: e.disabled ?? false,
    duration: clone(e.duration ?? {}),
    changes: clone(e.changes ?? []),
    flags: {}
  }));
  if (consumeAttunement && type !== "weapon") {
    effects.push({
      ...(withIds ? { _id: stableId(`wanderer:effect:${rune.id}:attunement`) } : {}),
      name: text.attunement,
      icon: img,
      transfer: true,
      disabled: false,
      duration: {},
      changes: [{ key: "system.attributes.attunement.max", mode: ADD, value: "-1", priority: 20 }],
      flags: { [MODULE_ID]: { attunement: true } }
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
        sourceName: rune.name
      }
    }
  };
}

/**
 * Build item data for a core option: a feat with its activated part (if any) and one disabled
 * Active Effect per Awakened Core ability, toggled by the long-rest choice.
 */
export function buildCoreItemData(core, { withIds = true } = {}) {
  const m = core.item ?? {};
  const img = core.img || ICONS.core;
  const system = {
    description: { value: core.description ?? "", chat: "" },
    source: "The Wanderer",
    type: { value: "feat", subtype: "" },
    requirements: core.requirements ?? "",
    ...actionSystem(m)
  };

  const effects = (core.awakened ?? []).map(ab => ({
    ...(withIds ? { _id: stableId(`wanderer:core-effect:${core.id}:${ab}`) } : {}),
    name: `Awakened Core (${ABILITY_NAMES[ab] ?? ab})`,
    icon: img,
    transfer: true,
    disabled: true,
    duration: {},
    changes: [{ key: `system.abilities.${ab}.value`, mode: ADD, value: "1", priority: 20 }],
    flags: { [MODULE_ID]: { awakened: ab } }
  }));

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
        awakened: clone(core.awakened ?? [])
      }
    }
  };
}
