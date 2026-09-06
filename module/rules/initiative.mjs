// module/rules/initiative.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ИНИЦИАТИВА: чем её считают, сколько раз кидают и что прибавляют (wdbc-7zzr).
//
//  До этого Инициатива была жёстко «бонус Ловкости плюс что накапало сверху»:
//  подменить характеристику было нечем, а число бросков было константой 3 на
//  одну-единственную возможность. Из-за этого четыре Таланта корбука (стр. 62)
//  лежали в паке пустыми, а Черта Эльдарского Тела обещала броски, которых не
//  было (wdbc-s2tp).
//
//  Три независимых механизма, и это важно не путать:
//
//  1. ЧЕМ СЧИТАТЬ — «использует I.b/P.b вместо A.b». Возможность с именем
//     `combat.initiativeChar.<хар>`; берётся ЛУЧШАЯ из разрешённых, потому что
//     книга говорит «может использовать», а игрок в этом выборе всегда выберет
//     большее число. Спрашивать его об этом каждый бой — ручной счёт, ровно то,
//     от чего система уходит.
//
//  2. СКОЛЬКО РАЗ КИДАТЬ — броски складываются, а не заменяют друг друга.
//     Книга Аэльдари: «Эльдар бросает три раза; если у него есть Lightning
//     Reflexes — не три, а четыре». Поэтому база 1 бросок, `combat.
//     initiativeAdvantage` даёт +2 (исторически «кидает трижды» — Отеший,
//     эльдар), `combat.initiativeExtraRoll` даёт +1 (Молниеносные Рефлексы).
//     Один Талант — 2 броска, одна раса — 3, вместе — 4. Ровно как в книге.
//
//  3. ЧТО ПРИБАВИТЬ — плоские надбавки (Паранойя +2, Боевое Построение +1)
//     работали и раньше эффектом на system.initiative, их тут нет. Здесь живёт
//     только Самая Быстрая Рука: её надбавка зависит от того, ЧТО СЕЙЧАС В
//     РУКАХ, поэтому эффектом её не выразить — она пересчитывается каждый цикл.
// ════════════════════════════════════════════════════════════════════════════

import { INITIATIVE_CHAR_PREFIX, INITIATIVE_CHAR_KEYS } from "../constants/capabilities.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { ruleFlags, hasRuleFlag, ruleFlagLabels } from "./flags.mjs";
import { handHeldItems } from "./hands.mjs";
import { isIntegralAttack } from "../combat/equipped-melee.mjs";

export { INITIATIVE_CHAR_PREFIX, INITIATIVE_CHAR_KEYS };

/** Характеристика Инициативы по умолчанию — Ловкость. */
export const INITIATIVE_DEFAULT_CHAR = "ag";

/** «Кидает Инициативу трижды» — +2 броска (Отеший, Эльдарское Тело). */
export const INITIATIVE_ADVANTAGE_CAPABILITY = "combat.initiativeAdvantage";

/** «+1 бросок Инициативы» — Молниеносные Рефлексы. */
export const INITIATIVE_EXTRA_ROLL_CAPABILITY = "combat.initiativeExtraRoll";

/** Самая Быстрая Рука — надбавка WS.b/BS.b при ножах/пистолетах. */
export const FASTEST_HAND_CAPABILITY = "combat.fastestHand";

/** Сколько бросков даёт каждая из «множительных» возможностей. */
const EXTRA_ROLLS = {
  [INITIATIVE_ADVANTAGE_CAPABILITY]: 2,
  [INITIATIVE_EXTRA_ROLL_CAPABILITY]: 1
};

/** Категория рукопашного оружия «нож» (module/constants/weapon-categories.mjs). */
const KNIFE_CATEGORY = "Нож";

const bonusOf = (chars, key) => Number(chars?.[key]?.bonus) || 0;

/**
 * Ключ характеристики, по которой считается Инициатива этого актора.
 *
 * Ловкость, если ни одной подменяющей возможности нет. Если их несколько
 * (Боевое Построение + Чувство Боя одновременно — законная связка), берётся та,
 * чей бонус больше: книга разрешает выбирать, а выбор здесь односторонний.
 */
export function initiativeCharKey(actor, chars = {}) {
  const flags = ruleFlags(actor);
  let best = INITIATIVE_DEFAULT_CHAR;
  let bestBonus = bonusOf(chars, INITIATIVE_DEFAULT_CHAR);
  for (const key of INITIATIVE_CHAR_KEYS) {
    if (!flags.has(INITIATIVE_CHAR_PREFIX + key)) continue;
    const bonus = bonusOf(chars, key);
    if (bonus > bestBonus) { best = key; bestBonus = bonus; }
  }
  return best;
}

/**
 * Сколько раз актор бросает Инициативу в трекере боя. Всегда ≥ 1.
 * Складывается, а не выбирается максимум — см. пункт 2 в шапке файла.
 */
export function initiativeRolls(actor) {
  const flags = ruleFlags(actor);
  let rolls = 1;
  for (const [capability, extra] of Object.entries(EXTRA_ROLLS)) {
    if (flags.has(capability)) rolls += extra;
  }
  return rolls;
}

/**
 * Надбавка Таланта «Самая Быстрая Рука» (корбук стр. 62): пока в руках ТОЛЬКО
 * ножи и/или пистолеты — +WS.b за ножи или +BS.b за пистолеты, на выбор.
 *
 * Считается по тому, что реально занимает руки (rules/hands.mjs), а не по всему
 * рюкзаку: книга говорит «вооружён только», а не «носит с собой только». Взял в
 * руку что-то третье — надбавка пропадает тем же циклом пересчёта, что и
 * появилась; книжная оговорка «очередность хода пересчитывается с начала
 * следующего Раунда» относится к порядку в трекере, а не к числу на листе.
 *
 * ИНТЕГРАЛЬНЫЕ АТАКИ ПРОПУСКАЮТСЯ ЦЕЛИКОМ — ни дают надбавку, ни отменяют её.
 * Шипы, кислотный плевок, вопль, дыхание — это части тела, а не то, чем
 * персонаж ВООРУЖЁН, и книжное условие про них ничего не говорит. Без этого
 * фильтра ошибались обе стороны сразу: «Шипы» и «Рёв» с weaponClass "ranged"
 * не значатся в RANGED_CLASS_HANDS, получали руку по умолчанию и НАВСЕГДА
 * гасили Талант, а «Кислотный Плевок» и «Вопль» с weaponClass "pistol"
 * считались пистолетом и давали +BS.b даже с пустыми руками. Тот же фильтр и
 * по той же причине стоит в combat/defense.mjs при выборе парирующего оружия.
 *
 * Пустые руки — надбавки нет: Талант описывает вооружённого персонажа.
 */
export function fastestHandBonus(actor, chars = {}) {
  if (!hasRuleFlag(actor, FASTEST_HAND_CAPABILITY)) return 0;
  const held = handHeldItems(actor).filter(item => !isIntegralAttack(item));
  if (!held.length) return 0;
  let knives = false;
  let pistols = false;
  for (const item of held) {
    const sys = item?.system || {};
    if (sys.weaponClass === "pistol") { pistols = true; continue; }
    if (sys.weaponClass === "melee" && sys.meleeCategory === KNIFE_CATEGORY) { knives = true; continue; }
    return 0; // в руках что-то ещё — условие Таланта не выполнено
  }
  return Math.max(knives ? bonusOf(chars, "ws") : 0,
                  pistols ? bonusOf(chars, "bs") : 0);
}

/**
 * Подсказка к Инициативе на листе: из чего она сложилась и сколько раз
 * кидается. Раньше подсказка была прибита строкой «1d10 + Ag.Бонус +
 * модификатор» — с подменой характеристики она стала бы враньём, а игрок
 * увидел бы «не ту» цифру без единого объяснения.
 */
export function initiativeHint(actor, chars = {}) {
  const key   = initiativeCharKey(actor, chars);
  const parts = [`1d10 + ${CHARACTERISTICS[key]?.abbr ?? "Ag"}.Бонус + модификатор`];
  if (key !== INITIATIVE_DEFAULT_CHAR) parts.push(`вместо Ag.Бонуса — ${labelsFor(actor, INITIATIVE_CHAR_PREFIX + key)}`);
  const fastest = fastestHandBonus(actor, chars);
  if (fastest) parts.push(`+${fastest} за ножи/пистолеты в руках (${labelsFor(actor, FASTEST_HAND_CAPABILITY)})`);
  const rolls = initiativeRolls(actor);
  if (rolls > 1) parts.push(`бросков ${rolls}, берётся лучший`);
  return parts.join("; ");
}

/** Названия правил, давших возможность — «неизвестно» вместо пустоты. */
function labelsFor(actor, capability) {
  const labels = ruleFlagLabels(actor, capability).filter(Boolean);
  return labels.length ? labels.join(", ") : "источник не назван";
}
