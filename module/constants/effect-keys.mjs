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

const AP_LOCATIONS = {
  head: "Голова", body: "Тело", leftArm: "Левая рука", rightArm: "Правая рука",
  leftLeg: "Левая нога", rightLeg: "Правая нога"
};

/** Путь → подпись. Генерируется из CHARACTERISTICS + AP_LOCATIONS + ручные записи. */
export const EFFECT_KEY_LABELS = {};
for (const [key, def] of Object.entries(CHARACTERISTICS)) {
  if (key === "inf") continue; // Инф — не характеристика с бонусом/значением на листе
  EFFECT_KEY_LABELS[`system.characteristics.${key}.bonus`] = `${def.abbr} (бонус, Unnatural)`;
  EFFECT_KEY_LABELS[`system.characteristics.${key}.total`] = `${def.abbr} (значение)`;
}
for (const [key, label] of Object.entries(AP_LOCATIONS)) {
  EFFECT_KEY_LABELS[`system.armour.${key}`] = `AP: ${label}`;
}
Object.assign(EFFECT_KEY_LABELS, {
  "system.fearRating":  "Рейтинг Страха",
  "system.sizeMod":     "Размер (модификатор)",
  "system.initiative":  "Инициатива",
  "system.speed":       "Скорость"
});

/** Все пути, куда разрешено целиться эффектам (используется тестами/миграцией). */
export const EFFECT_KEY_WHITELIST = Object.freeze(Object.keys(EFFECT_KEY_LABELS));

/** type change (Foundry ActiveEffect) → короткая русская подпись для сводки. */
export const EFFECT_TYPE_LABELS = {
  add: "+", subtract: "−", multiply: "×", override: "=",
  upgrade: "↑ (не меньше)", downgrade: "↓ (не больше)"
};

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
const change = (key, type, value) => ({ key, type, value, phase: "final", priority: 0 });

/**
 * Переводит старый объект system.effects.{...} (talent/trait/implant/
 * mutation/psychicPower/techPower/homeworld/divination/armorMod/weaponMod)
 * в массив changes[] для embedded ActiveEffect — ОДНА функция, разделяемая
 * библиотекой эффектов (module/constants/effects-library-core.mjs) и
 * миграцией (warhammer-dbc.mjs), чтобы правила перевода не разъезжались.
 *
 * Семантика 1:1 со старым потребителем в actor.mjs (prepareDerivedData):
 *  - charBonusStat/charBonusValue, charBonuses[] → .bonus, "add" (Unnatural).
 *  - charValueBonuses[]                          → .total, "add" (обычный +X к значению
 *    характеристики — .total пересчитывается заново из base/advance/... каждый цикл
 *    prepareDerivedData, так что "final"-эффект безопасно ложится поверх; ставить
 *    сюда .value ОШИБКА — такого поля не существует ни в схеме, ни в коде листа).
 *  - armourAll  → все 6 локаций AP, "add" (старый код тоже плюсовал всем).
 *  - apAll      → все 6 локаций AP, "add".
 *  - apHead/apBody → своя локация, "add".
 *  - apArms/apLegs → левая+правая соответствующей пары, "add".
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
          "fearRating", "sizeMod", "initMod", "speedMod"].some(k => !!effects[k]);
}

export function legacyEffectsToChanges(effects = {}) {
  const out = [];
  const addChar = (stat, value, path = "bonus") => {
    if (!stat || !value) return;
    out.push(change(`system.characteristics.${stat}.${path}`, "add", value));
  };
  addChar(effects.charBonusStat, effects.charBonusValue, "bonus");
  for (const cb of effects.charBonuses ?? []) addChar(cb?.stat, cb?.value, "bonus");
  for (const cb of effects.charValueBonuses ?? []) addChar(cb?.stat, cb?.value, "total");

  if (effects.armourAll) for (const loc of AP_ALL_KEYS) out.push(change(`system.armour.${loc}`, "add", effects.armourAll));
  if (effects.apAll)     for (const loc of AP_ALL_KEYS) out.push(change(`system.armour.${loc}`, "add", effects.apAll));
  if (effects.apHead) out.push(change("system.armour.head", "add", effects.apHead));
  if (effects.apBody) out.push(change("system.armour.body", "add", effects.apBody));
  if (effects.apArms) { out.push(change("system.armour.leftArm", "add", effects.apArms)); out.push(change("system.armour.rightArm", "add", effects.apArms)); }
  if (effects.apLegs) { out.push(change("system.armour.leftLeg", "add", effects.apLegs)); out.push(change("system.armour.rightLeg", "add", effects.apLegs)); }

  if (effects.fearRating) out.push(change("system.fearRating", "upgrade", effects.fearRating));
  if (effects.sizeMod)    out.push(change("system.sizeMod", "add", effects.sizeMod));
  if (effects.initMod)    out.push(change("system.initiative", "add", effects.initMod));
  if (effects.speedMod)   out.push(change("system.speed", "add", effects.speedMod));

  return out;
}
