# The Wanderer's Core

A Foundry VTT v11 module (dnd5e) for one character: a stone body with a glowing core.
It adds a crafting overlay drawn over the Wanderer's torso with four slots:

- **Core** (centre): a passive item slot. Only the GM can drop an item in or pull it out.
- **Node I, II, III**: craftable slots. Each holds either a **rune** carved from the rune library, or the
  **essence** of a magic item the Wanderer has disenchanted.

Everything slotted feeds straight into the character sheet: runes are real dnd5e items with uses, saves, damage
and Active Effects, essences are the original items, and +N weapons and armor contribute a non-stacking rider.

Crafting takes time. The Wanderer may work on the current project **once per day**; whatever already sits in the
target node keeps working until the project is finished, and only then is it replaced.

## Installation

The module is distributed through GitHub releases. In Foundry, open **Add-on Modules → Install Module** and paste
the manifest URL:

```
https://github.com/OWNER/wanderer/releases/latest/download/module.json
```

Then enable **The Wanderer's Core** in the world's module settings. The world must use the dnd5e system.

## Setting up the Wanderer

1. As GM, open the character's sheet and click the **Core** button in the sheet header.
2. Confirm the designation. The actor now carries the `wanderer.enabled` flag; its owners see the Core button and a
   **Core** tool under the token controls, and can open the overlay at any time.

Any character can be designated; the module is built around one, but it works per actor.

## Using the overlay

The window has the torso on the left and three panels on the right.

- **Hover** a slot to inspect it. **Click** to pin it. The panel shows the rune's effect and flavour, or the
  item's description, with **Open** (item sheet) and **Remove** buttons.
- **Double-click** a filled slot to open its item sheet; double-click an empty node to choose a rune.
- **Filled** slots glow blue and are linked to the core; a slot being worked on glows amber with a progress ring.

### Carving a rune

1. Click a node (or its **Choose a rune** button) to open the rune picker, grouped by rarity. The book icon on
   each row opens the rune in the **Wanderer Runes** compendium.
2. Pick a rune and press **Carve**, drag the rune onto a node, or drag an item straight out of the compendium
   onto a node. Runes already carved are marked, and runes with a prerequisite (Unstable Core II needs Overload)
   are locked until it is met.
3. The project appears on the **Crafting** bench with a progress bar. Press **Work for a day** once per day.
4. When the days are done the rune is installed. If the node was occupied, the old rune or essence stayed active
   the whole time and is replaced now (a rune is lost; an essence returns to the inventory).

Only one project can be active. Starting another abandons the current one (with a prompt).

### What a carved rune is on the sheet

A carved rune is copied from the compendium onto the actor as a **Supernatural Gift** feature (Runic Fist and
Wrecking Yard are weapons), named `Rune: …`, with:

- an **activation** (action, bonus, reaction or special) and the triggering condition in its activation text;
- **limited uses** where the rune says so (Overload 1 and Colossus 2 per long rest; Shockwave 1, Pile Driver 2
  and Kinetic Lock 2 per short rest). Unstable Core II spends Overload's use and, while carved, makes Overload
  recharge on a short rest;
- **saving throws** with the DC computed from the Wanderer (Overload: Dex save, DC 8 + PB + Con; pushes, pulls,
  trips and Shockwave: Strength save, DC 8 + PB + Str; Pile Driver: Con save, DC from Str), **damage** rolls
  (Overload 5d8 force, Slam 2d6, Hurl 1d6 per 10 ft, Vise = Str modifier, Rune-Burn 2d8 force, Pile Driver fall
  damage) and Rally Core's temporary hit points (PB + Con);
- **passive Active Effects** applied while carved: Tremor Step (tremorsense 30 ft). Bedrock carries a toggle
  effect (+2 AC, midi-qol no-crit flag) the player switches on while unmoved. Colossus carries a 1-minute effect
  (Large, +1d4 melee damage, midi-qol advantage flags) and Stillness a raging effect (midi-qol Wisdom-save
  advantage) that are offered on their chat cards;
- an **attunement** effect that lowers the actor's attunement maximum by one, so three carved runes use the three
  attunement slots (setting *Carved runes use an attunement slot*).

Runes with no mechanical hook (Rooted, Living Wall, Keystone, …) are passive features with their text. No rune
denies teleportation: Vault Door explicitly lets it through, so teleporting casters keep their counter.

Runes tagged **utility** in the picker are the non-combat set, carved after classic magic items: Hollow (bag of
holding), Lantern Heart (lantern of revealing, with a token light for Active Token Lighting), Makers' Tongue
(comprehend languages), Riverbed, Stone Sleep, Pumice, Mole's Road (burrow speed by effect), Quiet Earth and Stone
Tell, alongside Ley-Sight, Elven Protocol and Builder's Eye.

The picker and the bench carry a player-facing note that master rune-crafters may be able to aid the work,
particularly with very rare runes. Mechanically the GM represents such help with **Add days** on the bench.

### Disenchanting

**Disenchant an item…** lists the magic items in the inventory (anything with a rarity or the magical property).
Disenchanting destroys the item and creates an **Essence of …** loot item that keeps the original item's full data.
Essences can then be slotted into a node:

- press **Slot…** next to the essence and choose a node, drag the essence onto a node, or use the Essences tab of
  the rune picker;
- or drag a magic item straight from the inventory onto a node, which disenchants it and starts the project.

Slotting an essence takes the crafting time of its rarity unless the **Essences slot instantly** setting is on.
The installed item is the original item as-is (effects, uses, description), renamed `Node: …`, attuned, and
equipped (armor is attuned but not worn: the Wanderer's AC is his own). Removing an essence from a node returns
it to the inventory with its original data.

### Riders: +N weapons and armor

A disenchanted **+N weapon** carries its bonus as a rider: +N to the Wanderer's weapon attack and damage rolls
(`system.bonuses.mwak`/`rwak`), so his fists hit like the blade did. A **+N armor or shield** carries +N to AC
(`system.attributes.ac.bonus`). The bonus is read from dnd5e's `magicalBonus` field, the attack bonus, or a `+N` in
the item's name.

**Riders do not stack.** Among the slotted nodes only the highest weapon bonus and the highest armor bonus apply,
each through one Active Effect on the actor (`Node rider: weapon +2`). Two +2 swords give +2, not +4. The node
copy of the item has its own +N stripped so nothing is counted twice; the essence keeps the original data.

### The core

The GM drags any item (sidebar, compendium, or an inventory) onto the core. Items the actor already owns are flagged
in place; others are copied onto the actor. If the item requires attunement it is attuned. Players cannot delete the
core item from their sheet.

GM drops on a *node* offer a choice: install directly (no crafting), or disenchant and craft.

#### Built-in core: Core of the Wanderer

**Choose a core…** on the core's inspect panel (GM only) lists the built-in core options and seats one with a
click; the same item sits in the compendium and can be dragged onto the core instead. Seating replaces the
current core item. **Core of the Wanderer** (`scripts/cores.mjs`) is a granted feat with the three features from
the text:

- **Awakened Core**: after each long rest the owner is asked to choose Intelligence or Wisdom. The chosen score
  gets +1 through one of two Active Effects on the feat (the other is disabled) until the next long rest, and
  nothing is granted once the score would pass 20.
- **The Old Machinery**: description only, at the DM's discretion.
- **Search the Core**: a usable feature, 1 per long rest, 10 minutes, that spends one use of **Rage**. The link
  is made when the core is seated by finding a feature named Rage on the sheet; if there is none yet, a warning
  says so and the consumption can be set by hand on the item.

Seating is immediate; cores are DM-granted and never crafted.

## "Once per day"

The daily work allowance resets when any of these happen:

- the world clock passes into a new day (`game.time.worldTime`, 86,400 seconds per day);
- the actor completes a **long rest** (dnd5e `restCompleted` hook);
- the GM presses **New day** on the bench.

The bench also gives the GM **Add days** (bulk progress) and **Finish now**.

## The Wanderer Runes compendium

`packs/runes` ships all 40 runes (and the core options) as ready-to-use items. The picker and the carving code use it: a built-in rune
is carved as a copy of its compendium item, so a GM who unlocks the pack and edits a rune's mechanics sees the
edit on the next carving. Deleting or renaming entries is not supported (ids are fixed per rune); use the rune
library for new runes or duplicate a compendium item into the world, edit it, and drag it onto a node.

The pack is generated from `scripts/runes.mjs` (text and mechanics) by `tools/build-packs.mjs`. After editing
the definitions, rebuild it:

```bash
node tools/build-packs.mjs --modules "C:\Program Files\Foundry10\Foundry Virtual Tabletop\resources\app"
```

`--modules` points at a folder whose `node_modules` holds `classic-level` (Foundry's own install works, or run
`npm install classic-level` in the module folder and omit the flag). Foundry's bundled Node runs it without a
separate Node install:

```bash
ELECTRON_RUN_AS_NODE=1 "C:\Program Files\Foundry10\Foundry Virtual Tabletop\Foundry Virtual Tabletop.exe" tools/build-packs.mjs --modules "C:\Program Files\Foundry10\Foundry Virtual Tabletop\resources\app"
```

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| Crafting days: Common / Uncommon / Rare / Very rare / Legendary | 5 / 10 / 50 / 125 / 250 | DMG crafting times in days of work. |
| Essences slot instantly | off | Skip crafting time for disenchanted essences. |
| Carved runes use an attunement slot | on | Each carved rune feature lowers the attunement maximum by one. |
| Post crafting messages to chat | on | Work days, installs and disenchants go to the chat log. |
| Core image | the concept sheet | Any image; frame it with the Layout menu. |
| Rune library (menu) | | Add, edit, disable or delete runes. Edits to built-in runes are stored as overrides and can be reset. |
| Core layout (menu) | | Crop rectangle (source pixels) and the position (%), size (px) and label of each slot. |

## Data model

Items are the source of truth, so the sheet and the overlay never disagree:

- A slotted item has `flags.wanderer = { slot, kind: "rune" | "essence" | "core" | "item", rarity, sourceName, … }`.
  Deleting it from the sheet empties the slot. Slotted essences also keep `rider` and `sourceData`.
- An essence has `flags.wanderer.essence = { sourceName, sourceImg, rarity, rider, sourceData }` where `sourceData`
  is the original item's full data.
- Compendium rune items carry `flags.wanderer = { runeId, rarity, effect, flavor, requires, consumeOf }`.
- Rider effects on the actor carry `flags.wanderer = { rider: "weapon" | "armor", bonus }`.
- The actor holds `flags.wanderer.enabled`, `flags.wanderer.project` (the bench) and `flags.wanderer.dayToken`.

## API

```js
const api = game.wanderer; // also game.modules.get("wanderer").api
api.open();                       // the user's Wanderer (or any designated actor for the GM)
api.open(actor);                  // a specific actor, id or name
api.designate(actor);             // GM: flag an actor as the Wanderer; api.revoke(actor) undoes it
api.crafting.beginProject(actor, { slot: "node1", kind: "rune", runeId: "titans-grip" });
api.crafting.workDays(actor, 1);
api.crafting.grantNewDay(actor);
api.runes.library();              // all enabled runes (text + mechanics)
api.runes.save({ name, rarity, effect, flavor, requires, item, effects });
api.items.build(rune);            // full dnd5e item data for a rune definition
api.items.uuid("overload");       // compendium UUID of a built-in rune
api.slots.items(actor);           // { core, node1, node2, node3 } → Item | null
api.slots.disenchantItem(actor, item);
api.riders.active(actor);         // { weapon: 2, armor: 1 }
```

## Development

- `node tests/smoke.mjs .` runs the headless smoke test (stubbed Foundry; crafting, disenchant, riders, slots).
- The [check workflow](.github/workflows/check.yml) runs the syntax check, JSON validation and smoke test on
  every push. The [release workflow](.github/workflows/release.yml) stamps `module.json` and attaches
  `module.json` and `module.zip` to a published release tagged `vX.Y.Z`; replace `OWNER` in `module.json` and this
  README with the GitHub account first.
- For local play without a release, the folder can be placed (or junction-linked) in `Data/modules/wanderer`.

## Notes

- Verified against the dnd5e 2.x/3.x data models (attunement changed shape in 3.2; both are handled). The
  compendium is built for dnd5e 3.x; 3.2+ migrates its attunement fields on load.
- Works on Foundry v11 only (Application v1 API, LevelDB packs).
