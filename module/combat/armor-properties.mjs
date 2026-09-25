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
    gorgetRating: 0, jointArmourRating: 0, apBonusByType: {},
    // Подвиды урона (wdbc-q0q8) — те же три директивы, что noApVsType/
    // doubleApVsType/apBonusVsType выше, но ключом служит DAMAGE_SUBTYPES
    // (crushing/fragmentation/electrical/flame/laser/toxic), а не DAMAGE_TYPES:
    // множества, не булевы поля — иначе на каждый подвид пришлось бы заводить
    // свой noEnergy-подобный флаг, ×6 к размеру объекта.
    noApVsSubtype: {}, doubleApVsSubtype: {}, tripleApVsSubtype: {}, apBonusBySubtype: {}
  };
  for (const p of props) {
    const au = p.def.auto;
    if (!au) continue;
    if (au.noApVsType === "energy")   a.noEnergy = true;
    if (au.noApVsType === "impact")   a.noImpact = true;
    if (au.doubleApVsType === "blast") a.doubleBlast = true;
    if (au.noApVsSubtype)     a.noApVsSubtype[au.noApVsSubtype] = true;
    if (au.doubleApVsSubtype) a.doubleApVsSubtype[au.doubleApVsSubtype] = true;
    // Вулканизированный Плащ (wdbc-q0q8) — единственный источник ×3, отдельно
    // от doubleApVsSubtype (Flak, ×2), чтобы не путать множители на чтении.
    if (au.tripleApVsSubtype) a.tripleApVsSubtype[au.tripleApVsSubtype] = true;
    if (au.apBonusVsSubtype) {
      const st = au.apBonusVsSubtype;
      a.apBonusBySubtype[st] = (a.apBonusBySubtype[st] || 0) + (Number(ratings[p.key]) || 0);
    }
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
    // Joint Lining (wdbc-aq4c, Панцирь Темпестус): рейтинг X — гарантированный
    // минимум AP при попадании в Сочленение/Шею, см. resolveArmorAbsorptionAP.
    if (au.jointArmour) a.jointArmourRating = Math.max(a.jointArmourRating, Number(ratings[p.key]) || 0);
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

/** OR множества подвидов (noApVsSubtype/doubleApVsSubtype) двух предметов. */
function orSubtypeSet(a = {}, b = {}) {
  const out = { ...a };
  for (const k of Object.keys(b)) if (b[k]) out[k] = true;
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
    gorgetRating:            Math.max(a.gorgetRating || 0, b.gorgetRating || 0),
    jointArmourRating:       Math.max(a.jointArmourRating || 0, b.jointArmourRating || 0),
    noApVsSubtype:           orSubtypeSet(a.noApVsSubtype, b.noApVsSubtype),
    doubleApVsSubtype:       orSubtypeSet(a.doubleApVsSubtype, b.doubleApVsSubtype),
    tripleApVsSubtype:       orSubtypeSet(a.tripleApVsSubtype, b.tripleApVsSubtype)
  };
}

const EMPTY_FLAGS = Object.freeze({
  noEnergy: false, noImpact: false, doubleBlast: false,
  noRanged: false, noJointCalled: false, noEyeCalled: false,
  blocksPrimitiveDouble: false, noJointReduction: false, isPowerArmor: false,
  frontArcNoProtect: false, runesOfProtection: false, gorgetRating: 0, jointArmourRating: 0,
  noApVsSubtype: Object.freeze({}), doubleApVsSubtype: Object.freeze({}), tripleApVsSubtype: Object.freeze({})
});

export function emptyArmorLocFlags() {
  return { ...EMPTY_FLAGS };
}

/**
 * Пробитие Брони (core.json, «Раны и Урон», стр. 42; wdbc-x1nz.2.78) —
 * отдельный от обычного Поглощения расчёт: «AP удваивается (или утраивается
 * против I(Cr) Dmg) в расчёте Поглощения, но T.b игнорируется. Если в таком
 * расчёте попадание нанесло бы непоглощённый урон, это считается как
 * пробитие брони». Pen вычитается ДО умножения — effArmorAP уже после Pen/
 * Копья, как в обычном Поглощении (книга порядок не называет). Остальные
 * слагаемые Поглощения, не являющиеся T.b (аблативный AP-щит, Адаптация,
 * плоское снижение урона), входят как есть, без умножения. Чистая функция.
 *
 * @returns {{breached: boolean, breachAbsorption: number}}
 */
export function armorBreachOutcome({ rawDamage, effArmorAP = 0, damageSubtype = "", otherAbsorption = 0 }) {
  const mult = damageSubtype === "crushing" ? 3 : 2;
  const breachAbsorption = Math.max(0, Number(effArmorAP) || 0) * mult + (Number(otherAbsorption) || 0);
  return { breached: (Number(rawDamage) || 0) - breachAbsorption > 0, breachAbsorption };
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
 * Обнуляет ли свойство брони её AP против ЭТОГО попадания. Одно правило на
 * два случая: флаги одного предмета (слой, wdbc-x1nz.2.81) и слитые флаги
 * всей локации (прежний путь, если слоёв нет).
 */
export function armorNulledBy(f, { damageType, damageSubtype = "", melee = false, hitLocation = "", frontArcHit = false } = {}) {
  if (!f) return false;
  return !!((f.noEnergy && damageType === "energy")
    || (f.noImpact && damageType === "impact")
    || (damageSubtype && f.noApVsSubtype?.[damageSubtype])
    || (f.noRanged && !melee)
    || (f.noJointCalled && hitLocation === "Сочленение / Шея")
    || (f.noEyeCalled && hitLocation === "Глаз (Голова)")
    || (f.frontArcNoProtect && frontArcHit));
}

/** Флаги-обнулители одного предмета — то, что кладётся в его слой. */
export function armorNullers(propAuto = {}) {
  return {
    noEnergy: !!propAuto.noEnergy, noImpact: !!propAuto.noImpact,
    noApVsSubtype: { ...(propAuto.noApVsSubtype || {}) },
    noRanged: !!propAuto.noRanged, noJointCalled: !!propAuto.noJointCalled,
    noEyeCalled: !!propAuto.noEyeCalled, frontArcNoProtect: !!propAuto.frontArcNoProtect
  };
}

/**
 * AP носимой брони локации из её слоёв — тем же порядком и правилом, что
 * rules/character/armour.mjs: «stacks» складывается, прочие берут лучшее.
 * keep — какие слои считать (прочие как будто сняты).
 */
export function wornLayersAP(layers, keep = () => true) {
  let acc = 0;
  for (const l of layers ?? []) {
    if (!keep(l)) continue;
    const ap = Math.max(0, Number(l.ap) || 0);
    acc = l.stacks ? acc + ap : Math.max(acc, ap);
  }
  return acc;
}

/** Попадание «в голову» для правил вида урона (I(Cr)): голова и глаз. */
export function isHeadHit(hitLocation) {
  return hitLocation === "Голова" || hitLocation === "Глаз (Голова)";
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
 * @param {number}  subtypeBonus доп. AP против damageSubtype (моды/свойства брони,
 *   wdbc-q0q8) — та же роль, что vsTypeBonus, но на уровень точнее
 * @param {string}  damageSubtype "crushing"|"fragmentation"|"electrical"|"flame"|
 *   "laser"|"toxic"|"" — подвид урона из скобок книги (см. DAMAGE_SUBTYPES),
 *   пустая строка — книга не называет подвид у этой атаки
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
 * @param {?object[]} layers  слои носимой брони этой локации ({ap, stacks,
 *   nullers}, rules/character/armour.mjs). wdbc-x1nz.2.81: Мягкая, Проводящая
 *   и прочие обнулители снимают AP ТОЛЬКО своего предмета — жёсткие слои и
 *   естественная броня остаются. Без слоёв — прежний путь: слитые flags
 *   обнуляют всю локацию.
 * @param {number}  otherWornAP  лучшее из не-предметного носимого AP локации
 *   (ручное поле, пол, щит) — с ним сравнивается остаток слоёв.
 * @param {boolean} locationNulled  обнулить локацию целиком (Ртуть: вся часть
 *   тела «электропроводна», не один предмет).
 */
export function resolveArmorAbsorptionAP({
  baseArmorAP, vsTypeBonus = 0, damageType, subtypeBonus = 0, damageSubtype = "",
  melee = false, hitLocation = "",
  primitive = false, flags = null, frontArcHit = false, wornAP = null,
  layers = null, otherWornAP = 0, locationNulled = false
}) {
  const pf = flags || emptyArmorLocFlags();
  const hit = { damageType, damageSubtype, melee, hitLocation, frontArcHit };
  if (locationNulled) return 0;
  if (Array.isArray(layers)) {
    const other = Math.max(0, Number(otherWornAP) || 0);
    const drop = Math.max(wornLayersAP(layers), other)
               - Math.max(wornLayersAP(layers, l => !armorNulledBy(l.nullers, hit)), other);
    baseArmorAP = Math.max(0, baseArmorAP - drop);
    if (wornAP != null) wornAP = Math.max(0, (Number(wornAP) || 0) - drop);
  } else if (armorNulledBy(pf, hit)) return 0;

  // I(Cr) по голове (Виды Урона, wdbc-x1nz.2.80): «игнорирует половину
  // (окр.▼) брони головы» — остаётся большая половина, ⌈AP/2⌉.
  const halveHead = ap => (damageSubtype === "crushing" && isHeadHit(hitLocation)) ? Math.ceil(ap / 2) : ap;

  // Попадание в Глаз — попадание в голову, игнорирующее AP шлема целиком
  // (стр. 34), кроме силовых шлемов: у них по правилам дома всё равно есть
  // 4 AP на линзы очей. Плоское значение, а не доля от базового AP.
  // Естественная броня (Черты, импланты) — не шлем, она остаётся.
  if (hitLocation === "Глаз (Голова)") {
    const natural = wornAP == null ? 0 : Math.max(0, baseArmorAP - (Number(wornAP) || 0));
    return halveHead(natural + (pf.isPowerArmor ? 4 : 0));
  }

  let ap = halveHead(baseArmorAP + vsTypeBonus + subtypeBonus);
  // Попадание в Сочленение/Шею — AP этой части тела втрое меньше настоящего,
  // округление вниз (стр. 34). У брони без сочленений (Мягкая) выцелить
  // нечего — идёт полный AP.
  if (hitLocation === "Сочленение / Шея" && !pf.noJointReduction) {
    ap = Math.floor(ap / 3);
    // Joint Lining (wdbc-aq4c, Панцирь Темпестус, стр. 229): «AP 4 на
    // сочленениях» — не бонус К расчёту, а ГАРАНТИРОВАННЫЙ МИНИМУМ поверх
    // него: Math.max, никогда не хуже обычного ÷3 (напр. при бонусе против
    // подвида урона обычное деление уже может дать больше 4 — тогда его и
    // берём), только поднимает низкое значение до X.
    if (pf.jointArmourRating) ap = Math.max(ap, pf.jointArmourRating);
  }
  if (pf.doubleBlast && damageType === "blast") ap *= 2;
  if (damageSubtype && pf.doubleApVsSubtype?.[damageSubtype]) ap *= 2;
  if (damageSubtype && pf.tripleApVsSubtype?.[damageSubtype]) ap *= 3;
  if (primitive && !pf.blocksPrimitiveDouble && ap > 0) ap += Math.min(ap, 6);
  return ap;
}
