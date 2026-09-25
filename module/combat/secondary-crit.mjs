// module/combat/secondary-crit.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КРИТИЧЕСКИЙ ЭФФЕКТ ОТ ВТОРИЧНОГО УРОНА (wdbc-x1nz.2.85).
//
//  Книга, «Раны»: при КАЖДОМ получении Отрицательных Ран — Критический Эффект
//  по итоговому числу, месту и виду урона. Основной путь (combat/damage.mjs,
//  удар оружием) это делал всегда; урон мимо него — остаток Разъедающего,
//  извлечение Проникающего, Калечащее, тик яда, «X+Провалы», Горение — писал
//  только «крит. N» без самого эффекта, и ГМ листал таблицу руками.
//
//  Здесь — тот же блок, что у основного пути: строка таблицы, пилюли
//  Состояний, «Уронить», «Констатировать смерть», плюс отметка Изгнанного из
//  Смерти. Вызывающая сторона просто дописывает возвращённый HTML в свою
//  карточку.
// ════════════════════════════════════════════════════════════════════════════

import { getCriticalEffect } from "../../critical-tables.mjs";
import { parseCritEffectPills, critPillsHtml, deathButtonHtml, dropButtonHtml } from "./crit-effect-parser.mjs";
import { LOCATION_TO_SIDE } from "../rules/useless-limbs.mjs";
import { critCharDamageHtml } from "./char-damage-button.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { CAST_OUT_OF_DEATH_CAPABILITY, CAST_OUT_OF_DEATH_FLAG, scheduleCastOutOfDeathRegen }
  from "../rules/cast-out-of-death.mjs";

/** Ключ брони → метка места попадания (для урона, известного лишь по части тела). */
export const ARMOR_KEY_TO_LOCATION = {
  head: "Голова", body: "Торс",
  rightArm: "П. Рука", leftArm: "Л. Рука",
  rightLeg: "П. Нога", leftLeg: "Л. Нога"
};

/**
 * Блок Критического Эффекта для урона мимо основного пути. Пусто, если
 * Отрицательных Ран не прибавилось.
 *
 * @param {Actor}  actor
 * @param {object} loss  итог applyWoundLoss ({gotCritical, newCritical})
 * @param {object} o
 * @param {string} o.damageType   impact|rending|blast|energy|chemical
 * @param {string} [o.hitLocation] метка места («Торс» по умолчанию — урон без места)
 * @returns {Promise<string>} HTML
 */
export async function secondaryCritHtml(actor, { gotCritical, newCritical } = {}, { damageType, hitLocation = "Торс" } = {}) {
  if (!gotCritical) return "";
  const critEffect = getCriticalEffect(damageType, hitLocation, newCritical);
  if (critEffect && hasRuleFlag(actor, CAST_OUT_OF_DEATH_CAPABILITY)) {
    await actor.setFlag?.("warhammer-dbc", CAST_OUT_OF_DEATH_FLAG,
      scheduleCastOutOfDeathRegen(globalThis.game?.time?.worldTime ?? 0));
  }
  const side = LOCATION_TO_SIDE[hitLocation] || "";
  const pills = critEffect ? parseCritEffectPills(critEffect) : [];
  return `<div class="dmg-critical-block">
    <b>Критический урон</b> · отрицательные раны: <b>${newCritical}</b> · ${hitLocation}
    ${critEffect ? `<div class="roll-crit-effect">${critEffect}</div>` : ""}
    ${critPillsHtml(pills, actor.uuid, 0, { side })}
    ${critEffect ? critCharDamageHtml(critEffect, actor.uuid) : ""}
    ${critEffect ? dropButtonHtml(critEffect, actor.uuid, side) : ""}
    ${critEffect ? deathButtonHtml(critEffect, actor.uuid, "") : ""}
  </div>`;
}
