// module/combat/possession-fusion.mjs
// Кнопка Дара «Слияние» (rules/possession-weapon-gifts.mjs): выбрать рукопашное оружие,
// которое срослось с рукой, — на него ложатся Дары-усилители, пока демон проявлен.

import { esc } from "../helpers/utils.mjs";
import { FUSED_WEAPON_FLAG } from "../rules/possession-weapon-gifts.mjs";

const NS = "warhammer-dbc";

export async function fusePossessionWeapon(actor) {
  if (!actor) return null;
  const melee = [...actor.items].filter(i => i.type === "weapon" && i.system?.weaponClass === "melee");
  if (!melee.length) { ui.notifications.warn(`⚠️ ${actor.name}: нет рукопашного оружия для Слияния.`); return null; }
  const current = actor.getFlag(NS, FUSED_WEAPON_FLAG) ?? "";
  const options = melee.map(w => `<option value="${esc(w.id)}"${w.id === current ? " selected" : ""}>${esc(w.name)}</option>`).join("");
  const id = await new Promise(resolve => new Dialog({
    title: `Дар: Слияние — ${actor.name}`,
    content: `<form style="padding:6px;"><label>Оружие, слитое с рукой:</label> <select id="fusion-weapon">${options}</select>
      <p style="font-size:0.85em;">Пока демон проявлен, на него ложатся Reinforced и Дары-усилители (Варп-Пламя, Демонический Яд, Молниевое Поле, Лезвия Душ).</p></form>`,
    buttons: {
      ok: { label: "Слить", callback: html => resolve((html[0] ?? html).querySelector("#fusion-weapon")?.value ?? "") },
      cancel: { label: "Отмена", callback: () => resolve(null) }
    },
    default: "ok", close: () => resolve(null)
  }).render(true));
  if (!id) return null;
  await actor.setFlag(NS, FUSED_WEAPON_FLAG, id);
  const weapon = actor.items.get(id);
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">Дар: Слияние</div><div class="roll-threshold">${esc(weapon?.name ?? "Оружие")} срастается с рукой ${esc(actor.name)}: в Проявлении — Reinforced и Дары-усилители.</div></div>` });
  return id;
}
