/**
 * Built-in options for the core slot. The GM seats one from the core picker (or drags the
 * compendium item onto the core). Each becomes a feat on the sheet.
 *
 *   id, name, requirements, summary (one line for the picker), description (HTML),
 *   item: dnd5e mechanics for its activated part (same fields as rune mechanics, plus
 *         cost and consumeNamed: the name of a feature whose use it spends, e.g. "Rage"),
 *   awakened: ability keys the Awakened Core choice can raise by 1 (one effect each).
 */

const self = { value: null, units: "", type: "self" };
const selfRange = { value: null, long: null, units: "self" };

export const BUILTIN_CORES = [
  {
    id: "core-of-the-wanderer",
    name: "Core of the Wanderer",
    requirements: "You are a Kar’Ciel",
    summary: "Awakened Core: +1 Intelligence, Wisdom or Charisma, chosen at each long rest (max 20). The Old Machinery: knows the works of Carrow’ihl. Search the Core: once per day, spend a Rage and 10 minutes to ask the core one question.",
    description: `<p><em>Feat (granted; prerequisite: you are a Kar’Ciel)</em></p>
<p>After thousands of years, your core has re-awakened. Your memories still elude you — the road you walked, the places you stopped, the hands that set you going — but you are once more certain of your nature. You are Kar’Ciel: the last of nine, made by Carrow’ihl to go where the others could not, and to come back changed. Somewhere behind the stone, the old machinery is turning again, and it remembers more than you do.</p>
<p><strong>Awakened Core.</strong> Whenever you begin a long rest, choose Intelligence, Wisdom or Charisma. That score increases by 1 until you next begin a long rest, to a maximum of 20.</p>
<p><strong>The Old Machinery.</strong> You remember things about the ancient machineries of Kargabrad — the Kar’Ciel, the junctions, the works of Carrow’ihl — that you were never taught. At the DM’s discretion, when you encounter such a thing, you may know what it is, what it was for, or how it was meant to be used.</p>
<p><strong>Search the Core.</strong> Once per day, you can expend one use of your Rage to sit still and ponder for 10 minutes, reaching down into the memory your core keeps. At the end of that time, ask one question. The DM answers truthfully, as if you were searching your own memories: the answer may be a short phrase, a single word, or a cryptic rhyme, and it is never more than the Wanderer could have known. If the memory is not there at all, the DM tells you so, and the use is still spent. You cannot use this feature while raging, and you regain it when you finish a long rest.</p>`,
    item: {
      activation: "minute", cost: 10,
      condition: "Search the Core: not while raging; spends one use of Rage",
      uses: { max: 1, per: "lr" },
      range: selfRange, target: self, actionType: "util",
      chatFlavor: "Ask one question. The DM answers truthfully, as the Wanderer could have known it: a short phrase, a single word, or a cryptic rhyme. If the memory is not there, the use is still spent.",
      consumeNamed: "Rage"
    },
    awakened: ["int", "wis", "cha"]
  }
];
