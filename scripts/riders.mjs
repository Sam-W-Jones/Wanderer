/**
 * Riders: the +N of a disenchanted weapon or armor, carried by its node.
 * They never stack. The highest weapon bonus among the nodes applies to the Wanderer's weapon
 * attacks and damage, and the highest armor bonus to his AC, through one Active Effect each on the actor.
 */
import { MODULE_ID, NODE_IDS, ICONS } from "./constants.mjs";
import { getSlotItems } from "./model.mjs";
import { L } from "./utils.mjs";

const ADD = 2;
export const RIDER_KINDS = ["weapon", "armor"];
export const ARMOR_TYPES = new Set(["light", "medium", "heavy", "shield"]);

/** A "+N" inside a name. */
function parseBonus(s) {
  const m = String(s ?? "").match(/\+\s*(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** A bonus field: a bare number ("2") or a "+N" formula. */
function parseBonusField(s) {
  const n = Number(String(s ?? "").trim());
  if (Number.isFinite(n) && n > 0) return n;
  return parseBonus(s);
}

export function armorTypeOf(data) {
  return data?.system?.type?.value ?? data?.system?.armor?.type ?? "";
}

/** The largest rider an item of a given rarity can carry (+1 uncommon, +2 rare, +3 very rare, +4 beyond). */
export const RIDER_CAP = { common: 1, uncommon: 1, rare: 2, veryRare: 3, legendary: 4, artifact: 4 };

function capFor(data) {
  return RIDER_CAP[data?.system?.rarity] ?? 1;
}

/**
 * { kind: "weapon"|"armor", bonus } for +N weapons and armor, else null. Accepts an Item or plain data.
 * The bonus is read from dnd5e's magical bonus, the attack bonus, or a "+N" in the name, and capped by
 * rarity so a renamed item cannot mint more than its rarity allows.
 */
export function riderOf(data) {
  if (!data) return null;
  const sys = data.system ?? {};
  if (data.type === "weapon") {
    const bonus = Math.min(capFor(data), parseBonusField(sys.magicalBonus) || parseBonusField(sys.attackBonus) || parseBonus(data.name));
    return bonus > 0 ? { kind: "weapon", bonus } : null;
  }
  if (data.type === "equipment" && ARMOR_TYPES.has(armorTypeOf(data))) {
    const bonus = Math.min(capFor(data), parseBonusField(sys.armor?.magicalBonus) || parseBonus(data.name));
    return bonus > 0 ? { kind: "armor", bonus } : null;
  }
  return null;
}

/** Remove the +N from a node copy of the item, since the rider carries it instead. Mutates and returns data. */
export function stripRiderBonus(data, rider) {
  if (!rider) return data;
  const sys = data.system ?? (data.system = {});
  if (rider.kind === "weapon") {
    if ("magicalBonus" in sys) sys.magicalBonus = 0;
    if (parseBonusField(sys.attackBonus) === rider.bonus) sys.attackBonus = "";
    const trailing = new RegExp(`\\s*\\+\\s*${rider.bonus}\\s*$`);
    if (Array.isArray(sys.damage?.parts)) {
      sys.damage.parts = sys.damage.parts.map(part => {
        if (!Array.isArray(part)) return part;
        const [formula, type] = part;
        return [String(formula ?? "").replace(trailing, ""), type];
      });
    }
  } else if (rider.kind === "armor") {
    if (sys.armor && "magicalBonus" in sys.armor) sys.armor.magicalBonus = 0;
  }
  return data;
}

/** The highest bonus of each kind among the slotted nodes. */
export function activeRiders(actor) {
  const out = { weapon: 0, armor: 0 };
  const slots = getSlotItems(actor);
  for (const id of NODE_IDS) {
    const rider = slots[id]?.getFlag(MODULE_ID, "rider");
    if (!rider || !(rider.kind in out)) continue;
    out[rider.kind] = Math.max(out[rider.kind], Number(rider.bonus) || 0);
  }
  return out;
}

export function riderLabel(rider) {
  if (!rider?.kind) return "";
  return L(`WANDERER.App.rider.${rider.kind}`, { bonus: `+${rider.bonus}` });
}

function riderEffectData(kind, bonus) {
  const value = `+${bonus}`;
  const keys = kind === "weapon"
    ? ["system.bonuses.mwak.attack", "system.bonuses.mwak.damage", "system.bonuses.rwak.attack", "system.bonuses.rwak.damage"]
    : ["system.attributes.ac.bonus"];
  return {
    name: L(`WANDERER.Rider.${kind}`, { bonus: value }),
    icon: ICONS.essence,
    disabled: false,
    transfer: false,
    changes: keys.map(key => ({ key, mode: ADD, value, priority: 20 })),
    flags: { [MODULE_ID]: { rider: kind, bonus } }
  };
}

/** Bring the actor's rider effects in line with its nodes. Idempotent. */
export async function syncRiders(actor) {
  if (!actor?.isOwner) return;
  const want = activeRiders(actor);
  const mine = actor.effects.filter(e => !!e.getFlag(MODULE_ID, "rider"));
  const creates = [];
  const updates = [];
  const deletes = [];

  for (const kind of RIDER_KINDS) {
    const bonus = want[kind];
    const [keep, ...extra] = mine.filter(e => e.getFlag(MODULE_ID, "rider") === kind);
    deletes.push(...extra.map(e => e.id));
    if (!bonus) {
      if (keep) deletes.push(keep.id);
      continue;
    }
    const data = riderEffectData(kind, bonus);
    if (!keep) creates.push(data);
    else if (Number(keep.getFlag(MODULE_ID, "bonus")) !== bonus) updates.push({ _id: keep.id, ...data });
  }

  if (deletes.length) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
  if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
  if (creates.length) await actor.createEmbeddedDocuments("ActiveEffect", creates);
}

const queues = new Map();

/** Serialized, slightly delayed sync so bursts of item changes resolve to one consistent state. */
export function requestRiderSync(actor) {
  if (!actor) return Promise.resolve();
  const prev = queues.get(actor.id) ?? Promise.resolve();
  const next = prev
    .then(() => new Promise(resolve => setTimeout(resolve, 60)))
    .then(() => syncRiders(actor))
    .catch(err => console.error(`${MODULE_ID} | rider sync failed`, err));
  queues.set(actor.id, next);
  return next;
}
