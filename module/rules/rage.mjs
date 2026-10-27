// module/rules/rage.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЯРОСТЬ — числа Базы (Талант «Frenzy / Ярость», корбук, Таланты «Берсерк»,
//  pdf-стр. 62; Sahara 3-861e).
//
//  Книга: «В Ярости он получает +10 к WS, S и W, штраф −20 на все тесты BS, I
//  и F, игнорирует штраф −10 от Усталости, не может быть Оглушен,
//  автоматически проходит тесты Морали.»
//
//  ── Почему числа привязаны к СОСТОЯНИЮ, а не к Таланту ──
//
//  Ярость (system.inRage — простой тумблер) включается из шести мест, и Талант
//  Frenzy есть не у всех: Кхорнгор (Frenzy даёт Раса), галлюциногены, Икона
//  Богохульства, Первобытный Вой (союзники «без Frenzy входят в Ярость»),
//  Скорый на Гнев, Миролюбец. Записи Frenzy в Конструкторе («Когда Ярость»)
//  дали бы числа только его владельцам — остальные «впали бы в Ярость» без
//  единого её числа. Поэтому читается само состояние, одинаково для всех.
//
//  ── Где что считается ──
//
//    +10 WS/S/W        rules/character.mjs — слагаемое характеристики
//                      (rageCharBonus); эффект предмета тут не годится: запись
//                      «Когда Ярость» пересобирается лишь на правку предмета,
//                      а updateActor пересверяет только выдачу Черт, и бонус
//                      остался бы висеть после выхода из Ярости.
//    −20 BS/I/F        источник правил «rage» (rageRules, sources.mjs) — штраф
//                      к ТЕСТАМ, а не к значению: Бонус BS/I/F не падает.
//                      Атака стрельбой собирает порог сама, строка — в
//                      sheets/attack/mods.mjs. Штраф BS снимает возможность
//                      RAGE_NO_BS_PENALTY (Модуль Агрессии Скитария Best.Q).
//    Усталость −10     rules/situational.mjs::fatiguePenalty.
//    не Оглушается     rules/condition-guards.mjs::isImmuneToCondition.
//    Мораль            rules/morale-test.mjs и combat/fear.mjs.
//
//  Не входит (поведение, а не число — решает стол): обязанность двигаться к
//  ближайшему врагу и атаковать, запрет Избеганий, Ментальных действий и
//  речи, автопровал социальных тестов, тест W+0 на выход.
//
//  Таланты поверх Ярости: Раненный Зверь (+5/+10 к WS и S при ранении) и
//  Холодная Ярость (нет штрафа к F, ментальные действия и психосилы
//  разрешены ценой −10 на психотесты). Опознаются в rules/predicates.mjs
//  (hasWoundedBeast/hasColdFury) — по имени ИЛИ по ключу Возможности.
//
//  Единственный импорт — rules/predicates.mjs, лист графа: файл стоит среди
//  источников правил (sources.mjs) и читается из расчёта актора, и любой
//  импорт отсюда, ведущий к collect.mjs/flags.mjs, замкнул бы круг
//  (AGENTS.md, «Источники правил»); поэтому hasAbility/hasRuleFlag здесь нельзя.
// ════════════════════════════════════════════════════════════════════════════

import { hasColdFury, hasWoundedBeast } from "./predicates.mjs";

/** Прибавка к ЗНАЧЕНИЮ характеристики в Ярости (книга: «+10 к WS, S и W»). */
export const RAGE_CHAR_BONUS = Object.freeze({ ws: 10, s: 10, wp: 10 });

/** Штраф к ТЕСТАМ BS, I и F в Ярости (книга: «штраф −20 на все тесты BS, I и F»). */
export const RAGE_TEST_PENALTY = -20;

/**
 * Возможность «в Ярости нет штрафа −20 к BS» (Модуль Агрессии Best.Q: «убирает
 * штраф к BS в Ярости»). Читателей два, оба здесь не спрашивают hasRuleFlag
 * (файл — источник правил, круг импортов): тесты на BS — вытеснением правила
 * RAGE_BS_RULE_ID (rules/item-rules.mjs::CAPABILITY_OVERRIDES), строка окна
 * стрельбы — sheets/attack/mods.mjs.
 */
export const RAGE_NO_BS_PENALTY = "rage.noBsPenalty";

/** Id правила штрафа BS из rageRules — то, что вытесняет RAGE_NO_BS_PENALTY. */
export const RAGE_BS_RULE_ID = "rage.penalty.bs";

/** Характеристики штрафа (ключи актора) и их подписи в книге. */
const RAGE_PENALTY_CHARS = Object.freeze({ bs: "BS", int: "I", fel: "F" });

/**
 * Раненный Зверь (Wounded Beast, Берсерк): «Если он легко ранен, он увеличивает
 * бонусы к WS и S от Ярости до +15. Если он тяжело или критически ранен — до
 * +20». Книга называет итог, к +10 Ярости прибавляется разница: +5 / +10.
 * Ключи — уровень Ранения (system.wounds.tier, rules/wound-tier.mjs):
 * «При смерти» (dying) — это критическое.
 */
export const WOUNDED_BEAST_EXTRA = Object.freeze({ light: 5, heavy: 10, dying: 10 });

/** Раненный Зверь растит только WS и S (W в книге не упомянута). */
const WOUNDED_BEAST_CHARS = Object.freeze(["ws", "s"]);

/** Холодная Ярость на психотесты: «штраф −10 на все психотесты через броски на W». */
export const COLD_FURY_PSYCHIC_PENALTY = -10;

/** В Ярости ли актор — единственный источник правды: system.inRage. */
export function isInRage(actor) {
  return !!actor?.system?.inRage;
}

/** Сколько Ярость прибавляет к значению этой характеристики (0 вне Ярости). */
export function rageCharBonus(actor, key) {
  return isInRage(actor) ? (RAGE_CHAR_BONUS[key] ?? 0) : 0;
}

/**
 * Прибавка Раненного Зверя к значению WS/S — поверх +10 Ярости. Зависит от
 * Уровня Ранения, который считается ПОСЛЕ цикла характеристик
 * (rules/character.mjs), поэтому зовётся из отдельного прохода за ним.
 */
export function woundedBeastBonus(actor, key) {
  if (!isInRage(actor) || !WOUNDED_BEAST_CHARS.includes(key)) return 0;
  const extra = WOUNDED_BEAST_EXTRA[actor?.system?.wounds?.tier] ?? 0;
  return extra && hasWoundedBeast(actor) ? extra : 0;
}

/**
 * Источник правил «rage» (sources.mjs): −20 на тесты BS, I и F. Без Ярости —
 * пустой список: источник зовётся на каждый тест каждого актора.
 *
 * auto:true — это не выбор игрока, а состояние персонажа (как Усталость).
 *
 * Холодная Ярость: штрафа к F нет («не получает штрафа к F от Ярости»), а
 * псайкер, манифестирующий в Ярости, получает −10 на психотесты.
 */
export function rageRules(actor) {
  if (!isInRage(actor)) return [];
  const coldFury = hasColdFury(actor);
  const rules = Object.entries(RAGE_PENALTY_CHARS)
    .filter(([char]) => !(coldFury && char === "fel"))
    .map(([char, abbr]) => ({
      id: `rage.penalty.${char}`,
      label: `Ярость: −20 на тесты ${abbr}`,
      when: {},
      effects: [{
        kind: "rollBonus", target: `basedon:${char}`, value: RAGE_TEST_PENALTY,
        label: `😡 Ярость (${abbr})`, auto: true
      }]
    }));
  if (coldFury) {
    rules.push({
      id: "rage.coldFury.psychic",
      label: "Холодная Ярость: −10 на психотесты",
      when: {},
      effects: [{
        kind: "rollBonus", target: "power", value: COLD_FURY_PSYCHIC_PENALTY,
        label: "😡 Холодная Ярость (психотест)", auto: true
      }]
    });
  }
  return rules;
}
