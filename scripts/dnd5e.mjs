/**
 * Thin shims over the dnd5e system data model so the module works on dnd5e 3.x and 4.x
 * (attunement changed shape in 3.2; activities replaced the item action fields in 4.0).
 */
import { MODULE_ID } from "./constants.mjs";

export function isDnd5e() {
  return game.system?.id === "dnd5e";
}

export function systemVersion() {
  return game.system?.version ?? "0.0.0";
}

/** True when the running system version is >= v. */
export function systemAtLeast(v) {
  const cur = systemVersion();
  return cur === v || foundry.utils.isNewerVersion(cur, v);
}

/** dnd5e 4.0+ keeps activation, damage, saves and consumption in Activities instead of item fields. */
export function hasActivities() {
  return isDnd5e() && systemAtLeast("4.0.0");
}

/** The item data shape to build for the running system (see items.mjs). */
export function itemShape() {
  return hasActivities() ? "activities" : "legacy";
}

/** Item system data that marks an item as attuned (and requiring attunement). */
export function attunedData(required = true) {
  if (!isDnd5e()) return {};
  if (systemAtLeast("3.2.0")) return { attunement: required ? "required" : "", attuned: required };
  return { attunement: required ? 2 : 0 }; // 2 = ATTUNED in dnd5e < 3.2
}

/** Item system data that ends attunement while keeping the requirement. */
export function unattunedData(item) {
  if (!isDnd5e()) return {};
  if (systemAtLeast("3.2.0")) return { attuned: false };
  const a = Number(item?.system?.attunement ?? 0);
  return { attunement: a >= 2 ? 1 : a };
}

export function requiresAttunement(item) {
  const a = item?.system?.attunement;
  if (typeof a === "string") return a === "required" || a === "optional";
  return Number(a ?? 0) >= 1;
}

export function isAttuned(item) {
  if (typeof item?.system?.attuned === "boolean") return item.system.attuned;
  return Number(item?.system?.attunement ?? 0) >= 2;
}

export function itemRarity(item) {
  return item?.system?.rarity ?? "";
}

export function isMagicItem(item) {
  if (itemRarity(item)) return true;
  const p = item?.system?.properties;
  if (p instanceof Set) return p.has("mgc");
  if (Array.isArray(p)) return p.includes("mgc");
  if (p && typeof p === "object") return !!p.mgc;
  return false;
}

export const PHYSICAL_TYPES = ["weapon", "equipment", "consumable", "tool", "loot", "container"];

export function isPhysical(item) {
  return PHYSICAL_TYPES.includes(item?.type);
}

/* -------------------------------------------- */
/*  Activities (dnd5e 4.x)                       */
/* -------------------------------------------- */

/**
 * The activity a module-built item is used through: the one recorded in its flags when it was built,
 * else the first. Works on a live Item (ActivityCollection) and on plain item data.
 */
export function primaryActivity(item) {
  const acts = item?.system?.activities;
  if (!acts) return null;
  const wanted = item.getFlag?.(MODULE_ID, "activityId") ?? item.flags?.[MODULE_ID]?.activityId;
  const byId = id => (typeof acts.get === "function" ? acts.get(id) : acts[id]) ?? null;
  return (wanted && byId(wanted)) || activityList(acts)[0] || null;
}

/** An item's activities as an array, from a live ActivityCollection or from plain data. */
export function activityList(acts) {
  if (!acts) return [];
  if (Array.isArray(acts)) return acts;
  if (Array.isArray(acts.contents)) return acts.contents;
  if (typeof acts.values === "function") return [...acts.values()];
  return Object.values(acts);
}

/**
 * Run dnd5e's own migration over plain item data saved under an older system (an essence harvested on
 * 3.x and slotted after an upgrade to 4.x), so its legacy action fields become an activity instead of
 * being dropped. Mutates and returns the data; a no-op on 3.x or for data that already has activities.
 */
export function migrateLegacyItemData(data) {
  const cls = globalThis.CONFIG?.Item?.documentClass;
  if (!hasActivities() || typeof cls?.migrateData !== "function" || !data?.system) return data;
  if (data.system.activities || !(data.system.activation?.type || data.system.actionType)) return data;
  const hadId = "_id" in data; // the activity migration only runs on whole documents
  data._id ??= "wandererMigrat00";
  data.effects ??= [];
  try {
    cls.migrateData(data);
  } catch (err) {
    console.warn(`${MODULE_ID} | could not migrate legacy item data for ${data.name}`, err);
  }
  if (!hadId) delete data._id;
  if (data.flags?.dnd5e) {
    delete data.flags.dnd5e.migratedUses;
    delete data.flags.dnd5e.persistSourceMigration;
  }
  return data;
}

/** Strip the bookkeeping dnd5e 4.x adds to a compendium document's flags when it loads legacy uses. */
export function stripMigrationFlags(data) {
  if (data?.flags?.dnd5e) {
    delete data.flags.dnd5e.migratedUses;
    delete data.flags.dnd5e.persistSourceMigration;
  }
  return data;
}

export function activityId(activity) {
  return activity?.id ?? activity?._id ?? null;
}

/** Plain source data of an activity (document or plain object). */
export function activitySource(activity) {
  return typeof activity?.toObject === "function" ? activity.toObject() : foundry.utils.deepClone(activity ?? {});
}

/** The recovery period of an item's uses: `per` on 3.x, the first recovery profile on 4.x. */
export function usesPeriod(uses) {
  if (!uses) return "";
  if (uses.per) return uses.per;
  if (Array.isArray(uses.recovery)) return uses.recovery[0]?.period ?? "";
  return "";
}

/** 4.x recovery profiles for a period such as "sr" or "lr". */
export function recoveryData(per) {
  return per ? [{ period: per, type: "recoverAll", formula: "" }] : [];
}
