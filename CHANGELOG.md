# Changelog

## 0.1.1 (2026-10-27)

- Packaging release: no changes to the module since 0.1.0. Re-cut through the tag-push release workflow, which
  now creates the GitHub release and attaches `module.json` and `module.zip` without any local tooling.

## 0.1.0 (2026-10-27)

- Torso overlay with a GM-only core slot and three craftable nodes, drawn over the concept sheet.
- Rune library: the Uncommon, Rare and Very rare runes from the tables, with a GM editor for custom runes,
  overrides and disabling. Balance pass: Return of Mind and Recall dropped (the Core covers them), Deadweight
  folded into Rooted, Tremor Step 30 ft, Trip Line once per round, Unmaking Hand to uncommon, Fastball replaces
  one attack, Colossus 2/long rest; Very rares strengthened (Keystone restrains, Unstable Core II is a bonus
  action with short-rest recovery, Stillness moves and guards Wisdom saves, Pile Driver 4d6 and 2/short rest,
  Vault Door a bonus action that can't be moved and gives cover, Kinetic Lock 2/short rest, Rune-Burn 3d8 and no
  Disengage) and Bedrock and Mortar added. Nothing denies teleportation.
- Utility runes: Hollow, Lantern Heart, Makers' Tongue, Riverbed, Stone Sleep, Pumice (uncommon); Mole's Road,
  Quiet Earth, Stone Tell, Deep Ear, Masonwork (rare); Open Seam, Mason's Hand, Hearth, Chips of the Core (very
  rare). Runes carry tags shown in the picker.
- Player-facing note on the picker and bench: master rune-crafters may aid the work, especially on very rares.
- Throw runes for the grapple-throw house rule: Follow-Through (uncommon), Trebuchet and Hammerstone (rare),
  Thoroughfare (very rare). Hurl, Slam, Fastball and Wrecking Yard carry the throw tag.
- Socket graphics: a golden arcane sphere for the core and runed blue spheres for the nodes; slotted items take
  their slot's sphere as icon and get their own back when removed. Awakened Core offers Charisma as well.
- Audit fixes: dialogs no longer wiped by world-time or setting re-renders; removing a seated core destroys the
  feat; direct installs restore attunement and equipped state; designation refreshes every client's controls and
  sheet; the library form edits mechanics-bearing runes; `sourceUuid` trusted only from the module pack for
  players; GM-only operations guarded in the API; riders capped by rarity; essence duplication and compendium
  drops blocked with a GM watchdog; stacks lose one item per disenchant; tooltips escaped; install debounced.
- **Wanderer Runes compendium**: every rune as a ready-to-use dnd5e item (Supernatural Gift feature or weapon)
  with activation, limited uses, saves, damage, temporary hit points and passive Active Effects; carving copies
  the compendium item onto the sheet. Unstable Core II spends Overload's use. Carved runes lower the attunement
  maximum by one (setting).
- **Core of the Wanderer**: a built-in core option (also in the compendium) the GM seats from the core's panel.
  Search the Core is a 1/long rest, 10-minute feature that spends a Rage; Awakened Core asks for Intelligence
  or Wisdom after each long rest and applies +1 (max 20) until the next.
- Crafting bench: one project at a time, once-per-day work, DMG day counts per rarity, progress ring and bar.
  The occupant of a node keeps working until the project finishes, then is replaced.
- Disenchanting: break a magic item into an essence that keeps the original data; slot essences into nodes as the
  item itself (armor attuned but not worn).
- **Riders**: +N weapons and armor carry their bonus to the Wanderer's weapon attacks/damage or AC. Riders never
  stack: the highest bonus per kind among the nodes applies through one actor effect each.
- Drag and drop onto slots: items (GM) on the core, essences, magic items and compendium rune items on nodes.
- Day tracking by world time, long rest, or GM fiat; GM shortcuts to add days or finish.
- Layout editor for the image crop and slot positions.
- GitHub release and check workflows, headless smoke test, pack build script.
