// module/rules/possession-weapon-gifts.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Дары Одержимого для оружия (Разобрать m9zer). Книга (possession.mjs):
//    Слияние — «Рукопашное оружие сливается с рукой: Reinforced, … получает
//      Дары-усилители»;
//    Варп-Пламя — «наносит E(Fl) и получает Flame»;
//    Демонический Яд — «Felling (½Cor.b, окр.▲) и Toxic (½Cor.b, окр.▲)»;
//    Молниевое Поле — «+2 Dmg и Pen, наносит E, получает Power Field»;
//    Лезвия Душ — «Warp Weapon, но урон уменьшается до поглощения вдвое».
//
//  Усилители ложатся на слитое оружие: его id хранит флаг актора
//  FUSED_WEAPON_FLAG (кнопка Дара «Слияние», combat/possession-fusion.mjs).
//  Действуют, пока демон проявлен, — источник правил отдаёт grantWeaponProp
//  на атаку именно этим оружием. Урон, Пробиваемость и тип урона записи
//  правил не выражают (в Конструкторе нет вида «урон/Pen/тип урона оружия»),
//  поэтому их отдаёт possessionWeaponGiftDamage, а складывает в атаку
//  combat/attack.mjs — тем же приёмом, что Броненосец (bronenosets-talents.mjs).
//  Вручную: запрет менять хват слитого оружия.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, manifestedGift } from "./predicates.mjs";

export const FUSED_WEAPON_FLAG = "possessionFusedWeapon";
const NS = "warhammer-dbc";

// Имена — литералами в itemHasName: по ним Дар опознаёт и замер досягаемости (tools/capability-reachability.mjs).
const GIFT_TESTS = {
  "Слияние":         i => itemHasName(i, "Fusion"),
  "Варп-Пламя":      i => itemHasName(i, "Warpflame"),
  "Демонический Яд": i => itemHasName(i, "Daemonic Venom"),
  "Молниевое Поле":  i => itemHasName(i, "Lightning Field"),
  "Лезвия Душ":      i => itemHasName(i, "Blades of the Soul")
};
const hasGift = (actor, ru) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && GIFT_TESTS[ru](i))
  && manifestedGift(actor, ru);

export function hasFusionGift(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Fusion"));
}

export function fusedWeaponId(actor) {
  return String(actor?.flags?.[NS]?.[FUSED_WEAPON_FLAG] ?? actor?.getFlag?.(NS, FUSED_WEAPON_FLAG) ?? "");
}

/** Свойства, которые Дары дают слитому оружию сейчас: [{key, rating, label}]. */
export function possessionWeaponGiftProps(actor, weapon) {
  const id = fusedWeaponId(actor);
  if (!id || !weapon || weapon.id !== id) return [];
  if (!hasGift(actor, "Слияние")) return [];
  const half = Math.ceil((Number(actor?.system?.corruptionBonus) || 0) / 2);
  const out = [{ key: "reinforced", rating: "", label: "Дар: Слияние" }];
  if (hasGift(actor, "Варп-Пламя")) out.push({ key: "flame", rating: "1d10", label: "Дар: Варп-Пламя" });
  if (hasGift(actor, "Демонический Яд") && half > 0) {
    out.push({ key: "felling", rating: half, label: "Дар: Демонический Яд" });
    out.push({ key: "toxic", rating: half, label: "Дар: Демонический Яд" });
  }
  if (hasGift(actor, "Молниевое Поле")) out.push({ key: "powerField", rating: "", label: "Дар: Молниевое Поле" });
  if (hasGift(actor, "Лезвия Душ")) out.push({ key: "warpWeapon", rating: "", label: "Дар: Лезвия Душ" });
  return out;
}

/** Источник правил: атака слитым оружием в Проявлении получает свойства Даров. */
export function possessionWeaponGiftRules(actor, ctx = {}) {
  return possessionWeaponGiftProps(actor, ctx.weapon).map((p, n) => ({
    id: `possessionWeaponGift.${p.key}.${n}`, label: p.label, when: {},
    effects: [{ kind: "grantWeaponProp", target: "attack", propKey: p.key, rating: p.rating }]
  }));
}

/**
 * Урон слитого оружия от Даров (Sahara 584-e-e-fl-2-dmg-pen):
 *   Молниевое Поле — +2 Dmg и Pen, тип E;
 *   Варп-Пламя — тип E(Fl). Оба вместе — E(Fl): Fl лишь уточняет тот же E,
 *     а +2 Dmg/Pen Молниевого Поля остаются;
 *   Лезвия Душ — урон до поглощения вдвое (окр.▲), halve.
 * @returns {{dmg:number, pen:number, damageType:string, damageSubtype:string, halve:boolean, note:string}}
 */
export function possessionWeaponGiftDamage(actor, weapon) {
  const out = { dmg: 0, pen: 0, damageType: "", damageSubtype: "", halve: false, note: "" };
  const id = fusedWeaponId(actor);
  if (!id || !weapon || weapon.id !== id || !hasGift(actor, "Слияние")) return out;
  const parts = [];
  if (hasGift(actor, "Молниевое Поле")) {
    out.dmg += 2; out.pen += 2; out.damageType = "energy";
    parts.push("Молниевое Поле: +2 Dmg и Pen, урон E");
  }
  if (hasGift(actor, "Варп-Пламя")) {
    out.damageType = "energy"; out.damageSubtype = "flame";
    parts.push("Варп-Пламя: урон E(Fl)");
  }
  if (hasGift(actor, "Лезвия Душ")) {
    out.halve = true;
    parts.push("Лезвия Душ: урон до поглощения вдвое (окр.▲)");
  }
  if (parts.length) out.note = `👹 Дары-усилители — ${parts.join("; ")} (уже в уроне).`;
  return out;
}
