import { MODULE_ID, ICONS } from "./constants.mjs";
import { BUILTIN_RUNES } from "./runes.mjs";

/**
 * The rune library = built-in runes + a world setting holding GM edits:
 *   { custom: { [id]: runeFields }, disabled: [id, ...] }
 * A custom entry whose id matches a built-in rune overrides that rune.
 */

function readStore() {
  const stored = game.settings.get(MODULE_ID, "library") ?? {};
  return {
    custom: foundry.utils.deepClone(stored.custom ?? {}),
    disabled: Array.isArray(stored.disabled) ? [...stored.disabled] : []
  };
}

async function writeStore(store) {
  return game.settings.set(MODULE_ID, "library", store);
}

export function runeIcon(rune) {
  return rune?.img || ICONS[rune?.rarity] || ICONS.rune;
}

/** All runes, annotated with `source` ("builtin" | "override" | "custom") and `disabled`. */
export function getRuneLibrary({ includeDisabled = false } = {}) {
  const store = readStore();
  const builtinIds = new Set(BUILTIN_RUNES.map(r => r.id));
  const out = [];

  for (const b of BUILTIN_RUNES) {
    const override = store.custom[b.id];
    const rune = override ? { ...b, ...override, id: b.id } : { ...b };
    rune.source = override ? "override" : "builtin";
    rune.disabled = store.disabled.includes(b.id);
    if (rune.disabled && !includeDisabled) continue;
    out.push(rune);
  }
  for (const [id, c] of Object.entries(store.custom)) {
    if (builtinIds.has(id)) continue;
    const rune = { ...c, id, source: "custom", disabled: store.disabled.includes(id) };
    if (rune.disabled && !includeDisabled) continue;
    out.push(rune);
  }
  for (const r of out) r.img = runeIcon(r);
  return out;
}

/** Look a rune up by id, including disabled ones (carved runes must still resolve). */
export function getRune(id) {
  if (!id) return null;
  return getRuneLibrary({ includeDisabled: true }).find(r => r.id === id) ?? null;
}

export function makeRuneId(name, existing = new Set()) {
  const base = String(name ?? "").slugify({ strict: true }) || "rune";
  let id = base;
  let n = 2;
  while (existing.has(id)) id = `${base}-${n++}`;
  return id;
}

/** Save a custom rune (or an override of a built-in one). Returns the id. */
export async function saveRune(rune) {
  const store = readStore();
  const ids = new Set([...BUILTIN_RUNES.map(r => r.id), ...Object.keys(store.custom)]);
  const id = rune.id || makeRuneId(rune.name, ids);
  const clean = {
    name: String(rune.name ?? "").trim(),
    rarity: rune.rarity || "uncommon",
    effect: String(rune.effect ?? "").trim(),
    flavor: String(rune.flavor ?? "").trim()
  };
  if (rune.requires && rune.requires !== id) clean.requires = rune.requires;
  if (rune.activation) clean.activation = rune.activation;
  const usesMax = Number(rune.uses?.max ?? 0);
  if (usesMax > 0) clean.uses = { max: usesMax, per: rune.uses?.per || "lr" };
  if (rune.img) clean.img = rune.img;
  if (Array.isArray(rune.effects)) clean.effects = rune.effects;
  store.custom[id] = clean;
  await writeStore(store);
  return id;
}

/** Delete a custom rune, or discard the override of a built-in one. */
export async function deleteCustomRune(id) {
  const store = readStore();
  delete store.custom[id];
  await writeStore(store);
}

export async function setRuneDisabled(id, disabled) {
  const store = readStore();
  const set = new Set(store.disabled);
  if (disabled) set.add(id); else set.delete(id);
  store.disabled = [...set];
  await writeStore(store);
}
