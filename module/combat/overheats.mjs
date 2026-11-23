// module/combat/overheats.mjs
// ════════════════════════════════════════════════════════════════════════
//  Перегрев / Overheats (core, «Особые Свойства Оружия»): «понижает
//  Надежность на 1, но вместо Клина оно наносит урон по самому стрелку, в
//  руку, что держит его (случайную если ее держали двумя)».
//
//  −1 Надёжность уже идёт через auto.reliability (constants/weapon-
//  properties.mjs). Здесь — вторая половина: выпал Клин, а оружие с
//  Перегревом не клинит; вместо этого карточка с уроном оружия по стрелку и
//  кнопкой «Применить урон» в руку (тот же приём, что Критический Промах
//  Кистеня — combat/draw-action.mjs::resolveFlailMeleeFumble). Раньше
//  карточка писала «Оружие заклинило!» (Sahara overheats, 13.11.2026).
// ════════════════════════════════════════════════════════════════════════

import { damageFormulaFor } from "./attack-outcome.mjs";
import { getHeldHand } from "../rules/hands.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

/** Есть ли у оружия Перегрев (по собранным свойствам). */
export function hasOverheats(entries) {
  return (entries || []).some(e => (typeof e === "string" ? e : e?.key) === "overheats");
}

/**
 * В какую руку бьёт Перегрев: в держащую; двумя руками или рука неизвестна —
 * случайная (rnd — число 0..1).
 * @returns {"П. Рука"|"Л. Рука"}
 */
export function overheatArm(item, rnd = Math.random()) {
  const hand = getHeldHand(item);
  if (hand === "right") return "П. Рука";
  if (hand === "left") return "Л. Рука";
  return rnd < 0.5 ? "П. Рука" : "Л. Рука";
}

/**
 * Карточка Перегрева: бросок урона оружия и кнопка урона по самому стрелку.
 * @param {object} actor стрелок
 * @param {object} item  оружие
 * @param {{damage:string, penetration:number, wp:object, rv:number}} p урон/пробитие выстрела (с учётом снаряда), свойства, бросок атаки
 */
export async function resolveOverheat(actor, item, { damage, penetration = 0, wp = {}, rv } = {}) {
  if (!actor || !item) return;
  const loc = overheatArm(item);
  const formula = damageFormulaFor({
    damage, chars: actor.system?.characteristics, corruptionBonus: actor.system?.corruptionBonus ?? 0, wp
  });
  const dmgRoll = await new Roll(formula).evaluate();
  const weaponName = esc(item.name);
  const actorName = esc(actor.name);
  const pen = Number(penetration) || 0;
  const damageType = item.system?.damageType || "energy";
  const dmgBtn = `
    <button class="wh-apply-dmg-btn" type="button"
      data-damage="${dmgRoll.total}" data-penetration="${pen}"
      data-damage-type="${damageType}" data-damage-subtype="${item.system?.damageSubtype || ""}"
      data-hit-location="${loc}" data-weapon-name="${weaponName}"
      data-weapon-uuid="${item.uuid ?? ""}" data-attacker="${actorName}" data-attacker-uuid="${actor.uuid ?? ""}"
      data-force-target="${actor.uuid ?? ""}"
      data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0"
      data-lance="0" data-sanctified="0" data-blast="0" data-flame="0"
      data-power-field="0" data-spray="0" data-devastating="0" data-weapon-range="0"
      data-melee="0" data-burst="0" data-corrosive="0" data-entropy="0" data-touch-of-pain="0"
      data-crippling="0" data-piercing="0" data-haywire="" data-haywire-dmg2=""
      data-through-shot="0" data-has-extreme="0">
      Применить урон: <b>${dmgRoll.total}</b> → ${actorName}, ${loc}
    </button>`;
  await postTestCard(actor, {
    icon: rollIcon("fire", "#ff8a3a"),
    title: `${actorName} — Перегрев: ${weaponName} бьёт по стрелку!`,
    lines: [
      `<div class="roll-threshold" style="color:#ffb86b;">♨️ Бросок ${rv ?? "—"} — Клин, но оружие с Перегревом не клинит: урон по самому стрелку, в руку, что держит оружие.</div>`,
      `<div class="roll-threshold">Урон ${esc(formula)} = <b>${dmgRoll.total}</b>, Проб. ${pen}. Место: <b>${loc}</b></div>`
    ],
    sections: [`<div class="roll-apply-dmg-section">${dmgBtn}</div>`]
  }, { rolls: [dmgRoll] });
  return { loc, total: dmgRoll.total };
}
