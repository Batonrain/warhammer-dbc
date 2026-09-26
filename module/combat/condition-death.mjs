// module/combat/condition-death.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Смерть от Состояния (сверка «Статусы», wdbc-x1nz.2.92/.94/.96) — книга
//  прямо убивает персонажа без участия Ран: Кровотечение «на 0 и ниже он
//  умирает», Удушье «умирает от удушья через T.b Раундов», Гангрена «пока это
//  не убьёт его». Раньше это была только строка в чате.
//
//  Один путь на все три: тот же флаг flags.warhammer-dbc.deceased, что ставят
//  ручная галочка вкладки Тело и кнопка крит-строки (sheets/tabs/body.mjs::
//  setDeceased — с ним же засчитываются убийства Оружию Наследия), плюс
//  статус ядра «Повержен» на токене и отметка в трекере боя, чтобы мёртвый
//  выбывал из очереди Ходов. Снимается как обычно — вкладкой Смерть/Тело и
//  кликом по статусу.
//
//  Причина пишется в flags.warhammer-dbc.deathCause — Чудесное Спасение
//  прекращает именно «эффект, что вызвал смерть» (rules/death-save.mjs).
//  Под Божественной Защитой (до конца сессии «не может быть убит никаким
//  образом») смерть не наступает вовсе.
// ════════════════════════════════════════════════════════════════════════════

import { setDeceased } from "../sheets/tabs/body.mjs";
import { divineProtectionActive, DEATH_CAUSE_FLAG } from "../rules/death-save.mjs";

/**
 * Констатировать смерть актора от Состояния.
 * @param {Actor} actor
 * @param {string|null} cause ключ Состояния-причины ("bleeding"/"suffocating"/"gangrene")
 * @returns {Promise<boolean>} true — актор умер сейчас, false — уже был мёртв/нет актора/под Защитой
 */
export async function killByCondition(actor, cause = null) {
  if (!actor) return false;
  if (actor.getFlag?.("warhammer-dbc", "deceased")) return false;
  if (divineProtectionActive(actor)) return false;
  if (cause) await actor.setFlag("warhammer-dbc", DEATH_CAUSE_FLAG, cause);
  await setDeceased(actor, true);
  const deadId = globalThis.CONFIG?.specialStatusEffects?.DEFEATED;
  if (deadId && typeof actor.toggleStatusEffect === "function") {
    await actor.toggleStatusEffect(deadId, { active: true, overlay: true });
  }
  const combatants = globalThis.game?.combat?.combatants?.filter?.(c => c.actor === actor) ?? [];
  for (const c of combatants) {
    if (!c.defeated) await c.update({ defeated: true });
  }
  return true;
}
