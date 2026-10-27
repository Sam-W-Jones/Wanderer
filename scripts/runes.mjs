/**
 * The built-in rune library, transcribed from the Wanderer's rune tables, with dnd5e mechanics.
 *
 * Each rune:
 *   id         slug, stable across versions (saved on carved items; used for the compendium id)
 *   name       display name
 *   rarity     "uncommon" | "rare" | "veryRare" (any dnd5e rarity is accepted)
 *   effect     rules text
 *   flavor     italic flavor line
 *   requires   (optional) id of a rune that must already be carved
 *   tags       (optional) labels shown in the picker, e.g. ["utility"]
 *   effects    (optional) Active Effects on the created item. `transfer` defaults to true (a passive
 *              buff applied while carved); transfer: false effects are offered on the item's chat card.
 *   item       (optional) dnd5e mechanics for the created item. A rune without `item` is a passive
 *              feature. Fields: type ("feat" default, or "weapon"), activation, condition, uses {max, per},
 *              target {value, width, units, type}, range {value, long, units}, duration {value, units},
 *              actionType, ability, damage [[formula, type]], save {ability, scaling}, chatFlavor,
 *              weapon {type, properties}, consumeOf (rune id whose uses this rune spends).
 *
 * See scripts/items.mjs for how these become item data, and tools/build-packs.mjs for the compendium.
 */

const ADD = 2;      // CONST.ACTIVE_EFFECT_MODES.ADD
const UPGRADE = 4;  // CONST.ACTIVE_EFFECT_MODES.UPGRADE
const OVERRIDE = 5; // CONST.ACTIVE_EFFECT_MODES.OVERRIDE (Colossus size)

const one = { value: 1, units: "", type: "creature" };
const ally = { value: 1, units: "", type: "ally" };
const self = { value: null, units: "", type: "self" };
const burst = r => ({ value: r, units: "ft", type: "radius" });
const ft = (value, long = null) => ({ value, long, units: "ft" });
const selfRange = { value: null, long: null, units: "self" };
const strSave = { ability: "str", scaling: "str" };

export const BUILTIN_RUNES = [
  // ───────────────────────── Uncommon ─────────────────────────
  {
    id: "titans-grip", name: "Titan's Grip", rarity: "uncommon",
    effect: "Grapple and shove creatures up to Huge; dragging a grappled creature costs no extra movement.",
    flavor: "The first thing the makers taught a body of stone was how to hold on. The second was how not to let go."
  },
  {
    id: "rooted", name: "Rooted", rarity: "uncommon",
    effect: "Can't be knocked prone or moved against his will by creatures his size or smaller; counts as Huge for being lifted, carried, swallowed, or moved by wind and water.",
    flavor: "A mountain does not step aside. It was not asked, and it would not have understood the question."
  },
  {
    id: "runic-fist", name: "Runic Fist", rarity: "uncommon",
    effect: "Unarmed strikes are magical and deal 1d8 bludgeoning.",
    flavor: "Every line carved into a knuckle is a word, and every word is the same word, and the word is enough.",
    item: {
      type: "weapon", weapon: { type: "natural", properties: ["mgc"] },
      activation: "action", actionType: "mwak", ability: "str",
      damage: [["1d8 + @mod", "bludgeoning"]], range: ft(5), target: one
    }
  },
  {
    id: "sure-footing", name: "Sure Footing", rarity: "uncommon",
    effect: "Nonmagical difficult terrain doesn't slow him; standing from prone costs 5 ft.",
    flavor: "Rubble, ice, the dead, the dying — the ground is only ever the ground."
  },
  {
    id: "lodestone", name: "Lodestone", rarity: "uncommon",
    effect: "Start of his turn: one creature within 10 ft must make a Strength save or be pulled 5 ft toward him.",
    flavor: "Iron finds the stone. It has never been the other way round.",
    item: {
      activation: "special", condition: "Start of his turn",
      range: ft(10), target: one, actionType: "save", save: strSave,
      chatFlavor: "On a failed Strength save the creature is pulled 5 ft toward him."
    }
  },
  {
    id: "counterweight", name: "Counterweight", rarity: "uncommon",
    effect: "Reaction: when a creature fails to grapple or shove him, he grapples or shoves it.",
    flavor: "They put their hands on him. That was their mistake. Now they are his.",
    item: { activation: "reaction", condition: "When a creature fails to grapple or shove him", target: one, actionType: "util" }
  },
  {
    id: "tremor-step", name: "Tremor Step", rarity: "uncommon",
    effect: "Tremorsense 30 ft; always knows which way is down, and how far.",
    flavor: "He hears the earth the way others hear a room — who is in it, who is coming, and where the floor ends.",
    effects: [{ name: "Tremor Step", changes: [{ key: "system.attributes.senses.tremorsense", mode: UPGRADE, value: "30", priority: 20 }] }]
  },
  {
    id: "ley-sight", name: "Ley-Sight", rarity: "uncommon", tags: ["utility"],
    effect: "Sees magical auras within 30 ft as a faint cyan haze (passive detect magic).",
    flavor: "Light runs in the world like water in a wall. Most eyes were not made to see it leak."
  },
  {
    id: "elven-protocol", name: "Elven Protocol", rarity: "uncommon", tags: ["utility"],
    effect: "Doors and locks of elven make open, close or hold at his word, unless warded against his kind.",
    flavor: "The old houses remember who built them. A knock in the right language is still a key."
  },
  {
    id: "fulcrum", name: "Fulcrum", rarity: "uncommon",
    effect: "Swap places with a creature he's grappling as part of his movement; no opportunity attacks.",
    flavor: "Where he stands is a decision. He has simply decided for both of you."
  },
  {
    id: "catch", name: "Catch", rarity: "uncommon",
    effect: "Reaction: a creature falling, thrown or knocked past him is caught, takes no fall damage, lands beside him.",
    flavor: "Everything that falls is looking for something solid. Here is something solid.",
    item: { activation: "reaction", condition: "When a creature falls, is thrown or is knocked past him", target: one, actionType: "util" }
  },
  {
    id: "trip-line", name: "Trip Line", rarity: "uncommon",
    effect: "Reaction when a creature leaves his reach: Strength check vs its Dex save; on a win it falls prone instead. Once per round.",
    flavor: "Leaving is a thing you do with your legs. He would like a word with your legs.",
    item: {
      activation: "reaction", condition: "When a creature leaves his reach (once per round)",
      target: one, actionType: "abil", ability: "str",
      chatFlavor: "Contested: his Strength check against the target's Dexterity save. On a win it falls prone instead of leaving."
    }
  },
  {
    id: "builders-eye", name: "Builder's Eye", rarity: "uncommon", tags: ["utility"],
    effect: "Advantage to break, force or dismantle objects and structures; reads what a mechanism does at a glance.",
    flavor: "A wall is a list of places it will fail. He can read the list."
  },
  {
    id: "hollow", name: "Hollow", rarity: "uncommon", tags: ["utility"],
    effect: "A cavity behind the chest sigil opens on an extradimensional space (a 2 ft cube, up to 250 lb). Stowing or drawing an item is a bonus action; nothing inside can be detected from outside.",
    flavor: "The makers left room. They always left room; they knew what a long road collects.",
    item: { activation: "bonus", condition: "Stow or draw an item", range: selfRange, target: self, actionType: "util" }
  },
  {
    id: "lantern-heart", name: "Lantern Heart", rarity: "uncommon", tags: ["utility"],
    effect: "Bonus action: his core sheds bright light in a 30 ft radius and dim light for 30 ft beyond, or goes dark. Invisible creatures and objects in the bright light are visible.",
    flavor: "Light was the first thing they put in him. It will be the last thing he puts out.",
    item: { activation: "bonus", range: selfRange, target: self, duration: { value: null, units: "spec" }, actionType: "util" },
    effects: [{
      name: "Lantern Heart (lit)", transfer: false,
      changes: [
        { key: "ATL.light.bright", mode: OVERRIDE, value: "30", priority: 20 },
        { key: "ATL.light.dim", mode: OVERRIDE, value: "60", priority: 20 },
        { key: "ATL.light.color", mode: OVERRIDE, value: "#2d9bff", priority: 20 }
      ]
    }]
  },
  {
    id: "makers-tongue", name: "Makers' Tongue", rarity: "uncommon", tags: ["utility"],
    effect: "He understands any spoken language, and can read any writing by laying a hand on it.",
    flavor: "Every tongue is a dialect of the one he was carved in. He simply listens for the accent."
  },
  {
    id: "riverbed", name: "Riverbed", rarity: "uncommon", tags: ["utility"],
    effect: "He walks along the bottom of any body of water at full speed, unhindered by current, and does not need to breathe.",
    flavor: "Rivers are roads that happen to be wet. He has never understood the fuss."
  },
  {
    id: "stone-sleep", name: "Stone Sleep", rarity: "uncommon", tags: ["utility"],
    effect: "Action: while he stays motionless he is indistinguishable from a statue; a creature must succeed on an Intelligence (Investigation) check (DC 8 + PB + Con) to tell otherwise. He can keep it up for days, and wakes instantly.",
    flavor: "He has been furniture before. He was good at it.",
    item: {
      activation: "action", range: selfRange, target: self, duration: { value: null, units: "spec" }, actionType: "util",
      chatFlavor: "Indistinguishable from a statue while motionless. Intelligence (Investigation) DC 8 + his proficiency bonus + his Constitution modifier to tell otherwise."
    }
  },
  {
    id: "pumice", name: "Pumice", rarity: "uncommon", tags: ["utility"],
    effect: "Bonus action: he weighs 10 pounds until he ends it as a bonus action. He takes no fall damage, floats, and can be lifted, carried or thrown by anyone who could manage a pack.",
    flavor: "Heavy is a habit. He can put it down.",
    item: { activation: "bonus", range: selfRange, target: self, duration: { value: null, units: "spec" }, actionType: "util" }
  },

  // ─────────────────────────── Rare ───────────────────────────
  {
    id: "hurl", name: "Hurl", rarity: "rare",
    effect: "Shoving a grappled creature can throw it up to 20 ft: prone, 1d6 per 10 ft, and the same to whatever it lands on.",
    flavor: "There is an argument for picking things up and an argument for putting them down. He has combined them.",
    item: {
      activation: "special", condition: "When shoving a grappled creature",
      range: ft(20), target: one, actionType: "other", damage: [["1d6", "bludgeoning"]],
      chatFlavor: "1d6 per 10 ft thrown, and the same to whatever it lands on. The creature lands prone."
    }
  },
  {
    id: "capacitor", name: "Capacitor", rarity: "rare",
    effect: "Stores half the damage he takes from spells and magical effects, after resistance, as charge (up to 20; full damage still taken); his next melee hit deals the charge as force. Fades end of next turn.",
    flavor: "Burn him and the fire goes somewhere. It goes into the fist. It comes back out.",
    item: {
      activation: "special", condition: "On his next melee hit after taking damage from a spell or magical effect",
      target: one, actionType: "other",
      chatFlavor: "Deals the stored charge (half the magical damage taken, up to 20) as force damage. The charge fades at the end of his next turn."
    }
  },
  {
    id: "overload", name: "Overload", rarity: "rare",
    effect: "1/LR, first time below half HP: 10 ft burst, Dex save (DC 8 + PB + Con), 5d8 force, half on save. Variant: hits allies too until recarved.",
    flavor: "The lines were cut to hold a great deal. Nobody said what happens when they are asked to hold more.",
    item: {
      activation: "special", condition: "The first time he drops below half his hit points (1/long rest)",
      uses: { max: 1, per: "lr" }, range: selfRange, target: burst(10),
      actionType: "save", save: { ability: "dex", scaling: "con" }, damage: [["5d8", "force"]],
      chatFlavor: "Half damage on a success. Variant: hits allies too until recarved."
    }
  },
  {
    id: "bulwark", name: "Bulwark", rarity: "rare",
    effect: "Reaction: when an ally within 5 ft is hit, he takes the hit instead.",
    flavor: "A shield that walks, and chooses what it shields, and is not sorry.",
    item: { activation: "reaction", condition: "When an ally within 5 ft is hit", range: ft(5), target: ally, actionType: "util", chatFlavor: "He takes the hit instead." }
  },
  {
    id: "colossus", name: "Colossus", rarity: "rare",
    effect: "Bonus action, 2/LR, 1 min: Large, reach 10 ft, +1d4 melee damage, advantage on Strength checks and saves.",
    flavor: "The makers built him to a size the doors would allow. The doors were a courtesy.",
    item: { activation: "bonus", uses: { max: 2, per: "lr" }, duration: { value: 1, units: "minute" }, range: selfRange, target: self, actionType: "util" },
    effects: [{
      name: "Colossus", transfer: false, duration: { rounds: 10 },
      changes: [
        { key: "system.traits.size", mode: OVERRIDE, value: "lg", priority: 20 },
        { key: "system.bonuses.mwak.damage", mode: ADD, value: "+1d4", priority: 20 },
        { key: "flags.midi-qol.advantage.ability.check.str", mode: OVERRIDE, value: "1", priority: 20 },
        { key: "flags.midi-qol.advantage.ability.save.str", mode: OVERRIDE, value: "1", priority: 20 }
      ]
    }]
  },
  {
    id: "living-wall", name: "Living Wall", rarity: "rare",
    effect: "Allies move through his space; enemies treat every square within 5 ft of him as difficult terrain.",
    flavor: "You may go around. Going around takes a while. That is rather the point."
  },
  {
    id: "slam", name: "Slam", rarity: "rare",
    effect: "Throwing, shoving or dropping a creature into a wall, floor, object or creature adds 2d6 and can knock it prone.",
    flavor: "Every surface is an anvil if you are holding the hammer by the throat.",
    item: {
      activation: "special", condition: "When he throws, shoves or drops a creature into a wall, floor, object or creature",
      target: one, actionType: "other", damage: [["2d6", "bludgeoning"]],
      chatFlavor: "Added to the impact. The creature may be knocked prone."
    }
  },
  {
    id: "chain-gang", name: "Chain-Gang", rarity: "rare",
    effect: "Grapples two creatures at once, one in each hand; full speed if both are Medium or smaller.",
    flavor: "Two hands. Two problems. The arithmetic is not complicated."
  },
  {
    id: "earthbind", name: "Earthbind", rarity: "rare",
    effect: "A grappled flyer loses its flying speed and falls if released aloft; a shoved flyer must save or be knocked 20 ft down.",
    flavor: "The sky is for those the ground has let go of. He has not let go.",
    item: {
      activation: "special", condition: "When he shoves a flying creature", target: one, actionType: "save", save: strSave,
      chatFlavor: "On a failure the flyer is knocked 20 ft down. A grappled flyer loses its flying speed and falls if released aloft."
    }
  },
  {
    id: "spite-core", name: "Spite Core", rarity: "rare",
    effect: "While grappling a creature, whenever he takes damage, it takes half as force.",
    flavor: "Hurt him and the stone remembers it — and the stone is holding someone."
  },
  {
    id: "rally-core", name: "Rally Core", rarity: "rare",
    effect: "On entering rage, allies within 10 ft gain temp HP (PB + Con), and one sentence of his carries over any noise.",
    flavor: "Old bells were cast to be heard through battle. So, it turns out, was he.",
    item: {
      activation: "special", condition: "When he enters rage", range: ft(10), target: burst(10),
      actionType: "heal", damage: [["@prof + @abilities.con.mod", "temphp"]],
      chatFlavor: "Allies within 10 ft gain the temporary hit points. One sentence of his carries over any noise."
    }
  },
  {
    id: "unmaking-hand", name: "Unmaking Hand", rarity: "uncommon",
    effect: "Melee hits deal double damage to objects and structures and ignore constructs' bludgeoning resistance.",
    flavor: "Whatever was made can be unmade, and the hand that knows how a thing was joined knows where it parts."
  },
  {
    id: "fastball", name: "Fastball", rarity: "rare",
    effect: "In place of one attack of his Attack action: throw a willing Medium-or-smaller ally up to 30 ft; they land on their feet, may use their reaction for one weapon attack, no fall damage.",
    flavor: "Trust is a short flight and a hard landing. Ask the goblin.",
    item: {
      activation: "special", condition: "Replaces one attack of his Attack action", range: ft(30), target: ally, actionType: "util",
      chatFlavor: "A willing Medium-or-smaller ally is thrown up to 30 ft, lands on their feet, takes no fall damage, and may use their reaction to make one weapon attack."
    }
  },
  {
    id: "vise", name: "Vise", rarity: "rare",
    effect: "A grappled creature takes bludgeoning equal to his Strength modifier at the start of each of its turns; disadvantage to escape if his size or smaller.",
    flavor: "It is not a grip. A grip lets go eventually. This is a closing.",
    item: {
      activation: "special", condition: "Start of each grappled creature's turn", target: one,
      actionType: "other", damage: [["@abilities.str.mod", "bludgeoning"]],
      chatFlavor: "Creatures his size or smaller have disadvantage on checks to escape."
    }
  },
  {
    id: "juggernaut", name: "Juggernaut", rarity: "rare",
    effect: "Moving 10 ft straight, he passes through Large-or-smaller creatures; each must save or be shoved aside and knocked prone.",
    flavor: "The shortest path between two points is a line through everyone standing on it.",
    item: {
      activation: "special", condition: "When he moves 10 ft in a straight line",
      target: { value: 10, width: 5, units: "ft", type: "line" }, actionType: "save", save: strSave,
      chatFlavor: "He passes through Large-or-smaller creatures. Each that fails is shoved aside and knocked prone."
    }
  },
  {
    id: "shockwave", name: "Shockwave", rarity: "rare",
    effect: "Action, 1/short rest: strike the ground; creatures within 10 ft save or fall prone; the area is difficult terrain until end of his next turn.",
    flavor: "He said something to the floor. The floor passed it on.",
    item: {
      activation: "action", uses: { max: 1, per: "sr" }, range: selfRange, target: burst(10),
      actionType: "save", save: strSave,
      chatFlavor: "On a failure the creature falls prone. The area is difficult terrain until the end of his next turn."
    }
  },
  {
    id: "wrecking-yard", name: "Wrecking Yard", rarity: "rare",
    effect: "Throws objects up to Large as improvised weapons: 20/60 ft, 2d8; a Huge creature hit is pushed 5 ft.",
    flavor: "Carts, statues, the better sort of furniture. The world is full of things that would like to be thrown.",
    item: {
      type: "weapon", weapon: { type: "improv", properties: ["mgc", "thr"] },
      activation: "action", actionType: "rwak", ability: "str",
      damage: [["2d8 + @mod", "bludgeoning"]], range: ft(20, 60), target: one,
      chatFlavor: "Throws an object up to Large. A Huge creature hit is pushed 5 ft."
    }
  },
  {
    id: "moles-road", name: "Mole's Road", rarity: "rare", tags: ["utility"],
    effect: "Burrowing speed 20 ft through earth, sand and loose rock. He leaves a tunnel behind him if he chooses, wide enough for a Medium creature.",
    flavor: "The surface is a suggestion.",
    effects: [{ name: "Mole's Road", changes: [{ key: "system.attributes.movement.burrow", mode: UPGRADE, value: "20", priority: 20 }] }]
  },
  {
    id: "quiet-earth", name: "Quiet Earth", rarity: "rare", tags: ["utility"],
    effect: "He can move in perfect silence, and while he does, allies within 10 ft of him make no sound either.",
    flavor: "Stone knows how to be quiet. It has had practice."
  },
  {
    id: "stone-tell", name: "Stone Tell", rarity: "rare", tags: ["utility"],
    effect: "1/LR: lay a hand on worked stone for 10 minutes and ask it what it has seen. The DM describes who shaped it and the last significant thing to happen there, as a stone would remember it.",
    flavor: "Walls do not gossip. They testify.",
    item: {
      activation: "minute", cost: 10, uses: { max: 1, per: "lr" }, range: { value: null, long: null, units: "touch" }, target: { value: 1, units: "", type: "object" }, actionType: "util",
      chatFlavor: "Who shaped the stone, and the last significant thing to happen there, as a stone would remember it."
    }
  },

  // ───────────────────────── Very rare ─────────────────────────
  {
    id: "keystone", name: "Keystone", rarity: "veryRare",
    effect: "A creature he's grappling is restrained while grappled (it can still try to escape) and has disadvantage on attacks against anyone but him.",
    flavor: "Pull one stone from the arch and the whole thing comes down. He is the stone, and he has your attention."
  },
  {
    id: "unstable-core-ii", name: "Unstable Core II", rarity: "veryRare",
    effect: "Overload deals 7d8, pushes 10 ft, and he chooses who it hits; it recharges on a short rest. While raging he can also set it off deliberately as a bonus action. Requires Overload.",
    flavor: "What was once a flaw in the carving is now a decision. That is the only difference between a fault and a weapon.",
    requires: "overload",
    item: {
      activation: "bonus", condition: "Deliberately while raging, or automatically the first time he drops below half his hit points (spends Overload's use)",
      consumeOf: "overload", targetUses: { per: "sr" }, range: selfRange, target: burst(10),
      actionType: "save", save: { ability: "dex", scaling: "con" }, damage: [["7d8", "force"]],
      chatFlavor: "Pushes 10 ft; he chooses who it hits. Half damage on a success."
    }
  },
  {
    id: "stillness", name: "Stillness", rarity: "veryRare",
    effect: "When an ally within 30 ft is hit, he can rage as a reaction and move up to his speed toward the attacker without provoking opportunity attacks. His rage never ends for not attacking, and while raging he has advantage on Wisdom saving throws.",
    flavor: "The old masters did not rage. They decided, and the deciding looked much the same from outside.",
    item: {
      activation: "reaction", condition: "When an ally within 30 ft is hit", range: ft(30), target: self, actionType: "util",
      chatFlavor: "He enters rage as a reaction and moves up to his speed toward the attacker without provoking opportunity attacks. While raging he has advantage on Wisdom saves."
    },
    effects: [{
      name: "Stillness (raging)", transfer: false,
      changes: [{ key: "flags.midi-qol.advantage.ability.save.wis", mode: OVERRIDE, value: "1", priority: 20 }]
    }]
  },
  {
    id: "pile-driver", name: "Pile Driver", rarity: "veryRare",
    effect: "Action, 2/short rest: leap 20 ft with a grappled creature and come down on it — 4d6 bludgeoning to it (he takes half); it lands prone, stunned until end of its next turn on a failed Con save. He lands on his feet.",
    flavor: "Up is a short trip. Down is a longer conversation.",
    item: {
      activation: "action", uses: { max: 2, per: "sr" }, range: ft(20), target: one,
      actionType: "save", save: { ability: "con", scaling: "str" }, damage: [["4d6", "bludgeoning"]],
      chatFlavor: "He takes half the damage and lands on his feet. The target lands prone, and is stunned until the end of its next turn on a failed Constitution save."
    }
  },
  {
    id: "vault-door", name: "Vault Door", rarity: "veryRare",
    effect: "Bonus action: brace in a gap up to 10 ft wide. While braced he can't be moved or knocked prone, allies behind him have total cover from the far side, nothing Huge or smaller passes except by teleportation, and he can still attack. Ends when he moves or falls.",
    flavor: "There are doors with locks and doors with guards. He is a third kind.",
    item: {
      activation: "bonus", duration: { value: null, units: "spec" }, range: selfRange, target: { value: 10, units: "ft", type: "space" }, actionType: "util",
      chatFlavor: "Braced in a gap up to 10 ft wide: he can't be moved or knocked prone, allies behind him have total cover from the far side, and nothing Huge or smaller passes except by teleportation. He can still attack. Ends when he moves or falls."
    }
  },
  {
    id: "anvil", name: "Anvil", rarity: "veryRare",
    effect: "Creatures he knocks prone can't stand until the end of their next turn; his melee attacks against prone creatures crit on 19–20.",
    flavor: "What is down stays down long enough to regret it."
  },
  {
    id: "kinetic-lock", name: "Kinetic Lock", rarity: "veryRare",
    effect: "Reaction, 2/short rest: a creature within 30 ft starting to move must save or have speed 0 until the end of its next turn and be pulled 10 ft toward him.",
    flavor: "Motion is borrowed. He has decided it is time to collect.",
    item: {
      activation: "reaction", condition: "When a creature within 30 ft starts to move", uses: { max: 2, per: "sr" },
      range: ft(30), target: one, actionType: "save", save: strSave,
      chatFlavor: "On a failure its speed is 0 until the end of its next turn and it is pulled 10 ft toward him."
    }
  },
  {
    id: "rune-burn", name: "Rune-Burn", rarity: "veryRare",
    effect: "Once per turn on a melee hit: until end of his next turn the target has disadvantage on attacks against others, can't take the Disengage action, and takes 3d8 force if it willingly moves away from him.",
    flavor: "The mark is not deep, but it is hot, and it points one way: at him.",
    item: {
      activation: "special", condition: "Once per turn, on a melee hit", target: one, duration: { value: 1, units: "round" },
      actionType: "other", damage: [["3d8", "force"]],
      chatFlavor: "Until the end of his next turn the target has disadvantage on attacks against others, can't take the Disengage action, and takes the force damage if it willingly moves away from him."
    }
  },
  {
    id: "bedrock", name: "Bedrock", rarity: "veryRare",
    effect: "While he hasn't moved since the end of his last turn: +2 AC, attacks against him can't score critical hits, and he can't be moved or knocked prone against his will.",
    flavor: "He is not standing on the ground. The ground is standing on him.",
    effects: [{
      name: "Bedrock (unmoved)", transfer: true, disabled: true,
      changes: [
        { key: "system.attributes.ac.bonus", mode: ADD, value: "+2", priority: 20 },
        { key: "flags.midi-qol.grants.noCritical.all", mode: OVERRIDE, value: "1", priority: 20 }
      ]
    }]
  },
  {
    id: "mortar", name: "Mortar", rarity: "veryRare",
    effect: "While raging, at the start of each of his turns he gains temporary hit points equal to his proficiency bonus + Constitution modifier. They don't stack.",
    flavor: "Cracks are not damage. Cracks are where the next stone goes.",
    item: {
      activation: "special", condition: "Start of each of his turns while raging", range: selfRange, target: self,
      actionType: "heal", damage: [["@prof + @abilities.con.mod", "temphp"]],
      chatFlavor: "Temporary hit points; they don't stack with any he already has."
    }
  },
  {
    id: "waygate", name: "Waygate", rarity: "veryRare", tags: ["utility"],
    effect: "Over an hour he can inscribe a stone arch or doorway as his waystone (one at a time). Once every seven days, he and up to eight willing creatures can step through any arch of worked stone and arrive at the waystone.",
    flavor: "Every door he has ever walked through is still a door. He has only to remember which.",
    item: {
      activation: "action", condition: "Once every seven days; inscribing a waystone takes an hour",
      uses: { max: 1, per: "charges" }, target: { value: 9, units: "", type: "creature" }, range: { value: null, long: null, units: "touch" }, actionType: "util",
      chatFlavor: "He and up to eight willing creatures step through an arch of worked stone and arrive at his waystone. Regains its use after seven days."
    }
  },
  {
    id: "the-long-road", name: "The Long Road", rarity: "veryRare", tags: ["utility"],
    effect: "He and up to eight companions travelling with him move at a fast pace without penalty, suffer no exhaustion from forced marches or weather, and he always knows the way to any place he has been.",
    flavor: "He has walked longer than most roads have existed. The roads are catching up."
  }
];
