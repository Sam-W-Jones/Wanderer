import { MODULE_ID, SLOT_IDS, ICONS, SLOT_ICONS } from "./constants.mjs";
import {
  attunedData, unattunedData, requiresAttunement, itemRarity, isMagicItem, isPhysical,
  hasActivities, primaryActivity, activityId, activitySource, recoveryData, migrateLegacyItemData, stripMigrationFlags
} from "./dnd5e.mjs";
import { itemUsesTarget } from "./items.mjs";
import { slotLabel } from "./settings.mjs";
import { getRune } from "./library.mjs";
import { L, postChat, escapeHTML } from "./utils.mjs";
import { riderOf, stripRiderBonus, ARMOR_TYPES, armorTypeOf, requestRiderSync } from "./riders.mjs";

/**
 * Items are the source of truth. A slotted item carries
 *   flags.wanderer = { slot: "core"|"node1"|"node2"|"node3", kind: "rune"|"essence"|"core"|"item", rarity, ... }
 * and an essence (a disenchanted item waiting to be slotted) carries
 *   flags.wanderer.essence = { sourceName, sourceImg, rarity, rider, sourceData }
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

/** Ids of runes currently carved into a node. */
export function slottedRuneIds(actor) {
  const out = new Set();
  for (const item of actor.items) {
    const runeId = item.getFlag(MODULE_ID, "runeId");
    if (runeId && item.getFlag(MODULE_ID, "slot")) out.add(runeId);
  }
  return out;
}

/** Magic items in the inventory that could be broken down. */
export function disenchantables(actor) {
  return actor.items.filter(i => isPhysical(i) && isMagicItem(i)
    && !i.getFlag(MODULE_ID, "slot") && !i.getFlag(MODULE_ID, "essence"));
}

export function prefixedName(kind, name) {
  const key = { rune: "WANDERER.ItemName.rune", essence: "WANDERER.ItemName.node", core: "WANDERER.ItemName.core" }[kind];
  return key ? L(key, { name }) : name;
}

/**
 * Item data for an essence harvested from a magic item. `source` is an Item or plain item data.
 * The whole original item is kept in the flag so slotting it later restores its mechanics, and
 * a +N weapon or armor records its rider.
 */
export function buildEssenceItemData(source) {
  const data = source instanceof Item ? source.toObject() : foundry.utils.deepClone(source);
  delete data._id;
  if (data.flags) delete data.flags[MODULE_ID];
  if (data.system && "quantity" in data.system) data.system.quantity = 1;
  const rarity = data.system?.rarity || "uncommon";
  const desc = data.system?.description?.value ?? "";
  const rider = riderOf(data);
  const riderLine = rider ? `<p>${escapeHTML(L(`WANDERER.App.rider.${rider.kind}`, { bonus: `+${rider.bonus}` }))}</p>` : "";
  return {
    name: L("WANDERER.ItemName.essence", { name: data.name }),
    type: "loot",
    img: ICONS.essence,
    system: {
      description: { value: `<p>${escapeHTML(L("WANDERER.Essence.harvestedFrom", { name: data.name }))}</p>${riderLine}${desc}` },
      rarity,
      quantity: 1
    },
    flags: {
      [MODULE_ID]: {
        essence: { sourceName: data.name, sourceImg: data.img, rarity, rider, sourceData: data }
      }
    }
  };
}

/**
 * Item data for slotting an essence into a node: the original item as-is, attuned and flagged for the
 * slot. A +N weapon or armor has its bonus stripped (the rider carries it) and armor is not worn.
 */
export function buildSlottedEssenceData(essenceItem, slot) {
  const ess = essenceItem.getFlag(MODULE_ID, "essence") ?? {};
  const original = foundry.utils.deepClone(ess.sourceData ?? {});
  const data = foundry.utils.deepClone(original);
  delete data._id;
  data.name = prefixedName("essence", ess.sourceName || essenceItem.name);
  const sourceImg = data.img || ess.sourceImg || essenceItem.img;
  data.img = SLOT_ICONS[slot] ?? sourceImg;
  data.system = data.system ?? {};
  // An essence harvested under dnd5e 3.x and slotted after an upgrade to 4.x gets dnd5e's own migration first.
  migrateLegacyItemData(data);

  const rider = ess.rider ?? riderOf(original);
  if (rider) stripRiderBonus(data, rider);
  const isArmor = data.type === "equipment" && ARMOR_TYPES.has(armorTypeOf(data));
  if (data.type === "weapon") data.system.equipped = true;
  else if (data.type === "equipment") data.system.equipped = !isArmor;
  Object.assign(data.system, attunedData(true));

  data.flags = data.flags ?? {};
  data.flags[MODULE_ID] = {
    slot, kind: "essence",
    rarity: ess.rarity || itemRarity(essenceItem),
    sourceName: ess.sourceName || essenceItem.name,
    sourceImg,
    rider: rider ?? null,
    sourceData: original
  };
  return data;
}

/** Rebuild an essence from an item currently slotted as one (used when prying it out). */
export function essenceFromSlotted(item) {
  const f = slotFlags(item);
  let data;
  if (f.sourceData) {
    data = foundry.utils.deepClone(f.sourceData);
  } else {
    data = item.toObject();
    delete data._id;
    if (data.flags) delete data.flags[MODULE_ID];
    data.name = f.sourceName || item.name;
    Object.assign(data.system ?? {}, unattunedData(item));
  }
  return buildEssenceItemData(data);
}

/**
 * Point a slotted item's consumption at the feature it spends: `consumeOf` names a carved rune
 * (Unstable Core II → Overload), `consumeNamed` a feature by name (Search the Core → Rage).
 * Returns the linked Item, or null if there is nothing to link to.
 */
export async function wireConsumption(actor, item) {
  const f = slotFlags(item);
  let target = null;
  if (f.consumeOf) {
    target = actor.items.find(i => i.getFlag(MODULE_ID, "slot") && i.getFlag(MODULE_ID, "runeId") === f.consumeOf);
  } else if (f.consumeNamed) {
    const name = String(f.consumeNamed).trim().toLowerCase();
    target = actor.items.find(i => i.type === "feat" && i.name.trim().toLowerCase() === name)
      ?? actor.items.find(i => i.name.trim().toLowerCase() === name);
  }
  if (!target || target.id === item.id) return null;
  if (hasActivities()) {
    // 4.x: the item's primary activity gets an "item uses" consumption target pointing at the feature,
    // replacing any earlier link but keeping the blank target that spends the item's own uses.
    const activity = primaryActivity(item);
    if (!activity) return null; // nothing to spend through, so no link was made
    const targets = (activitySource(activity).consumption?.targets ?? []).filter(t => !(t.type === "itemUses" && t.target));
    targets.push(itemUsesTarget(target.id));
    await item.update({ [`system.activities.${activityId(activity)}.consumption.targets`]: targets });
  } else {
    await item.update({ "system.consume": { type: "charges", target: target.id, amount: 1, scale: false } });
  }
  // Some runes change how the feature they spend recovers (Unstable Core II: Overload recharges on a short rest).
  if (f.targetUses?.per) await target.update(recoveryUpdate(f.targetUses.per));
  return target;
}

/** Undo wireConsumption's change to the spent feature's recovery when the spending item leaves its slot. */
export async function unwireConsumption(actor, item) {
  const f = slotFlags(item);
  if (!f.consumeOf || !f.targetUses?.per) return;
  const target = actor.items.find(i => i.getFlag(MODULE_ID, "slot") && i.getFlag(MODULE_ID, "runeId") === f.consumeOf);
  const original = getRune(f.consumeOf)?.item?.uses?.per;
  if (target && original) await target.update(recoveryUpdate(original));
}

/** The update that makes an item's uses recover on the given period, in the running system's shape. */
function recoveryUpdate(per) {
  return hasActivities() ? { "system.uses.recovery": recoveryData(per) } : { "system.uses.per": per };
}

/**
 * When a slotted rune leaves, every slotted item that spends its uses (consumeOf) is pointed away from it,
 * so nothing on the sheet references a missing item. Re-carving the rune links them again.
 */
export async function unlinkDependents(actor, item) {
  const runeId = slotFlags(item).runeId;
  if (!runeId) return;
  for (const other of actor.items) {
    if (other.id === item.id || !other.getFlag(MODULE_ID, "slot") || other.getFlag(MODULE_ID, "consumeOf") !== runeId) continue;
    if (hasActivities()) {
      const activity = primaryActivity(other);
      if (!activity) continue;
      const targets = (activitySource(activity).consumption?.targets ?? []).filter(t => !(t.type === "itemUses" && t.target === item.id));
      await other.update({ [`system.activities.${activityId(activity)}.consumption.targets`]: targets });
    } else if (other.system?.consume?.target === item.id) {
      await other.update({ "system.consume": { type: "", target: "", amount: null, scale: false } });
    }
  }
}

/**
 * Put an existing Item document into a slot as-is (the core, or a GM's direct install into a node).
 * Items already owned by the actor are flagged in place; anything else is copied onto the actor.
 */
export async function installItemDocument(actor, slot, item, { announce = true } = {}) {
  if (slot === "core" && !game.user.isGM) return void ui.notifications.warn(L("WANDERER.Drop.coreGmOnly"));
  const existing = getSlotItems(actor)[slot];
  const kind = slot === "core" ? "core" : "item";
  const attune = slot !== "core" || requiresAttunement(item);
  const own = slotFlags(item);
  const runeKind = own.runeId ? "rune" : kind;
  // Remember what the item looked like so removal can put it back exactly.
  const sourceSystem = {
    attunement: item.system?.attunement ?? null,
    attuned: typeof item.system?.attuned === "boolean" ? item.system.attuned : null,
    equipped: typeof item.system?.equipped === "boolean" ? item.system.equipped : null
  };
  const flags = {
    ...own, slot, kind: runeKind, rarity: itemRarity(item),
    sourceName: own.sourceName || item.name, sourceImg: own.sourceImg || item.img,
    sourceSystem: own.sourceSystem ?? sourceSystem
  };
  const name = own.coreId ? item.name : prefixedName(runeKind, own.sourceName || item.name);
  const img = SLOT_ICONS[slot] ?? item.img;
  const sys = {};
  if (attune) Object.assign(sys, attunedData(true));
  if (["weapon", "equipment"].includes(item.type)) sys.equipped = true;

  let result;
  if (item.parent === actor) {
    if (existing && existing.id !== item.id) await removeFromSlot(actor, slot, { announce: false });
    const update = { name, img, [`flags.${MODULE_ID}`]: flags };
    for (const [k, v] of Object.entries(sys)) update[`system.${k}`] = v;
    await item.update(update);
    result = item;
  } else {
    if (existing) await removeFromSlot(actor, slot, { announce: false });
    const data = item.toObject();
    delete data._id;
    stripMigrationFlags(data);
    data.name = name;
    data.img = img;
    data.system = foundry.utils.mergeObject(data.system ?? {}, sys);
    data.flags = data.flags ?? {};
    data.flags[MODULE_ID] = flags;
    [result] = await actor.createEmbeddedDocuments("Item", [data]);
  }

  await wireConsumption(actor, result);
  requestRiderSync(actor);
  if (announce) {
    const key = slot === "core" ? "WANDERER.Chat.coreSet" : "WANDERER.Chat.installed";
    await postChat(actor, escapeHTML(L(key, { name: item.name, slot: slotLabel(slot) })));
  }
  return result;
}

/**
 * Empty a slot. Runes and built-in cores are destroyed (they are the module's own items), essences go
 * back to the inventory, and anything else is unflagged and restored to how it was before being slotted.
 */
export async function removeFromSlot(actor, slot, { announce = true } = {}) {
  if (slot === "core" && !game.user.isGM) return void ui.notifications.warn(L("WANDERER.Remove.coreGmOnly"));
  const item = getSlotItems(actor)[slot];
  if (!item) return;
  const f = slotFlags(item);
  const name = f.sourceName || item.name;

  if (f.kind === "rune" || f.runeId || f.coreId) {
    await unwireConsumption(actor, item);
    await item.delete();
  } else if (f.kind === "essence") {
    await actor.createEmbeddedDocuments("Item", [essenceFromSlotted(item)], { wandererEssence: true });
    await item.delete();
  } else {
    const update = {
      name,
      img: f.sourceImg || item.img,
      [`flags.${MODULE_ID}.-=slot`]: null,
      [`flags.${MODULE_ID}.-=kind`]: null,
      [`flags.${MODULE_ID}.-=rarity`]: null,
      [`flags.${MODULE_ID}.-=sourceName`]: null,
      [`flags.${MODULE_ID}.-=sourceImg`]: null,
      [`flags.${MODULE_ID}.-=sourceSystem`]: null
    };
    const ss = f.sourceSystem;
    if (ss) {
      if (ss.attunement !== null && ss.attunement !== undefined) update["system.attunement"] = ss.attunement;
      if (ss.attuned !== null && ss.attuned !== undefined) update["system.attuned"] = ss.attuned;
      if (ss.equipped !== null && ss.equipped !== undefined) update["system.equipped"] = ss.equipped;
    } else {
      for (const [k, v] of Object.entries(unattunedData(item))) update[`system.${k}`] = v;
    }
    await item.update(update);
  }
  requestRiderSync(actor);
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
  const [essence] = await actor.createEmbeddedDocuments("Item", [data], { wandererEssence: true });
  if (destroy && item.parent === actor) {
    const quantity = Number(item.system?.quantity ?? 1);
    if (quantity > 1) await item.update({ "system.quantity": quantity - 1 });
    else await item.delete();
  }
  if (announce) await postChat(actor, escapeHTML(L("WANDERER.Chat.disenchanted", { actor: actor.name, item: name })));
  return essence;
}
