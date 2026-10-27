# Changelog

## 0.2.1 (2026-10-27)

- Every rune and the Core of the Wanderer declare the 2014 rules in their source, so dnd5e 4.x no longer tags
  them as 2024 content (its default for items that say nothing); dnd5e 3.x ignores the field.

## 0.2.0 (2026-10-27)

- **Foundry v12 and dnd5e 4.x.** The module now runs on Foundry v11 or v12 with dnd5e 3.0 through 4.4. On dnd5e
  4.x every rune and the Core of the Wanderer are built as Activities (attack, save, heal, damage, check or
  utility, with the 4.x uses and consumption model); on 3.x the classic item fields are built as before. The
  shipped compendium carries both shapes, so it reads correctly under either system, and runes carved under 3.x
  are converted by dnd5e's own migration when the system is upgraded.
- Unstable Core II and Search the Core link what they spend (Overload's charge, a use of Rage) through the 4.x
  activity's item-uses consumption target; Overload's short-rest recovery is set through a 4.x recovery profile.
- Riders read dnd5e's magical bonus, the 3.0 attack bonus, a 4.x attack activity bonus or the name, and strip the
  4.x base damage bonus on node copies. Active Effects carry both the v11 `icon` and the v12 `img` field.
- The headless smoke test runs under the dnd5e 3.0.4, 3.3.1 and 4.4.4 item models.
- Audit fixes for the port: carved runes and seated cores no longer inherit dnd5e 4.x's `migratedUses`
  bookkeeping from the compendium copy (a later world migration would have refunded spent uses); removing a rune
  that another rune spends (Overload under Unstable Core II) unlinks the dependant instead of leaving a dangling
  consumption target, and re-carving links it again; essences harvested under 3.x are run through dnd5e's own
  migration when slotted on 4.x; on 4.x a core option with nothing to activate no longer reports a Rage link it
  did not make; the rider reader handles live 4.x activity collections.

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
