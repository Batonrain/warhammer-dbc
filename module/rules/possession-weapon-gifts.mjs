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
//  на атаку именно этим оружием. Числа, которых в реестре правил нет (тип
//  урона E/E(Fl), +2 Dmg и Pen Молниевого Поля, половина урона Лезвий Душ),
//  отдаёт possessionWeaponGiftStats — их читает сама атака (combat/attack.mjs),
//  как и прочие прибавки к Dmg/Pen отдельных Талантов (21.11.2026, Studio 579-175).
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
 * Числа Даров-усилителей для атаки слитым оружием в Проявлении (Studio 579-175):
 *   Молниевое Поле — «+2 Dmg и Pen, наносит E»;
 *   Варп-Пламя     — «наносит E(Fl)» (при обоих Дарах — E(Fl): подвид точнее);
 *   Лезвия Душ     — «урон уменьшается до поглощения вдвое (окр.▲)».
 * Вне Проявления, без Слияния или не тем оружием — нули.
 * @returns {{dmg:number, pen:number, damageType:string, damageSubtype:string, halve:boolean, notes:string[]}}
 */
export function possessionWeaponGiftStats(actor, weapon) {
  const out = { dmg: 0, pen: 0, damageType: "", damageSubtype: "", halve: false, notes: [] };
  const id = fusedWeaponId(actor);
  if (!id || !weapon || weapon.id !== id || !hasGift(actor, "Слияние")) return out;
  if (hasGift(actor, "Молниевое Поле")) {
    out.dmg += 2; out.pen += 2; out.damageType = "energy";
    out.notes.push("Дар: Молниевое Поле — +2 Dmg, +2 Pen, урон E (уже учтено).");
  }
  if (hasGift(actor, "Варп-Пламя")) {
    out.damageType = "energy"; out.damageSubtype = "flame";
    out.notes.push("Дар: Варп-Пламя — урон E(Fl) (уже учтено).");
  }
  if (hasGift(actor, "Лезвия Душ")) {
    out.halve = true;
    out.notes.push("Дар: Лезвия Душ — урон каждого попадания вдвое до Поглощения, окр.▲ (уже учтено).");
  }
  return out;
}

/** Урон попадания под Лезвиями Душ: вдвое, с округлением вверх. */
export function halveSoulBladeDamage(total, halve) {
  return halve ? Math.ceil((Number(total) || 0) / 2) : total;
}
