import { MODULE_ID, TEMPLATES, SLOT_IDS, NODE_IDS } from "../constants.mjs";
import { getLayout, getImage, essencesInstant, slotLabel, getDaysFor } from "../settings.mjs";
import {
  getSlotItems, getEssences, disenchantables, slotFlags,
  installItemDocument, removeFromSlot, disenchantItem
} from "../model.mjs";
import {
  projectStatus, beginProject, workDays, installProject, abandonProject, grantNewDay, finishNow, currentWorldDay
} from "../crafting.mjs";
import { isMagicItem, isPhysical, itemRarity } from "../dnd5e.mjs";
import { activeRiders, riderLabel } from "../riders.mjs";
import { L, rarityLabel, kindLabel, isWanderer, escapeHTML, promptNumber } from "../utils.mjs";
import { RunePicker } from "./picker.mjs";
import { openDisenchantDialog } from "./disenchant.mjs";
import { openCorePicker } from "../core-options.mjs";
import { RuneLibraryEditor } from "./library-editor.mjs";
import { LayoutEditor } from "./layout-editor.mjs";

/**
 * The core overlay: the Wanderer's torso with four slots, an inspect panel,
 * the crafting bench and the essence reserve.
 */
export class WandererCoreApp extends Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    /** Which slot the inspect panel shows when the mouse is not over a slot. */
    this._inspect = { slot: "core", pinned: false };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wanderer-app", "wanderer-core"],
      template: TEMPLATES.core,
      width: 990,
      height: 720,
      resizable: true,
      scrollY: [".side-pane"],
      dragDrop: [{ dragSelector: "[data-drag]", dropSelector: ".slot" }]
    });
  }

  get id() {
    return `wanderer-core-${this.actor.id}`;
  }

  get title() {
    return L("WANDERER.App.title", { name: this.actor.name });
  }

  /** Open (or focus) the core window for an actor. */
  static open(actor) {
    if (!actor) return null;
    const existing = Object.values(ui.windows).find(a => a instanceof WandererCoreApp && a.actor?.id === actor.id);
    if (existing) return existing.render(true, { focus: true });
    return new WandererCoreApp(actor).render(true);
  }

  /* -------------------------------------------- */
  /*  Data                                        */
  /* -------------------------------------------- */

  async getData() {
    const actor = this.actor;
    const layout = getLayout();
    const slots = getSlotItems(actor);
    const status = projectStatus(actor);
    const isGM = game.user.isGM;
    const isOwner = actor.isOwner;

    const slotViews = [];
    for (const id of SLOT_IDS) {
      const cfg = layout.slots?.[id] ?? {};
      const item = slots[id];
      const isCore = id === "core";
      const view = {
        id,
        label: cfg.label ?? id,
        x: cfg.x ?? 50, y: cfg.y ?? 50, size: cfg.size ?? 54,
        isCore,
        item: null,
        inspected: this._inspect.slot === id,
        isProject: status.project?.slot === id,
        canEdit: isCore ? isGM : isOwner,
        canCraft: !isCore && isOwner
      };
      if (item) {
        const f = slotFlags(item);
        const rarity = f.rarity || itemRarity(item);
        const kind = f.kind || "item";
        const description = kind === "rune" ? "" : await TextEditor.enrichHTML(
          item.system?.description?.value ?? "", { async: true, secrets: isOwner, relativeTo: item }
        );
        const uses = item.system?.uses;
        const usesLabel = uses?.max ? L("WANDERER.App.uses", {
          value: uses.value ?? 0, max: uses.max,
          per: game.i18n.localize(`WANDERER.App.per.${uses.per}`) === `WANDERER.App.per.${uses.per}` ? (uses.per || "") : game.i18n.localize(`WANDERER.App.per.${uses.per}`)
        }) : "";
        view.item = {
          id: item.id, name: item.name, img: item.img,
          kind, kindLabel: kindLabel(kind),
          rarity, rarityLabel: rarityLabel(rarity),
          effect: f.effect ?? "", flavor: f.flavor ?? "",
          rider: f.rider ?? null, riderLabel: riderLabel(f.rider),
          sourceImg: f.sourceImg && f.sourceImg !== item.img ? f.sourceImg : null,
          usesLabel,
          description
        };
        view.tooltip = rarity ? `${item.name} (${rarityLabel(rarity)})` : item.name;
      } else {
        view.tooltip = L("WANDERER.App.emptyTooltip", { label: view.label });
      }
      slotViews.push(view);
    }

    const core = layout.slots?.core ?? { x: 50, y: 50 };
    const links = NODE_IDS.map(id => ({
      x1: core.x, y1: core.y,
      x2: layout.slots?.[id]?.x ?? 50, y2: layout.slots?.[id]?.y ?? 50,
      lit: !!slots[id],
      forging: status.project?.slot === id
    }));

    const essences = getEssences(actor).map(e => {
      const f = e.getFlag(MODULE_ID, "essence") ?? {};
      const rarity = f.rarity || itemRarity(e);
      return {
        id: e.id, name: f.sourceName || e.name, img: f.sourceImg || e.img,
        rarity, rarityLabel: rarityLabel(rarity),
        rider: f.rider ?? null, riderLabel: riderLabel(f.rider),
        days: essencesInstant() ? 0 : getDaysFor(rarity)
      };
    });

    const active = activeRiders(actor);
    const riderParts = [];
    if (active.weapon) riderParts.push(riderLabel({ kind: "weapon", bonus: active.weapon }));
    if (active.armor) riderParts.push(riderLabel({ kind: "armor", bonus: active.armor }));
    const riders = { any: riderParts.length > 0, summary: riderParts.join(" · ") || L("WANDERER.App.ridersNone") };

    const crop = layout.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const sheet = layout.sheet ?? { w: 1, h: 1 };
    const image = {
      src: getImage(),
      aspect: `${crop.w} / ${crop.h}`,
      widthPct: (sheet.w / crop.w) * 100,
      offXPct: (crop.x / crop.w) * 100,
      offYPct: (crop.y / crop.w) * 100
    };

    return {
      actor, isGM, isOwner,
      enabled: isWanderer(actor),
      slots: slotViews, links, image,
      project: { ...status, rarityLabel: rarityLabel(status.rarity), daysLeft: Math.max(0, (status.total ?? 0) - (status.done ?? 0)) },
      essences,
      riders,
      essenceInstant: essencesInstant(),
      magicCount: disenchantables(actor).length,
      worldDay: currentWorldDay()
    };
  }

  /* -------------------------------------------- */
  /*  Listeners                                   */
  /* -------------------------------------------- */

  activateListeners(html) {
    super.activateListeners(html);
    const slots = html.find(".slot");
    slots.on("mouseenter", ev => this._showInspect(ev.currentTarget.dataset.slot));
    html.find(".torso").on("mouseleave", () => this._showInspect(this._inspect.slot));
    slots.on("click", ev => {
      const slot = ev.currentTarget.dataset.slot;
      this._inspect = { slot, pinned: true };
      this._showInspect(slot);
    });
    slots.on("dblclick", ev => this._onSlotDoubleClick(ev.currentTarget.dataset.slot));
    html.find("[data-action]").on("click", ev => {
      ev.preventDefault();
      this._onAction(ev);
    });
  }

  /** Swap the visible inspect card without a full re-render. */
  _showInspect(slot) {
    const html = this.element;
    if (!html?.length) return;
    html.find(".inspect-card").removeClass("active").filter(`[data-slot="${slot}"]`).addClass("active");
    html.find(".slot").removeClass("inspected").filter(`[data-slot="${slot}"]`).addClass("inspected");
  }

  async _onSlotDoubleClick(slot) {
    const item = getSlotItems(this.actor)[slot];
    if (item) return item.sheet.render(true);
    if (slot !== "core" && this.actor.isOwner) return RunePicker.open(this.actor, slot);
  }

  async _onAction(event) {
    const btn = event.currentTarget;
    const action = btn.dataset.action;
    const slot = btn.dataset.slot ?? btn.closest("[data-slot]")?.dataset.slot;
    const actor = this.actor;

    switch (action) {
      case "craft": return RunePicker.open(actor, slot);
      case "remove": return this._remove(slot);
      case "open-item": return actor.items.get(btn.dataset.itemId)?.sheet.render(true);
      case "work": await workDays(actor, 1); break;
      case "abandon": await abandonProject(actor); break;
      case "install": await installProject(actor); break;
      case "new-day": await grantNewDay(actor); break;
      case "add-days": {
        const n = await promptNumber({ title: L("WANDERER.Craft.addDaysTitle"), label: L("WANDERER.Craft.addDaysLabel"), initial: 1 });
        if (n) await workDays(actor, n, { ignoreDaily: true });
        break;
      }
      case "finish": await finishNow(actor); break;
      case "disenchant": return openDisenchantDialog(actor);
      case "choose-core": return openCorePicker(actor);
      case "slot-essence": return this._slotEssence(btn.dataset.itemId);
      case "essence-sheet": return actor.items.get(btn.dataset.itemId)?.sheet.render(true);
      case "library": return new RuneLibraryEditor().render(true);
      case "layout": return new LayoutEditor().render(true);
      case "designate": return this._toggleDesignation();
      default: return;
    }
    this.render(false);
  }

  async _remove(slot) {
    const item = getSlotItems(this.actor)[slot];
    if (!item) return;
    if (slot === "core" && !game.user.isGM) return ui.notifications.warn(L("WANDERER.Remove.coreGmOnly"));
    const ok = await Dialog.confirm({
      title: L("WANDERER.App.remove"),
      content: `<p>${escapeHTML(L("WANDERER.Remove.confirm", { name: item.name, slot: slotLabel(slot) }))}</p>`,
      defaultYes: false
    });
    if (!ok) return;
    await removeFromSlot(this.actor, slot);
    this.render(false);
  }

  async _slotEssence(itemId) {
    const ess = this.actor.items.get(itemId);
    if (!ess) return;
    const name = ess.getFlag(MODULE_ID, "essence")?.sourceName ?? ess.name;
    const slot = await chooseNode(this.actor, name);
    if (!slot) return;
    await beginProject(this.actor, { slot, kind: "essence", essenceId: ess.id });
    this.render(false);
  }

  async _toggleDesignation() {
    if (!game.user.isGM) return;
    const enabled = isWanderer(this.actor);
    const key = enabled ? "WANDERER.Designate.revoke" : "WANDERER.Designate.confirm";
    const ok = await Dialog.confirm({
      title: L(enabled ? "WANDERER.App.revoke" : "WANDERER.App.designate"),
      content: `<p>${escapeHTML(L(key, { name: this.actor.name }))}</p>`
    });
    if (!ok) return;
    await this.actor.setFlag(MODULE_ID, "enabled", !enabled);
    ui.controls?.initialize();
    this.render(false);
  }

  /* -------------------------------------------- */
  /*  Drag & drop                                 */
  /* -------------------------------------------- */

  _canDragStart() {
    return this.actor.isOwner;
  }

  _canDragDrop() {
    return this.actor.isOwner;
  }

  _onDragStart(event) {
    const item = this.actor.items.get(event.currentTarget.dataset.itemId);
    if (!item) return;
    event.dataTransfer.setData("text/plain", JSON.stringify(item.toDragData()));
  }

  async _onDrop(event) {
    const slotEl = event.target.closest(".slot");
    if (!slotEl) return;
    const slot = slotEl.dataset.slot;
    const actor = this.actor;
    const data = TextEditor.getDragEventData(event);

    // A rune dragged out of the picker.
    if (data?.type === "WandererRune") {
      if (slot === "core") return ui.notifications.warn(L("WANDERER.Drop.runeOnCore"));
      await beginProject(actor, { slot, kind: "rune", runeId: data.runeId });
      return this.render(false);
    }
    if (data?.type !== "Item") return;
    const item = await Item.implementation.fromDropData(data);
    if (!item) return;

    // The core: GM only, anything goes.
    if (slot === "core") {
      if (!game.user.isGM) return ui.notifications.warn(L("WANDERER.Drop.coreGmOnly"));
      const ok = await Dialog.confirm({
        title: slotLabel("core"),
        content: `<p>${escapeHTML(L("WANDERER.Drop.setCore", { name: item.name }))}</p>`
      });
      if (!ok) return;
      await installItemDocument(actor, "core", item);
      return this.render(false);
    }

    // A node: essences queue for crafting; magic items are disenchanted first.
    const ownItem = item.parent === actor;
    if (ownItem && item.getFlag(MODULE_ID, "essence")) {
      await beginProject(actor, { slot, kind: "essence", essenceId: item.id });
      return this.render(false);
    }
    if (item.getFlag(MODULE_ID, "slot")) return;

    // A rune item (from the Wanderer Runes compendium, or a world copy of one).
    const runeId = item.getFlag(MODULE_ID, "runeId");
    if (runeId) {
      await beginProject(actor, { slot, kind: "rune", runeId, sourceUuid: item.uuid });
      return this.render(false);
    }

    if (game.user.isGM) {
      const choice = await gmNodeChoice(item, slot);
      if (choice === "install") await installItemDocument(actor, slot, item);
      else if (choice === "craft") {
        const ess = await disenchantItem(actor, item, { destroy: ownItem });
        await beginProject(actor, { slot, kind: "essence", essenceId: ess.id });
      }
      return this.render(false);
    }

    if (ownItem && isPhysical(item) && isMagicItem(item)) {
      const ok = await Dialog.confirm({
        title: L("WANDERER.Disenchant.title"),
        content: `<p>${escapeHTML(L("WANDERER.Drop.disenchantConfirm", { name: item.name, slot: slotLabel(slot) }))}</p>`,
        defaultYes: false
      });
      if (!ok) return;
      const ess = await disenchantItem(actor, item);
      await beginProject(actor, { slot, kind: "essence", essenceId: ess.id });
      return this.render(false);
    }
    ui.notifications.warn(L("WANDERER.Drop.notAllowed"));
  }
}

/** Ask which of the three nodes to use. Resolves to a node id or null. */
export async function chooseNode(actor, name) {
  const slots = getSlotItems(actor);
  return new Promise(resolve => {
    const buttons = {};
    for (const id of NODE_IDS) {
      const occupant = slots[id];
      buttons[id] = {
        label: `${escapeHTML(slotLabel(id))} — ${occupant ? escapeHTML(occupant.name) : L("WANDERER.ChooseNode.empty")}`,
        callback: () => resolve(id)
      };
    }
    new Dialog({
      title: L("WANDERER.ChooseNode.title", { name }),
      content: "",
      buttons,
      close: () => resolve(null)
    }, { classes: ["dialog", "wanderer-app", "wanderer-choose-node"] }).render(true);
  });
}

/** GM drop on a node: install directly, or disenchant and craft. */
async function gmNodeChoice(item, slot) {
  return new Promise(resolve => {
    new Dialog({
      title: L("WANDERER.Drop.gmNodeTitle", { name: item.name, slot: slotLabel(slot) }),
      content: `<p>${escapeHTML(L("WANDERER.Drop.gmNodeContent"))}</p>`,
      buttons: {
        install: { icon: '<i class="fas fa-bolt"></i>', label: L("WANDERER.Drop.install"), callback: () => resolve("install") },
        craft: { icon: '<i class="fas fa-hammer"></i>', label: L("WANDERER.Drop.craft"), callback: () => resolve("craft") },
        cancel: { icon: '<i class="fas fa-times"></i>', label: game.i18n.localize("Cancel"), callback: () => resolve(null) }
      },
      default: "install",
      close: () => resolve(null)
    }, { classes: ["dialog", "wanderer-app"] }).render(true);
  });
}
