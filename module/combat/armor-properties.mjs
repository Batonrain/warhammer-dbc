// module/combat/armor-properties.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ДВИЖОК АВТОМАТИЗАЦИИ ОСОБЫХ СВОЙСТВ БРОНИ
//  Читает system.properties[] брони (плоский массив строк-ключей, в отличие от
//  оружия — у свойств брони в данных нет рейтинга), сопоставляет с реестром
//  ARMOR_PROPERTIES (module/constants/items.mjs) и сворачивает directives auto.*
//  одной брони в плоский набор флагов. Дальше:
//  - module/documents/actor.mjs собирает флаги ВСЕХ надетых предметов брони по
//    локациям в system.absorption.propFlags[loc] (см. комментарий там же);
//  - module/combat/damage.mjs читает propFlags[armorKey] при поглощении урона.
// ─────────────────────────────────────────────────────────────────────────────

import { ARMOR_PROPERTIES } from "../constants/items.mjs";

/** Разрешает system.properties[] (массив строк-ключей) брони в список с .def. */
export function resolveArmorProps(item) {
  const keys = item?.system?.properties;
  if (!Array.isArray(keys)) return [];
  return keys
    .map(key => ({ key, def: ARMOR_PROPERTIES[key] }))
    .filter(p => p.def);
}

/**
 * Сворачивает auto.* директивы свойств ОДНОГО предмета брони в плоский набор
 * флагов, который actor.mjs распределяет по локациям (см. armorLocPropFlags).
 *
 * @param {object} [ratings]  item.system.propRatings этого же предмета — сюда
 *   ходят свойства с рейтингом X (Gorget/Protective), у брони, в отличие от
 *   оружия, рейтинг хранится не рядом с ключом свойства, а в отдельном
 *   свободном реестре (см. data/item/armor.mjs).
 */
export function aggregateArmorAuto(props, ratings = {}) {
  const a = {
    noEnergy: false, noImpact: false, doubleBlast: false,
    noRanged: false, noJointCalled: false, noEyeCalled: false,
    blocksPrimitiveDouble: false, noJointReduction: false, isPowerArmor: false,
    frontArcNoProtect: false, runesOfProtection: false,
    gorgetRating: 0, apBonusByType: {}
  };
  for (const p of props) {
    const au = p.def.auto;
    if (!au) continue;
    if (au.noApVsType === "energy")   a.noEnergy = true;
    if (au.noApVsType === "impact")   a.noImpact = true;
    if (au.doubleApVsType === "blast") a.doubleBlast = true;
    if (au.noApRanged)      a.noRanged = true;
    if (au.noApJointCalled) a.noJointCalled = true;
    if (au.noApEyeCalled)   a.noEyeCalled = true;
    if (au.blocksPrimitiveDouble) a.blocksPrimitiveDouble = true;
    if (au.noJointReduction) a.noJointReduction = true;
    // Cloak / Плащ (wdbc-p5el): не защищает от атак с передней арки 90° —
    // геометрия (isFrontArcHit, combat/facing.mjs) считается снаружи и
    // приходит в resolveArmorAbsorptionAP параметром frontArcHit, здесь
    // только флаг «у этой локации вообще есть такое свойство».
    if (au.frontArcNoProtect) a.frontArcNoProtect = true;
    // Runes of Protection (wdbc-tejb): тест на AP-бонус при попадании —
    // читает damage.mjs::applyDamageToActor, сам бросок не здесь.
    if (au.runesOfProtection) a.runesOfProtection = true;
    // Gorget (wdbc-8b5): рейтинг X — порог 1d10 кнопки на карточке атаки
    // (combat/attack.mjs). Несколько предметов на одной локации (редкость) —
    // берём лучший рейтинг, как и остальные числовые бонусы брони.
    if (au.gorget) a.gorgetRating = Math.max(a.gorgetRating, Number(ratings[p.key]) || 0);
    // Protective (wdbc-8b5): +X AP против конкретного damageType — та же
    // точность/упрощение, что уже принята для armorVsType от модов брони
    // (rules/character.mjs): не привязано к конкретной локации, суммируется
    // по всем надетым предметам с этим свойством.
    if (au.apBonusVsType) {
      const t = au.apBonusVsType;
      a.apBonusByType[t] = (a.apBonusByType[t] || 0) + (Number(ratings[p.key]) || 0);
    }
  }
  return a;
}

/**
 * Модификаторы Навыков от свойств ОДНОГО предмета брони (Heavy/Stealthed и
 * подобные) — плоская карта {skillKey: дельта}, суммируется по всем auto.
 * skillMod свойствам предмета. Отдельно от aggregateArmorAuto: тот считает
 * флаги для поглощения урона (damage.mjs), это — для диалога броска Навыка
 * (module/sheets/actor-sheet.mjs::_armorSkillModsHtml, wdbc-vzyi).
 */
export function aggregateArmorSkillMods(props) {
  const out = {};
  for (const p of props) {
    const skillMod = p.def.auto?.skillMod;
    if (!skillMod) continue;
    for (const [skillKey, value] of Object.entries(skillMod)) out[skillKey] = (out[skillKey] || 0) + value;
  }
  return out;
}

/** OR флагов нескольких предметов брони, покрывающих одну и ту же локацию. */
export function mergeArmorLocFlags(a, b) {
  return {
    noEnergy:              a.noEnergy || b.noEnergy,
    noImpact:               a.noImpact || b.noImpact,
    doubleBlast:            a.doubleBlast || b.doubleBlast,
    noRanged:                a.noRanged || b.noRanged,
    noJointCalled:           a.noJointCalled || b.noJointCalled,
    noEyeCalled:             a.noEyeCalled || b.noEyeCalled,
    blocksPrimitiveDouble:   a.blocksPrimitiveDouble || b.blocksPrimitiveDouble,
    noJointReduction:        a.noJointReduction || b.noJointReduction,
    isPowerArmor:            a.isPowerArmor || b.isPowerArmor,
    frontArcNoProtect:       a.frontArcNoProtect || b.frontArcNoProtect,
    runesOfProtection:       a.runesOfProtection || b.runesOfProtection,
    gorgetRating:            Math.max(a.gorgetRating || 0, b.gorgetRating || 0)
  };
}

const EMPTY_FLAGS = Object.freeze({
  noEnergy: false, noImpact: false, doubleBlast: false,
  noRanged: false, noJointCalled: false, noEyeCalled: false,
  blocksPrimitiveDouble: false, noJointReduction: false, isPowerArmor: false,
  frontArcNoProtect: false, runesOfProtection: false, gorgetRating: 0
});

export function emptyArmorLocFlags() {
  return { ...EMPTY_FLAGS };
}

/**
 * Помечает надетую броню, покрывающую локацию, как пробитую (wdbc-k0ff) —
 * общее состояние между ударами, а не привязанное к конкретному свойству:
 * ЧТО означает пробитие (теряет Sealed, теряет ещё что-то) решает читатель
 * флага, не эта функция. Уже пробитую не трогает повторно (нет смысла — раз
 * пробита, чинить действием система пока не умеет). Несколько предметов,
 * покрывающих одну локацию (stacks:true) — помечаются все разом: удар,
 * пробивший суммарный AP, компрометирует весь слой, не один конкретный предмет.
 * @param {Actor} actor
 * @param {string} armorKey  "head"/"body"/"leftArm"/... — как в LOCATION_TO_ARMOR
 * @returns {Promise<number>} число помеченных предметов
 */
export async function breachArmorAtLocation(actor, armorKey) {
  const items = (actor?.items ?? []).filter(i =>
    i.type === "armor" && i.system?.equipped
    && (Number(i.system?.[armorKey]) || 0) > 0
    && !i.system?.breached
  );
  // Один запрос на все предметы: по item.update() на каждый — это круг до
  // сервера и перерисовка листов на каждое попадание (ср. resetActionEconomy).
  if (items.length) {
    await actor.updateEmbeddedDocuments("Item", items.map(i => ({ _id: i.id, "system.breached": true })));
  }
  return items.length;
}

/**
 * Считает итоговый AP брони одной локации против одного попадания, применяя
 * флаги её свойств (см. mergeArmorLocFlags). Чистая функция — не знает про
 * пробитие/T.b/Копьё, это делает вызывающая сторона (module/combat/damage.mjs)
 * до и после.
 *
 * @param {number}  baseArmorAP  AP брони этой локации до бонусов/свойств
 * @param {number}  vsTypeBonus  доп. AP против damageType (моды брони)
 * @param {string}  damageType   "energy"|"impact"|"rending"|"blast"|"chemical"
 * @param {boolean} melee        атака была рукопашной (не стрелковой)
 * @param {string}  hitLocation  метка попадания (для Сочленения/Глаза)
 * @param {boolean} primitive    атакующее оружие имеет свойство Primitive
 * @param {object}  flags        propFlagsByLoc[armorKey] (mergeArmorLocFlags/emptyArmorLocFlags)
 * @param {boolean} frontArcHit  атака пришла из передней дуги защищающегося
 *   (combat/facing.mjs::isFrontArcHit, wdbc-p5el) — снимает AP локации с
 *   Cloak/Плащом. Геометрия считается снаружи (нужны токены сцены), сюда
 *   приходит уже готовым булевым.
 * @param {number|null} wornAP  часть baseArmorAP от носимой брони/щита
 *   (absorption.wornOnly); остаток — естественная броня Черт/имплантов.
 *   Нужен только правилу Глаза; null — считать весь baseArmorAP носимым.
 */
export function resolveArmorAbsorptionAP({
  baseArmorAP, vsTypeBonus = 0, damageType, melee = false, hitLocation = "",
  primitive = false, flags = null, frontArcHit = false, wornAP = null
}) {
  const pf = flags || emptyArmorLocFlags();
  const armorNulled = (pf.noEnergy && damageType === "energy")
                    || (pf.noImpact && damageType === "impact")
                    || (pf.noRanged && !melee)
                    || (pf.noJointCalled && hitLocation === "Сочленение / Шея")
                    || (pf.noEyeCalled  && hitLocation === "Глаз (Голова)")
                    || (pf.frontArcNoProtect && frontArcHit);
  if (armorNulled) return 0;

  // Попадание в Глаз — попадание в голову, игнорирующее AP шлема целиком
  // (стр. 34), кроме силовых шлемов: у них по правилам дома всё равно есть
  // 4 AP на линзы очей. Плоское значение, а не доля от базового AP.
  // Естественная броня (Черты, импланты) — не шлем, она остаётся.
  if (hitLocation === "Глаз (Голова)") {
    const natural = wornAP == null ? 0 : Math.max(0, baseArmorAP - (Number(wornAP) || 0));
    return natural + (pf.isPowerArmor ? 4 : 0);
  }

  let ap = baseArmorAP + vsTypeBonus;
  // Попадание в Сочленение/Шею — AP этой части тела втрое меньше настоящего,
  // округление вниз (стр. 34). У брони без сочленений (Мягкая) выцелить
  // нечего — идёт полный AP.
  if (hitLocation === "Сочленение / Шея" && !pf.noJointReduction) ap = Math.floor(ap / 3);
  if (pf.doubleBlast && damageType === "blast") ap *= 2;
  if (primitive && !pf.blocksPrimitiveDouble && ap > 0) ap += Math.min(ap, 6);
  return ap;
}
