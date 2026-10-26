import { MODULE_ID, TEMPLATES } from "../constants.mjs";
import { getDaysFor, essencesInstant, slotLabel } from "../settings.mjs";
import { getRuneLibrary, getRune } from "../library.mjs";
import { getEssences, slottedRuneIds } from "../model.mjs";
import { beginProject, runeAvailability } from "../crafting.mjs";
import { runePackUuid } from "../items.mjs";
import { itemRarity } from "../dnd5e.mjs";
import { L, rarityLabel } from "../utils.mjs";

const RARITY_ORDER = ["uncommon", "rare", "veryRare", "common", "legendary", "artifact"];

/** Choose a rune (or an essence) to craft into a node. */
export class RunePicker extends Application {
  constructor(actor, slot, options = {}) {
    super(options);
    this.actor = actor;
    this.slot = slot;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["wanderer-app", "wanderer-picker"],
      template: TEMPLATES.picker,
      width: 780,
      height: 640,
      resizable: true,
      tabs: [{ navSelector: ".tabs", contentSelector: ".picker-body", initial: "uncommon" }],
      scrollY: [".picker-body .tab"],
      dragDrop: [{ dragSelector: ".rune-row.available" }]
    });
  }

  get id() {
    return `wanderer-picker-${this.actor.id}`;
  }

  get title() {
    return L("WANDERER.Picker.title", { slot: slotLabel(this.slot) });
  }

  static open(actor, slot) {
    const existing = Object.values(ui.windows).find(a => a instanceof RunePicker && a.actor?.id === actor.id);
    if (existing) {
      existing.slot = slot;
      return existing.render(true, { focus: true });
    }
    return new RunePicker(actor, slot).render(true);
  }

  async getData() {
    const carved = slottedRuneIds(this.actor);
    const library = getRuneLibrary();
    const byRarity = new Map();
    for (const r of library) {
      if (!byRarity.has(r.rarity)) byRarity.set(r.rarity, []);
      byRarity.get(r.rarity).push(r);
    }
    const keys = [...RARITY_ORDER.filter(k => byRarity.has(k)), ...[...byRarity.keys()].filter(k => !RARITY_ORDER.includes(k))];
    const groups = keys.map(key => ({
      key,
      label: rarityLabel(key) || key,
      days: getDaysFor(key),
      runes: byRarity.get(key).map(r => this._runeView(r, carved))
    }));

    const essences = getEssences(this.actor).map(e => {
      const f = e.getFlag(MODULE_ID, "essence") ?? {};
      const rarity = f.rarity || itemRarity(e);
      return {
        id: e.id, name: f.sourceName || e.name, img: f.sourceImg || e.img,
        rarity, rarityLabel: rarityLabel(rarity),
        days: essencesInstant() ? 0 : getDaysFor(rarity)
      };
    });

    return {
      slot: this.slot,
      slotLabel: slotLabel(this.slot),
      groups,
      essences,
      essenceInstant: essencesInstant(),
      isOwner: this.actor.isOwner
    };
  }

  _runeView(rune, carved) {
    const taken = carved.has(rune.id);
    const problem = runeAvailability(this.actor, rune);
    const req = rune.requires ? getRune(rune.requires) : null;
    return {
      id: rune.id,
      name: rune.name,
      img: rune.img,
      rarity: rune.rarity,
      effect: rune.effect ?? "",
      flavor: rune.flavor ?? "",
      days: getDaysFor(rune.rarity),
      taken,
      locked: !taken && !!problem,
      problem: problem ?? "",
      available: !problem,
      requiresName: req?.name ?? "",
      packUuid: ["builtin", "override"].includes(rune.source) ? runePackUuid(rune.id) : null,
      search: `${rune.name} ${rune.effect ?? ""} ${rune.flavor ?? ""}`.toLowerCase()
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".search").on("input", ev => this._filter(ev.currentTarget.value));
    html.find("[data-action=view]").on("click", async ev => {
      ev.preventDefault();
      const doc = await fromUuid(ev.currentTarget.dataset.uuid).catch(() => null);
      doc?.sheet?.render(true);
    });
    html.find("[data-action=craft]").on("click", async ev => {
      ev.preventDefault();
      const id = ev.currentTarget.closest("[data-rune-id]")?.dataset.runeId;
      const project = await beginProject(this.actor, { slot: this.slot, kind: "rune", runeId: id });
      if (project) this.close();
    });
    html.find("[data-action=slot-essence]").on("click", async ev => {
      ev.preventDefault();
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      const project = await beginProject(this.actor, { slot: this.slot, kind: "essence", essenceId: id });
      if (project) this.close();
    });
  }

  _filter(text) {
    const q = String(text ?? "").trim().toLowerCase();
    this.element.find(".rune-row").each((_, el) => {
      el.classList.toggle("hidden", !!q && !(el.dataset.search ?? "").includes(q));
    });
  }

  _canDragStart() {
    return this.actor.isOwner;
  }

  _onDragStart(event) {
    const runeId = event.currentTarget.dataset.runeId;
    if (!runeId) return;
    event.dataTransfer.setData("text/plain", JSON.stringify({ type: "WandererRune", runeId, actorId: this.actor.id }));
  }
}
