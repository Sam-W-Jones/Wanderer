import { TEMPLATES } from "../constants.mjs";
import { disenchantables, disenchantItem } from "../model.mjs";
import { itemRarity, isAttuned } from "../dnd5e.mjs";
import { L, rarityLabel, escapeHTML, rerenderWandererApps } from "../utils.mjs";

/** List the actor's magic items and let the owner break one down into an essence. */
export async function openDisenchantDialog(actor) {
  const items = disenchantables(actor).map(i => {
    const rarity = itemRarity(i);
    return {
      id: i.id, name: i.name, img: i.img, type: i.type,
      rarity, rarityLabel: rarityLabel(rarity), attuned: isAttuned(i)
    };
  });
  const content = await renderTemplate(TEMPLATES.disenchant, { items });

  const dialog = new Dialog({
    title: `${L("WANDERER.Disenchant.title")} — ${actor.name}`,
    content,
    buttons: {
      close: { icon: '<i class="fas fa-times"></i>', label: game.i18n.localize("Close") }
    },
    default: "close",
    render: html => {
      html.find("[data-action=disenchant]").on("click", async ev => {
        ev.preventDefault();
        const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
        const item = actor.items.get(id);
        if (!item) return;
        const ok = await Dialog.confirm({
          title: L("WANDERER.Disenchant.title"),
          content: `<p>${escapeHTML(L("WANDERER.Disenchant.confirm", { name: item.name }))}</p>`,
          defaultYes: false
        });
        if (!ok) return;
        await disenchantItem(actor, item);
        dialog.close();
        rerenderWandererApps(actor.id);
      });
    }
  }, { classes: ["dialog", "wanderer-app", "wanderer-disenchant"], width: 560 });

  return dialog.render(true);
}
