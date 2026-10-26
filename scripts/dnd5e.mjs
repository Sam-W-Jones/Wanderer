/**
 * Thin shims over the dnd5e system data model so the module works across
 * dnd5e 2.x and 3.x on Foundry v11 (attunement changed shape in 3.2).
 */

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

export const PHYSICAL_TYPES = ["weapon", "equipment", "consumable", "tool", "loot", "backpack", "container"];

export function isPhysical(item) {
  return PHYSICAL_TYPES.includes(item?.type);
}

/** Equipment sub-type "trinket", in whichever field the system version uses. */
export function equipmentTypeData() {
  if (!isDnd5e()) return {};
  return systemAtLeast("3.0.0") ? { type: { value: "trinket" } } : { armor: { type: "trinket" } };
}

/** The "magical" item property, where the system supports it on equipment. */
export function magicalPropertyData() {
  if (!isDnd5e()) return {};
  return systemAtLeast("3.0.0") ? { properties: ["mgc"] } : {};
}
