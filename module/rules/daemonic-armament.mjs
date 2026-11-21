// module/rules/daemonic-armament.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Daemonic Armament (X/Y) / Демоническое Вооружение (задача Studio 55-15,
//  остаток dbc-114). Книга (core.json, Трейты):
//    «Он может выбрать одно стандартное примитивное рукопашное, метательное
//     или стрелковое оружие. Он может в любой момент за полудействие (или
//     свободное действие при наличии Таланта Quick Draw) призывать это оружие
//     себе в руку, и оно получает +X Dmg, +Y Pen, свойство Reinforced и
//     теряет свойство Primitive. Это оружие не тратит стандартные
//     боеприпасы. Если персонаж роняет оружие или его выбивают у него из рук,
//     оружие растворяется в воздухе. …»
//
//  Чистая часть: какое оружие можно выбрать, во что превращается призванное,
//  сколько стоит призыв. Кнопка Черты — module/apps/daemonic-armament.mjs.
//  Призванное оружие — обычный предмет на листе с меткой DAEMONIC_ARMAMENT_FLAG:
//  его атаки идут обычным путём, а rules/ammo-free.mjs не списывает патроны.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const DAEMONIC_ARMAMENT_FLAG = "daemonicArmament";
/** Флаг на самой Черте: uuid выбранного оружия из компендиума. */
export const DAEMONIC_ARMAMENT_CHOICE_FLAG = "daemonicArmamentChoice";
/** Папка компендиума оружия, где лежит «стандартное примитивное» (Имперское → Рукопашное/Стрелковое). */
export const PRIMITIVE_FOLDER = "Примитивное";

const NS = "warhammer-dbc";

export function isDaemonicArmamentTrait(item) {
  return item?.type === "trait" && itemHasName(item, "Daemonic Armament");
}

/** Призванное этой Чертой оружие (растворяется, если выпало из рук). */
export function isDaemonicArmament(item) {
  return item?.type === "weapon" && !!(item?.flags?.[NS]?.[DAEMONIC_ARMAMENT_FLAG]
    ?? item?.getFlag?.(NS, DAEMONIC_ARMAMENT_FLAG));
}

/** Призванное оружие на акторе (их может быть не больше одного на Черту). */
export function summonedDaemonicArmament(actor) {
  return [...(actor?.items ?? [])].filter(isDaemonicArmament);
}

const hasProp = (props, key) => (props ?? []).some(p => (typeof p === "string" ? p : p?.key) === key);

/**
 * Можно ли выбрать это оружие: «стандартное примитивное». Стандартное —
 * имперский арсенал основной книги (папка «Примитивное» у рукопашного и
 * стрелкового, метательное лежит там же), примитивное — свойство Primitive.
 * @param {{type?:string, system?:object, folderName?:string}} entry
 */
export function isDaemonicArmamentCandidate(entry) {
  if (!entry || (entry.type && entry.type !== "weapon")) return false;
  if (entry.folderName !== PRIMITIVE_FOLDER) return false;
  const sys = entry.system ?? {};
  return hasProp(sys.weaponProps, "primitive");
}

/** «1d10-2» + 3 → «1d10+1»; «2d10» + 2 → «2d10+2». Пустую/неразборную формулу дополняет как есть. */
export function addFlatDamage(formula, x) {
  const add = Number(x) || 0;
  const f = String(formula ?? "").trim();
  if (!add) return f;
  if (!f) return String(add);
  const m = f.match(/^(.*?)([+-])\s*(\d+)$/);
  if (m && /d/i.test(m[1])) {
    const total = (m[2] === "-" ? -1 : 1) * Number(m[3]) + add;
    return total === 0 ? m[1] : `${m[1]}${total > 0 ? "+" : "-"}${Math.abs(total)}`;
  }
  return `${f}${add > 0 ? "+" : "-"}${Math.abs(add)}`;
}

/** Свойства: −Primitive, +Reinforced (без дубля). */
export function daemonicArmamentProps(props) {
  const out = (props ?? []).filter(p => (typeof p === "string" ? p : p?.key) !== "primitive")
    .map(p => (typeof p === "string" ? { key: p } : { ...p }));
  if (!hasProp(out, "reinforced")) out.push({ key: "reinforced" });
  return out;
}

const patchProfile = (p, x, y) => ({
  ...p,
  damage: addFlatDamage(p.damage, x),
  penetration: (Number(p.penetration) || 0) + (Number(y) || 0),
  weaponProps: daemonicArmamentProps(p.weaponProps)
});

/**
 * Данные призванного оружия из выбранного образца (toObject() предмета компендиума).
 * @param {object} base  данные оружия
 * @param {{x?:number, y?:number, traitId?:string, sourceUuid?:string}} opts
 */
export function daemonicArmamentWeaponData(base, { x = 0, y = 0, traitId = "", sourceUuid = "" } = {}) {
  const data = foundry_clone(base);
  delete data._id;
  const sys = data.system ?? (data.system = {});
  data.name = `${base.name} (Демоническое Вооружение)`;
  Object.assign(sys, patchProfile(sys, x, y));
  if (Array.isArray(sys.profiles)) sys.profiles = sys.profiles.map(p => patchProfile(p, x, y));
  if (sys.offProfile && typeof sys.offProfile === "object" && Object.keys(sys.offProfile).length)
    sys.offProfile = patchProfile(sys.offProfile, x, y);
  sys.equipped = true;
  sys.stored = false;
  sys.quantity = 1;
  sys.availability = 0;
  sys.weight = 0;
  data.flags = { ...(data.flags ?? {}), [NS]: { ...(data.flags?.[NS] ?? {}),
    [DAEMONIC_ARMAMENT_FLAG]: { traitId, sourceUuid, x: Number(x) || 0, y: Number(y) || 0 } } };
  return data;
}

function foundry_clone(o) {
  return globalThis.foundry?.utils?.deepClone ? globalThis.foundry.utils.deepClone(o) : structuredClone(o);
}

/** Призыв: полудействие (1 ОД), с Quick Draw — свободное (0). Убрать оружие — бесплатно. */
export function daemonicArmamentSummonAp({ quickDraw = false } = {}) {
  return quickDraw ? 0 : 1;
}

/** X и Y Черты: рейтинг и второй рейтинг. */
export function daemonicArmamentRatings(trait) {
  const s = trait?.system ?? {};
  return { x: Number(s.rating) || 0, y: Number(s.rating2) || 0 };
}
