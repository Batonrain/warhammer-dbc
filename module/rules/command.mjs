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

/**
 * Почему до КОНКРЕТНОГО подчинённого не доходит ничего из Командования —
 * ни Команды, ни Присутствие («Раны и Урон», «Статусы», wdbc-x1nz.2.90):
 *  - Без сознания — «не может видеть и слышать других»: не слышит приказа и
 *    не видит жеста, исключений книга не даёт;
 *  - Оглох — «не может получать эффектов Командования, если только его
 *    командир не отдаёт приказы языком жестов, телепатически, или через
 *    Ноосферу». Исключение — возможность communication.deafExempt (grantFlag
 *    на самом подчинённом, как и было, wdbc-r5o7.6).
 *
 * @returns {string} подпись причины («Оглох»/«Без сознания») или "" — доходит
 */
export function commandBlockReason(actor) {
  const c = actor?.system?.conditions;
  if (c?.unconscious) return "Без сознания";
  if (c?.deafened && !hasRuleFlag(actor, "communication.deafExempt")) return "Оглох";
  return "";
}

/**
 * Доходит ли конкретное преимущество Присутствия до этого актора. `actor`
 * необязателен (старые вызовы по одному типу): с ним учитываются Оглох/Без
 * сознания (commandBlockReason) — Присутствие тоже эффект Командования.
 */
export function receivesPresence(actorType, benefitKey, actor = null) {
  if (commandBlockReason(actor)) return false;
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
  // Оглох/Без сознания (wdbc-x1nz.2.90) — см. commandBlockReason.
  if (commandBlockReason(actor)) return false;
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
 * @param {object} [actor] сам подчинённый — нужен для per-актор
 *   исключений (Оглох, Без сознания — commandBlockReason); без него
 *   учитывается только тип.
 * @returns {{presence:string[], presenceApplies:boolean, commands:boolean,
 *            blockedBy:string, healsPsych:boolean, forcedMove:boolean, notes:string[]}}
 */
export function commandReachFor(actorType, benefitKey = "", actor = null) {
  // Оглох/Без сознания (wdbc-x1nz.2.90): не доходит ВСЁ — и Команды, и
  // Присутствие. Раньше Присутствие глухоту не проверяло вовсе.
  const blockedBy = commandBlockReason(actor);
  const presence = blockedBy ? [] : presenceBenefitsFor(actorType);
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
  if (blockedBy === "Оглох")
    notes.push("Оглох: не получает Команды и Присутствие (кроме жестов/телепатии/Ноосферы).");
  if (blockedBy === "Без сознания")
    notes.push("Без сознания: не видит и не слышит — ни Команды, ни Присутствие не доходят.");

  return {
    presence,
    // Без выбранного преимущества «доходит ли Присутствие вообще» — у
    // Оглохшего/Без сознания нет (раньше !benefitKey давал true всем).
    presenceApplies: blockedBy ? false : (!benefitKey || presence.includes(benefitKey)),
    blockedBy,
    commands,
    healsPsych: commandHealsPsych(actorType),
    forcedMove: canBeForcedToMove(actorType),
    notes
  };
}
