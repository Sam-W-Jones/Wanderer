import { TEMPLATES, RARITIES, ACTIVATION_TYPES, USES_PER, ICONS } from "../constants.mjs";
import { getRuneLibrary, getRune, saveRune, deleteCustomRune, setRuneDisabled } from "../library.mjs";
import { L, rarityLabel, escapeHTML, rerenderWandererApps } from "../utils.mjs";

const RARITY_ORDER = ["uncommon", "rare", "veryRare", "common", "legendary", "artifact"];

/** GM tool: add, edit, disable and delete runes. */
export class RuneLibraryEditor extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wanderer-rune-library",
      classes: ["wanderer-app", "wanderer-library"],
      template: TEMPLATES.library,
      width: 860,
      height: 660,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false,
      submitOnClose: false,
      scrollY: [".library-body"]
    });
  }

  get title() {
    return L("WANDERER.Library.title");
  }

  async getData() {
    const runes = getRuneLibrary({ includeDisabled: true });
    const byRarity = new Map();
    for (const r of runes) {
      if (!byRarity.has(r.rarity)) byRarity.set(r.rarity, []);
      byRarity.get(r.rarity).push(r);
    }
    const keys = [...RARITY_ORDER.filter(k => byRarity.has(k)), ...[...byRarity.keys()].filter(k => !RARITY_ORDER.includes(k))];
    const groups = keys.map(key => ({
      key,
      label: rarityLabel(key) || key,
      runes: byRarity.get(key).map(r => ({
        ...r,
        sourceLabel: L(`WANDERER.Library.${r.source}`),
        requiresName: r.requires ? (getRune(r.requires)?.name ?? r.requires) : "",
        isCustom: r.source === "custom",
        isOverride: r.source === "override"
      }))
    }));
    return { groups };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("[data-action]").on("click", ev => this._onAction(ev));
  }

  async _onAction(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const id = btn.closest("[data-rune-id]")?.dataset.runeId;
    const rune = id ? getRune(id) : null;

    switch (btn.dataset.action) {
      case "add": {
        const data = await runeFormDialog(null);
        if (data) await saveRune(withMechanics(null, data));
        break;
      }
      case "edit": {
        if (!rune) return;
        const data = await runeFormDialog(rune);
        if (data) await saveRune({ ...withMechanics(rune, data), id, effects: rune.effects });
        break;
      }
      case "toggle": {
        if (!rune) return;
        await setRuneDisabled(id, !rune.disabled);
        break;
      }
      case "delete": {
        if (!rune) return;
        const ok = await Dialog.confirm({
          title: L("WANDERER.Library.delete"),
          content: `<p>${escapeHTML(L("WANDERER.Library.deleteConfirm", { name: rune.name }))}</p>`,
          defaultYes: false
        });
        if (ok) await deleteCustomRune(id);
        break;
      }
      case "reset": {
        if (!rune) return;
        const ok = await Dialog.confirm({
          title: L("WANDERER.Library.reset"),
          content: `<p>${escapeHTML(L("WANDERER.Library.resetConfirm", { name: rune.name }))}</p>`,
          defaultYes: false
        });
        if (ok) await deleteCustomRune(id);
        break;
      }
      default: return;
    }
    this.render(false);
    rerenderWandererApps();
  }

  /** No form submission; everything is saved through the action buttons. */
  async _updateObject() {}
}

/**
 * Fold the form's activation and uses into the rune's mechanics block, which is what the item builder
 * reads first, so edits to runes that ship with mechanics (Overload's uses, say) take effect.
 */
function withMechanics(rune, data) {
  const item = { ...(rune?.item ?? {}) };
  if (data.activation) item.activation = data.activation; else delete item.activation;
  const max = Number(data.uses?.max ?? 0);
  if (max > 0) item.uses = { max, per: data.uses?.per || "lr" }; else delete item.uses;
  const out = { ...data };
  if (Object.keys(item).length) out.item = item; else delete out.item;
  return out;
}

/** A dialog editing one rune. Resolves to the rune fields, or null if cancelled. */
export async function runeFormDialog(rune) {
  const others = getRuneLibrary({ includeDisabled: true }).filter(r => r.id !== rune?.id);
  const noneLabel = L("WANDERER.Library.form.none");
  // The icon field only shows an explicit override, not the rarity default.
  const imgValue = rune?.img && rune.img !== ICONS[rune.rarity] && rune.img !== ICONS.rune ? rune.img : "";
  const formRune = rune
    ? { ...rune, activation: rune.item?.activation ?? rune.activation ?? "", uses: rune.item?.uses ?? rune.uses ?? {} }
    : { rarity: "uncommon", uses: {} };
  const content = await renderTemplate(TEMPLATES.runeForm, {
    rune: formRune,
    imgValue,
    noneLabel,
    rarities: Object.fromEntries(RARITIES.map(value => [value, rarityLabel(value)])),
    requiresOptions: Object.fromEntries(others.map(r => [r.id, r.name])),
    activations: Object.fromEntries(ACTIVATION_TYPES.filter(Boolean).map(value => [value, value])),
    usesPer: Object.fromEntries(USES_PER.filter(Boolean).map(value => [value, value]))
  });

  return new Promise(resolve => {
    new Dialog({
      title: rune ? rune.name : L("WANDERER.Library.add"),
      content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: L("WANDERER.Library.form.save"),
          callback: html => {
            const form = html.find("form")[0];
            const data = foundry.utils.expandObject(new FormDataExtended(form).object);
            if (!String(data.name ?? "").trim()) {
              ui.notifications.warn(L("WANDERER.Library.form.nameRequired"));
              return resolve(null);
            }
            resolve(data);
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: L("WANDERER.Library.form.cancel"), callback: () => resolve(null) }
      },
      default: "save",
      render: html => {
        html.find("button.file-picker").on("click", ev => {
          ev.preventDefault();
          const target = html.find("[name=img]")[0];
          new FilePicker({ type: "image", current: target.value, callback: path => { target.value = path; } }).browse();
        });
      },
      close: () => resolve(null)
    }, { classes: ["dialog", "wanderer-app", "wanderer-rune-form"], width: 600 }).render(true);
  });
}
