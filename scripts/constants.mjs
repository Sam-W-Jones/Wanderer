export const MODULE_ID = "wanderer";
export const SECONDS_PER_DAY = 86400;

export const TEMPLATES = {
  core: `modules/${MODULE_ID}/templates/core.hbs`,
  picker: `modules/${MODULE_ID}/templates/picker.hbs`,
  disenchant: `modules/${MODULE_ID}/templates/disenchant.hbs`,
  library: `modules/${MODULE_ID}/templates/library.hbs`,
  runeForm: `modules/${MODULE_ID}/templates/rune-form.hbs`,
  layout: `modules/${MODULE_ID}/templates/layout.hbs`
};

export const ICONS = {
  rune: `modules/${MODULE_ID}/assets/icons/rune.svg`,
  uncommon: `modules/${MODULE_ID}/assets/icons/rune-uncommon.svg`,
  rare: `modules/${MODULE_ID}/assets/icons/rune-rare.svg`,
  veryRare: `modules/${MODULE_ID}/assets/icons/rune-very-rare.svg`,
  essence: `modules/${MODULE_ID}/assets/icons/essence.svg`,
  core: `modules/${MODULE_ID}/assets/icons/core.svg`
};

export const DEFAULT_IMAGE = `modules/${MODULE_ID}/assets/wanderer-sheet.webp`;

export const SLOT_IDS = ["core", "node1", "node2", "node3"];
export const NODE_IDS = ["node1", "node2", "node3"];

export const RARITIES = ["common", "uncommon", "rare", "veryRare", "legendary", "artifact"];
export const CRAFTABLE_RARITIES = ["uncommon", "rare", "veryRare"];

/** Rarity → settings key holding the crafting days. */
export const DAYS_SETTING = {
  common: "daysCommon",
  uncommon: "daysUncommon",
  rare: "daysRare",
  veryRare: "daysVeryRare",
  legendary: "daysLegendary",
  artifact: "daysLegendary"
};

export const ACTIVATION_TYPES = ["", "action", "bonus", "reaction", "special"];
export const USES_PER = ["", "sr", "lr", "day"];

/**
 * Where the four slots sit over the image, as percentages of the framed (cropped) area,
 * plus the crop rectangle in source-image pixels. Editable in-game via the Layout menu.
 */
export const DEFAULT_LAYOUT = {
  sheet: { w: 1440, h: 1080 },
  crop: { x: 8, y: 8, w: 497, h: 672 },
  slots: {
    core: { label: "Core", x: 50.1, y: 27.5, size: 74 },
    node1: { label: "Node I", x: 22.5, y: 25.5, size: 54 },
    node2: { label: "Node II", x: 78.0, y: 25.5, size: 54 },
    node3: { label: "Node III", x: 50.1, y: 50.5, size: 54 }
  }
};
