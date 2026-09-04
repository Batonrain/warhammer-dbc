// module/constants/tech-imperatives.mjs
// ════════════════════════════════════════════════════════════════════════
//  Числовые бонусы конкретных Императивов Пастыря Императивов (packs-src/
//  tech-powers/ТЕХНОЧУДЕСА/НООТЕУРГИЯ/Пастырь_Императивов) — item несёт эти
//  числа только текстом в system.effect (wdbc-yu32), структурные значения
//  здесь. Прямая проверка по имени предмета (itemHasName), тот же приём
//  точечного соответствия, что recoil-item-bonuses.mjs/witchs-edge.mjs — не
//  любой бонус стоит тащить через общую Конструктор-Механику ради двух
//  потребителей (doombc-mechanics-honesty-ratchet).
//
//  evasionBonus — умолчание диалога активации (module/sheets/tabs/
//  tech.mjs::activateTechMiracle), поле остаётся редактируемым (тот же
//  принцип, что «всегда редактируемое поле» у coverBonusForShot,
//  module/combat/cover.mjs) — «+до +Х» читается как максимум по умолчанию,
//  фиксированный штраф (Fortress: −30) — тоже как умолчание, менять не
//  обязательно, но можно.
//
//  Исключение «Отскок в укрытие» (у обоих Императивов эффект на тест
//  Избегания переворачивается специально для этого манёвра) — движок не
//  знает заранее, что именно этот бросок Уклонения обернётся Отскоком в
//  укрытие: выбор «нивелировать или Отскочить» происходит уже ПОСЛЕ
//  успешного теста (см. module/combat/recoil.mjs). Частично автоматизировано
//  (wdbc-hdxj): evasionRecoilBonus — фиксированный книжный знак «кроме
//  Отскока в укрытие» (не следует за отредактированным evasionBonus диалога
//  активации), подставляется в dodgeMod ЗАРАНЕЕ, если защищающийся ДО броска
//  Уклонения отметил декларацию «планирую Отскочить в укрытие?» (условное
//  поле в module/combat/attack-card.mjs::defenseSection, показывается только
//  при активном Evasion/Fortress Imperative — module/combat/imperative-
//  bonuses.mjs::hasEvasionRecoilImperative/evasionImperativeBonus). Честный
//  компромисс остаётся только для случая «передумал/не декларировал
//  заранее» — evasionRecoilNote, текст-напоминание для карточки активации и
//  диалога Отскока (module/combat/recoil.mjs), не гейт.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";

export const TECH_IMPERATIVES = {
  "Evasion Imperative": {
    label: "Императив Избегания",
    evasionBonus: 30,
    // Книга: «+до +30 на Избегания (кроме Отскока в укрытие, −20)» — фикс.
    evasionRecoilBonus: -20,
    evasionRecoilNote: "Отскок в укрытие: −20 вместо бонуса — переключите вручную.",
    coverApDelta: -8,
    coverApFloorRatio: 0.5
  },
  "Fortress Imperative": {
    label: "Императив Крепости",
    evasionBonus: -30,
    // Книга: «+20 на Отскок в укрытие, но −30 на остальные Избегания» — фикс.
    evasionRecoilBonus: 20,
    evasionRecoilNote: "Отскок в укрытие: +20 вместо штрафа на прочие Избегания — переключите вручную.",
    coverApDelta: 8,
    coverApCeilRatio: 2
  }
};

/** Конфигурация Императива у предмета, или null (не один из перечисленных выше). */
export function findTechImperative(item) {
  const key = Object.keys(TECH_IMPERATIVES).find(k => itemHasName(item, k));
  return key ? { key, ...TECH_IMPERATIVES[key] } : null;
}
