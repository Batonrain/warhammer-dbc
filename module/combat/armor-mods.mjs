// module/combat/armor-mods.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  Модификации брони (включая Системы Силовой брони).
//  armorMod.system.installedOn = id брони. Системы (category="powerSystem")
//  работают только с силовой бронёй — «Силовая» (power) или «Аспектная» (aspect,
//  считается силовой для модификаций/систем).
// ─────────────────────────────────────────────────────────────────────────────

// Типы брони, считающиеся «силовыми» для систем силовой брони.
const POWER_ARMOR_TYPES = new Set(["power", "aspect"]);

/**
 * Система стоит в шлеме? Слот берётся из modGroup библиотеки систем.
 * Вокс-линк — исключение: он работает через горжет и со снятым шлемом,
 * пусть и только на передачу звука. Имя проверяется, а не флаг, чтобы
 * правило действовало и на предметы, заведённые до этого расширения.
 */
export function isHelmetMod(mod) {
  if (mod?.system?.modGroup !== "helmet") return false;
  return !/вокс|vox/i.test(mod.name || "");
}

/** Шлем снят и правило включено? */
function helmetIsOff(actor) {
  if (!actor?.system?.helmetOff) return false;
  try { return game.settings.get("warhammer-dbc", "helmetless") !== false; }
  catch (e) { return true; }
}

/** Все модификации, установленные на данную броню. */
export function getInstalledArmorMods(actor, armor) {
  if (!actor || !armor) return [];
  const helmetOff = helmetIsOff(actor);
  return actor.items.filter(i =>
    i.type === "armorMod" && i.system.installedOn === armor.id &&
    // Системы силовой брони действуют только на силовую/аспектную броню
    !(i.system.category === "powerSystem" && !POWER_ARMOR_TYPES.has(armor.system.armorType)) &&
    // Включаемые системы дают бонусы только когда активны
    !(i.system.activatable && !i.system.active) &&
    // Со снятым шлемом всё, что стоит в шлеме, не работает — кроме вокс-линка
    !(helmetOff && isHelmetMod(i))
  );
}

/** Свёрнутые эффекты всех модификаций данной брони. */
export function getArmorModEffects(actor, armor) {
  const fx = {
    apAll: 0, apHead: 0, apBody: 0, apArms: 0, apLegs: 0,
    vs: { energy: 0, impact: 0, rending: 0, blast: 0 },
    maxAgilityMod: 0, charBonuses: [], names: []
  };
  for (const mod of getInstalledArmorMods(actor, armor)) {
    // Мигрированные моды несут эти же AP как embedded ActiveEffect
    // (см. migrations/item-effects.mjs) — не считаем дважды.
    const e = mod.getFlag("warhammer-dbc", "migratedEffect") ? {} : (mod.system.effects || {});
    fx.apAll  += e.apAll  || 0;
    fx.apHead += e.apHead || 0;
    fx.apBody += e.apBody || 0;
    fx.apArms += e.apArms || 0;
    fx.apLegs += e.apLegs || 0;
    fx.vs.energy  += e.apVsEnergy  || 0;
    fx.vs.impact  += e.apVsImpact  || 0;
    fx.vs.rending += e.apVsRending || 0;
    fx.vs.blast   += e.apVsBlast   || 0;
    fx.maxAgilityMod += e.maxAgilityMod || 0;
    for (const cb of (e.charBonuses || [])) fx.charBonuses.push(cb);
    fx.names.push(mod.name);
  }
  return fx;
}

/** AP-надбавка модификаций по локации (ключ поля брони). */
export function armorModApForLocation(fx, key) {
  switch (key) {
    case "head":               return fx.apAll + fx.apHead;
    case "body":               return fx.apAll + fx.apBody;
    case "leftArm": case "rightArm": return fx.apAll + fx.apArms;
    case "leftLeg": case "rightLeg": return fx.apAll + fx.apLegs;
    default:                   return fx.apAll;
  }
}
