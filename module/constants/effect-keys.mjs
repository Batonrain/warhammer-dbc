// module/constants/effect-keys.mjs
// ════════════════════════════════════════════════════════════════════════
//  Реестр «известных» путей system.* на акторе, которые эффекты предмета
//  (Foundry ActiveEffect) вправе менять, плюс подписи для отображения на
//  вкладке «Эффекты» и в редакторе. Используется:
//   - сводкой в списке эффектов на листе предмета (item-sheet.mjs);
//   - миграцией старых system.effects.* в embedded ActiveEffect;
//   - вайтлистом при заполнении библиотеки/тестах (module/apps/effects.mjs).
//
//  Каждый путь считается ФИНАЛЬНЫМ полем — эффект должен применяться в фазе
//  "final" (после prepareDerivedData), иначе его тут же перепишет авто-расчёт
//  листа. См. план: Foundry уже вызывает applyActiveEffects("final") в конце
//  Actor#prepareData(), автору эффекта достаточно проставить phase:"final".
// ════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "./characteristics.mjs";

// Складываемая надбавка AP по зонам. Цель — system.armorBonus.<зона>, ХРАНИМОЕ
// поле схемы, поэтому фаза у него "initial": расчёт листа читает его в середине
// prepareDerivedData (рядом с естественной бронёй Черт), а не после. Тот же
// приём, что у system.encumbrance.indexBonus.
//
// До wdbc-b3m ключ звался system.armour.<зона> — такого поля у актора нет
// вовсе: в схеме system.armor, и это ручной блок, который берётся через
// Math.max, а не складывается. Эффекты писали в никуда.
export const AP_LOCATIONS = {
  head: "Голова", body: "Тело", leftArm: "Левая рука", rightArm: "Правая рука",
  leftLeg: "Левая нога", rightLeg: "Правая нога"
};

// Надбавка AP против конкретного типа урона. Цель — производное
// system.absorption.vsType (documents/actor.mjs собирает его в конце разбора
// брони), поэтому фаза только "final": до prepareDerivedData объекта ещё нет,
// а сам он каждый цикл собирается заново. Читает поглощение combat/damage.mjs.
const AP_VS_TYPES = {
  energy: "Энергетического", impact: "Ударного",
  rending: "Разрывного", blast: "Взрывного"
};

/** Путь → подпись. Генерируется из CHARACTERISTICS + AP_LOCATIONS + ручные записи. */
export const EFFECT_KEY_LABELS = {};
for (const [key, def] of Object.entries(CHARACTERISTICS)) {
  if (key === "inf") continue; // Инф — не характеристика с бонусом/значением на листе
  EFFECT_KEY_LABELS[`system.characteristics.${key}.bonusFx`] = `${def.abbr} (бонус, Unnatural)`;
  EFFECT_KEY_LABELS[`system.characteristics.${key}.totalFx`] = `${def.abbr} (значение)`;
}
for (const [key, label] of Object.entries(AP_LOCATIONS)) {
  EFFECT_KEY_LABELS[`system.armorBonus.${key}`] = `AP: ${label}`;
}
for (const [key, label] of Object.entries(AP_VS_TYPES)) {
  EFFECT_KEY_LABELS[`system.absorption.vsType.${key}`] = `AP против ${label}`;
}
Object.assign(EFFECT_KEY_LABELS, {
  "system.fearRating":  "Рейтинг Страха",
  "system.sizeMod":     "Размер (модификатор)",
  "system.initiative":  "Инициатива",
  "system.speed":       "Скорость",
  "system.incomingDamageReduction": "Снижение входящего урона",
  // Экономика действий (стр. 12, module/combat/action-economy.mjs) — надбавка
  // к максимуму пула, складывается с базой 2 ОД / 1 Реакция. Пример: Eldar
  // Agility «+1 ОД в начале каждого хода, до 3 взятий» — берётся Талантом
  // с активируемым эффектом (см. armor-mod.mjs activatable/active), не голым
  // ADD на списанном предмете.
  "system.actionPoints.max":    "ОД (максимум)",
  "system.reactions.max":       "Реакции (максимум, универсальные)",
  "system.reactions.defenseMax": "Реакции (максимум, только Избегание)"
});

/** Все пути, куда разрешено целиться эффектам (используется тестами/миграцией). */
export const EFFECT_KEY_WHITELIST = Object.freeze(Object.keys(EFFECT_KEY_LABELS));

/**
 * type change (Foundry ActiveEffect) → короткая русская подпись для сводки.
 *
 * Первые шесть — штатные типы ядра. Деление своё: у Foundry его нет, и
 * divideUp/divideDown применяет хук "applyActiveEffect" в warhammer-dbc.mjs.
 * Без подписи сводка на листе предмета печатала бы «divideUp2» — единственное
 * место, где эти два типа выглядели чужими.
 */
export const EFFECT_TYPE_LABELS = {
  add: "+", subtract: "−", multiply: "×", override: "=",
  upgrade: "↑ (не меньше)", downgrade: "↓ (не больше)",
  divideUp: "÷↑ (вверх)", divideDown: "÷↓ (вниз)"
};

// Ключи, которые обязаны применяться ДО расчёта листа: это ХРАНИМЫЕ поля, из
// которых prepareDerivedData считает производные. Поставить им "final" — значит
// записать поверх уже посчитанного и не повлиять ни на что. Всем остальным,
// наоборот, нужна "final": расчёт перезапишет их сам.
const INITIAL_PHASE_KEYS = [
  "system.armorBonus.",             // складываемая надбавка AP (см. AP_LOCATIONS)
  "system.encumbrance.indexBonus.", // сдвиг индекса грузоподъёмности (apps/mechanics.mjs)
  "system.movement.spdBonus",       // SPD — вход расчёта перемещений, а не его итог
  "system.sizeMod",                 // Размер от Черт — сам вход SPD (documents/actor.mjs
                                     // складывает его в traitSizeMod ДО calcMovement);
                                     // "final" ложился поверх посчитанного SPD и не
                                     // успевал в движение, хотя бейдж на листе был верный
  "system.incomingDamageReduction",  // плоское снижение урона (combat/damage.mjs читает
                                      // ХРАНИМОЕ поле напрямую, не производное)
  "system.actionPoints.max",         // база экономики действий — ХРАНИМОЕ поле,
  "system.reactions.max",            // сбрасывается в .value каждый Ход
  "system.reactions.defenseMax"      // (module/combat/action-economy.mjs)
];

/** Фаза, в которой ключ обязан применяться. */
export function expectedPhase(key = "") {
  // Надбавки характеристики — своё поле у каждой (bonusFx/totalFx), поэтому
  // по хвосту, а не по началу. Они ХРАНИМЫЕ и входят в расчёт Значения и
  // Бонуса (documents/actor.mjs): фаза "final" легла бы поверх готового числа
  // и не дошла бы ни до брони, ни до навыков.
  if (key.endsWith(".bonusFx") || key.endsWith(".totalFx")) return "initial";
  return INITIAL_PHASE_KEYS.some(p => key.startsWith(p)) ? "initial" : "final";
}

/** Путь → подпись, либо сам путь без "system." для незнакомых полей. */
export function effectKeyLabel(key = "") {
  return EFFECT_KEY_LABELS[key] || key.replace(/^system\./, "");
}

/**
 * Короткая читаемая сводка списка changes для строки в таблице эффектов
 * листа предмета, напр. "T (бонус, Unnatural) +2, AP: Голова +1".
 */
export function summarizeEffectChanges(changes = []) {
  return (changes || [])
    .filter(c => c?.key)
    .map(c => `${effectKeyLabel(c.key)} ${EFFECT_TYPE_LABELS[c.type] || c.type || "+"}${c.value ?? ""}`)
    .join(", ");
}

const AP_ALL_KEYS = Object.keys(AP_LOCATIONS);
/** Поле старого формата → тип урона: apVsEnergy → energy и т.д. */
const AP_VS_KEYS = new Map(Object.keys(AP_VS_TYPES)
  .map(t => [`apVs${t[0].toUpperCase()}${t.slice(1)}`, t]));
const change = (key, type, value, phase = "final") => ({ key, type, value, phase, priority: 0 });
/** Надбавка AP по зоне — хранимое поле, значит фаза "initial" (см. AP_LOCATIONS). */
const apChange = (loc, value) => change(`system.armorBonus.${loc}`, "add", value, "initial");

/**
 * Переводит старый объект system.effects.{...} (talent/trait/implant/
 * mutation/psychicPower/techPower/homeworld/divination/armorMod/weaponMod)
 * в массив changes[] для embedded ActiveEffect — ОДНА функция, разделяемая
 * библиотекой эффектов (module/constants/effects-library-core.mjs) и
 * миграцией (warhammer-dbc.mjs), чтобы правила перевода не разъезжались.
 *
 * Семантика 1:1 со старым потребителем в actor.mjs (prepareDerivedData):
 *  - charBonusStat/charBonusValue, charBonuses[] → .bonusFx, "add" (Unnatural;
 *    хранимое поле в фазе "initial" — см. addChar ниже).
 *  - charValueBonuses[]                          → .total, "add" (обычный +X к значению
 *    характеристики — .total пересчитывается заново из base/advance/... каждый цикл
 *    prepareDerivedData, так что "final"-эффект безопасно ложится поверх; ставить
 *    сюда .value ОШИБКА — такого поля не существует ни в схеме, ни в коде листа).
 *  - armourAll  → все 6 локаций AP, "add" (старый код тоже плюсовал всем).
 *  - apAll      → все 6 локаций AP, "add".
 *  - apHead/apBody → своя локация, "add".
 *  - apArms/apLegs → левая+правая соответствующей пары, "add".
 *  - apVsEnergy/Impact/Rending/Blast → system.absorption.vsType.<тип>, "add"
 *    (старый код тоже суммировал, см. armorVsType в documents/actor.mjs).
 *  - fearRating → "upgrade" (НЕ "add" — старый код брал Math.max, а не сумму;
 *    два источника Rating 2 должны остаться 2, а не стать 4).
 *  - sizeMod/initMod/speedMod → "add" (старый код суммировал через +=).
 */
/** Есть ли у старого объекта system.effects.{...} хоть один ненулевой эффект. */
export function hasLegacyEffects(effects) {
  if (!effects) return false;
  if (effects.charBonusStat && effects.charBonusValue) return true;
  if (Array.isArray(effects.charBonuses) && effects.charBonuses.some(cb => cb?.stat && cb?.value)) return true;
  if (Array.isArray(effects.charValueBonuses) && effects.charValueBonuses.some(cb => cb?.stat && cb?.value)) return true;
  return ["armourAll", "apAll", "apHead", "apBody", "apArms", "apLegs",
          ...AP_VS_KEYS.keys(),
          "fearRating", "sizeMod", "initMod", "speedMod"].some(k => !!effects[k]);
}

export function legacyEffectsToChanges(effects = {}) {
  const out = [];
  // Надбавка к Бонусу целится в ХРАНИМОЕ bonusFx в фазе "initial": .bonus
  // считается расчётом листа, и эффект поверх готового числа менял бы лист,
  // но не броню и не навыки (wdbc-5wm).
  const addChar = (stat, value, path = "bonusFx") => {
    if (!stat || !value) return;
    const key = `system.characteristics.${stat}.${path}`;
    out.push(change(key, "add", value, expectedPhase(key)));
  };
  addChar(effects.charBonusStat, effects.charBonusValue, "bonusFx");
  for (const cb of effects.charBonuses ?? []) addChar(cb?.stat, cb?.value, "bonusFx");
  // …и то же для надбавки к ЗНАЧЕНИЮ: `total` расчёт собирает заново из
  // base/advance/..., так что эффект поверх него не поднимал ни Бонус, ни
  // навыки — только показанную цифру.
  for (const cb of effects.charValueBonuses ?? []) addChar(cb?.stat, cb?.value, "totalFx");

  if (effects.armourAll) for (const loc of AP_ALL_KEYS) out.push(apChange(loc, effects.armourAll));
  if (effects.apAll)     for (const loc of AP_ALL_KEYS) out.push(apChange(loc, effects.apAll));
  if (effects.apHead) out.push(apChange("head", effects.apHead));
  if (effects.apBody) out.push(apChange("body", effects.apBody));
  if (effects.apArms) { out.push(apChange("leftArm", effects.apArms)); out.push(apChange("rightArm", effects.apArms)); }
  if (effects.apLegs) { out.push(apChange("leftLeg", effects.apLegs)); out.push(apChange("rightLeg", effects.apLegs)); }

  for (const [field, type] of AP_VS_KEYS)
    if (effects[field]) out.push(change(`system.absorption.vsType.${type}`, "add", effects[field]));

  if (effects.fearRating) out.push(change("system.fearRating", "upgrade", effects.fearRating));
  if (effects.sizeMod)    out.push(change("system.sizeMod", "add", effects.sizeMod));
  if (effects.initMod)    out.push(change("system.initiative", "add", effects.initMod));
  if (effects.speedMod)   out.push(change("system.speed", "add", effects.speedMod));

  return out;
}
