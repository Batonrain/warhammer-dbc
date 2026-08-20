// module/rules/horde-damage.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СЧЁТ УРОНА ПО ОРДЕ — чистые функции, без Foundry.
//
//  Орда не теряет Раны: попадание, пробившее её Поглощение, снимает 1 Магнитуду
//  независимо от величины непоглощённого урона — поэтому мощное одиночное
//  оружие против толпы бесполезно, а важно ЧИСЛО попаданий. Всё, что их
//  добавляет (Blast, Огонь, Силовое Поле, Распыление, разница Размеров),
//  считается здесь; кто и когда это зовёт — combat/horde-damage.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Подписи Размера Орды — показываются на листе рядом с числом. */
export const HORDE_SIZE_LABELS = {
  2: "небольшая толпа / стая",
  3: "толпа / отряд / выводок",
  4: "фаланга / орда",
  5: "массированное наступление",
  6: "огромная волна"
};

/**
 * Размер Орды по её Магнитуде. Считается в атаках по Орде и тестах Stealth,
 * но НЕ в SPD — там работает собственный Размер существ (system.sizeMod).
 */
export function hordeSizeFor(magnitude) {
  const m = Math.max(0, Number(magnitude) || 0);
  return m >= 120 ? 6 : m >= 90 ? 5 : m >= 60 ? 4 : m >= 30 ? 3 : m >= 10 ? 2 : 1;
}

/** Бонусные кубы урона атак самой Орды: 10–19 → +1d10, 20+ → +2d10. */
export function hordeMagDamageDice(magnitude) {
  const m = Math.max(0, Number(magnitude) || 0);
  return m >= 20 ? 2 : m >= 10 ? 1 : 0;
}

/**
 * Сколько попаданий по Орде даёт одно успешное попадание оружия.
 *
 * Базовое попадание всегда одно; свойства добавляют сверху. Распыление считает
 * дальность конуса (+Rng/5, окр.▼), поэтому ему нужен Rng оружия. Разница
 * Размеров работает только в рукопашной: крупный боец (Размер 1+), рубящий
 * мелюзгу (Размер ≤0), задевает нескольких за удар.
 *
 * @param {object}  o
 * @param {number}  [o.blast]        рейтинг Взрывного (0 — свойства нет)
 * @param {boolean} [o.flame]        Огонь
 * @param {boolean} [o.powerField]   Силовое Поле
 * @param {boolean} [o.spray]        Распыление
 * @param {number}  [o.range]        Rng оружия в метрах — для Распыления
 * @param {boolean} [o.melee]        попадание рукопашное
 * @param {number}  [o.attackerSize] итоговый Размер атакующего
 * @param {number}  [o.creatureSize] Размер существ Орды (не Размер самой Орды)
 * @returns {{hits:number, notes:string[]}}
 */
export function hordeExtraHits({
  blast = 0, flame = false, powerField = false, spray = false, range = 0,
  melee = false, attackerSize = 0, creatureSize = 0
} = {}) {
  const notes = [];
  let hits = 1;

  const blastRating = Math.max(0, Number(blast) || 0);
  if (blastRating > 0) { hits += blastRating; notes.push(`Взрывное (${blastRating}): +${blastRating}`); }
  if (flame)      { hits += 1; notes.push("Огонь: +1"); }
  if (powerField) { hits += 1; notes.push("Силовое Поле: +1"); }
  if (spray) {
    const sprayHits = Math.floor(Math.max(0, Number(range) || 0) / 5);
    if (sprayHits > 0) { hits += sprayHits; notes.push(`Распыление (Rng ${range}): +${sprayHits}`); }
  }
  // Размер атакующего важен только в рукопашной: «Персонажи Размером 1 и более,
  // сражающиеся против орд существ Размером 0 и менее, получают ещё +1
  // Попадание за каждое успешное рукопашное попадание по Орде».
  if (melee && (Number(attackerSize) || 0) >= 1 && (Number(creatureSize) || 0) <= 0) {
    hits += 1;
    notes.push("Размер против мелюзги: +1");
  }

  return { hits, notes };
}

/**
 * Сколько Магнитуды снимает попадание.
 *
 * Поглощение проверяется один раз: у всех попаданий одной атаки урон один и
 * тот же, поэтому либо проходят все, либо ни одного. Опустошительное и Таланты
 * («Ураган Смерти», «Свинцовый Дождь») добавляют урон в Магнитуду, а не
 * попадания, и потому считаются раз за атаку — но тоже только при пробитии:
 * иначе они пробивали бы Поглощение в обход общего правила.
 *
 * @returns {{pierced:boolean, magLoss:number, absorbed:number}}
 */
export function hordeMagnitudeLoss({
  rawDamage = 0, absorption = 0, hits = 1, devastating = 0, talentBonus = 0
} = {}) {
  const raw  = Math.max(0, Number(rawDamage)  || 0);
  const abs  = Math.max(0, Number(absorption) || 0);
  const pierced = raw > abs;
  if (!pierced) return { pierced: false, magLoss: 0, absorbed: raw };
  const magLoss = Math.max(0, Number(hits) || 0)
                + Math.max(0, Number(devastating) || 0)
                + Math.max(0, Number(talentBonus) || 0);
  return { pierced: true, magLoss, absorbed: abs };
}

/**
 * Массивный урон за Раунд: 25% и более стартовой Магнитуды требуют теста
 * W+Магнитуда, а его Провалы стоят ещё Провалы×3 Магнитуды.
 *
 * Порог берётся от СТАРТОВОЙ Магнитуды (правило говорит «25%+ начальной»),
 * а бонус к тесту — от текущей: чем меньше осталось, тем меньше опоры.
 */
export function massDamageThreshold(startMagnitude) {
  return Math.ceil(Math.max(0, Number(startMagnitude) || 0) * 0.25);
}

/** Достаточно ли накоплено урона за Раунд, чтобы требовать тест W+Магнитуда. */
export function needsMassDamageTest({ roundDamage = 0, startMagnitude = 0 } = {}) {
  const threshold = massDamageThreshold(startMagnitude);
  return threshold > 0 && (Number(roundDamage) || 0) >= threshold;
}

/**
 * Психологический урон от провала теста.
 *   massDamage — тест W+Магнитуда после массивных потерь: Провалы×3
 *   fear       — провал теста на Страх: Провалы×2
 *   intimidate — провал против Запугивания: Провалы×1
 */
export const PSYCH_MULTIPLIERS = { massDamage: 3, fear: 2, intimidate: 1 };

export function psychDamageFor(kind, degreesOfFailure) {
  const mult = PSYCH_MULTIPLIERS[kind] ?? 0;
  return Math.max(0, Number(degreesOfFailure) || 0) * mult;
}

/**
 * Состояние Орды по доле оставшейся Магнитуды.
 *   steady   — боеспособна
 *   weakened — потеряно больше 50%: −10 на тесты W, психологический урон не
 *              лечится 10−W.b часов
 *   broken   — 25% и меньше: рассыпается. Орды, автоматически проходящие тесты
 *              на Страх и Запугивание, Сломлены быть не могут.
 */
export function hordeState({ value = 0, start = 0, immune = false } = {}) {
  const v = Math.max(0, Number(value) || 0);
  const s = Math.max(0, Number(start) || 0);
  const pct = s > 0 ? v / s : 1;
  if (!immune && pct <= 0.25) return "broken";
  if (pct <= 0.50) return "weakened";
  return "steady";
}

/** Штраф Ослабленной Орды к тестам Воли. */
export const WEAKENED_WP_PENALTY = -10;

/** Сколько часов Ослабленная Орда не может лечить психологический урон. */
export function noRecoveryHours(wpBonus) {
  return Math.max(0, 10 - (Number(wpBonus) || 0));
}

/**
 * Прячась в Орде: куда уходят попадания не-Избирательной стрелковой атаки по
 * персонажу, стоящему в союзной Орде.
 *
 * Одиночный выстрел решается чётностью броска на попадание: чётный — в
 * персонажа, нечётный — в Орду. Очередь вместо этого раздаёт Орде каждое
 * нечётное по счёту попадание (1-е, 3-е, 5-е…).
 *
 * @param {object}  o
 * @param {number}  o.hitsCount число попаданий атаки
 * @param {number}  o.rv        бросок на попадание (для одиночного выстрела)
 * @param {boolean} [o.burst]   атака очередью
 * @returns {boolean[]} по попаданию: true — ушло в Орду
 */
export function hitsAbsorbedByHorde({ hitsCount = 0, rv = 0, burst = false } = {}) {
  const count = Math.max(0, Number(hitsCount) || 0);
  if (count === 0) return [];
  if (burst) return Array.from({ length: count }, (_, i) => i % 2 === 0);
  // Одиночное попадание: нечётный бросок уводит его в Орду целиком.
  const toHorde = (Math.abs(Number(rv) || 0) % 2) === 1;
  return Array.from({ length: count }, () => toHorde);
}
