import { MODULE_ID, SLOT_IDS, ICONS } from "./constants.mjs";
import {
  attunedData, unattunedData, equipmentTypeData, magicalPropertyData,
  requiresAttunement, itemRarity, isMagicItem, isPhysical
} from "./dnd5e.mjs";
import { runeIcon } from "./library.mjs";
import { slotLabel } from "./settings.mjs";
import { L, postChat, escapeHTML } from "./utils.mjs";

/**
 * Items are the source of truth. A slotted item carries
 *   flags.wanderer = { slot: "core"|"node1"|"node2"|"node3", kind: "rune"|"essence"|"core"|"item", rarity, ... }
 * and an essence (a disenchanted item waiting to be slotted) carries
 *   flags.wanderer.essence = { sourceName, sourceImg, rarity, sourceData }
 */

export function slotFlags(item) {
  return item?.flags?.[MODULE_ID] ?? {};
}

/** { core: Item|null, node1: Item|null, node2: Item|null, node3: Item|null } */
export function getSlotItems(actor) {
  const slots = Object.fromEntries(SLOT_IDS.map(s => [s, null]));
  for (const item of actor.items) {
    const slot = item.getFlag(MODULE_ID, "slot");
    if (slot in slots && !slots[slot]) slots[slot] = item;
  }
  return slots;
}

export function getEssences(actor) {
  return actor.items.filter(i => !!i.getFlag(MODULE_ID, "essence"));
}

export function slottedRuneIds(actor) {
  return new Set(actor.items.map(i => i.getFlag(MODULE_ID, "runeId")).filter(Boolean));
}

/** Magic items in the inventory that could be broken down. */
export function disenchantables(actor) {
  return actor.items.filter(i => isPhysical(i) && isMagicItem(i)
    && !i.getFlag(MODULE_ID, "slot") && !i.getFlag(MODULE_ID, "essence"));
}

function prefixedName(kind, name) {
  const key = { rune: "WANDERER.ItemName.rune", essence: "WANDERER.ItemName.node", core: "WANDERER.ItemName.core" }[kind];
  return key ? L(key, { name }) : name;
}

function runeDescription(rune) {
  const parts = [];
  if (rune.effect) parts.push(`<p>${escapeHTML(rune.effect)}</p>`);
  if (rune.flavor) parts.push(`<p><em>${escapeHTML(rune.flavor)}</em></p>`);
  return parts.join("");
}

/** Item data for a carved rune: an attuned trinket with the rune text and any active effects. */
export function buildRuneItemData(rune, slot) {
  const system = {
    description: { value: runeDescription(rune) },
    rarity: rune.rarity,
    equipped: true,
    quantity: 1,
    ...attunedData(true),
    ...equipmentTypeData(),
    ...magicalPropertyData()
  };
  if (rune.activation) system.activation = { type: rune.activation, cost: 1, condition: "" };
  if (rune.uses?.max) system.uses = { value: rune.uses.max, max: String(rune.uses.max), per: rune.uses.per || "lr" };

  const effects = (rune.effects ?? []).map(e => ({
    name: e.name ?? rune.name,
    icon: runeIcon(rune),
    transfer: true,
    disabled: false,
    changes: foundry.utils.deepClone(e.changes ?? [])
  }));

  return {
    name: prefixedName("rune", rune.name),
    type: "equipment",
    img: runeIcon(rune),
    system,
    effects,
    flags: {
      [MODULE_ID]: {
        slot, kind: "rune", runeId: rune.id, rarity: rune.rarity,
        sourceName: rune.name, effect: rune.effect ?? "", flavor: rune.flavor ?? ""
      }
    }
  };
}

/**
 * Item data for an essence harvested from a magic item. `source` is an Item or plain item data.
 * The whole original item is kept in the flag so slotting it later restores its mechanics.
 */
export function buildEssenceItemData(source) {
  const data = source instanceof Item ? source.toObject() : foundry.utils.deepClone(source);
  delete data._id;
  if (data.flags) delete data.flags[MODULE_ID];
  const rarity = data.system?.rarity || "uncommon";
  const desc = data.system?.description?.value ?? "";
  return {
    name: L("WANDERER.ItemName.essence", { name: data.name }),
    type: "loot",
    img: ICONS.essence,
    system: {
      description: { value: `<p>${escapeHTML(L("WANDERER.Essence.harvestedFrom", { name: data.name }))}</p>${desc}` },
      rarity,
      quantity: 1
    },
    flags: {
      [MODULE_ID]: {
        essence: { sourceName: data.name, sourceImg: data.img, rarity, sourceData: data }
      }
    }
  };
}

/** Item data for slotting an essence into a node: the original item, attuned, flagged for the slot. */
export function buildSlottedEssenceData(essenceItem, slot) {
  const ess = essenceItem.getFlag(MODULE_ID, "essence") ?? {};
  const data = foundry.utils.deepClone(ess.sourceData ?? {});
  delete data._id;
  data.name = prefixedName("essence", ess.sourceName || essenceItem.name);
  data.img = data.img || ess.sourceImg || essenceItem.img;
  data.system = data.system ?? {};
  if (["weapon", "equipment"].includes(data.type)) data.system.equipped = true;
  Object.assign(data.system, attunedData(true));
  data.flags = data.flags ?? {};
  data.flags[MODULE_ID] = { slot, kind: "essence", rarity: ess.rarity || itemRarity(essenceItem), sourceName: ess.sourceName || essenceItem.name };
  return data;
}

/** Rebuild an essence from an item currently slotted as one (used when prying it out). */
export function essenceFromSlotted(item) {
  const f = slotFlags(item);
  const data = item.toObject();
  delete data._id;
  if (data.flags) delete data.flags[MODULE_ID];
  data.name = f.sourceName || item.name;
  Object.assign(data.system ?? {}, unattunedData(item));
  return buildEssenceItemData(data);
}

/**
 * Put an existing Item document into a slot. Items already owned by the actor are flagged in place;
 * anything else (sidebar, compendium, another actor) is copied onto the actor.
 */
export async function installItemDocument(actor, slot, item, { announce = true } = {}) {
  const existing = getSlotItems(actor)[slot];
  const kind = slot === "core" ? "core" : "item";
  const attune = slot !== "core" || requiresAttunement(item);
  const flags = { slot, kind, rarity: itemRarity(item), sourceName: item.name };
  const sys = {};
  if (attune) Object.assign(sys, attunedData(true));
  if (["weapon", "equipment"].includes(item.type)) sys.equipped = true;

  let result;
  if (item.parent === actor) {
    if (existing && existing.id !== item.id) await existing.delete();
    const update = { name: prefixedName(kind, item.name), [`flags.${MODULE_ID}`]: flags };
    for (const [k, v] of Object.entries(sys)) update[`system.${k}`] = v;
    await item.update(update);
    result = item;
  } else {
    if (existing) await existing.delete();
    const data = item.toObject();
    delete data._id;
    data.name = prefixedName(kind, item.name);
    data.system = foundry.utils.mergeObject(data.system ?? {}, sys);
    data.flags = data.flags ?? {};
    data.flags[MODULE_ID] = flags;
    [result] = await actor.createEmbeddedDocuments("Item", [data]);
  }

  if (announce) {
    const key = slot === "core" ? "WANDERER.Chat.coreSet" : "WANDERER.Chat.installed";
    await postChat(actor, escapeHTML(L(key, { name: item.name, slot: slotLabel(slot) })));
  }
  return result;
}

/** Empty a slot. Runes are destroyed, essences go back to the inventory, other items are unflagged. */
export async function removeFromSlot(actor, slot, { announce = true } = {}) {
  const item = getSlotItems(actor)[slot];
  if (!item) return;
  const f = slotFlags(item);
  const name = f.sourceName || item.name;

  if (f.kind === "rune") {
    await item.delete();
  } else if (f.kind === "essence") {
    await actor.createEmbeddedDocuments("Item", [essenceFromSlotted(item)]);
    await item.delete();
  } else {
    const update = {
      name,
      [`flags.${MODULE_ID}.-=slot`]: null,
      [`flags.${MODULE_ID}.-=kind`]: null,
      [`flags.${MODULE_ID}.-=rarity`]: null,
      [`flags.${MODULE_ID}.-=sourceName`]: null
    };
    for (const [k, v] of Object.entries(unattunedData(item))) update[`system.${k}`] = v;
    await item.update(update);
  }
  if (announce) await postChat(actor, escapeHTML(L("WANDERER.Chat.removed", { name, slot: slotLabel(slot) })));
}

/**
 * Harvest an item's essence onto the actor. The source is destroyed unless `destroy` is false
 * (used when the GM drags in an item the actor does not own).
 * Returns the essence Item.
 */
export async function disenchantItem(actor, item, { announce = true, destroy = true } = {}) {
  const data = buildEssenceItemData(item);
  const name = item.name;
  const [essence] = await actor.createEmbeddedDocuments("Item", [data]);
  if (destroy && item.parent === actor) await item.delete();
  if (announce) await postChat(actor, escapeHTML(L("WANDERER.Chat.disenchanted", { actor: actor.name, item: name })));
  return essence;
}
