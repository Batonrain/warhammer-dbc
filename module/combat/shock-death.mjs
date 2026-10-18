// module/combat/shock-death.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тест «смерть от шока» (Критический Эффект): «Цель должна пройти тест на T+0,
//  или умереть от шока» — 11 строк critical-tables.mjs, плюс C/Торс 9 «…или умирает
//  от остановки сердца». Правило МИРА, а не Таланта: кнопка (crit-effect-parser.mjs::
//  shockDeathButtonHtml) стоит под текстом эффекта у ЛЮБОГО персонажа.
//
//  Почему раньше его не было: textAssertsDeath намеренно не ловит условную смерть —
//  «Констатировать смерть» по такой строке была бы враньём (crit-effect-parser.mjs,
//  шапка textAssertsDeath). Теперь у условной смерти своя кнопка, и приговор выносит
//  бросок, а не строка текста.
//
//  Провал убивает тем же путём, каким система уже убивает от Состояний —
//  condition-death.mjs::killByCondition (флаг deceased, статус «Повержен», выбывание
//  из очереди Ходов; Божественная Защита смерть не допускает). Причина не пишется:
//  смерть от попадания — Чудесное Спасение откатывает урон (rules/death-save.mjs).
//
//  Крепкий Орешек («перебрасывает тесты на Кровотечение и смерть от шока»): два
//  броска d100, засчитывается лучший (меньший) — как Преимущество.
// ════════════════════════════════════════════════════════════════════════════

import { rollResilienceTest } from "./resilience-test.mjs";
import { killByCondition } from "./condition-death.mjs";
import { runCardOnce } from "./card-once.mjs";
import { hasResilienceTalent } from "../rules/resilience-talents.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { CAST_OUT_OF_DEATH_CAPABILITY } from "../rules/cast-out-of-death.mjs";

/** Двойной бросок Крепкого Орешка: лучший (меньший) из двух. */
export const DIE_HARD_REROLL = { rolls: 2, mode: "keepBest", label: "Крепкий Орешек" };

/**
 * Бросить тест «смерть от шока».
 * @param {Actor} actor
 * @param {{char?:string, mod?:number, cause?:string, message?:ChatMessage}} o
 *   message — карточка Критического Эффекта: тест раз на карточку
 * @returns {Promise<boolean>} true — тест брошен
 */
export async function rollShockDeath(actor, { char = "t", mod = 0, cause = "шока", message = null } = {}) {
  if (!actor) return false;
  const run = async () => {
    // Изгнанный из Смерти: умереть от Критического Эффекта не может — тест ничего не решает.
    if (hasRuleFlag(actor, CAST_OUT_OF_DEATH_CAPABILITY)) {
      ui.notifications?.info(`${actor.name}: Изгнанный из Смерти — от Критического Эффекта не умирает.`);
      return false;
    }
    const dieHard = hasResilienceTalent(actor, "dieHard");
    const test = await rollResilienceTest(actor, char, {
      title: `Смерть от ${cause}`, mod, charLabel: char.toUpperCase(),
      reroll: dieHard ? DIE_HARD_REROLL : null,
      successText: "Успех — персонаж выжил",
      failText: `Провал — смерть от ${cause}`
    });
    if (!test.success) await killByCondition(actor, null);
    return true;
  };
  return message
    ? runCardOnce(message, "shockDeathRolled", run, "Тест «смерть от шока» с этой карточки уже брошен.", { persist: false })
    : run();
}
