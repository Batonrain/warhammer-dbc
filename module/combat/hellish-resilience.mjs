// module/combat/hellish-resilience.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Hellish Resilience / Адская Живучесть (Талант Стойкости, глава 3): «Когда
//  персонаж получает непоглощённый урон, он может потратить Очко Бесчестия, чтобы
//  получить +Cor.b поглощения против этого урона и до конца своего следующего
//  Хода.»
//
//  Вызывается из конвейера урона (combat/damage.mjs::applyDamageToActor) после
//  поглощения и перед списанием Ран:
//   • согласие → Очко Бесчестия списывается общей точкой spendFromInfamyPool
//     (запись обычного пула — здесь), непоглощённый урон этого попадания
//     уменьшается на Cor.b;
//   • на «до конца следующего Хода» носителю кладётся настоящий ActiveEffect на
//     system.incomingDamageReduction (+Cor.b, фаза initial по expectedPhase).
//     Конвейер читает это поле ДО предложения, поэтому текущее попадание
//     бонус не удваивает — эффект действует на следующие.
//
//  Срок не штатной Duration ядра, а счётчик концов Хода на самом эффекте
//  (flags.warhammer-dbc.hellishResilience.ends). Причина: «turnEnd» Duration ядра
//  привязан к Ходу того, чей Ход шёл в момент создания эффекта (effect.start.
//  combatant), а книга требует конец СВОЕГО следующего Хода носителя, кто бы ни
//  бил в тот момент. Счётчик убывает в конце каждого Хода носителя
//  (hooks.mjs, updateCombat); получил урон в чужой Ход — 1 конец, в собственный — 2
//  (rules/resilience-talents.mjs::hellishResilienceTurnEnds). Конец боя снимает всё.
//
//  Вне боя Ходов нет: эффект не создаётся, +Cor.b действует только на это попадание.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { expectedPhase } from "../constants/effect-keys.mjs";
import {
  hellishResilienceBonus, hellishResilienceNet, hellishResilienceTurnEnds
} from "../rules/resilience-talents.mjs";
import { isOwnTurn } from "./action-economy.mjs";
import { combatOfActor } from "./actor-combat.mjs";

const NS = "warhammer-dbc";
export const HELLISH_RESILIENCE_FLAG = "hellishResilience";
const EFFECT_KEY = "system.incomingDamageReduction";

const confirm = (title, text, yes, no) => foundry.applications.api.DialogV2.confirm({
  window: { title }, content: `<p>${text}</p>`, yes: { label: yes }, no: { label: no }
}).then(r => !!r).catch(() => false);

/** Эффекты Адской Живучести на акторе. */
function hellishEffects(actor) {
  const all = actor?.effects?.contents ?? [...(actor?.effects ?? [])];
  return all.filter(fx => fx?.getFlag?.(NS, HELLISH_RESILIENCE_FLAG));
}

async function grantEffect(actor, bonus) {
  const combat = combatOfActor(actor);
  if (!combat) return false;   // вне боя Ходов нет — срок считать не от чего
  const old = hellishEffects(actor).map(fx => fx.id);
  if (old.length) await actor.deleteEmbeddedDocuments("ActiveEffect", old);
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: "Адская Живучесть", img: "icons/svg/shield.svg",
    system: { changes: [{ key: EFFECT_KEY, type: "add", value: bonus, phase: expectedPhase(EFFECT_KEY), priority: 0 }] },
    flags: { [NS]: { [HELLISH_RESILIENCE_FLAG]: { combatId: combat.id, ends: hellishResilienceTurnEnds(isOwnTurn(actor)) } } }
  }]);
  return true;
}

/**
 * Предложить потратить Очко Бесчестия на +Cor.b поглощения.
 * @returns {Promise<{net:number, note:string}>} итоговый непоглощённый урон и строка для карточки
 */
export async function hellishResilienceOffer(actor, netDamage) {
  const net = Number(netDamage) || 0;
  const bonus = hellishResilienceBonus(actor);
  if (!actor || net <= 0 || bonus <= 0 || !actorHasInfamyPoint(actor)) return { net, note: "" };

  const ok = await confirm("Адская Живучесть",
    `${esc(actor.name)} получает непоглощённый урон: <b>${net}</b>. Потратить Очко Бесчестия: +<b>${bonus}</b> (Cor.b) поглощения против этого урона и до конца своего следующего Хода?`,
    "Потратить Очко", "Нет");
  if (!ok) return { net, note: "" };

  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return { net, note: "" };   // Пустота Парии и т. п. — не потратили
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });

  const out = hellishResilienceNet(net, bonus);
  const timed = await grantEffect(actor, bonus);
  return {
    net: out,
    note: `🔥 Адская Живучесть: Очко Бесчестия → +${bonus} поглощения, непоглощённый урон ${net} → ${out}${
      timed ? "; бонус держится до конца следующего Хода" : "; вне боя — только на это попадание"}.`
  };
}

/** Конец Хода носителя (hooks.mjs, updateCombat): счётчик убывает, на нуле эффект снимается. */
export async function hellishResilienceTurnEnd(actor) {
  for (const fx of hellishEffects(actor)) {
    const flag = fx.getFlag(NS, HELLISH_RESILIENCE_FLAG);
    const ends = (Number(flag?.ends) || 1) - 1;
    if (ends <= 0) await fx.delete();
    else await fx.setFlag(NS, HELLISH_RESILIENCE_FLAG, { ...flag, ends });
  }
}

/** Конец боя (hooks.mjs, deleteCombat): бонус «до конца Хода» не переживает бой. */
export async function clearHellishResilience(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    const ids = hellishEffects(actor).map(fx => fx.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
  }
}
