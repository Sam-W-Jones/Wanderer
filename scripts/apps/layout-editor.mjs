import { MODULE_ID, TEMPLATES, SLOT_IDS, DEFAULT_LAYOUT } from "../constants.mjs";
import { getLayout, getImage } from "../settings.mjs";
import { L, rerenderWandererApps } from "../utils.mjs";

/** GM tool: frame the image and place the four slots. */
export class LayoutEditor extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wanderer-layout",
      classes: ["wanderer-app", "wanderer-layout"],
      template: TEMPLATES.layout,
      width: 560,
      height: "auto",
      closeOnSubmit: true,
      submitOnChange: false
    });
  }

  get title() {
    return L("WANDERER.Layout.title");
  }

  getData() {
    const layout = getLayout();
    return {
      layout,
      image: getImage(),
      slots: SLOT_IDS.map(id => ({ id, ...(layout.slots?.[id] ?? {}) }))
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action=reset]").on("click", async ev => {
      ev.preventDefault();
      await game.settings.set(MODULE_ID, "layout", foundry.utils.deepClone(DEFAULT_LAYOUT));
      rerenderWandererApps();
      this.render(false);
    });
  }

  async _updateObject(event, formData) {
    const data = foundry.utils.expandObject(formData);
    const layout = foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_LAYOUT), data, { inplace: false });
    for (const key of ["x", "y", "w", "h"]) {
      if (key in layout.crop) layout.crop[key] = Number(layout.crop[key]) || (key === "w" || key === "h" ? 1 : 0);
    }
    for (const id of SLOT_IDS) {
      const s = layout.slots[id];
      s.x = Number(s.x) || 0;
      s.y = Number(s.y) || 0;
      s.size = Math.max(16, Number(s.size) || 54);
      s.label = String(s.label ?? "").trim() || DEFAULT_LAYOUT.slots[id].label;
    }
    await game.settings.set(MODULE_ID, "layout", layout);
    rerenderWandererApps();
  }
}
