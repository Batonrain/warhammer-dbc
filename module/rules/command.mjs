// module/rules/command.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЧТО ПОДЧИНЁННЫЙ ПОЛУЧАЕТ ОТ КОМАНДОВАНИЯ — чистые функции, без Foundry.
//
//  Команды нигде не пишутся на подчинённых: их состояние живёт у отдающего, а
//  подчинённые читают карточку в чате. Значит вопрос всегда один — что из
//  отданного вообще доходит до конкретного актора. У Орды ответ особый: она
//  «не получает эффектов Командования, кроме эффектов 1 и 3 Командного
//  Присутствия», а тесты Командования умеют только лечить ей психологический
//  урон.
//
//  Правило одно на два пути: и на состав Отряда, и на свободный список
//  «Под моим Присутствием» у командира-персонажа.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

/**
 * Ключи преимуществ Командного Присутствия в порядке книги.
 * 1 — Экстремальный Урон, 2 — Концентрация огня, 3 — Воля Командира.
 * Порядок значим: правила ссылаются на них номерами.
 */
export const PRESENCE_ORDER = ["extreme", "focus", "morale"];

/** Номер преимущества по книге (1-3) — для подписей «эффект 2». */
export function presenceNumber(key) {
  const idx = PRESENCE_ORDER.indexOf(key);
  return idx < 0 ? 0 : idx + 1;
}

/**
 * Какие преимущества Присутствия доходят до актора этого типа.
 *
 * Орде — только 1-е и 3-е: Концентрация огня строит «Тройки» из отдельных
 * бойцов, а толпа и так бьёт всей массой (её собственные бонусы за Магнитуду
 * заменяют концентрацию).
 */
export function presenceBenefitsFor(actorType) {
  if (actorType === "horde") return ["extreme", "morale"];
  return [...PRESENCE_ORDER];
}

/** Доходит ли конкретное преимущество Присутствия до этого актора. */
export function receivesPresence(actorType, benefitKey) {
  return presenceBenefitsFor(actorType).includes(benefitKey);
}

/**
 * Доходят ли до актора Короткие и Детальные Команды.
 *
 * До Орды — нет: «не получает эффектов Командования, кроме эффектов 1 и 3
 * Командного Присутствия». Единственное, на что годится тест Командования по
 * Орде, — вернуть ей психологический урон (см. commandHealsPsych).
 *
 * Оглох (стр. 30-31, wdbc-r5o7.6): «не получает эффектов Командования, кроме
 * жестов/телепатии/Ноосферы» — та же идея («не слышит устные команды»), но
 * per-АКТОР, а не per-тип, поэтому второй параметр опционален (Отряд как
 * список типов эту проверку не касается, только конкретный подчинённый).
 * Исключение — возможность communication.deafExempt (grantFlag, ещё не
 * выдаётся ни одним правилом книги — читатель заведён заранее для будущих
 * Талантов/трейтов на телепатию/жесты, тем же приёмом, что и прочие
 * capability-флаги этого файла).
 */
export function receivesCommands(actorType, actor = null) {
  if (actorType === "horde") return false;
  if (actor?.system?.conditions?.deafened && !hasRuleFlag(actor, "communication.deafExempt")) return false;
  return true;
}

/** Лечит ли успешный тест Командования психологический урон этому актору. */
export function commandHealsPsych(actorType) {
  return actorType === "horde";
}

/**
 * Действуют ли на актора эффекты, смещающие его против воли (Давление, Отскок,
 * командные сдвиги строя). На Орду — нет: сдвинуть толпу нельзя.
 */
export function canBeForcedToMove(actorType) {
  return actorType !== "horde";
}

/**
 * Бонус актора к тесту против Подавления. Подавление на Ордах работает, но они
 * получают бонус, равный Магнитуде: залп по толпе теряется в толпе.
 */
export function suppressionBonus(actor) {
  if (actor?.type !== "horde") return 0;
  return Math.max(0, Number(actor?.system?.magnitude?.value) || 0);
}

/**
 * Полная сводка по одному подчинённому: что до него доходит и что нет.
 * Её показывают и лист Отряда, и панель «Под моим Присутствием».
 *
 * @param {string} actorType
 * @param {string} [benefitKey] выбранное сейчас преимущество Присутствия
 * @param {object} [actor] сам подчинённый — нужен только для per-актор
 *   исключений (Оглох, wdbc-r5o7.6); необязателен, Отряд как список типов
 *   его не передаёт вовсе.
 * @returns {{presence:string[], presenceApplies:boolean, commands:boolean,
 *            healsPsych:boolean, forcedMove:boolean, notes:string[]}}
 */
export function commandReachFor(actorType, benefitKey = "", actor = null) {
  const presence = presenceBenefitsFor(actorType);
  const notes = [];

  if (actorType === "horde") {
    notes.push("Орде доходят только эффекты 1 и 3 Командного Присутствия.");
    notes.push("Короткие и Детальные Команды на Орду не действуют.");
    notes.push("Тест Командования по Орде лечит ей психологический урон.");
    notes.push("Смещающие против воли эффекты на Орду не действуют.");
    notes.push("Подавление работает, но Орда получает бонус, равный Магнитуде.");
    if (benefitKey && !presence.includes(benefitKey))
      notes.push(`Выбранное преимущество (эффект ${presenceNumber(benefitKey)}) до Орды не доходит.`);
  }

  const commands = receivesCommands(actorType, actor);
  if (actorType !== "horde" && !commands)
    notes.push("Оглох: не получает Короткие и Детальные Команды (кроме жестов/телепатии/Ноосферы).");

  return {
    presence,
    presenceApplies: !benefitKey || presence.includes(benefitKey),
    commands,
    healsPsych: commandHealsPsych(actorType),
    forcedMove: canBeForcedToMove(actorType),
    notes
  };
}
