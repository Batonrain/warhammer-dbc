// ════════════════════════════════════════════════════════════════════════
//  Подбор тематической SVG-иконки для предмета по типу/подтипу.
//  Иконки лежат в assets/item-icons/ (голо-стиль когитатора).
// ════════════════════════════════════════════════════════════════════════

const BASE = "systems/warhammer-dbc/assets/item-icons/";

const WEAPON_CLASS_ICON = {
  melee: "weapon-melee", thrown: "weapon-thrown", pistol: "weapon-pistol",
  basic: "weapon-basic", heavy: "weapon-heavy", launcher: "weapon-launcher",
  stationary: "weapon-stationary"
};
const AMMO_CAT_ICON = {
  batteries: "ammo-battery", bolts: "ammo-bolt",
  shotgun_shells: "ammo-shell", auto_shells: "ammo-shell",
  plasma_fuel: "ammo-fuel", melta_fuel: "ammo-fuel", flame_fuel: "ammo-fuel",
  arrows: "ammo-arrow"
};
const DRUG_CAT_ICON = {
  medicine: "drug-medicine", narcotic: "drug-narcotic",
  poison: "drug-poison", elixir: "drug-elixir"
};
// Дисциплины псайканы, для которых есть отдельная иконка psy-<key>.svg
const PSY_DISC = new Set([
  "thaumaturgy", "sorcery", "highSorcery", "daemonology",
  "telekinesis", "telepathy", "divination", "biomancy", "pyromancy",
  "slaanesh", "nurgle", "tzeentch",
  "chronomancy", "cryomancy", "technomancy", "fulmination", "geomancy",
  "umbramancy", "librarium", "bloodMagic",
  "warlock", "spiritSeer", "farseer", "voidDreamer", "runesFateBattle", "revenant"
]);

// Подтип Колдовства (system.subtype) → иконка psy-sorcery-<x>
function sorceryIcon(subtype = "") {
  const s = String(subtype);
  if (/Разруш/i.test(s))                 return "psy-sorcery-destruction";
  if (/Искаж/i.test(s))                  return "psy-sorcery-distortion";
  if (/Т[её]мн\w*\s*слав/i.test(s))      return "psy-sorcery-darkglory";
  if (/Порч/i.test(s))                   return "psy-sorcery-corruption";
  if (/Призыв/i.test(s))                 return "psy-sorcery-summon";
  if (/Клинок/i.test(s))                 return "psy-sorcery-blade";
  if (/Архитектор/i.test(s))             return "psy-sorcery-architect";
  if (/Анарх/i.test(s))                  return "psy-sorcery-anarchy";
  if (/Эктомант/i.test(s))               return "psy-sorcery-ectomancy";
  if (/Амальгам/i.test(s))               return "psy-sorcery-amalgam";
  return "psy-sorcery";
}

// Форма рукопашного оружия (берётся из текста system.special) → иконка
function meleeFormIcon(special = "") {
  const s = String(special);
  if (/Топор|Секир|Бердыш/i.test(s))                     return "weapon-axe";
  if (/Копь[её]|Глеф|Пик[аи]|Алебард|Коса|Вил/i.test(s)) return "weapon-spear";
  if (/Нож|Кинжал|Стилет|Рапир/i.test(s))                return "weapon-knife";
  if (/Молот|Маул|Кувалд/i.test(s))                      return "weapon-hammer";
  if (/Булав|Дубин|Палиц|Цеп|Кадил|Моргенштерн/i.test(s)) return "weapon-mace";
  if (/Кнут|Бич|Плеть|Хлыст/i.test(s))                   return "weapon-whip";
  if (/Посох|Жезл|Шест/i.test(s))                        return "weapon-staff";
  return "weapon-melee"; // меч/сабля/клинок и прочее
}

const TYPE_ICON = {
  weaponMod: "weaponmod", armor: "armor", armorMod: "armormod",
  forcefield: "forcefield", gear: "gear", tool: "tool",
  cybernetic: "cybernetic", implant: "implant",
  talent: "talent", ability: "ability", trait: "trait",
  psychicPower: "psychicpower", techPower: "techpower",
  mutation: "mutation", navigatorPower: "navigatorpower",
  mentalDisorder: "mentaldisorder", component: "component", shipHull: "component",
  cargo: "cargo", torpedo: "torpedo", disease: "disease",
  // Своей иконки нет — вязь такая же «модификация носителя», как armorMod.
  runicWeave: "armormod"
};

/** Путь к иконке для типа+подтипа, либо null (тип без своей иконки). */
export function itemIconFor(type, system = {}) {
  let name = null;
  if (type === "weapon") {
    const sp = system?.special || "";
    if      (/Мехадендрит/i.test(sp))                            name = "mechadendrite";
    else if (/Защита:/.test(sp) || system?.weaponClass === "shield") name = "shield";
    else if (system?.weaponClass === "melee")                    name = meleeFormIcon(sp);
    else name = WEAPON_CLASS_ICON[system?.weaponClass] || "weapon-basic";
  }
  else if (type === "weaponMod") name = (system?.category === "shield") ? "shield" : "weaponmod";
  else if (type === "psychicPower") {
    const disc = system?.discipline;
    // Демонология: Чистая (экзорцизм) — отдельная иконка
    if (disc === "daemonology" && /Чист/i.test(system?.subtype || "")) name = "psy-daemonology-pure";
    // Колдовство: своя иконка на каждый подтип (школу)
    else if (disc === "sorcery") name = sorceryIcon(system?.subtype);
    else name = PSY_DISC.has(disc) ? "psy-" + disc : "psychicpower";
  }
  else if (type === "ammo")      name = AMMO_CAT_ICON[system?.ammoCategory] || "ammo";
  else if (type === "drug")      name = DRUG_CAT_ICON[system?.drugCategory] || "drug";
  else                           name = TYPE_ICON[type] || null;
  return name ? BASE + name + ".svg" : null;
}

/** Дефолтная ли иконка (core Foundry или пусто) — можно заменять на тематическую. */
export function isGenericImg(img) {
  if (!img) return true;
  return /^icons\//.test(img);
}

/** Управляемая нами иконка: дефолтная Foundry ИЛИ из нашего набора item-icons.
 *  (Позволяет миграции переназначать на более точную иконку, не трогая кастомные.) */
export function isManagedImg(img) {
  if (isGenericImg(img)) return true;
  return typeof img === "string" && img.startsWith(BASE);
}
