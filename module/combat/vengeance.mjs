// module/combat/vengeance.mjs
// ════════════════════════════════════════════════════════════════════════════
//  VENGEANCE / МЕСТЬ — Foundry-обвязка к rules/berserker-talents.mjs::vengeanceReward
//  (Таланты «Берсерк», Sahara 3-861e).
//
//  Звать из sheets/tabs/body.mjs::setDeceased — тем же тактом «система признала смерть»,
//  что Кровавое Пламя и Оружие Наследия (blood-flame.mjs, legacy-weapon-kill-credit.mjs):
//  убийцу и рукопашность удара даёт оружие, которым ранили в последний раз
//  (LAST_DAMAGE_WEAPON_FLAG, ставит combat/damage.mjs). «Может восстановить» — выгода без
//  цены, поэтому начисляется сразу, с карточкой в чат.
// ════════════════════════════════════════════════════════════════════════════

import { changeActorInfamy } from "../apps/infamy-points.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { hatredTargetsOf } from "../rules/predicates.mjs";
import { anyTargetMatches } from "../rules/talent-targets.mjs";
import { vengeanceReward } from "../rules/berserker-talents.mjs";

/**
 * @param {Actor} victim   убитый (цель Ненависти, лидер/чемпион по метке ГМа)
 * @param {Item}  weapon   оружие последнего ранения; weapon.actor — убийца
 */
export async function registerVengeanceKill(victim, weapon) {
  const killer = weapon?.actor ?? weapon?.parent ?? null;
  if (!killer || !victim || killer === victim) return null;
  const melee = weapon.system?.weaponClass === "melee";
  const hatedTargets = hatredTargetsOf(killer);
  const hated = hatedTargets.length > 0 && anyTargetMatches(hatedTargets, { targetActor: victim });
  const reward = vengeanceReward(killer, victim, { melee, hated });
  if (!reward) return null;

  const roll = await new Roll(reward.formula).evaluate();
  const gained = Math.max(0, roll.total);
  const res = await changeActorInfamy(killer, gained);
  await postTestCard(killer, {
    icon: rollIcon("skull", "#ff6b6b"),
    title: `Месть — ${esc(victim.name)}`,
    lines: [`<div class="roll-threshold">${esc(killer.name)} убил(а) ${esc(victim.name)} — лидера или чемпиона Ненавистных — в рукопашной: `
      + `восстановлено Очков Бесчестия: <b>${res.after - res.before}</b> из ${gained} (${esc(reward.formula)}); сейчас ${res.after}/${res.max}.</div>`]
  }, { rolls: [roll], sound: false });
  return { gained, ...res };
}
