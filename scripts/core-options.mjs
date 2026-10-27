/**
 * Seatable core options (scripts/cores.mjs): the GM's picker, seating, and the Awakened Core
 * choice after a long rest.
 */
import { MODULE_ID, TEMPLATES, ICONS, SLOT_ICONS } from "./constants.mjs";
import { BUILTIN_CORES } from "./cores.mjs";
import { buildCoreItemData, coreItemId, PACK_ID } from "./items.mjs";
import { itemShape, stripMigrationFlags } from "./dnd5e.mjs";
import { getSlotItems, removeFromSlot, wireConsumption } from "./model.mjs";
import { L, postChat, escapeHTML, rerenderWandererApps } from "./utils.mjs";

export function getCoreOptions() {
  return BUILTIN_CORES.map(c => ({ ...c, img: c.img || ICONS.core }));
}

export function getCoreOption(id) {
  return getCoreOptions().find(c => c.id === id) ?? null;
}

/** Item data for seating a core option: the compendium item when present, else built from the definition. */
export async function coreInstallData(core) {
  let data = null;
  const pack = game.packs?.get(PACK_ID);
  const doc = pack ? await pack.getDocument(coreItemId(core.id)).catch(() => null) : null;
  if (doc) data = doc.toObject();
  if (!data) data = buildCoreItemData(core, { withIds: false, shape: itemShape() });
  delete data._id;
  stripMigrationFlags(data);
  data.flags = data.flags ?? {};
  data.flags[MODULE_ID] = {
    ...(data.flags[MODULE_ID] ?? {}),
    slot: "core", kind: "core", coreId: core.id, sourceName: core.name, sourceImg: data.img, rarity: ""
  };
  data.img = SLOT_ICONS.core;
  return data;
}

/** GM: seat a built-in core option, replacing whatever is in the core. */
export async function seatCore(actor, coreId, { announce = true } = {}) {
  if (!game.user.isGM) return void ui.notifications.warn(L("WANDERER.Drop.coreGmOnly"));
  const core = getCoreOption(coreId);
  if (!core) return null;
  const data = await coreInstallData(core);
  await removeFromSlot(actor, "core", { announce: false });
  const [created] = await actor.createEmbeddedDocuments("Item", [data]);
  const linked = await wireConsumption(actor, created);
  const consumeNamed = data.flags[MODULE_ID].consumeNamed;
  if (consumeNamed && !linked) ui.notifications.warn(L("WANDERER.Core.consumeMissing", { feature: consumeNamed, item: core.name }));
  if (announce) await postChat(actor, escapeHTML(L("WANDERER.Chat.coreSet", { name: core.name })));
  rerenderWandererApps(actor.id);
  return created;
}

/** GM dialog listing the core options. */
export async function openCorePicker(actor) {
  if (!game.user.isGM) return void ui.notifications.warn(L("WANDERER.Drop.coreGmOnly"));
  const current = getSlotItems(actor).core?.getFlag(MODULE_ID, "coreId") ?? null;
  const cores = getCoreOptions().map(c => ({ ...c, current: c.id === current }));
  const content = await renderTemplate(TEMPLATES.corePicker, { cores });
  const dialog = new Dialog({
    title: `${L("WANDERER.CorePicker.title")} — ${actor.name}`,
    content,
    buttons: { close: { icon: '<i class="fas fa-times"></i>', label: game.i18n.localize("Close") } },
    default: "close",
    render: html => {
      html.find("[data-action=seat]").on("click", async ev => {
        ev.preventDefault();
        const id = ev.currentTarget.closest("[data-core-id]")?.dataset.coreId;
        const core = getCoreOption(id);
        if (!core) return;
        const occupant = getSlotItems(actor).core;
        if (occupant) {
          const ok = await Dialog.confirm({
            title: L("WANDERER.CorePicker.title"),
            content: `<p>${escapeHTML(L("WANDERER.CorePicker.replace", { name: occupant.name, core: core.name }))}</p>`,
            defaultYes: false
          });
          if (!ok) return;
        }
        await seatCore(actor, id);
        dialog.close();
      });
    }
  }, { classes: ["dialog", "wanderer-app", "wanderer-core-picker"], width: 600 });
  return dialog.render(true);
}

function abilityLabel(ab) {
  const label = globalThis.CONFIG?.DND5E?.abilities?.[ab]?.label;
  return label ? game.i18n.localize(label) : ab.toUpperCase();
}

/**
 * Awakened Core: after a long rest, choose which ability the seated core raises by 1 until the next
 * long rest (max 20). Enables one of the core item's awakened effects and disables the others.
 * Resolves to the chosen ability key, or null.
 */
export async function awakenedCoreChoice(actor) {
  const core = getSlotItems(actor).core;
  const abilities = core?.getFlag(MODULE_ID, "awakened") ?? [];
  if (!core || !abilities.length) return null;
  const effects = Array.from(core.effects ?? []).filter(e => !!foundry.utils.getProperty(e, `flags.${MODULE_ID}.awakened`));
  if (!effects.length) return null;

  const choice = await new Promise(resolve => {
    const buttons = {};
    for (const ab of abilities) {
      const score = actor.system?.abilities?.[ab]?.value;
      buttons[ab] = {
        icon: '<i class="fas fa-arrow-up"></i>',
        label: `${escapeHTML(abilityLabel(ab))}${score !== undefined ? ` (${score})` : ""}`,
        callback: () => resolve(ab)
      };
    }
    buttons.none = { icon: '<i class="fas fa-minus"></i>', label: L("WANDERER.Awakened.neither"), callback: () => resolve(null) };
    new Dialog({
      title: `${L("WANDERER.Awakened.title")} — ${actor.name}`,
      content: `<p>${escapeHTML(L("WANDERER.Awakened.prompt"))}</p>`,
      buttons,
      default: abilities[0],
      close: () => resolve(null)
    }, { classes: ["dialog", "wanderer-app"] }).render(true);
  });

  const updates = [];
  let granted = null;
  for (const e of effects) {
    const ab = foundry.utils.getProperty(e, `flags.${MODULE_ID}.awakened`);
    const id = e._id ?? e.id;
    let enable = ab === choice;
    if (enable) {
      const current = Number(actor.system?.abilities?.[ab]?.value ?? 10);
      const base = current - (e.disabled ? 0 : 1);
      if (base >= 20) {
        enable = false;
        ui.notifications.info(L("WANDERER.Awakened.capped", { ability: abilityLabel(ab) }));
      } else granted = ab;
    }
    updates.push({ _id: id, disabled: !enable });
  }
  await core.updateEmbeddedDocuments("ActiveEffect", updates);
  if (granted) ui.notifications.info(L("WANDERER.Awakened.chosen", { ability: abilityLabel(granted) }));
  return granted;
}
