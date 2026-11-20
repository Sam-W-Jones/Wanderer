import { MODULE_ID, DEFAULT_LAYOUT, DEFAULT_IMAGE, DAYS_SETTING } from "./constants.mjs";
import { rerenderWandererApps, L } from "./utils.mjs";
import { RuneLibraryEditor } from "./apps/library-editor.mjs";
import { LayoutEditor } from "./apps/layout-editor.mjs";

export function registerSettings() {
  const rerender = () => rerenderWandererApps();

  const days = { daysCommon: 5, daysUncommon: 10, daysRare: 50, daysVeryRare: 125, daysLegendary: 250 };
  for (const [key, def] of Object.entries(days)) {
    game.settings.register(MODULE_ID, key, {
      name: `WANDERER.Settings.${key}.name`,
      hint: `WANDERER.Settings.${key}.hint`,
      scope: "world", config: true, type: Number, default: def, onChange: rerender
    });
  }

  game.settings.register(MODULE_ID, "disenchantMinutes", {
    name: "WANDERER.Settings.disenchantMinutes.name",
    hint: "WANDERER.Settings.disenchantMinutes.hint",
    scope: "world", config: true, type: Number, default: 30, onChange: rerender
  });

  game.settings.register(MODULE_ID, "essenceCraftingDays", {
    name: "WANDERER.Settings.essenceCraftingDays.name",
    hint: "WANDERER.Settings.essenceCraftingDays.hint",
    scope: "world", config: true, type: Boolean, default: false, onChange: rerender
  });

  game.settings.register(MODULE_ID, "runesConsumeAttunement", {
    name: "WANDERER.Settings.runesConsumeAttunement.name",
    hint: "WANDERER.Settings.runesConsumeAttunement.hint",
    scope: "world", config: true, type: Boolean, default: true, onChange: rerender
  });

  game.settings.register(MODULE_ID, "chatMessages", {
    name: "WANDERER.Settings.chatMessages.name",
    hint: "WANDERER.Settings.chatMessages.hint",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, "sheetImage", {
    name: "WANDERER.Settings.sheetImage.name",
    hint: "WANDERER.Settings.sheetImage.hint",
    scope: "world", config: true, type: String, default: DEFAULT_IMAGE, filePicker: "image", onChange: rerender
  });

  game.settings.register(MODULE_ID, "layout", {
    scope: "world", config: false, type: Object, default: foundry.utils.deepClone(DEFAULT_LAYOUT), onChange: rerender
  });

  game.settings.register(MODULE_ID, "library", {
    scope: "world", config: false, type: Object, default: { custom: {}, disabled: [] }, onChange: rerender
  });

  game.settings.registerMenu(MODULE_ID, "libraryMenu", {
    name: "WANDERER.Settings.libraryMenu.name",
    label: "WANDERER.Settings.libraryMenu.label",
    hint: "WANDERER.Settings.libraryMenu.hint",
    icon: "fa-solid fa-book",
    type: RuneLibraryEditor,
    restricted: true
  });

  game.settings.registerMenu(MODULE_ID, "layoutMenu", {
    name: "WANDERER.Settings.layoutMenu.name",
    label: "WANDERER.Settings.layoutMenu.label",
    hint: "WANDERER.Settings.layoutMenu.hint",
    icon: "fa-solid fa-crosshairs",
    type: LayoutEditor,
    restricted: true
  });
}

/** Days of work needed to craft something of the given rarity. */
export function getDaysFor(rarity) {
  const key = DAYS_SETTING[rarity] ?? DAYS_SETTING.uncommon;
  return Math.max(0, Math.round(Number(game.settings.get(MODULE_ID, key)) || 0));
}

/** Minutes it takes to disenchant an item into a node. Far less than a day of work, so it is done at once. */
export function disenchantMinutes() {
  return Math.max(0, Math.round(Number(game.settings.get(MODULE_ID, "disenchantMinutes")) || 0));
}

/** Days of work to set an essence into a node: none, unless the table opted into crafting days for essences. */
export function essenceDays(rarity) {
  return game.settings.get(MODULE_ID, "essenceCraftingDays") ? getDaysFor(rarity) : 0;
}

/** How long setting an essence of this rarity takes, for display: { days, minutes, label, short }. */
export function essenceTime(rarity) {
  const days = essenceDays(rarity);
  const minutes = days > 0 ? 0 : disenchantMinutes();
  if (days > 0) return { days, minutes, label: L("WANDERER.Picker.essenceDays", { days }), short: `${days}d` };
  if (minutes > 0) return { days, minutes, label: L("WANDERER.Picker.minutes", { minutes }), short: L("WANDERER.Picker.minutesShort", { minutes }) };
  return { days, minutes, label: L("WANDERER.Picker.instant"), short: L("WANDERER.Picker.instant") };
}

/** The one-line note on the bench about how long essences take. */
export function essenceHint() {
  if (game.settings.get(MODULE_ID, "essenceCraftingDays")) return L("WANDERER.App.timedEssence");
  const minutes = disenchantMinutes();
  return minutes > 0 ? L("WANDERER.App.minutesEssence", { minutes }) : L("WANDERER.App.instantEssence");
}

export function runesConsumeAttunement() {
  return !!game.settings.get(MODULE_ID, "runesConsumeAttunement");
}

export function getImage() {
  return game.settings.get(MODULE_ID, "sheetImage") || DEFAULT_IMAGE;
}

export function getLayout() {
  const stored = game.settings.get(MODULE_ID, "layout");
  return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_LAYOUT), stored ?? {}, { inplace: false });
}

export function slotLabel(slot) {
  return getLayout().slots?.[slot]?.label ?? slot;
}
