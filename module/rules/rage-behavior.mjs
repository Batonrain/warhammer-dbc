// module/rules/rage-behavior.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПОВЕДЕНИЕ ЯРОСТИ (Sahara focused-wrath-20-bs, п.2; решения владельца
//  27.10.2026 — автоматизировать). Числа Ярости — rules/rage.mjs; здесь то, что
//  раньше оставалось «решает стол».
//
//  Книга (корбук, Таланты «Берсерк», Frenzy / Ярость): «В Ярости персонаж …
//  обязан двигаться к ближайшему доступному видимому противнику и атаковать его
//  в рукопашной, если только это не очевидно суицидальный шаг, не может
//  совершать Избегания, Ментальные действия и общаться иначе, чем
//  нечленораздельными воплями, автоматически проваливая все тесты на
//  социальные взаимодействия, кроме Запугивания. Псайкеры не способны
//  манифестировать психосилы, находясь в Ярости, и должны в начале каждого Хода
//  проходить тест на W+0, чтобы не прекратить поддержание всех уже
//  манифестированных психосил. Ярость длится до тех пор, пока персонаж не
//  выйдет из неё тестом на W+0 (не более одной попытки в Ход), или потеряет
//  сознание. По завершении боя персонаж получает бонус +10 на тест выхода из
//  Ярости за каждый Ход после боя. Если он проваливает тест на выход, он обязан
//  атаковать других, приоритизируя сначала сдавшихся, беспомощных или
//  обезоруженных врагов, потом союзных NPC и игроков. Он теряет бонус за конец
//  боя, если его союзники или пленники пытаются атаковать его, но их попытки
//  Избеганий не снимают бонус. Однажды выйдя из Ярости, персонаж не может снова
//  войти в неё до конца боя, кроме как с помощью наркотиков или психосил.»
//
//  Cold Fury / Холодная Ярость: свободно говорит и совершает ментальные
//  действия, психосилы можно манифестировать и поддерживать со штрафом −10 на
//  психотесты (rules/rage.mjs), переброс неудачной попытки выйти из Ярости.
//  Battle Rage / Боевой Гнев: в Ярости можно Парировать; «с позволения ГМа» +30
//  на попытки выйти. Модуль Агрессии Скитария: Избегания в Ярости «без обычных
//  ограничений» и автоуспех на тесте выхода.
//
//  ── Что где живёт ──
//    Избегания          combat/full-attack-lock.mjs::avoidanceVerdict (Уклонение,
//                       Парирование, верхом), combat/rage-behavior.mjs (прочие
//                       Избегания: Парирование психосилы, Сжатие, Вираж, Шагоход);
//    Ментальные действия, психосилы — rules/predicates.mjs::isMentalActionBlocked
//                       (манифестация, sheets/tabs/psychic.mjs) и
//                       combat/action-economy.mjs::actionBlockReason (траты ОД и
//                       Реакций, помеченные physical:false);
//    речь                sheets/actor-sheet.mjs::_runTest (автопровал);
//    начало Хода         combat/rage-behavior.mjs::processRageTurnStart (тест
//                       поддержания, напоминание), hooks.mjs::updateCombat;
//    выход из Ярости     combat/rage-behavior.mjs::attemptRageExit.
//
//  Файл НЕ источник правил и не импортируется из rules/sources.mjs: ему можно
//  спрашивать hasRuleFlag. Круг (AGENTS.md, «Источники правил») замкнул бы
//  только обратный импорт — из rules/rage.mjs сюда, поэтому rage.mjs этот файл
//  не трогает.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";
import { hasAbility } from "./ability-by-key.mjs";
import { isSocialSkill } from "./resolve-test.mjs";
import { isInRage, rageBlocksMental } from "./rage.mjs";
import { SECONDS_PER_ROUND } from "./condition-duration.mjs";

/** Метка Хода: попытка выйти из Ярости в этом Ходу уже была (turn-flags.mjs гасит её в начале СВОЕГО Хода). */
export const RAGE_EXIT_TRIED_FLAG = "rageExitTried";
/** Метка актора: попытка выйти провалена — «обязан атаковать других». Гаснет вместе с Яростью. */
export const RAGE_EXIT_FAILED_FLAG = "rageExitFailed";
/** Метка актора: бой кончился, а Ярость осталась — { at: worldTime, lost: бонус за конец боя потерян }. */
export const RAGE_AFTER_COMBAT_FLAG = "rageAfterCombat";
/** Ключ карточки (card-once.mjs): переброс неудачной попытки выйти — Холодная Ярость, раз на карточку. */
export const RAGE_EXIT_REROLL_CARD_FLAG = "rageExitRerolled";

/** Возможность Модуля Агрессии: «Избегания в Ярости без обычных ограничений». */
export const RAGE_FREE_AVOIDANCE_CAPABILITY = "rage.avoidWithoutLimit";
/** Возможность Модуля Агрессии: «автоматический Успех на тестах для выхода из Ярости». */
export const RAGE_EXIT_AUTO_CAPABILITY = "rage.exitAutoSuccess";

/** Книга: «+10 на тест выхода из Ярости за каждый Ход после боя». */
export const RAGE_EXIT_TURN_BONUS = 10;
/** Боевой Гнев: «с позволения ГМа +30 на попытки выйти из Ярости». */
export const RAGE_EXIT_BATTLE_RAGE_BONUS = 30;

/**
 * Сторона встречного теста, проваленная автоматически: минимальный провал (1 степень), Порог 0. Инициатор побеждает
 * по обычным правилам resolveOpposed; «0 Успехов» книги — это отсутствие успеха, а не нулевая степень провала.
 */
export const RAGE_AUTOFAIL_SIDE = Object.freeze({ success: false, deg: 1, threshold: 0 });

/** Талант Боевой Гнев — по имени (в паке без записи Конструктора) ИЛИ по ключу Возможности. */
export function hasBattleRage(actor) {
  return hasAbility(actor, "berserker.core.battleRage", "Battle Rage", "talent");
}

/** Модуль Агрессии (и всё, что даст ту же возможность): Избегания в Ярости не запрещены. */
export function hasFreeRageAvoidance(actor) {
  return hasRuleFlag(actor, RAGE_FREE_AVOIDANCE_CAPABILITY);
}

/** Модуль Агрессии: выход из Ярости удаётся без броска. */
export function hasRageExitAutoSuccess(actor) {
  return hasRuleFlag(actor, RAGE_EXIT_AUTO_CAPABILITY);
}

const AVOIDANCE_LABELS = { dodge: "Уклонение", parry: "Парирование", evade: "Избегание" };

/**
 * Можно ли в Ярости совершить Избегание.
 *
 * @param {object} actor
 * @param {"dodge"|"parry"|"evade"} kind  dodge — Уклонение (в т.ч. верхом и Шагохода),
 *   parry — любое Парирование (оружием, психосилы), evade — прочие Избегания
 *   (Сжатие, Вираж, Акробатика против шаблона)
 * @returns {{blocked:boolean, reason:string}}  blocked — отказ, Реакция при этом не тратится
 */
export function rageAvoidanceVerdict(actor, kind = "evade") {
  const open = { blocked: false, reason: "" };
  if (!isInRage(actor)) return open;
  if (hasFreeRageAvoidance(actor)) return open;
  if (kind === "parry" && hasBattleRage(actor)) return open;
  const what = AVOIDANCE_LABELS[kind] ?? AVOIDANCE_LABELS.evade;
  const hint = kind === "parry"
    ? " Парировать в Ярости может только носитель Таланта Боевой Гнев (Battle Rage)."
    : "";
  return {
    blocked: true,
    reason: `${what} невозможно: в Ярости персонаж не может совершать Избегания.${hint}`
  };
}

/**
 * Тест социального Навыка (или Общительности без Навыка) в Ярости проваливается
 * сам: «общаться иначе, чем нечленораздельными воплями». Запугивание — исключение
 * книги; Холодная Ярость говорить разрешает.
 */
export function rageSocialAutoFail(actor, { skill = null, char = null } = {}) {
  if (!rageBlocksMental(actor)) return false;
  if (skill) return isSocialSkill(skill) && skill !== "intimidate";
  return char === "fel";
}

/** Есть ли у актора поддерживаемая психосила — ради неё в начале Хода идёт тест W+0. */
export function sustainedPowers(actor) {
  return [...(actor?.items ?? [])].filter(i => i?.type === "psychicPower" && i.system?.isSustained);
}

/**
 * В начале Хода нужен тест W+0 на сохранение поддержания: в Ярости и есть что поддерживать.
 * Холодная Ярость тест снимает (решение владельца 27.10.2026): Талант «поддерживает психосилы в Ярости»,
 * цена — только −10 на психотесты (rules/rage.mjs::rageRules).
 */
export function rageSustainTestNeeded(actor) {
  return rageBlocksMental(actor) && sustainedPowers(actor).length > 0;
}

// ── Попытка выхода из Ярости ──────────────────────────────────────────────────

/** Номер «Хода» вне боя: 6 секунд игрового времени (Раунд Foundry). */
export const worldTurnIndex = worldTime => Math.floor((Number(worldTime) || 0) / SECONDS_PER_ROUND);

/**
 * Значение метки «попытка выхода была» — что записать на актора.
 * В бою метка живёт до начала СВОЕГО Хода (rules/turn-flags.mjs), вне боя «Ход» —
 * 6 секунд игрового времени, поэтому рядом пишется номер такого Хода.
 */
export function rageExitTriedStamp({ combatId = "", worldTime = 0 } = {}) {
  return { combatId: combatId || "", turn: worldTurnIndex(worldTime) };
}

/**
 * Можно ли сейчас пробовать выйти: «не более одной попытки в Ход».
 * @param {object|null} tried  значение метки (rageExitTriedStamp) или пусто
 */
export function rageExitAttemptAllowed(tried, { combatId = "", worldTime = 0 } = {}) {
  if (!tried || typeof tried !== "object") return true;
  if (combatId) return tried.combatId !== combatId;      // метка этого боя = попытка уже была в этом Ходу
  if (tried.combatId) return true;                       // метка прошлого боя, боя больше нет — новый «Ход»
  return tried.turn !== worldTurnIndex(worldTime);
}

/** Сколько полных Ходов прошло после конца боя (0, если бой не заканчивался с этой Яростью). */
export function turnsAfterCombat(afterCombat, worldTime) {
  // Number(null) === 0: метка «бонус потерян» без момента боя иначе считалась бы концом боя в нулевую секунду.
  if (afterCombat?.at == null) return 0;
  const at = Number(afterCombat.at);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, worldTurnIndex(worldTime) - worldTurnIndex(at));
}

/**
 * Слагаемые Порога теста выхода из Ярости (кроме самой W и модификаторов правил).
 *
 * @param {object} o
 * @param {number} o.turns       Ходов после боя
 * @param {boolean} o.bonusLost  союзники/пленники пытались напасть — бонус за конец боя потерян
 * @param {boolean} o.battleRage ГМ разрешил +30 Боевого Гнева
 * @param {object} o.actor       носитель (+30 даёт только Талант)
 * @returns {{label:string, value:number}[]}
 */
export function rageExitParts({ turns = 0, bonusLost = false, battleRage = false, actor = null } = {}) {
  const parts = [];
  const t = Math.max(0, Math.floor(Number(turns) || 0));
  if (t > 0 && !bonusLost) parts.push({ label: `${t} ${turnWord(t)} после боя`, value: RAGE_EXIT_TURN_BONUS * t });
  if (battleRage && hasBattleRage(actor)) parts.push({ label: "Боевой Гнев (с позволения ГМа)", value: RAGE_EXIT_BATTLE_RAGE_BONUS });
  return parts;
}

function turnWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "Ход";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "Хода";
  return "Ходов";
}

// ── Напоминание «двигаться к врагу» ───────────────────────────────────────────

/**
 * Выбор цели для напоминания.
 * @param {{name:string, distance:number, relation:"enemy"|"ally"|"neutral", helpless?:boolean}[]} candidates
 *   видимые токены сцены (сам персонаж не входит)
 * @param {{failedExit?:boolean}} o
 *   failedExit=false — ближайший видимый враг;
 *   failedExit=true  — по книге: сперва беспомощные враги, затем прочие враги,
 *   затем союзники (NPC и игроки).
 * @returns {{name:string, distance:number, relation:string}|null}
 */
export function pickRageTarget(candidates, { failedExit = false } = {}) {
  const byDistance = (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity);
  const pool = [...(candidates ?? [])].filter(c => c && c.name);
  const enemies = pool.filter(c => c.relation === "enemy").sort(byDistance);
  if (!failedExit) return enemies[0] ?? null;
  const helpless = enemies.filter(c => c.helpless);
  if (helpless.length) return helpless[0];
  if (enemies.length) return enemies[0];
  return pool.filter(c => c.relation === "ally").sort(byDistance)[0] ?? null;
}

/** Строка напоминания в чат в начале Хода персонажа в Ярости. */
export function rageTurnReminderText({ target = null, failedExit = false } = {}) {
  const where = target
    ? ` — ${failedExit ? "ближайшая цель" : "ближайший"}: ${target.name}${Number.isFinite(target.distance) ? `, ${Math.round(target.distance * 10) / 10} м` : ""}`
    : "";
  if (failedExit) {
    return "Ярость: не вышел из Ярости — обязан атаковать других (приоритет: сдавшиеся, беспомощные и обезоруженные "
      + `враги; затем союзные NPC и игроки)${where}`;
  }
  return `Ярость: обязан двигаться к ближайшему видимому противнику и атаковать в рукопашной${where}`;
}
