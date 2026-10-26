# The Wanderer's Core

A Foundry VTT v11 module (dnd5e) for one character: a stone body with a glowing core.
It adds a crafting overlay drawn over the Wanderer's torso with four slots:

- **Core** (centre): a passive item slot. Only the GM can drop an item in or pull it out.
- **Node I, II, III**: craftable slots. Each holds either a **rune** carved from the rune library, or the
  **essence** of a magic item the Wanderer has disenchanted. Anything in a node is an attuned item on the sheet.

Crafting takes time. The Wanderer may work on the current project **once per day**; the project finishes when
its days are done and the rune or essence is set into its node.

## Installation

1. Put this folder in your Foundry data directory as `Data/modules/wanderer` (the folder name must match the
   module id `wanderer`). On Windows a junction keeps the dev folder in place:

   ```bash
   cmd /c mklink /J "C:\Users\Sam\AppData\Local\FoundryVTT\Data\modules\wanderer" "Z:\dnd\slop_modules\Wanderer"
   ```

2. Enable **The Wanderer's Core** in the world's module settings. The world must use the dnd5e system.

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

### Crafting a rune

1. Click an empty node (or its **Choose a rune** button) to open the rune picker, grouped by rarity.
2. Pick a rune and press **Carve**, or drag the rune onto a node. Runes already carved are marked, and runes with a
   prerequisite (Unstable Core II needs Overload) are locked until it is met.
3. The project appears on the **Crafting** bench with a progress bar. Press **Work for a day** once per day.
4. When the days are done the rune is installed. If the node was occupied you are asked before replacing it.

Only one project can be active. Starting another abandons the current one (with a prompt).

### Disenchanting

**Disenchant an item…** lists the magic items in the inventory (anything with a rarity or the magical property).
Disenchanting destroys the item and creates an **Essence of …** loot item that keeps the original item's full data.
Essences can then be slotted into a node:

- press **Slot…** next to the essence and choose a node, or drag the essence onto a node, or use the Essences tab of
  the rune picker;
- or drag a magic item straight from the inventory onto a node, which disenchants it and starts the project.

Slotting an essence takes the crafting time of its rarity unless the **Essences slot instantly** setting is on. The
installed item is the original item (with its effects, uses and description), renamed `Node: …`, equipped and attuned.
Removing an essence from a node returns it to the inventory as an essence; removing a rune destroys it.

### The core

The GM drags any item (sidebar, compendium, or an inventory) onto the core. Items the actor already owns are flagged
in place; others are copied onto the actor. If the item requires attunement it is attuned. Players cannot delete the
core item from their sheet.

GM drops on a *node* offer a choice: install directly (no crafting), or disenchant and craft.

## "Once per day"

The daily work allowance resets when any of these happen:

- the world clock passes into a new day (`game.time.worldTime`, 86,400 seconds per day);
- the actor completes a **long rest** (dnd5e `restCompleted` hook);
- the GM presses **New day** on the bench.

The bench also gives the GM **Add days** (bulk progress) and **Finish now**.

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| Crafting days: Common / Uncommon / Rare / Very rare / Legendary | 5 / 10 / 50 / 125 / 250 | DMG crafting times in days of work. |
| Essences slot instantly | off | Skip crafting time for disenchanted essences. |
| Post crafting messages to chat | on | Work days, installs and disenchants go to the chat log. |
| Core image | the concept sheet | Any image; frame it with the Layout menu. |
| Rune library (menu) | | Add, edit, disable or delete runes. Edits to built-in runes are stored as overrides and can be reset. |
| Core layout (menu) | | Crop rectangle (source pixels) and the position (%), size (px) and label of each slot. |

## Runes

The built-in library is the full set of Uncommon, Rare and Very rare runes from the Wanderer's tables, in
`scripts/runes.mjs`. A carved rune becomes an attuned trinket named `Rune: …` with the effect and flavour text in its
description. Runes with explicit usage (Overload, Colossus, Shockwave, Pile Driver, Kinetic Lock, Return of Mind) get
an activation and limited uses; Recall, Return of Mind and Tremor Step carry Active Effects for their numeric parts.

Custom runes added through the library get the same treatment (activation and uses are optional fields in the form);
Active Effects on custom runes can be set through the API (`effects` on the saved rune).

## Data model

Items are the source of truth, so the sheet and the overlay never disagree:

- A slotted item has `flags.wanderer = { slot, kind: "rune" | "essence" | "core" | "item", rarity, sourceName, … }`.
  Deleting it from the sheet empties the slot.
- An essence has `flags.wanderer.essence = { sourceName, sourceImg, rarity, sourceData }` where `sourceData` is the
  original item's full data.
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
api.runes.library();              // all enabled runes
api.runes.save({ name, rarity, effect, flavor, requires, activation, uses, effects });
api.slots.items(actor);           // { core, node1, node2, node3 } → Item | null
api.slots.disenchantItem(actor, item);
```

## Notes

- dnd5e limits attunement to three items by default. Three nodes fill that; if the core item also requires
  attunement, raise the actor's attunement maximum on the sheet.
- Verified against the dnd5e 2.x/3.x data models (attunement changed shape in 3.2; both are handled).
- Works on Foundry v11 only (Application v1 API).
