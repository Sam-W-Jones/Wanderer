import { MODULE_ID, TEMPLATES, SLOT_IDS, NODE_IDS } from "./constants.mjs";
import { registerSettings, getLayout, getDaysFor } from "./settings.mjs";
import { WandererCoreApp, chooseNode } from "./apps/core-app.mjs";
import { RunePicker } from "./apps/picker.mjs";
import { openDisenchantDialog } from "./apps/disenchant.mjs";
import { RuneLibraryEditor } from "./apps/library-editor.mjs";
import { LayoutEditor } from "./apps/layout-editor.mjs";
import { L, isWanderer, myWanderer, wandererActors, rerenderWandererApps, escapeHTML } from "./utils.mjs";
import {
  getProject, projectStatus, beginProject, workDays, installProject, abandonProject, grantNewDay, finishNow
} from "./crafting.mjs";
import { getRuneLibrary, getRune, saveRune, deleteCustomRune, setRuneDisabled } from "./library.mjs";
import {
  getSlotItems, getEssences, disenchantables, disenchantItem, installItemDocument, removeFromSlot
} from "./model.mjs";
import { BUILTIN_RUNES } from "./runes.mjs";
import { buildRuneItemData, buildCoreItemData, runeItemId, runePackUuid, corePackUuid, PACK_ID } from "./items.mjs";
import { activeRiders, syncRiders, requestRiderSync, riderOf } from "./riders.mjs";
import { getCoreOptions, seatCore, openCorePicker, awakenedCoreChoice } from "./core-options.mjs";

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

function resolveActor(ref) {
  if (!ref) return myWanderer() ?? (game.user.isGM ? wandererActors()[0] ?? null : null);
  if (ref instanceof Actor) return ref;
  return game.actors.get(ref) ?? game.actors.getName(ref) ?? null;
}

/** Open the core for the user's Wanderer (or a given actor). */
function open(ref) {
  const actor = resolveActor(ref);
  if (!actor) return void ui.notifications.warn(L("WANDERER.Designate.none"));
  return WandererCoreApp.open(actor);
}

async function designate(ref, enabled = true) {
  const actor = resolveActor(ref);
  if (!actor || !game.user.isGM) return null;
  await actor.setFlag(MODULE_ID, "enabled", !!enabled);
  ui.controls?.initialize();
  return actor;
}

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerSettings();
  loadTemplates(Object.values(TEMPLATES));

  const api = {
    open,
    designate,
    revoke: ref => designate(ref, false),
    chooseNode,
    openDisenchantDialog,
    apps: { WandererCoreApp, RunePicker, RuneLibraryEditor, LayoutEditor },
    runes: { builtin: BUILTIN_RUNES, library: getRuneLibrary, get: getRune, save: saveRune, remove: deleteCustomRune, setDisabled: setRuneDisabled },
    crafting: { getProject, projectStatus, beginProject, workDays, installProject, abandonProject, grantNewDay, finishNow, getDaysFor },
    slots: { ids: SLOT_IDS, nodes: NODE_IDS, items: getSlotItems, essences: getEssences, disenchantables, disenchantItem, install: installItemDocument, remove: removeFromSlot },
    items: { build: buildRuneItemData, buildCore: buildCoreItemData, id: runeItemId, uuid: runePackUuid, coreUuid: corePackUuid, pack: PACK_ID },
    riders: { active: activeRiders, of: riderOf, sync: syncRiders, request: requestRiderSync },
    cores: { options: getCoreOptions, seat: seatCore, choose: openCorePicker, awakened: awakenedCoreChoice },
    layout: getLayout,
    isWanderer,
    myWanderer,
    rerender: rerenderWandererApps
  };
  game.modules.get(MODULE_ID).api = api;
  game.wanderer = api;
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") {
    console.warn(`${MODULE_ID} | Built for dnd5e; running on ${game.system.id}. Attunement and rarity helpers will be no-ops.`);
  }
});

/* -------------------------------------------- */
/*  Ways in: sheet button, scene control         */
/* -------------------------------------------- */

Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  const actor = sheet.actor ?? sheet.object;
  if (!(actor instanceof Actor)) return;
  const designated = isWanderer(actor);
  if (!designated && actor.type !== "character") return;
  if (!(game.user.isGM || (designated && actor.isOwner))) return;

  buttons.unshift({
    label: L("WANDERER.Sheet.button"),
    class: "wanderer-core",
    icon: "fa-solid fa-circle-nodes",
    onclick: async () => {
      if (!isWanderer(actor)) {
        if (!game.user.isGM) return;
        const ok = await Dialog.confirm({
          title: L("WANDERER.App.designate"),
          content: `<p>${escapeHTML(L("WANDERER.Designate.confirm", { name: actor.name }))}</p>`
        });
        if (!ok) return;
        await designate(actor, true);
      }
      WandererCoreApp.open(actor);
    }
  });
});

Hooks.on("getSceneControlButtons", controls => {
  const token = controls.find(c => c.name === "token");
  if (!token) return;
  token.tools.push({
    name: "wanderer-core",
    title: L("WANDERER.Control.open"),
    icon: "fa-solid fa-circle-nodes",
    button: true,
    visible: game.user.isGM || !!myWanderer(),
    onClick: () => open()
  });
});

/* -------------------------------------------- */
/*  Keep windows current                        */
/* -------------------------------------------- */

function refreshFor(doc) {
  const actor = doc instanceof Actor ? doc : (doc?.parent instanceof Actor ? doc.parent : null);
  if (actor) rerenderWandererApps(actor.id);
}

for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, (...args) => {
    const item = args[0];
    const userId = args.at(-1);
    refreshFor(item);
    // Slot changes made from the sheet (or by this module) keep the rider effects in step.
    const actor = item?.parent;
    if (actor instanceof Actor && isWanderer(actor) && userId === game.user.id && item.getFlag(MODULE_ID, "slot")) {
      requestRiderSync(actor);
    }
  });
}

Hooks.on("updateActor", (actor, changes) => {
  if (foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`) || ("name" in changes)) refreshFor(actor);
});

Hooks.on("updateWorldTime", () => rerenderWandererApps());

/* -------------------------------------------- */
/*  Rules hooks                                 */
/* -------------------------------------------- */

/** A long rest turns the day: the work allowance resets, and a seated core asks its Awakened Core choice. */
Hooks.on("dnd5e.restCompleted", async (actor, result) => {
  if (!isWanderer(actor) || !result?.longRest || !actor.isOwner) return;
  await grantNewDay(actor);
  awakenedCoreChoice(actor);
});

/** Rune and core items reach a sheet only through the core: players cannot drag them in from the compendium. */
Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (!(item.parent instanceof Actor)) return;
  const f = item.flags?.[MODULE_ID] ?? {};
  if (!(f.runeId || f.coreId) || f.slot) return;
  if (game.users.get(userId)?.isGM) return;
  ui.notifications.warn(L("WANDERER.Craft.mustCarve"));
  return false;
});

/** Only the GM may pull the core item. */
Hooks.on("preDeleteItem", (item, options, userId) => {
  if (item.getFlag(MODULE_ID, "slot") !== "core") return;
  if (game.users.get(userId)?.isGM) return;
  ui.notifications.warn(L("WANDERER.Remove.coreGmOnly"));
  return false;
});
