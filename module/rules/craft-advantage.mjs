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
  return hasDarkMuse(assistantActor) ? 30 : 0;
}

/**
 * +10 от Полимата — безусловно на ЛЮБОЙ тест Крафта И Исследования (книга не
 * ограничивает категорией/навыком, в отличие от Киберпроповедника). Не
 * покрыто (см. capabilities.mjs): Крит на тесте Крафта/Исследования даёт
 * бесплатный второй тест — нужен отдельный крюк на исход броска, не входит
 * в этот флат-бонус.
 */
export function polymathBonus(crafter) {
  return hasPolymath(crafter) ? 10 : 0;
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
export function effectiveDiceMode(rawMode, crafter, categoryKey, slowShiftChosen, assistantActor = null) {
  if (cyberpreacherApplies(crafter, categoryKey)) return "advantage";
  if (slowShiftChosen && hasSlowShiftTalent(crafter)) return "advantage";
  if (hasJourneyman(assistantActor)) return "advantage";
  return rawMode;
}

/** +30 от Медленной Смены — только если выбрано И Талант реально есть у крафтера. */
export function slowShiftBonus(crafter, slowShiftChosen) {
  return (slowShiftChosen && hasSlowShiftTalent(crafter)) ? 30 : 0;
}
