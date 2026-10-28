// module/rules/squat-traits.mjs
// ════════════════════════════════════════════════════════════════════════
//  Расовые Черты Сквата (корбук, глава I «Расы», сверка 28.09.2026) — всё,
//  что система считает сама, в одном месте; сами Черты несут возможности
//  записями Конструктора (packs-src/traits), здесь — их читатели.
//
//   Clever Hands / Умелые Руки (trait.cleverHands):
//     «+15 на все тесты Крафта, ремонта и обслуживания, требующие тонкой
//     работы, поднимающийся до +30 в экстремальных ситуациях, вроде взлома
//     замка посреди боя или побега от погони, Расклина оружия…»
//     — галочки +15/+15 в диалоге Ремесла/Технологии/Безопасности живут
//       правилами library/squat.mjs (askOnly: «требует ли тонкой работы»
//       решает стол, в бросок без диалога сами не складываются);
//     — Расклин книга прямо называет экстремальной ситуацией, поэтому там
//       +30 без спроса (combat/clear-jam.mjs, cleverHandsClearJamBonus).
//   Hard as Stone / Крепкий как Камень (trait.hardAsStone):
//     — лечится как Космодесантник — готовая возможность healing.astartes
//       (с ней же сон 3 ч, sheets/tabs/conditions.mjs::sleepHours);
//     — мутации как Космодесантник — возможность mutations.asAstartes,
//       пороги rules/character.mjs::nextMutationThreshold;
//     — Преимущество на тест против яда (hooks.mjs, сопротивление Toxic —
//       единственный настоящий тест против яда в системе, см.
//       resolve-test.mjs scope "poison"): poisonResistReroll;
//     — «может не спать до 3-х суток»: сдвиг лестницы Сна (vitals.mjs,
//       sleepGraceDays) и подсказка длительности сна (sleepNeededHours);
//     — защита от радиации −3: считает rules/radiation-scene.mjs (радиация
//       сцены по часам Календаря, combat/radiation-scene.mjs, wdbc-c5vf0);
//     — Преимущество против ядов — poisonResistReroll (Живучесть Сплайса —
//       та же функция, resist.poisonAdvantage);
//     — Преимущество против болезней — diseaseResistReroll (тест заражения,
//       combat/disease-infection.mjs; Живучесть Сплайса — resist.diseaseAdvantage);
//     — Преимущество против вакуума — vacuumResistReroll (тест вакуума,
//       combat/vacuum.mjs; у Живучести Сплайса вакуума в тексте нет).
//   Sure Tread / Надёжная Поступь (trait.sureTread):
//     — −1 SPD — запись Конструктора kind:"movement" на самой Черте;
//     — «не может двигаться пешком более 3×SPD в Ход» — Бег урезан до
//       Натиска (rules/character/movement.mjs, sureTreadMovementCap), а
//       пройденный за Ход путь токена не может превысить эту дальность
//       (sureTreadWalkCeiling; измеряет и блокирует combat/path-limit.mjs,
//       правило rules/movement-path.mjs, wdbc-l2urs);
//     — Трудный Ландшафт: Awareness (P) вместо A, 3+ Успеха — не замедляет
//       (combat/movement-terrain.mjs, sureTreadTerrainBase/
//       sureTreadIgnoresTerrain).
//   Void in Veins / Пустота в Венах — правило squat.voidInVeins (library/
//     squat.mjs): переброс (лучший из 2) на тесты Ловкости и Акробатики, пока
//     сцена в невесомости (предикат weightlessScene, гравитация < 0,2 G);
//     «I вместо A» — выбор «Бросок с:» в том же диалоге, кода здесь нет.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";
import { hasAbility } from "./ability-by-key.mjs";
import { NEW_MEN } from "./new-men.mjs";

export const CLEVER_HANDS          = "trait.cleverHands";
export const HARD_AS_STONE         = "trait.hardAsStone";
export const SURE_TREAD            = "trait.sureTread";
export const MUTATIONS_AS_ASTARTES = "mutations.asAstartes";
/** Преимущество на тест против яда от записи Черты/Адаптации (Живучесть Сплайса). */
export const POISON_ADVANTAGE      = "resist.poisonAdvantage";
/** Преимущество на тест заражения болезнью от Адаптации (Живучесть Сплайса). */
export const DISEASE_ADVANTAGE     = "resist.diseaseAdvantage";

/** Расклин — «экстремальная ситуация» по тексту Черты: +30 вместо +15. */
export function cleverHandsClearJamBonus(actor) {
  return actor && hasRuleFlag(actor, CLEVER_HANDS) ? 30 : 0;
}

/**
 * Преимущество на тест сопротивления яду (Отравление от свойства Toxic).
 * Та же форма, что Кубик «Преимущество» диалога (rules/test-kind.mjs::
 * diceModeFor) — бросок дважды, берётся лучший; rollD100WithReroll её понимает.
 * @returns {?{rolls:number, mode:"keepBest", label:string}}
 */
export function poisonResistReroll(actor, condition) {
  if (condition !== "poisoned" || !actor) return null;
  if (hasRuleFlag(actor, HARD_AS_STONE))
    return { rolls: 2, mode: "keepBest", label: "Преимущество (Крепкий как Камень)" };
  // Адаптация Сплайса «Живучесть»: «Преимущество на все тесты против ядов…» (wdbc-dbveg).
  if (hasRuleFlag(actor, POISON_ADVANTAGE))
    return { rolls: 2, mode: "keepBest", label: "Преимущество против яда" };
  return null;
}

/**
 * Преимущество на тест заражения болезнью (combat/disease-infection.mjs):
 * Крепкий как Камень («на все тесты против… болезней») и Живучесть Сплайса —
 * та же форма, что у яда выше (бросок дважды, лучший).
 * @returns {?{rolls:number, mode:"keepBest", label:string}}
 */
export function diseaseResistReroll(actor) {
  if (!actor) return null;
  if (hasRuleFlag(actor, HARD_AS_STONE))
    return { rolls: 2, mode: "keepBest", label: "Преимущество (Крепкий как Камень)" };
  // По имени тоже: у старой копии Черты есть запись против яда, а против болезней — нет до «Обновить мир».
  if (hasAbility(actor, DISEASE_ADVANTAGE, "Adaptation: Resilience", "trait"))
    return { rolls: 2, mode: "keepBest", label: "Преимущество против болезней" };
  return null;
}

/**
 * Преимущество на тест вакуума (combat/vacuum.mjs): Крепкий как Камень —
 * «на все тесты против… вакуума».
 * @returns {?{rolls:number, mode:"keepBest", label:string}}
 */
export function vacuumResistReroll(actor) {
  if (!actor) return null;
  if (hasRuleFlag(actor, HARD_AS_STONE))
    return { rolls: 2, mode: "keepBest", label: "Преимущество (Крепкий как Камень)" };
  return null;
}

/**
 * Сколько суток без сна проходит без штрафа — порог первой стадии Сна
 * (constants/vitals.mjs). Человеку сутки, Сквату «до 3-х суток».
 */
export function sleepGraceDays(actor) {
  // Одно правило на две Черты с одинаковым числом: Крепкий как Камень
  // (Скват) и Новые Люди (Йигори) — «без сна до 3-х суток».
  return actor && (hasRuleFlag(actor, HARD_AS_STONE) || hasRuleFlag(actor, NEW_MEN.sleep)) ? 3 : 1;
}

/** «3ч сна в день… за каждые бессонные сутки +3ч до максимума в 9ч». */
export function sleepNeededHours(sleeplessDays) {
  const days = Math.max(0, Math.floor(Number(sleeplessDays) || 0));
  return Math.min(9, 3 + 3 * days);
}

/**
 * Характеристика теста Трудного Ландшафта: Ловкость, а с Надёжной Поступью —
 * лучшее из Ловкости и Awareness. «Может использовать» — выбор игрока, но
 * худший вариант брать незачем, поэтому выбирается сам (тот же приём, что
 * лучший из Tech-Use/Trade у Расклина, combat/clear-jam.mjs).
 * @returns {{base:number, char:string, skill:?string, label:string}}
 */
export function sureTreadTerrainBase(actor) {
  const ag = Number(actor?.system?.characteristics?.ag?.total) || 0;
  const plain = { base: ag, char: "ag", skill: null, label: "Ловкость (Ag)" };
  if (!actor || !hasRuleFlag(actor, SURE_TREAD)) return plain;
  const aw = actor.system?.skills?.awareness?.total;
  if (aw == null || Number(aw) <= ag) return plain;
  return { base: Number(aw), char: "per", skill: "awareness", label: "Awareness (P) — Надёжная Поступь" };
}

/** «На 3+ Успеха Трудный Ландшафт вовсе не замедляет его». */
export function sureTreadIgnoresTerrain(actor, passed, degrees) {
  return !!passed && Number(degrees) >= 3 && !!actor && hasRuleFlag(actor, SURE_TREAD);
}

/**
 * «Не может двигаться пешком более 3×SPD в Ход»: Натиск и так 3×SPD, Бег
 * (6×SPD) урезается до него. Числа, уже уменьшенные Поваленным/потерей ног,
 * не поднимаются — берётся меньшее.
 */
export function sureTreadMovementCap({ halfMove, move, charge, run }) {
  return { halfMove, move, charge, run: Math.min(run, charge) };
}

/**
 * Тот же потолок «не более 3×SPD пешком в Ход», но на РЕАЛЬНО пройденный
 * путь, а не на цифру Бега в листе (wdbc-l2urs): сумма Движений за Ход
 * (Натиск 9 м + ещё Полудвижение 3 м у SPD 3) не может перевалить за дальность
 * Натиска. Берётся уже посчитанный charge (после Поваленного, потери ног и
 * Стойки), поэтому потолок опускается вместе с ним. Нулевой/неизвестный charge
 * потолка не даёт (Infinity): не знаем скорость — не режем вслепую.
 * @returns {number} метры; Infinity — потолка нет
 */
export function sureTreadWalkCeiling({ charge } = {}) {
  const c = Number(charge);
  return Number.isFinite(c) && c > 0 ? c : Infinity;
}
