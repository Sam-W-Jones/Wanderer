import { MODULE_ID } from "./constants.mjs";

/** Localize, with optional format data. */
export const L = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export function rarityLabel(rarity) {
  if (!rarity) return "";
  const key = `WANDERER.Rarity.${rarity}`;
  const s = game.i18n.localize(key);
  return s === key ? rarity : s;
}

export function kindLabel(kind) {
  const key = `WANDERER.Kind.${kind || "item"}`;
  const s = game.i18n.localize(key);
  return s === key ? kind : s;
}

export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

/** Is this actor designated as the Wanderer? */
export function isWanderer(actor) {
  return actor?.getFlag(MODULE_ID, "enabled") === true;
}

export function wandererActors() {
  return game.actors?.filter(a => isWanderer(a)) ?? [];
}

/** The designated actor this user should open: their assigned character first, else any owned one. */
export function myWanderer() {
  const owned = wandererActors().filter(a => a.isOwner);
  if (!owned.length) return null;
  return owned.find(a => a.id === game.user.character?.id) ?? owned[0];
}

/**
 * Re-render the open Wanderer windows that show an actor (the core window, the picker), optionally only
 * for one actor. Dialogs are never touched (a re-render would wipe what the user is typing) and the
 * GM editors re-render themselves after their own actions.
 */
export function rerenderWandererApps(actorId) {
  for (const app of Object.values(ui.windows)) {
    if (!app?.options?.classes?.includes("wanderer-app")) continue;
    if (app instanceof Dialog) continue;
    if (!app.actor) continue;
    if (actorId && app.actor.id !== actorId) continue;
    app.render(false);
  }
}

/** Post a short flavour line to chat, if the setting allows it. */
export async function postChat(actor, html) {
  if (!game.settings.get(MODULE_ID, "chatMessages")) return null;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wanderer-chat"><i class="fa-solid fa-circle-nodes"></i> ${html}</div>`
  });
}

/** Simple numeric prompt. Resolves to a number or null. */
export async function promptNumber({ title, label, initial = 1, min = 1 } = {}) {
  return new Promise(resolve => {
    new Dialog({
      title,
      content: `<form class="wanderer-prompt"><div class="form-group"><label>${escapeHTML(label)}</label>
        <input type="number" name="value" value="${Number(initial)}" min="${Number(min)}" step="1" autofocus></div></form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-check"></i>', label: game.i18n.localize("Yes"),
          callback: html => resolve(Number(html.find("[name=value]").val()) || null) },
        cancel: { icon: '<i class="fas fa-times"></i>', label: game.i18n.localize("Cancel"), callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }, { classes: ["dialog", "wanderer-app"] }).render(true);
  });
}
