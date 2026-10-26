import { MODULE_ID, DEFAULT_LAYOUT, DEFAULT_IMAGE, DAYS_SETTING } from "./constants.mjs";
import { rerenderWandererApps } from "./utils.mjs";
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

  game.settings.register(MODULE_ID, "essenceInstant", {
    name: "WANDERER.Settings.essenceInstant.name",
    hint: "WANDERER.Settings.essenceInstant.hint",
    scope: "world", config: true, type: Boolean, default: false, onChange: rerender
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

export function essencesInstant() {
  return !!game.settings.get(MODULE_ID, "essenceInstant");
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
