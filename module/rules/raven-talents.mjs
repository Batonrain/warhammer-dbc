// module/rules/raven-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Ворон (Элитный архетип) — чистая часть без Foundry.
//
//  Черты:
//   • Blades of Fate / Клинки Судьбы — «бонусные Очки Бесчестия» живут пулом
//     ресурса bladesOfFate (rules/resource-pools.mjs, запись Конструктора на
//     Черте): максимум I.b, тратится вместо Очка Бесчестия (окно «Чем
//     заплатить?»). +1 в начале каждого Хода в бою (Чтец Течения — +2), всё
//     сгорает в конце боя — combat/raven.mjs.
//   • False Blade / Ложный Клинок — встречные тесты WS через Deceive(WS):
//     лишний вариант в окне приёма и в «Сопротивляться» (ravenContestOptions,
//     ravenResistOptions → combat/techniques.mjs, combat/opposed-contest.mjs).
//   • Stances of Deceit / Стойки Обмана — выбранная Стойка хранится флагом
//     ravenStances (кнопка Черты); Превосходство (+2d10 урона по лежащим) и
//     Двойник (вес в численном превосходстве) читает код, остальное — строки
//     карточек.
//
//  Таланты: Акупунктура (две Стойки разом), Скрытые Узоры (строка карточки
//  Стойки), Рычаг (WS вместо S, Deceive вместо Athletics в приёмах и защите в
//  Борьбе), Подножка (5+ Успехов во встречном WS — цель Ничком), Пропустить и
//  Перенаправить Удар (кнопки встречного WS, combat/raven.mjs).
//
//  Имена — литералами (их ищет tools/capability-reachability.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";

const NS = "warhammer-dbc";

export const BLADES_POOL = "bladesOfFate";
export const RAVEN_STANCE_FLAG = "ravenStances";
/** «Подножка»: Успехов перевеса во встречном тесте и предельный Размер цели. */
export const TRIP_MARGIN = 5;
export const TRIP_MAX_SIZE = 1;

const hasNamed = (actor, type, name) =>
  [...(actor?.items ?? [])].some(i => i?.type === type && itemHasName(i, name));

export const hasBladesOfFate   = a => hasNamed(a, "trait", "Blades of Fate");
export const hasFlowReader     = a => hasNamed(a, "talent", "Flow Reader");
export const hasFalseBlade     = a => hasNamed(a, "trait", "False Blade");
export const hasStancesOfDeceit = a => hasNamed(a, "trait", "Stances of Deceit");
export const hasAcupuncture    = a => hasNamed(a, "talent", "Acupuncture");
export const hasHiddenPatterns = a => hasNamed(a, "talent", "Hidden Patterns");
export const hasLeverage       = a => hasNamed(a, "talent", "Leverage");
export const hasTrip           = a => hasNamed(a, "talent", "Trip");
export const hasPassBy         = a => hasNamed(a, "talent", "Pass By");
export const hasRedirectBlow   = a => hasNamed(a, "talent", "Redirect Blow");

/** Стойки Обмана: ключ → подпись и текст книги. */
export const RAVEN_STANCES = Object.freeze({
  confusion: { label: "Замешательства", text: "Раз в Ход Финт свободным действием, в т.ч. посреди Натиска." },
  superiority: { label: "Превосходства", text: "+2d10 урона рукопашными по лежащим (Ничком) целям — бросается само. Когда цель в рукопашной с Вороном Встаёт — свободная атака по ней." },
  thief: { label: "Вора", text: "Обезоружив цель, сразу хватает выбитое оружие в свободную руку, складывает на разгрузку или отбивает на до S.b×2 м. Избегая рукопашной атаки на 5+ Успехов — немедленно Обезоруживание против атакующего." },
  pursuer: { label: "Преследователя", text: "Побеждая в Давлении и преследуя цель, немедленно одна рукопашная атака по ней за свободное действие (не имеет типа «атака»)." },
  doppel: { label: "Двойника", text: "Считается как ⅓(WS.b+1) (окр.▼) персонажей в расчёте численного превосходства в рукопашной — уже в подсчёте контакта." }
});

/** Сколько Стоек одновременно: 1, с Акупунктурой — 2. */
export function maxRavenStances(actor) {
  return hasAcupuncture(actor) ? 2 : 1;
}

/** Выбранные Стойки (ключи), обрезанные по лимиту; без Черты — пусто. */
export function ravenStancesOf(actor) {
  if (!hasStancesOfDeceit(actor)) return [];
  const raw = actor?.flags?.[NS]?.[RAVEN_STANCE_FLAG] ?? actor?.getFlag?.(NS, RAVEN_STANCE_FLAG);
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(k => k in RAVEN_STANCES);
  return [...new Set(list)].slice(0, maxRavenStances(actor));
}

export const inRavenStance = (actor, key) => ravenStancesOf(actor).includes(key);

/** Двойник: вес Ворона в подсчёте численного превосходства — ⌊(WS.b+1)/3⌋, не меньше 1. */
export function doppelOutnumberWeight(actor) {
  if (!inRavenStance(actor, "doppel")) return 1;
  const wsb = Math.floor((Number(actor?.system?.characteristics?.ws?.total) || 0) / 10);
  return Math.max(1, Math.floor((wsb + 1) / 3));
}

/** Превосходство: рукопашная по цели Ничком — +2d10 к урону. */
export function superiorityDice(actor, { isMelee = false, targetProne = false } = {}) {
  return (isMelee && targetProne && inRavenStance(actor, "superiority")) ? "2d10" : "";
}

/** Значение «Навык(Характеристика)»: Характеристика + Ранг Навыка (нетренированный −20). */
export function skillWithChar(actor, skillKey, charKey) {
  const ch = Number(actor?.system?.characteristics?.[charKey]?.total) || 0;
  const sk = actor?.system?.skills?.[skillKey];
  const rank = SKILL_RANKS[sk?.rank ?? "untrained"]?.bonus ?? -20;
  return ch + rank + (Number(sk?.mod) || 0);
}

const isWsContest = (techDef) => {
  if (!techDef) return false;
  if (techDef.defaultChar && techDef.defaultChar !== "ws") return false;
  if (techDef.skills && Object.keys(techDef.skills).length) return false;
  return true;
};
const isAthleticsContest = techDef => Object.values(techDef?.skills ?? {}).includes("athletics");

const opt = (actor, key, skillKey, charKey, label, extra = {}) =>
  ({ key, label, value: skillWithChar(actor, skillKey, charKey), skillKey, charKey, ...extra });

/**
 * Лишние варианты окна приёма у Ворона:
 *  • Ложный Клинок — Deceive(WS) вместо WS в любом встречном тесте WS
 *    (Финт, Давление, Обезоружить…); цель отвечает тем, чем отвечала (WS);
 *  • Рычаг — в приёмах на Athletics(S): Athletics(WS), Deceive(S), Deceive(WS).
 * @returns {{key:string,label:string,value:number,skillKey:string,charKey:string,resist?:object[]}[]}
 */
export function ravenContestOptions(actor, techDef) {
  const out = [];
  if (hasFalseBlade(actor) && isWsContest(techDef)) {
    out.push(opt(actor, "raven:falseBlade", "deceive", "ws", "Deceive(WS) — Ложный Клинок",
      { resist: techDef.resist?.length ? techDef.resist : [{ char: "ws" }] }));
  }
  if (hasLeverage(actor) && isAthleticsContest(techDef)) {
    const resist = techDef.resist?.length ? techDef.resist : [{ skill: "athletics" }];
    out.push(opt(actor, "raven:leverage:athWs", "athletics", "ws", "Athletics(WS) — Рычаг", { resist }));
    out.push(opt(actor, "raven:leverage:decS", "deceive", "s", "Deceive(S) — Рычаг", { resist }));
    out.push(opt(actor, "raven:leverage:decWs", "deceive", "ws", "Deceive(WS) — Рычаг", { resist }));
  }
  return out;
}

/**
 * Лишние варианты «Сопротивляться» у Ворона-защитника: Ложный Клинок к WS
 * добавляет Deceive(WS); Рычаг к Athletics — Athletics(WS) и Deceive(S/WS)
 * («защитные тесты Борьбы»).
 * @param {object[]} opts уже предложенные варианты ({skill, char, mod})
 */
export function ravenResistOptions(actor, opts = []) {
  const out = [];
  const hasSide = (skill, char) => opts.some(o => (o.skill || "") === skill && (!char || o.char === char));
  if (hasFalseBlade(actor) && opts.some(o => !o.skill && o.char === "ws") && !hasSide("deceive", "ws"))
    out.push({ skill: "deceive", char: "ws", mod: 0 });
  if (hasLeverage(actor) && opts.some(o => o.skill === "athletics")) {
    for (const [skill, char] of [["athletics", "ws"], ["deceive", "s"], ["deceive", "ws"]])
      if (!hasSide(skill, char) && !out.some(o => o.skill === skill && o.char === char)) out.push({ skill, char, mod: 0 });
  }
  return out;
}

/** Бросал ли инициатор встречного теста от WS (WS или Навык(WS)). */
export const sideIsWs = side => side?.char === "ws" && (!side.skill || side.char === "ws");

/**
 * Подножка: «побеждает в любом атакующем встречном тесте WS на 5+ Успехов
 * против цели Размером до 1 — также Сбивает цель с ног».
 */
export function tripApplies(actor, { side, margin = 0, targetSize = 0 } = {}) {
  return hasTrip(actor) && sideIsWs(side) && (Number(margin) || 0) >= TRIP_MARGIN
    && (Number(targetSize) || 0) <= TRIP_MAX_SIZE;
}

/** Пропустить: Избегание рукопашной на 5+ Успехов — можно потратить 4 Успеха на встречный WS. */
export const PASS_BY_MIN = 5;
export const PASS_BY_COST = 4;

/** Строки карточки Уклонения/Парирования Ворона (Пропустить, Стойка Вора). */
export function ravenEvasionNotes(actor, { passed = false, deg = 0, isMelee = false } = {}) {
  if (!passed || !isMelee || deg < PASS_BY_MIN) return [];
  const out = [];
  if (hasPassBy(actor)) out.push(`🪶 Пропустить: ${deg} Успехов — можно потратить ${PASS_BY_COST} и пройти встречный WS (кнопка Таланта «Пропустить» с атакующим в цели).`);
  if (inRavenStance(actor, "thief")) out.push("🪶 Стойка Вора: Избегание на 5+ Успехов — немедленно Обезоруживание против атакующего (Приём «Обезоружить»).");
  return out;
}

/**
 * Скрытые Узоры: «Тесты на засекание работы Трейта Stances of Deceit
 * пси-чутьём и другими методами, засекающими энергии Варпа, что-то
 * обнаруживают только Критическим Успехом». Тест Пси-Чутья, наведённый на
 * Ворона с Узорами и включённой Стойкой, засчитывается только Критическим
 * Успехом (эффект critSuccessOnly, rules/kind-outcome.mjs). Источник правил
 * «ravenHiddenPatterns» в rules/sources.mjs.
 */
export function hiddenPatternsRules(actor, ctx = {}) {
  const raven = ctx?.targetActor;
  if (!raven || raven === actor || !hasHiddenPatterns(raven) || !ravenStancesOf(raven).length) return [];
  return [{
    id: "raven.hiddenPatterns", label: "Скрытые Узоры", when: {},
    effects: [{ kind: "critSuccessOnly", target: ["skill:psyniscience"],
      label: `🪶 Скрытые Узоры (${raven.name ?? "Ворон"}): Стойку засекает только Критический Успех` }]
  }];
}
