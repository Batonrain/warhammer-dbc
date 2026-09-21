// module/rules/unseen-attack.mjs
//
// Незримое / Unseen (wdbc-1rno.2, core.json стр. 32): «Незримое – подтип
// атаки, обычно присущий психосилам и Техно-чудесам Механикум, и
// показывающий, что действие не заметно для обычных человеческих чувств.
// Персонажи могут совершать Избегание от этой атаки только если они
// засекли ее альтернативными методами (обычно пси-чутьем или ноосферным
// сканированием соответственно)».
//
// Это ЯДРО общего примитива — только он, без завязки Талантов (Sixth
// Sense/Blind Fighting/Blindside/Hair Trigger/Sniper Assassin/Backstab/
// Defensive Rider/Music of Battle), которые остаются capability-
// заглушками до отдельного прохода (wdbc-1rno, слой «таланты»).
//
// Источник признака «эта атака Незримая»:
//   1. wp.unseen — структурное свойство оружия/психосилы/Техночуда
//      (weaponProps ключ "unseen", constants/weapon-properties.mjs) —
//      проставляется по книжному тексту КАЖДОЙ конкретной записи
//      индивидуально (см. capabilities.mjs/пак-предметы; общего дефолта
//      «все психосилы Незримые» НЕТ — проверено разведкой wdbc-1rno.2:
//      у части техночудес/психосил «Незримое» в строке «Тип:» отсутствует).
//   2. Сокрытая Угроза/Hidden Threat (wdbc-1rno.1, rules/hidden-threat.mjs)
//      — разовая метка атакующего, читается отдельно (module/combat/
//      attack.mjs уже это делает, здесь не дублируется).
//
// Три штатных способа засечь:
//   1. Реактивный тест Психонауки/Техпользования В ОТВЕТ на конкретную
//      атаку — module/combat/unseen-attack.mjs::_performUnseenDetect.
//      Разовый: не переживает саму атаку, поэтому в персистентный флаг
//      этого файла не попадает вовсе (клиентский разблок кнопки в той же
//      карточке — attack-card.mjs/hooks.mjs).
//   2. Проактивное Ноосферное Сканирование (Tech-Use+0, раз в Раунд,
//      module/sheets/tabs/tech.mjs) — книга прямо говорит «остаётся
//      активным до начала следующего Хода» — это и есть persistent-флаг
//      ниже (markUnseenDetectedUntilNextTurn/isUnseenDetected).
//   3. Пассивное Варп-Зрение (книжный трейт, НЕ «Медуза»-трейт с тем же
//      именем — см. hasWarpSight) — автоматически засекает Незримые
//      ПСИХИЧЕСКИЕ атаки, без теста и без срока действия.
//
// Sixth Sense (тратит Очко Бесчестия, чтобы Избежать УЖЕ засчитанного
// попадания задним числом, и получает ту же персистентность до начала
// следующего Хода) и Blind Fighting (Избегание Незримой атаки в рукопашной
// со штрафом −20 БЕЗ засечения) — не этот файл: оба меняют не «засечена
// ли атака», а «нужно ли вообще её засекать», это capability-заглушки
// отдельного прохода.

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";
const DETECTED_FLAG = "unseenDetectedUntilNextTurn";

/** Эта атака — Незримая (structural-флаг оружия/психосилы/Техночуда). */
export function isUnseenAttack(wp) {
  return !!wp?.unseen;
}

/**
 * Пассивное Варп-Зрение (книжный трейт core.json: «автоматически засекает
 * Незримые психические атаки») — НЕ путать с одноимённым флейвор-трейтом
 * «Медуза»/«Дар: Варп-Зрение» (числового правила не несут, см. wdbc-1rno.2
 * дочерний тикет про транскрибирование). Различить программно нечем —
 * оба называются «Warp Sight / Варп-Зрение» — поэтому этот хелпер честно
 * засекает ПО ИМЕНИ ЛЮБОЙ предмет с этим именем: у флейвор-вариантов
 * побочный эффект «тоже начинает засекать Незримые психические атаки» не
 * противоречит книге (они лишь не несли правило явно в своём тексте, не
 * отрицали его).
 */
export function hasWarpSight(actor) {
  return (actor?.items ?? []).some(item =>
    (item?.type === "trait" || item?.type === "talent") &&
    (itemHasName(item, "Warp Sight") || itemHasName(item, "Варп-Зрение")));
}

/**
 * Electroepithany/Электропрозрение (Техночудо): «Отключает обычное зрение,
 * давая Unnatural Senses (P) (незримые электро/магнитные эффекты)» —
 * альтернативный канал засечения радиационной разновидности Незримого
 * (Irrad Cleanser/Irradiation Engine/Voltagheist Retribution — «Незримо,
 * если цель не может засекать радиацию», wp.radiationSourced). В отличие
 * от Варп-Зрения это АКТИВИРУЕМОЕ Техночудо — засекает только пока
 * поддерживается (system.sustained), не просто по факту владения.
 */
export function hasRadiationDetection(actor) {
  return (actor?.items ?? []).some(item =>
    item?.type === "techPower" && item?.system?.sustained &&
    (itemHasName(item, "Electroepithany") || itemHasName(item, "Электропрозрение")));
}

/**
 * Уже засечена ли Незримая атака этим защищающимся — персистентно
 * (Ноосферное Сканирование, до начала следующего Хода) или пассивно
 * (Варп-Зрение — только против психических источников; Электропрозрение —
 * только против радиационных, wp.radiationSourced). Разовый реактивный
 * детект сюда не попадает — он открывает Уклонение/Парирование только для
 * ТОЙ атаки (клиентский код карточки, не этот флаг).
 */
export function isUnseenDetected(actor, { isPsychic = false, isRadiation = false } = {}) {
  if (isPsychic && hasWarpSight(actor)) return true;
  if (isRadiation && hasRadiationDetection(actor)) return true;
  return !!actor?.getFlag?.(NS, DETECTED_FLAG);
}

/** Успешное Ноосферное Сканирование — держится до начала следующего Хода. */
export async function markUnseenDetectedUntilNextTurn(actor) {
  await actor.setFlag(NS, DETECTED_FLAG, true);
}

/** Начало следующего Хода носителя (module/hooks.mjs::updateCombat) — снимает метку. */
export async function clearUnseenDetection(actor) {
  if (actor?.getFlag?.(NS, DETECTED_FLAG)) await actor.unsetFlag(NS, DETECTED_FLAG);
}
