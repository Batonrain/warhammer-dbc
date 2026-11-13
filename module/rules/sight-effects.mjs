// module/rules/sight-effects.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Даёт ли активный прицел эффект X» — ОДИН вопрос для всех прицелов
//  (Sahara task-e683, Омни-Прицел; книга, «Модификации → Прицелы»).
//
//  Прицелы опознавались по-разному: по имени (Оптический и Джинн гасят штраф
//  дальней дистанции, Термальный — слабого света, Джинн — дыма:
//  rules/range-penalty-immunity.mjs, rules/vision-penalty-immunity.mjs) и по
//  полям мода (Коллиматорный `aimAttackMod`, Предсказатель `aimIgnoresRunning`,
//  Целеуказатель `rofSemi/FullAttackMod`, Лазерный `rofSingleAttackMod`). Омни-
//  Прицел «комбинирует эффекты всех остальных прицелов», и расти он должен без
//  правки каждого читателя, поэтому читатели спрашивают здесь:
//    • sightGrants(моды, эффект)  — есть ли среди модов тот, что даёт эффект
//      (по имени; Омни отвечает «да» на любой);
//    • sightEffectsOf(мод)        — поля `system.effects` мода, а для Омни —
//      поля, дополненные числами всех остальных прицелов (OMNI_COMBINED).
//
//  Условия эффектов («(Прицеливание)») остаются у читателей: Омни наследует их,
//  потому что эффект приходит в те же самые места проверки.
//
//  Требование «Интегрируется с X» у Омни — своё собственное (requiresWorn Омни:
//  Ретинальный Дисплей или Бионический Глаз, MIU книга здесь не называет), а не
//  объединение требований других прицелов: Целеуказатель просит ещё и MIU, но
//  внутри Омни он «растворён» и своего требования не приносит (рекомендация
//  задачи task-e683). Гейт — combat/weapon-mods.mjs::modWornRequirementMet.
//
//  Чистая логика без Foundry. Единственный импорт — item-marker; из rules/sources.mjs
//  модуль не импортируется, так что круга через source-registry нет.
// ════════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";

export const OMNI_SIGHT_NAME = "Omni-Sight";

/** Эффекты прицелов, опознаваемые по имени мода. */
export const SIGHT_EFFECT = Object.freeze({
  /** Нет штрафов дальней и экстремальной дистанции («прицеливание»). */
  longRange: "longRange",
  /** Игнор штрафов слабого света и тьмы («прицеливание»). */
  lowLight: "lowLight",
  /** Силуэты в дыму и тумане видны («прицеливание»). */
  smoke: "smoke",
  /** Лазерная точка: врагов можно заметить Awareness−10 и узнать стрелка. */
  laserDot: "laserDot"
});

// Какие прицелы (английская половина имени) дают эффект сами по себе. Массивы — отдельными
// константами и опознание — отдельной строкой на каждый: именно такую форму видит сторож имён
// test/rules/talent-name-literals.test.mjs (имя в таблице-словаре он бы не нашёл).
const LONG_RANGE_SIGHTS = ["Optical Sight", "Djinn Sight"];
const LOW_LIGHT_SIGHTS = ["Thermal Sight"];
const SMOKE_SIGHTS = ["Djinn Sight"];
const LASER_DOT_SIGHTS = ["Laser Sight"];

const GRANTED_BY = Object.freeze({
  [SIGHT_EFFECT.longRange]: m => LONG_RANGE_SIGHTS.some(n => itemIs(m, "weaponMod", null, n)),
  [SIGHT_EFFECT.lowLight]: m => LOW_LIGHT_SIGHTS.some(n => itemIs(m, "weaponMod", null, n)),
  [SIGHT_EFFECT.smoke]: m => SMOKE_SIGHTS.some(n => itemIs(m, "weaponMod", null, n)),
  [SIGHT_EFFECT.laserDot]: m => LASER_DOT_SIGHTS.some(n => itemIs(m, "weaponMod", null, n))
});

/**
 * Числовые и булевы поля `system.effects`, которые несут прицелы, — в объединённом
 * виде, как их получает Омни-Прицел. Сторож test/combat/weapon-mod-sights-omni.test.mjs
 * сверяет таблицу с настоящими модами пака: поменяли число у Коллиматорного —
 * тест падает и просит поправить его здесь.
 */
export const OMNI_COMBINED = Object.freeze({
  aimAttackMod: 5,            // Коллиматорный: (Прицеливание) +5 к попаданию
  aimIgnoresRunning: true,    // Предсказатель Движения: (Прицеливание) без штрафа за бег цели
  rofSingleAttackMod: 10,     // Лазерный: +10 к попаданию одиночным
  rofSemiAttackMod: 5,        // Целеуказатель: +5 короткой очередью
  rofFullAttackMod: 10        // Целеуказатель: +10 длинной очередью
});

/** Омни-Прицел ли этот мод. */
export const isOmniSight = mod => itemIs(mod, "weaponMod", null, OMNI_SIGHT_NAME);

/**
 * Мод среди `mods`, который даёт эффект, либо null. Омни-Прицел даёт любой.
 * @param {object[]} mods  действующие моды оружия (combat/weapon-mods.mjs::getActiveMods)
 * @param {string} effect  одно из SIGHT_EFFECT
 */
export function sightGrants(mods, effect) {
  const grantedBy = GRANTED_BY[effect];
  if (!grantedBy) throw new Error(`sight-effects: неизвестный эффект прицела «${effect}»`);
  return (mods ?? []).find(m => isOmniSight(m) || grantedBy(m)) ?? null;
}

/**
 * Поля `system.effects` мода с учётом «комбинирует эффекты всех остальных
 * прицелов»: у Омни каждое поле таблицы OMNI_COMBINED не меньше объединённого
 * (max, не сумма — прицел за атаку один, а собственные числа Омни, если их
 * когда-нибудь внесут, не должны удваиваться). Остальные моды отдают свои поля как есть.
 */
export function sightEffectsOf(mod) {
  const own = mod?.system?.effects || {};
  const omni = isOmniSight(mod);
  // Лазерный Прицел по имени получает свои +10 одиночным и у старых копий на акторах (созданных до правки
  // пака, у них rofSingleAttackMod = 0, пока ГМ не нажмёт «Обновить мир»): иначе шёпот «Лазерная точка» —
  // плата — появилась бы раньше бонуса. max, не сумма: у синхронизированной копии бонус не удвоится.
  const laser = !omni && LASER_DOT_SIGHTS.some(n => itemIs(mod, "weaponMod", null, n));
  if (!omni && !laser) return own;
  const out = { ...own };
  if (laser) {
    out.rofSingleAttackMod = Math.max(Number(own.rofSingleAttackMod) || 0, OMNI_COMBINED.rofSingleAttackMod);
    return out;
  }
  for (const [key, combined] of Object.entries(OMNI_COMBINED)) {
    out[key] = typeof combined === "boolean" ? !!(own[key] || combined) : Math.max(Number(own[key]) || 0, combined);
  }
  return out;
}
