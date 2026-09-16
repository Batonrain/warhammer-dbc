// module/rules/unseen-talents.mjs
//
// Незримое (wdbc-1rno.2) — слой Талантов/Черт, завязанных на общий примитив
// module/rules/unseen-attack.mjs, но НЕ входивших в ядро (ядро — только
// сам гейт + засечение). Здесь — узнавание конкретных предметов по имени,
// чистая логика без Foundry-бросков (те — в module/combat/unseen-attack.mjs).
//
// itemHasName вызывается literal-строкой в КАЖДОЙ функции отдельно (не
// через общий rest-param хелпер) — tools/capability-reachability.mjs
// разбирает достижимость возможностей регуляркой по литералам аргументов
// itemHasName(...); обёртка с ...names спрятала бы имена за переменной и
// сделала бы этот слой ложно «недосягаемым» (test/tools/
// capability-reachable-ratchet.test.mjs) — тот же приём, что уже
// используется у hasWarpSight (module/rules/unseen-attack.mjs).
//
// Sixth Sense / Шестое Чувство (талант, Требования Awareness+30): «Когда
// персонаж получает попадание с типом Незримое, он может потратить Очко
// Бесчестия, чтобы Избежать от него как обычно и до начала своего
// следующего Хода сохранить способность Избегать от Незримых атак.» —
// персистентный бонус (markUnseenDetectedUntilNextTurn), в отличие от
// Music of Battle ниже.
//
// Music of Battle / Музыка Битвы (черта, Элитный архетип Воин Ноты):
// «...если он получает попадание, от которого не может Уклоняться
// (незримое, врасплох, после Финта, от Таланта, что не даёт Избегать),
// может потратить Очко Бесчестия, чтобы Уклониться как обычно» — РАЗОВЫЙ
// обход (решение 16.09.2026, wdbc-1rno.2): реализована только ветка
// «незримое» — «врасплох»/«после Финта»/«блокирующий Талант» нигде в
// системе не хранятся отдельными проверяемыми флагами (Врасплох — ручная
// галочка ГМа в диалоге атаки, не состояние актора), гейтить по ним нечем.
// Персистентности (в отличие от Sixth Sense) книга не обещает.
//
// Blind Fighting / Бой Вслепую (талант): «...Он также может Избегать от
// Незримых атак в рукопашной со штрафом −20.» — НЕ обход постфактум, а
// альтернативный канал доступности Уклонения: кнопка Уклонения рендерится
// как ОБЫЧНАЯ (не disabled), только с доп. −20, без всякого теста
// засечения. Только рукопашные атаки (RAW).

import { itemHasName } from "./predicates.mjs";

const isTalentOrTrait = item => item?.type === "talent" || item?.type === "trait";

/** Sixth Sense / Шестое Чувство — обход Незримого ценой Очка Бесчестия, с персистентностью. */
export function hasSixthSense(actor) {
  return (actor?.items ?? []).some(item => isTalentOrTrait(item) &&
    (itemHasName(item, "Sixth Sense") || itemHasName(item, "Шестое Чувство")));
}

/** Music of Battle / Музыка Битвы — разовый обход Незримого ценой Очка Бесчестия. */
export function hasMusicOfBattle(actor) {
  return (actor?.items ?? []).some(item => isTalentOrTrait(item) &&
    (itemHasName(item, "Music of Battle") || itemHasName(item, "Музыка Битвы")));
}

/** Blind Fighting / Бой Вслепую — Избегание Незримой атаки в рукопашной без засечения, −20. */
export function hasBlindFighting(actor) {
  return (actor?.items ?? []).some(item => isTalentOrTrait(item) &&
    (itemHasName(item, "Blind Fighting") || itemHasName(item, "Бой Вслепую")));
}

// Backstab / Удар в Спину (талант): «Нанося попадание незримой Избирательной
// атакой ножом (например, со спины, проведя весь Ход вне поля зрения цели),
// персонаж удваивает базовые кубики урона этой атаки (нож 1d5 → 2d5)».
//
// «Незримой» здесь — ТОТ ЖЕ общий тип атаки стр. 32, читается как
// unseen-параметр attack.mjs (structural wp.unseen ИЛИ Сокрытая Угроза).
// Честная граница: книга приводит «со спины, весь Ход вне поля зрения» как
// САМЫЙ ЧАСТЫЙ способ получить Незримое для этого случая (общее правило
// «Скрытная Атака», стр. 32) — геометрия обзора/фактического нахождения
// атакующего в поле зрения цели весь Ход в системе не считается нигде
// (нет учёта facing по времени), поэтому Backstab сработает только когда
// Незримость атаки пришла ИЗВЕСТНЫМ движку источником (wp.unseen у
// оружия/психосилы/Техночуда, Сокрытая Угроза) — не от голой позиции.
export function hasBackstab(actor) {
  return (actor?.items ?? []).some(item => isTalentOrTrait(item) &&
    (itemHasName(item, "Backstab") || itemHasName(item, "Удар в Спину")));
}

/** Нож — тем же признаком, что initiative.mjs::fastestHandBonus (weaponClass "melee" + meleeCategory "Нож"). */
export function isKnifeWeapon(item) {
  const sys = item?.system;
  return sys?.weaponClass === "melee" && sys?.meleeCategory === "Нож";
}

/**
 * Sniper Assassin / Снайпер-Убийца (талант, Требования BS 50): «Когда
 * персонаж делает одиночный выстрел из оружия со свойством Accurate после
 * Полного Прицеливания, выстрел получает свойство Незримое и может
 * получать до 4-х дополнительных кубиков урона за Успехи на попадание
 * вместо обычных 2-х (на 3, 5, 7 и 9 Успехов)».
 *
 * Условие полностью детерминировано существующими данными атаки — не
 * требует новой decl/UI: rofMode==="single" (одиночный выстрел),
 * wp.accurate (свойство Меткое на оружии), actor.system.aiming==="full"
 * (то же поле, что читает sheets/attack-dialog.mjs для бонуса Полного
 * Прицеливания — персистентное состояние актора, не параметр диалога).
 */
export function hasSniperAssassin(actor) {
  return (actor?.items ?? []).some(item => isTalentOrTrait(item) &&
    (itemHasName(item, "Sniper Assassin") || itemHasName(item, "Снайпер-Убийца")));
}

// Blindside / Из Слепой Зоны (талант, Требования A 40, Stealth+20): «Раз в
// Ход при численном преимуществе персонаж может ментальным свободным
// действием пройти Stealth(A)+0 vs Awareness(P)+0. При победе, если его
// следующее действие — атака ножом по этой цели, эта атака считается
// Незримой.»
//
// Честная граница (wdbc-1rno.2): «численное преимущество» нигде в системе
// не считается (нет примитива «свои vs чужие в радиусе/сцене»), а встречный
// тест Stealth(A) vs Awareness(P) против ПРОИЗВОЛЬНОГО токена-цели не
// ложится ни в один существующий диалог (opposedAuto — для делегирования
// СВОЕГО теста другому игроку, не для встречного теста ПРОТИВ выбранной
// цели прямо с листа). Кнопка предмета (пак: kind:"script") метит цель
// БЕЗ авто-теста — тот же уровень доверия столу, что у ручной галочки
// «Врасплох» в диалоге атаки (devourer-of-time.mjs).
const BLINDSIDE_MARK_FLAG = "blindsideMark";
const BLINDSIDE_USE_FLAG = "blindsideUsedThisTurn";

/** Помечена ли ИМЕННО эта цель предыдущим успешным «Из Слепой Зоны». */
export function isBlindsideMarked(actor, targetUuid) {
  const mark = actor?.getFlag?.("warhammer-dbc", BLINDSIDE_MARK_FLAG);
  return !!(mark && targetUuid && mark.targetUuid === targetUuid);
}

/** Ставит метку — кнопка предмета после (не проверяемых движком) встречного теста и численного преимущества. */
export async function markBlindside(actor, targetUuid) {
  await actor.setFlag("warhammer-dbc", BLINDSIDE_MARK_FLAG, { targetUuid });
}

/** Снимает метку — на атаке ножом по помеченной цели (attack.mjs), успешной или нет. */
export async function consumeBlindsideMark(actor) {
  if (actor?.getFlag?.("warhammer-dbc", BLINDSIDE_MARK_FLAG)) await actor.unsetFlag("warhammer-dbc", BLINDSIDE_MARK_FLAG);
}

/** «Раз в Ход» — уже использовано в текущем Ходу этого актора? (гейт кнопки, не этого файла). */
export function blindsideUsedThisTurn(actor) {
  return !!actor?.getFlag?.("warhammer-dbc", BLINDSIDE_USE_FLAG);
}

/** Начало следующего Хода носителя (module/hooks.mjs::updateCombat) — снимает разовый гейт. */
export async function clearBlindsideUse(actor) {
  if (actor?.getFlag?.("warhammer-dbc", BLINDSIDE_USE_FLAG)) await actor.unsetFlag("warhammer-dbc", BLINDSIDE_USE_FLAG);
}
