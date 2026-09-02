// module/rules/mech-blocks.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Блок Requirement+Condition+Effect — единица вкладки МЕХАНИКА в новой
//  модели (doombc-req-condition-effect-plan). Предмет несёт МНОГО блоков;
//  каждый = опциональный Requirement (module/rules/requirements.mjs) +
//  обязательный Condition (module/rules/conditions.mjs) + минимум один
//  Effect (переиспользует СУЩЕСТВУЮЩИЙ формат entry.kind из
//  module/apps/mechanics.mjs как есть — новой Effect-логики тут нет и не
//  нужно, viz. blankMechEntry()/applyMechEntry() там же).
//
//  Этот модуль только СВЯЗЫВАЕТ три части и решает «сработает ли блок на
//  случившееся событие» — он НЕ применяет Effect сам (это по-прежнему
//  applyMechEntry() в mechanics.mjs, которую предстоит научить понимать
//  блоки — следующий шаг, не эта правка, см. подвал файла).
// ════════════════════════════════════════════════════════════════════════════

import { reqBlockMet } from "./requirements.mjs";
import { blankCondition, conditionMatches } from "./conditions.mjs";

/** Пустой блок — опциональный Requirement (null), Condition "при получении", 0 Effect. */
export function blankMechBlock() {
  return { requirement: null, condition: blankCondition("onGrant"), effects: [] };
}

/** Выполнен ли Requirement блока (нет Requirement — всегда true). */
export function blockRequirementMet(actor, block) {
  return !block?.requirement || reqBlockMet(actor, block.requirement);
}

/**
 * Полнота блока для сохранения: хотя бы один Effect обязателен (warning,
 * не блокировка — см. решение пользователя «нужен хотя бы один эффект,
 * без него выдавать warning»).
 */
export function blockHasEffect(block) {
  return Array.isArray(block?.effects) && block.effects.length > 0;
}

/**
 * Срабатывает ли блок целиком на случившееся событие: Requirement выполнен
 * (для актора, который сейчас получает/держит предмет) И Condition подходит
 * к событию.
 */
export function blockFires(actor, block, event) {
  return blockRequirementMet(actor, block) && conditionMatches(block?.condition, event);
}

/** Нормализованный список блоков предмета (новый флаг, аддитивно к mechanics/reqBlocks). */
export function getMechBlocks(item) {
  const arr = item?.flags?.["warhammer-dbc"]?.mechBlocks;
  return Array.isArray(arr) ? arr : [];
}

/** Все блоки предмета, которые сработали бы на это событие для этого актора. */
export function blocksFiring(actor, item, event) {
  return getMechBlocks(item).filter(b => blockFires(actor, b, event));
}

// ════════════════════════════════════════════════════════════════════════════
//  СЛЕДУЮЩИЙ ШАГ (НЕ в этой правке): applyMechEntry()/mechEffectData() в
//  mechanics.mjs должны научиться брать effects блока (тот же формат entry,
//  что и сейчас) и применять их, когда blockFires() истинно — т.е. связать
//  этот модуль с реальным применением, а не просто с чистой логикой «сработал
//  ли блок». Плюс живая врезка событий (см. подвал conditions.mjs) и UI на
//  вкладке МЕХАНИКА. Каждый — отдельный тикет, тот же файл сегодня активно
//  правят параллельные сессии.
// ════════════════════════════════════════════════════════════════════════════
