import { MODULE_ID, SECONDS_PER_DAY, NODE_IDS } from "./constants.mjs";
import { getDaysFor, essencesInstant, slotLabel } from "./settings.mjs";
import { getRune, runeIcon } from "./library.mjs";
import { getSlotItems, slottedRuneIds, buildRuneItemData, buildSlottedEssenceData } from "./model.mjs";
import { L, postChat, escapeHTML } from "./utils.mjs";

/**
 * One project at a time, stored at flags.wanderer.project:
 * {
 *   slot, kind: "rune"|"essence", runeId|null, essenceId|null,
 *   name, img, rarity, daysRequired, daysDone, complete,
 *   startedDay, lastWork: { worldDay, dayToken } | null
 * }
 * "Once per day" = at most one work action per (world day, day token). The day token
 * increments on a long rest or when the GM grants a new day, so tables that never
 * advance world time still get a fresh day.
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
  if (project.kind === "rune") return getRune(project.runeId);
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

/**
 * Start a project. `force` skips the "abandon current project?" prompt.
 * Returns the project, or null if cancelled.
 */
export async function beginProject(actor, { slot, kind, runeId = null, essenceId = null }, { force = false } = {}) {
  if (!actor.isOwner) return void ui.notifications.warn(L("WANDERER.Craft.notOwner"));
  if (!NODE_IDS.includes(slot)) return null;

  const current = getProject(actor);
  if (current && !force) {
    const ok = await confirm(L("WANDERER.App.crafting"), escapeHTML(L("WANDERER.Craft.replaceProject", { name: current.name })));
    if (!ok) return null;
  }

  let project;
  if (kind === "rune") {
    const rune = getRune(runeId);
    const problem = runeAvailability(actor, rune);
    if (problem) return void ui.notifications.warn(problem);
    project = {
      slot, kind, runeId: rune.id, essenceId: null,
      name: rune.name, img: runeIcon(rune), rarity: rune.rarity,
      daysRequired: getDaysFor(rune.rarity)
    };
  } else {
    const ess = actor.items.get(essenceId);
    const e = ess?.getFlag(MODULE_ID, "essence");
    if (!e) return void ui.notifications.warn(L("WANDERER.Craft.sourceMissing", { name: essenceId }));
    project = {
      slot, kind: "essence", runeId: null, essenceId: ess.id,
      name: e.sourceName || ess.name, img: e.sourceImg || ess.img, rarity: e.rarity || "uncommon",
      daysRequired: essencesInstant() ? 0 : getDaysFor(e.rarity || "uncommon")
    };
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

/** Put the finished project into its node. Prompts if the node is occupied. */
export async function installProject(actor, { confirmReplace = true } = {}) {
  const project = getProject(actor);
  if (!project) return false;
  const status = projectStatus(actor);
  if (!status.complete) return false;

  const existing = getSlotItems(actor)[project.slot];
  if (existing && confirmReplace) {
    const ok = await confirm(L("WANDERER.App.install"),
      escapeHTML(L("WANDERER.Craft.replaceSlot", { slot: slotLabel(project.slot), name: existing.name })));
    if (!ok) return false;
  }

  let data;
  if (project.kind === "rune") {
    const rune = getRune(project.runeId);
    if (!rune) return void ui.notifications.warn(L("WANDERER.Craft.sourceMissing", { name: project.name }));
    data = buildRuneItemData(rune, project.slot);
  } else {
    const ess = actor.items.get(project.essenceId);
    if (!ess) return void ui.notifications.warn(L("WANDERER.Craft.sourceMissing", { name: project.name }));
    data = buildSlottedEssenceData(ess, project.slot);
  }

  if (existing) await existing.delete();
  await actor.createEmbeddedDocuments("Item", [data]);
  if (project.kind === "essence") await actor.items.get(project.essenceId)?.delete();
  await actor.unsetFlag(MODULE_ID, "project");
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
