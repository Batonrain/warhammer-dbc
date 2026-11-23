// module/rules/craft-advantage.mjs
// ════════════════════════════════════════════════════════════════════════
//  Преимущество на тестах Крафта (wdbc-u0by, продолжение): «Кубик смены»
//  (стр. 26, module/apps/craft-workshop.mjs::diceMode) — уже готовый ручной
//  дропдаун Преимущество/Помеха, сюда просто вплетаются два Таланта, а не
//  строится новый механизм переброса.
//
//  Cyberpreacher / Киберпроповедник — «Преимущество на тесты имплантации
//  бионики/кибернетики» — ПАССИВНО, всегда, когда крафтер с этим Талантом
//  ведёт проект категории «Бионика и Мехадендриты» (CRAFT_CATEGORIES,
//  key:"bionics"). Уменьшение времени восстановления вдвое — НЕ покрыто
//  здесь: пост-операционное восстановление не часть резолва Крафта.
//
//  Slow Shift / Медленная Смена — «+4 часа смены → +30 и Преимущество» —
//  ВЫБОР игрока за смену (чекбокс на проекте), а не пассивный грант: время
//  само не тратится системой (в Мастерской нигде не тикает игровое время),
//  как и раньше — это остаётся на честном слове стола, отражается только в
//  +30/Преимуществе самого теста.
//
//  Journeyman / Подмастерье — «Когда персонаж ассистирует в тесте Крафта,
//  тот, кому он ассистирует, получает Преимущество на свой тест» — ГРАНТ НЕ
//  СЕБЕ, а крафтеру. ИСПРАВЛЕНО (wdbc-1rno): раньше module/apps/
//  craft-workshop.mjs::assistants было только ЧИСЛО без ссылок на акторов —
//  честный флаг на слово стола, не валидировался. Теперь у проекта Крафта
//  есть отдельное поле assistantId (ОДИН именованный ассистент, для
//  Талантов, не входит в общий счётчик assistants) — hasJourneyman/
//  hasDarkMuse ниже реально читают его инвентарь.
//
//  Dark Muse / Тёмная Муза (wdbc-1rno) — «Когда персонаж действует как
//  ассистент, он даёт бонус +20 вместо обычного +10. Если он ассистирует в
//  тесте крафта, бонус увеличивается до +30» — тот же именованный
//  assistantId, +30 в Мастерской (это всегда тест Крафта/Исследования),
//  «общие +20» — вне Мастерской, другая точка интеграции (обычный
//  ассистент диалога Навыка, module/rules/assists.mjs), здесь не покрыто.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { inVoidMark } from "./void-split.mjs";
import { isHaemonculus } from "../constants/haemonculus.mjs";
import { POLYMATH_CHAIN_MAX } from "../constants/craft.mjs";
import { craftedItemsOf, prototypingFor } from "./craft-memory.mjs";

const hasItem = (actor, type, name) =>
  !!actor?.items?.some(i => i.type === type && itemHasName(i, name));
const hasTalent = (actor, name) => hasItem(actor, "talent", name);

export const hasCyberpreacher = actor => hasTalent(actor, "Cyberpreacher");
export const hasSlowShiftTalent = actor => hasTalent(actor, "Slow Shift");
/** Polymath / Полимат (wdbc-1rno) — Мутация, не Талант. */
export const hasPolymath = actor => hasItem(actor, "mutation", "Polymath");
export const hasJourneyman = actor => hasTalent(actor, "Journeyman");
export const hasDarkMuse = actor => hasItem(actor, "mutation", "Dark Muse");

/** +30 от Тёмной Музы, когда именованный ассистент владеет Даром (в Мастерской — всегда тест Крафта/Исследования). */
export function darkMuseAssistBonus(assistantActor) {
  // Пустота Парии (task-f568): вдохновение Тёмного Принца не доходит — обычный ассистент.
  return hasDarkMuse(assistantActor) && !inVoidMark(assistantActor) ? 30 : 0;
}

/**
 * +10 от Полимата — безусловно на ЛЮБОЙ тест Крафта И Исследования (книга не
 * ограничивает категорией/навыком, в отличие от Киберпроповедника). Крит на
 * смене — отдельно, polymathCrit() ниже: это не флат-бонус, а крюк на исход
 * броска.
 */
export function polymathBonus(crafter) {
  return hasPolymath(crafter) ? 10 : 0;
}

/**
 * Критический Успех Полимата в Мастерской (task-b6b8): «1d5 Усталости и сразу
 * же ещё один тест, по сути работа двух смен в одну». Условие в тексте одно —
 * Критический Успех (натуральные 1–5, стр. 25), мастерство/5+ Успехов не
 * требуется.
 *
 * `step` — номер смены в цепочке (1 — та, что бросил игрок). `capped` — это
 * последняя разрешённая смена цепочки: Усталость за крит она получает, но
 * новой смены не запускает (POLYMATH_CHAIN_MAX — страховка от бесконечной
 * цепочки, см. constants/craft.mjs).
 *
 * @returns {{triggered:boolean, capped:boolean}}
 */
export function polymathCrit(crafter, critSuccess, step = 1) {
  const triggered = !!critSuccess && hasPolymath(crafter);
  return { triggered, capped: triggered && step >= POLYMATH_CHAIN_MAX };
}

/** Workaholic / Трудоголик (3-3a64) — Талант Крафта. */
export const hasWorkaholic = actor => hasTalent(actor, "Workaholic");
/** Fabricator / Фабрикатор (3-3a64) — Талант Крафта. */
export const hasFabricator = actor => hasTalent(actor, "Fabricator");
/** Prototyping / Прототипирование (3-3a64) — Талант Крафта. */
export const hasPrototyping = actor => hasTalent(actor, "Prototyping");

/**
 * Прототипирование для ЭТОГО проекта: переброс, Банк с вдвое меньшим
 * мультипликатором Качества, без −20 Улучшения — по журналу уже созданного
 * (rules/craft-memory.mjs). Только Крафт предмета: Исследование, ремонт
 * («Крафт предметов, которые он уже создавал») и безымянный проект — нет.
 * Без Таланта — всё false.
 */
export function prototypingEffects(crafter, proj) {
  const none = { known: false, reroll: false, halveBank: false, noImprovePenalty: false };
  if (!hasPrototyping(crafter) || proj?.mode !== "craft" || proj?.repair) return none;
  return prototypingFor(craftedItemsOf(crafter), proj?.title, proj?.quality);
}

/** Master Engineseer / Мастер-Технопровидец (3-cc96, п.11) — Талант Механикума. */
export const hasMasterEngineseer = actor => hasTalent(actor, "Master Engineseer");

/**
 * Штраф за монотонный Крафт (галочка «Монотонная работа» проекта): −30, а у
 * Трудоголика нет вовсе (книга: «не получает штрафы за занятие одним и тем же
 * Крафтом несколько смен подряд»). Сама галочка по-прежнему на слове стола —
 * система не считает, сколько смен подряд одно и то же.
 */
export function monotonyPenalty(actor, monotonyChecked) {
  return monotonyChecked && !hasWorkaholic(actor) ? -30 : 0;
}

/**
 * Фабрикатор удваивает БОНУСЫ от инструментов на тесты Крафта. Штраф за плохие
 * инструменты (отрицательный модификатор) не удваивается — книга говорит
 * именно о бонусах. «И ремонта» — ремонт теперь проект Крафта с галочкой
 * «Ремонт» (см. masterEngineseerNoParts), на него это удвоение действует само.
 */
export function fabricatorToolMod(actor, toolMod) {
  const mod = Number(toolMod) || 0;
  return mod > 0 && hasFabricator(actor) ? mod * 2 : mod;
}

/**
 * Мастер-Технопровидец: «+10 к Tech-Use на Крафт и ремонт». Бонус к Навыку, а
 * не к тесту вообще, поэтому работает, когда Tech-Use — ведущий Навык
 * комбинированного теста (его total и задаёт Предел); если ведущий другой
 * (Ремесло, Знание), Tech-Use даёт только бонус ранга и +10 к его total
 * Предел не меняет. Только Крафт: Исследования и Биолаборатория в тексте не
 * названы. Автоуспех за Очко Бесчестия — отдельная часть Таланта, не здесь.
 *
 * @param {string} mode        режим проекта ("craft"/"research"/"bio"/…)
 * @param {string} primaryValue value ведущего Навыка ("skill:techUse", …)
 */
export function masterEngineseerBonus(crafter, mode, primaryValue) {
  return mode === "craft" && primaryValue === "skill:techUse" && hasMasterEngineseer(crafter) ? 10 : 0;
}

/**
 * Мастер-Технопровидец, вторая половина Таланта: «Может потратить Очко Бесчестия,
 * чтобы автоматически преуспеть в расширенном тесте Tech-Use на Крафт/ремонт,
 * получая I.b Успехов за смену». Предложение траты показывается там же, где
 * действует +10: Крафт, ведущий Навык — Tech-Use. «Ремонта» в Мастерской нет.
 */
export function masterEngineseerAutoEligible(crafter, mode, primaryValue) {
  return mode === "craft" && primaryValue === "skill:techUse" && hasMasterEngineseer(crafter);
}

/**
 * Ремонт в Мастерской (решение владельца 26.10.2026) — проект Крафта с галочкой
 * «Ремонт»: тот же расширенный тест Tech-Use («расширенное действие для
 * создания и ремонта предметов»), поэтому +10 Мастера-Технопровидца, его
 * автоуспех и удвоение бонусов инструментов Фабрикатором действуют на него
 * без отдельных веток. Книга Банка Успехов для ремонта не называет — его
 * вписывает стол в «Базовый Банк» проекта.
 *
 * «Чинить механизмы вообще без запчастей под рукой» — Мастер-Технопровидец
 * отмечает это галочкой проекта-ремонта; система запчастей не ведёт, поэтому
 * галочка только честно попадает в карточку смены («по внешнему виду будет
 * заметно, что их чинили без нужных ресурсов»).
 */
export function masterEngineseerNoParts(crafter, proj) {
  return !!proj?.repair && !!proj?.noParts && hasMasterEngineseer(crafter);
}

/** Сломанное оружие мастера (system.destroyed) — что можно выбрать целью ремонта. */
export function destroyedWeaponsOf(actor) {
  return [...(actor?.items ?? [])].filter(i => i?.type === "weapon" && i.system?.destroyed);
}

/** Заголовок карточки смены: исследование / ремонт / крафт. */
export function craftShiftTitle(proj) {
  if (proj?.mode === "research") return "Смена исследования";
  return proj?.repair ? "Смена ремонта" : "Смена крафта";
}

/** Успехов за смену автоуспеха — I.b крафтера (не меньше 0). */
export function masterEngineseerAutoSuccesses(crafter) {
  const ib = Number(crafter?.system?.characteristics?.int?.bonus);
  if (Number.isFinite(ib)) return Math.max(0, ib);
  return Math.max(0, Math.floor((Number(crafter?.system?.characteristics?.int?.total) || 0) / 10));
}

/** Имя возможности «+10 на тесты Исследований» (Стремление «Инновация»). */
export const RESEARCH_BONUS_CAPABILITY = "craft.researchBonus";

/**
 * +10 от Инновации — только на смены проектов-ИССЛЕДОВАНИЙ (`mode:"research"`),
 * в отличие от Полимата, который даёт то же на Крафт и Исследования разом.
 */
export function researchBonus(crafter, mode) {
  return mode === "research" && hasRuleFlag(crafter, RESEARCH_BONUS_CAPABILITY) ? 10 : 0;
}

/**
 * Когитор, Черта «Инфернальное Вдохновение» (Sahara 583-29da): «Уменьшает время
 * смены для любых исследований вдвое (обычно до 4 ч) и удваивает Успехи на
 * исследования». Только режим Исследования; узнаётся по имени Черты, а не
 * записью Конструктора — снимки Черты на акторах живых миров её не несут.
 * @returns {{hours:number, successMult:number, source:string}}
 */
export function cogitorResearchShift(crafter, mode, baseHours) {
  const on = mode === "research" && (crafter?.items ?? []).some(i => i?.type === "trait"
    && (itemHasName(i, "Infernal Inspiration") || itemHasName(i, "Инфернальное Вдохновение")));
  return on
    ? { hours: baseHours / 2, successMult: 2, source: "Инфернальное Вдохновение" }
    : { hours: baseHours, successMult: 1, source: "" };
}

/** Киберпроповедник применяется к ЭТОМУ проекту (категория «Бионика и Мехадендриты»)? */
export function cyberpreacherApplies(crafter, categoryKey) {
  return categoryKey === "bionics" && hasCyberpreacher(crafter);
}

/**
 * Итоговый Кубик смены для броска — «advantage», если применился Киберпроповедник,
 * игрок выбрал Медленную Смену (и Талант у крафтера реально есть), или
 * именованный ассистент (assistantActor) реально владеет Подмастерьем
 * (wdbc-1rno — раньше это был флаг на слово стола, теперь проверяется по
 * инвентарю), иначе — то, что выбрано вручную (rawMode).
 */
export function effectiveDiceMode(rawMode, crafter, categoryKey, slowShiftChosen, assistantActor = null, prototypingReroll = false) {
  // Переброс Прототипирования в системе — «лучший из двух» (rules/reroll-pick.mjs,
  // умолчание переброса), то есть те же два кубика, что у Преимущества; вместе
  // с другим источником Преимущества кубиков не становится больше.
  if (prototypingReroll) return "advantage";
  if (cyberpreacherApplies(crafter, categoryKey)) return "advantage";
  if (slowShiftChosen && hasSlowShiftTalent(crafter)) return "advantage";
  if (hasJourneyman(assistantActor)) return "advantage";
  return rawMode;
}

/** +30 от Медленной Смены — только если выбрано И Талант реально есть у крафтера. */
export function slowShiftBonus(crafter, slowShiftChosen) {
  return (slowShiftChosen && hasSlowShiftTalent(crafter)) ? 30 : 0;
}

/**
 * +60 от Лаборатории Гемункула (wdbc-6nl9, «Ковен Гемункулов» — благо стадии
 * 0 Элитного архетипа Гемункул, module/constants/haemonculus.mjs:32) — БЕЗ
 * УСЛОВИЯ на категорию, тем же приёмом, что и polymathBonus («+60 на все
 * крафты и исследования» в тексте, без ограничения по категории/навыку, в
 * отличие от Киберпроповедника). Стадия 0 доступна ЛЮБОМУ Гемункулу
 * (haemState().open всегда включает stage:0) — isHaemonculus() уже
 * достаточная проверка, отдельного флага на «физическую Лабораторию» в
 * системе нет (тот же класс упрощения, что у Киберпроповедника — не
 * проверяем наличие инструментов).
 *
 * НЕ покрыто здесь (тот же текст благ, другая точка интеграции): +80 на
 * Medicae/Lore(Chymistry)/Trade(Chymist) — это отдельные тесты Навыка, не
 * тесты Мастерской, к общему конвейеру резолва Навыка это преимущество ещё
 * не подключено (см. wdbc-6nl9). До 5 бригад одновременно и +3 к максимуму
 * ассистентов (после чего число удваивается) — тоже отдельные лимиты, не
 * бонус к самому броску.
 */
export function haemonculusLabBonus(crafter) {
  return isHaemonculus(crafter) ? 60 : 0;
}

// ════════════════════════════════════════════════════════════════════════
//  Потеря Успехов за Критический Провал (корбук, «Расширенные Тесты»):
//  «Провалы в этих тестах не отнимаются от банка Успехов, но Критические
//  Провалы отнимают от 5 до 15 по решению ГМа». Число — решение ГМа, поэтому
//  оно не выдумывается, а стоит полем на проекте (critLoss, по умолчанию 10 —
//  середина диапазона); Мастерская снимает его сама, игроку считать нечего.
//
//  Safety Precautions / Техника Безопасности — «не теряет Успехи из банка от
//  Критических Провалов на тесты Крафта, а когда он ассистирует другим в
//  тестах Крафта, те теряют только 1 Успех». Только Крафт (не Исследование):
//  книга говорит о тестах Крафта и дефектах производства. Ассистент — тот же
//  именованный assistantId, что у Подмастерья/Тёмной Музы.
// ════════════════════════════════════════════════════════════════════════

export const CRAFT_CRIT_LOSS_MIN = 5;
export const CRAFT_CRIT_LOSS_MAX = 15;
export const CRAFT_CRIT_LOSS_DEFAULT = 10;

export const hasSafetyPrecautions = actor => hasTalent(actor, "Safety Precautions");

/** Число ГМа с проекта, зажатое в книжные 5–15; пусто/мусор → 10. */
export function craftCritLossBase(configured) {
  const n = Math.round(Number(configured));
  if (configured === "" || configured == null || !Number.isFinite(n)) return CRAFT_CRIT_LOSS_DEFAULT;
  return Math.min(CRAFT_CRIT_LOSS_MAX, Math.max(CRAFT_CRIT_LOSS_MIN, n));
}

/**
 * Сколько Успехов снять с банка за смену.
 * @param {object} o
 * @param {boolean} o.critFailure  смена — Критический Провал
 * @param {string}  o.mode         "craft" | "research" | …
 * @param {*}       o.configured   proj.critLoss (решение ГМа)
 * @param {?Actor}  o.crafter
 * @param {?Actor}  o.assistantActor именованный ассистент проекта
 * @returns {{loss:number, base:number, source:"none"|"base"|"crafter"|"assistant"}}
 */
export function craftCritLoss({ critFailure, mode, configured, crafter, assistantActor } = {}) {
  const base = craftCritLossBase(configured);
  if (!critFailure) return { loss: 0, base, source: "none" };
  if (mode === "craft" && hasSafetyPrecautions(crafter)) return { loss: 0, base, source: "crafter" };
  if (mode === "craft" && hasSafetyPrecautions(assistantActor)) return { loss: Math.min(1, base), base, source: "assistant" };
  return { loss: base, base, source: "base" };
}
