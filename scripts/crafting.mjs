import { MODULE_ID, SECONDS_PER_DAY, NODE_IDS } from "./constants.mjs";
import { getDaysFor, essencesInstant, slotLabel, runesConsumeAttunement } from "./settings.mjs";
import { getRune, runeIcon } from "./library.mjs";
import { attunedData, itemRarity } from "./dnd5e.mjs";
import { buildRuneItemData, runeItemId, PACK_ID } from "./items.mjs";
import { getSlotItems, slottedRuneIds, buildSlottedEssenceData, removeFromSlot, prefixedName } from "./model.mjs";
import { requestRiderSync } from "./riders.mjs";
import { L, postChat, escapeHTML } from "./utils.mjs";

/**
 * One project at a time, stored at flags.wanderer.project:
 * {
 *   slot, kind: "rune"|"essence", runeId|null, essenceId|null, sourceUuid|null,
 *   name, img, rarity, daysRequired, daysDone, complete,
 *   startedDay, lastWork: { worldDay, dayToken } | null
 * }
 * "Once per day" = at most one work action per (world day, day token). The day token
 * increments on a long rest or when the GM grants a new day, so tables that never
 * advance world time still get a fresh day.
 *
 * Whatever already sits in the target node keeps working until the project is finished;
 * only then is it replaced.
 */

export function getProject(actor) {
  return actor.getFlag(MODULE_ID, "project") ?? null;
}

export function currentWorldDay() {
  return Math.floor((game.time?.worldTime ?? 0) / SECONDS_PER_DAY);
}

export function getDayToken(actor) {
  return Number(actor.getFlag(MODULE_ID, "dayToken") ?? 0);
}

export function hasWorkedToday(actor, project = getProject(actor)) {
  const last = project?.lastWork;
  if (!last) return false;
  return last.worldDay === currentWorldDay() && last.dayToken === getDayToken(actor);
}

/** Resolve the rune or essence a project points at. Null if it no longer exists. */
export function projectSource(actor, project = getProject(actor)) {
  if (!project) return null;
  if (project.kind === "rune") return getRune(project.runeId) ?? (project.sourceUuid ? { id: project.runeId, external: true } : null);
  return actor.items.get(project.essenceId) ?? null;
}

/** Everything the UI needs to describe the bench. */
export function projectStatus(actor) {
  const project = getProject(actor);
  if (!project) return { project: null };
  const total = Math.max(0, Number(project.daysRequired) || 0);
  const done = Math.min(total, Math.max(0, Number(project.daysDone) || 0));
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;
  const complete = !!project.complete || done >= total;
  const valid = !!projectSource(actor, project);
  const workedToday = hasWorkedToday(actor, project);
  return {
    project,
    slot: project.slot,
    slotLabel: slotLabel(project.slot),
    name: project.name,
    img: project.img,
    rarity: project.rarity,
    done, total, pct,
    remainingPct: 100 - pct,
    complete, valid, workedToday,
    canWork: valid && !complete && !workedToday
  };
}

/** Validate that a rune may be carved for this actor. Returns an error string or null. */
export function runeAvailability(actor, rune) {
  if (!rune) return L("WANDERER.Craft.sourceMissing", { name: "?" });
  const carved = slottedRuneIds(actor);
  if (carved.has(rune.id)) return L("WANDERER.Craft.runeTaken", { name: rune.name });
  if (rune.requires && !carved.has(rune.requires)) {
    const req = getRune(rune.requires);
    return L("WANDERER.Craft.requiresRune", { name: rune.name, req: req?.name ?? rune.requires });
  }
  return null;
}

async function confirm(title, content) {
  return Dialog.confirm({ title, content: `<p>${content}</p>`, defaultYes: false, options: { classes: ["dialog", "wanderer-app"] } });
}

/** Read a rune definition off an Item carrying wanderer rune flags (a compendium or world rune item). */
export function runeFromItem(item) {
  if (!item) return null;
  const f = item.flags?.[MODULE_ID] ?? {};
  const id = f.runeId || String(item.name ?? "").slugify({ strict: true });
  if (!id) return null;
  return {
    id,
    name: f.sourceName || item.name,
    rarity: f.rarity || itemRarity(item) || "uncommon",
    effect: f.effect ?? "",
    flavor: f.flavor ?? "",
    requires: f.requires ?? null,
    img: item.img,
    item: { consumeOf: f.consumeOf ?? null },
    source: "item"
  };
}

/**
 * Start a project. `force` skips the "abandon current project?" prompt.
 * `sourceUuid` carves a copy of that Item (a rune item from a compendium or the world).
 * Returns the project, or null if cancelled.
 */
export async function beginProject(actor, { slot, kind, runeId = null, essenceId = null, sourceUuid = null }, { force = false } = {}) {
  if (!actor.isOwner) return void ui.notifications.warn(L("WANDERER.Craft.notOwner"));
  if (!NODE_IDS.includes(slot)) return null;

  const current = getProject(actor);
  if (current && !force) {
    const ok = await confirm(L("WANDERER.App.crafting"), escapeHTML(L("WANDERER.Craft.replaceProject", { name: current.name })));
    if (!ok) return null;
  }

  let project;
  if (kind === "rune") {
    let rune = getRune(runeId);
    if (!rune && sourceUuid) rune = runeFromItem(await fromUuid(sourceUuid).catch(() => null));
    const problem = runeAvailability(actor, rune);
    if (problem) return void ui.notifications.warn(problem);
    project = {
      slot, kind, runeId: rune.id, essenceId: null, sourceUuid,
      name: rune.name, img: runeIcon(rune), rarity: rune.rarity,
      daysRequired: getDaysFor(rune.rarity)
    };
  } else {
    const ess = actor.items.get(essenceId);
    const e = ess?.getFlag(MODULE_ID, "essence");
    if (!e) return void ui.notifications.warn(L("WANDERER.Craft.sourceMissing", { name: essenceId }));
    project = {
      slot, kind: "essence", runeId: null, essenceId: ess.id, sourceUuid: null,
      name: e.sourceName || ess.name, img: e.sourceImg || ess.img, rarity: e.rarity || "uncommon",
      daysRequired: essencesInstant() ? 0 : getDaysFor(e.rarity || "uncommon")
    };
  }

  const occupant = getSlotItems(actor)[slot];
  if (occupant && !force) {
    const ok = await confirm(slotLabel(slot), escapeHTML(L("WANDERER.Craft.occupiedAtStart", { slot: slotLabel(slot), name: occupant.name })));
    if (!ok) return null;
  }

  project.daysDone = 0;
  project.complete = project.daysRequired <= 0;
  project.lastWork = null;
  project.startedDay = currentWorldDay();

  await actor.setFlag(MODULE_ID, "project", project);
  if (project.complete) await installProject(actor);
  return project;
}

/** Spend a day (or several, for the GM) on the current project. */
export async function workDays(actor, days = 1, { ignoreDaily = false } = {}) {
  const project = getProject(actor);
  if (!project) return void ui.notifications.warn(L("WANDERER.Craft.noProject"));
  if (project.complete) return installProject(actor);
  if (!ignoreDaily && hasWorkedToday(actor, project)) return void ui.notifications.warn(L("WANDERER.Craft.alreadyWorked"));

  const update = foundry.utils.deepClone(project);
  update.daysDone = Math.min(update.daysRequired, (Number(update.daysDone) || 0) + Math.max(1, Math.round(days)));
  update.lastWork = { worldDay: currentWorldDay(), dayToken: getDayToken(actor) };
  update.complete = update.daysDone >= update.daysRequired;
  await actor.setFlag(MODULE_ID, "project", update);

  await postChat(actor, escapeHTML(L("WANDERER.Chat.worked", {
    actor: actor.name, name: update.name, done: update.daysDone, total: update.daysRequired
  })));
  if (update.complete) await installProject(actor);
}

/**
 * Item data for carving a rune: a copy of the compendium item when the rune is built in (so GM
 * edits to the pack carry through), the referenced item for `sourceUuid`, else built from the definition.
 */
export async function runeInstallData(project, rune, slot) {
  let data = null;
  if (project.sourceUuid) {
    const doc = await fromUuid(project.sourceUuid).catch(() => null);
    if (doc instanceof Item) data = doc.toObject();
  }
  if (!data && rune && rune.source === "builtin") {
    const pack = game.packs?.get(PACK_ID);
    const doc = pack ? await pack.getDocument(runeItemId(rune.id)).catch(() => null) : null;
    if (doc) data = doc.toObject();
  }
  if (!data && rune && !rune.external) {
    data = buildRuneItemData(rune, { attunement: attunedData(true), consumeAttunement: runesConsumeAttunement(), withIds: false });
  }
  if (!data) return null;

  delete data._id;
  const f = data.flags?.[MODULE_ID] ?? {};
  const sourceName = f.sourceName || rune?.name || data.name;
  data.name = prefixedName("rune", sourceName);
  data.flags = data.flags ?? {};
  data.flags[MODULE_ID] = {
    ...f,
    runeId: rune?.id ?? f.runeId ?? project.runeId,
    slot, kind: "rune",
    rarity: f.rarity || rune?.rarity || "",
    effect: f.effect ?? rune?.effect ?? "",
    flavor: f.flavor ?? rune?.flavor ?? "",
    requires: f.requires ?? rune?.requires ?? null,
    sourceName
  };
  data.system = data.system ?? {};
  if (data.type === "feat") data.system.requirements = L("WANDERER.Item.requirementsSlot", { slot: slotLabel(slot) });
  if (["weapon", "equipment"].includes(data.type)) Object.assign(data.system, attunedData(true), { equipped: true });
  if (!runesConsumeAttunement()) data.effects = (data.effects ?? []).filter(e => !e.flags?.[MODULE_ID]?.attunement);
  return data;
}

/** Put the finished project into its node, replacing whatever was there. */
export async function installProject(actor) {
  const project = getProject(actor);
  if (!project) return false;
  const status = projectStatus(actor);
  if (!status.complete) return false;

  let data;
  let rune = null;
  if (project.kind === "rune") {
    rune = getRune(project.runeId);
    data = await runeInstallData(project, rune, project.slot);
    if (!data) return void ui.notifications.warn(L("WANDERER.Craft.sourceMissing", { name: project.name }));
  } else {
    const ess = actor.items.get(project.essenceId);
    if (!ess) return void ui.notifications.warn(L("WANDERER.Craft.sourceMissing", { name: project.name }));
    data = buildSlottedEssenceData(ess, project.slot);
  }

  await removeFromSlot(actor, project.slot, { announce: false });
  const [created] = await actor.createEmbeddedDocuments("Item", [data]);
  if (project.kind === "essence") await actor.items.get(project.essenceId)?.delete();

  // A rune that spends another rune's uses (Unstable Core II → Overload) is pointed at it.
  const consumeOf = data.flags?.[MODULE_ID]?.consumeOf ?? rune?.item?.consumeOf;
  if (created && consumeOf) {
    const target = actor.items.find(i => i.getFlag(MODULE_ID, "slot") && i.getFlag(MODULE_ID, "runeId") === consumeOf);
    if (target) await created.update({ "system.consume": { type: "charges", target: target.id, amount: 1, scale: false } });
  }

  await actor.unsetFlag(MODULE_ID, "project");
  requestRiderSync(actor);
  await postChat(actor, escapeHTML(L("WANDERER.Chat.installed", { name: project.name, slot: slotLabel(project.slot) })));
  return true;
}

export async function abandonProject(actor, { ask = true } = {}) {
  const project = getProject(actor);
  if (!project) return;
  if (ask) {
    const ok = await confirm(L("WANDERER.App.abandon"), escapeHTML(L("WANDERER.Craft.abandonConfirm", { name: project.name })));
    if (!ok) return;
  }
  await actor.unsetFlag(MODULE_ID, "project");
}

/** Reset the once-per-day allowance (long rest, or GM fiat). */
export async function grantNewDay(actor) {
  return actor.setFlag(MODULE_ID, "dayToken", getDayToken(actor) + 1);
}

/** GM: finish the current project immediately. */
export async function finishNow(actor) {
  const project = getProject(actor);
  if (!project) return;
  const update = foundry.utils.deepClone(project);
  update.daysDone = update.daysRequired;
  update.complete = true;
  await actor.setFlag(MODULE_ID, "project", update);
  return installProject(actor);
}
