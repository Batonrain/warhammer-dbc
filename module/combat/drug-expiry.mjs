// module/combat/drug-expiry.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Часы Календаря для препаратов со сроком по игровому времени (Sahara
//  task-3ab7, п.5; арифметика и книжные допущения — rules/drug-expiry.mjs).
//
//  Подключено списком CONDITION_CLOCK_HANDLERS (combat/condition-clock.mjs):
//  на каждый сдвиг Календаря ГМ проходит акторов мира, и для каждого препарата,
//  чья отметка `activeEffect.expiresAt` достигнута, действие кончается:
//    • есть пост-эффект (Струп: урон в T, Оглушение) — наступает он, штатным
//      путём кнопки «Пост-эффект» (sheets/tabs/drugs.mjs::triggerAfterEffect:
//      иммунитеты к пост-эффектам, урон, карточка);
//    • пост-эффекта нет — препарат просто снимается, как кнопкой
//      «Эффект завершён» (deactivateDrugEffect).
//  Отметку гасим ДО действия: повторный прогон (второй сдвиг Календаря подряд,
//  откат и новый ход вперёд) препарат второй раз не закончит.
// ════════════════════════════════════════════════════════════════════════════

import { dueDrugs } from "../rules/drug-expiry.mjs";
import { triggerAfterEffect, deactivateDrugEffect } from "../sheets/tabs/drugs.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * Обработчик часов: закончить действие препаратов актора, чей срок вышел.
 * @param {Actor} actor
 * @param {{from:number, to:number}} span  отрезок worldTime, секунды
 */
export async function drugExpiryClock(actor, { to }) {
  for (const item of dueDrugs(actor.items, to)) {
    // Срок для карточки — фактический (с поправками получателя), а не gameMinutes препарата.
    const fx = item.system?.activeEffect ?? {};
    const minutes = Math.round((Number(fx.expiresAt) - Number(fx.appliedAt ?? fx.expiresAt)) / 60);
    await item.update({ "system.activeEffect.expiresAt": null });
    await postTestCard(actor, {
      icon: rollIcon("spark", "#9fd13f"),
      title: `Срок действия вышел — ${esc(item.name)}`,
      threshold: `<div class="roll-threshold">Игровое время: действие препарата кончилось само (срок ${minutes} мин).</div>`
    }, { sound: false });
    if (item.system?.hasAfterEffect) await triggerAfterEffect(actor, item);
    else await deactivateDrugEffect(item);
  }
}
