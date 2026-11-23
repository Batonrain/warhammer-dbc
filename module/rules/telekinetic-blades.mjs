// module/rules/telekinetic-blades.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Клинки Силы (Телекинез, core.json стр. 315; wdbc-1rno.28) — чистая часть.
//  Кнопки и диалоги — module/apps/telekinetic-blades.mjs, общий механизм
//  призванного оружия — rules/summoned-weapon.mjs.
//
//  Telekinetic Blade: «создает любое стандартное примитивное рукопашное
//   оружие у себя в руке. Это оружие может использовать только профили,
//   наносящие R Dmg, получает +PR Dmg и +PR Pen, и ничего не весит. Клинок
//   невидим, и персонажи, неспособные засекать его, получают штраф –20 на
//   броски Избегания … С Точным Телекинезом атаки им становятся полностью
//   невидимыми и получают тип Незримое. При манифестации с PR 4+ — ещё одно
//   оружие, и ещё по одному на PR 7+ и PR 10+.»
//  Telekinetic Edge (Психический Клинок — на одно рукопашное оружие):
//   «+PR Dmg и Reinforced. Профили, что наносят R Dmg, также получают +PR Pen.»
//  Precision Telekinesis: «пара доп. телекинетических рук (Multiple Arms (+2))».
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { addFlatDamage } from "./daemonic-armament.mjs";
import { summonFlagData } from "./summoned-weapon.mjs";

export const TK_BLADE_KIND = "telekineticBlade";
/** Флаг на силе: uuid выбранных образцов (запоминается между манифестациями). */
export const TK_BLADE_CHOICE_FLAG = "tkBladeChoice";
/** Частичное Незримое Клинка: −20 к Избеганиям незасекшего. */
export const TK_PARTIAL_UNSEEN_MOD = -20;
/** Точный Телекинез: телекинетические руки сверх своих (как Multiple Arms +2). */
export const PRECISION_TK_ARMS = 2;

const isPower = (item, en) => item?.type === "psychicPower" && itemHasName(item, en);
export const isTelekineticBlade = item => isPower(item, "Telekinetic Blade");
export const isTelekineticEdge = item => isPower(item, "Telekinetic Edge");
export const isPrecisionTelekinesis = item => isPower(item, "Precision Telekinesis");

/** Поддерживает ли актор Точный Телекинез прямо сейчас. */
export function sustainsPrecisionTelekinesis(actor) {
  return [...(actor?.items ?? [])].some(i => isPrecisionTelekinesis(i) && !!i.system?.isSustained);
}

/** Доп. руки от поддерживаемого Точного Телекинеза (rules/hands.mjs). */
export function precisionTelekinesisArms(actor) {
  return sustainsPrecisionTelekinesis(actor) ? PRECISION_TK_ARMS : 0;
}

/** Сколько клинков: 1, +1 на эPR 4+, 7+, 10+. */
export function telekineticBladeCount(epr) {
  const pr = Number(epr) || 0;
  return 1 + (pr >= 4 ? 1 : 0) + (pr >= 7 ? 1 : 0) + (pr >= 10 ? 1 : 0);
}

const isRending = p => String(p?.damageType ?? "") === "rending";

/**
 * Можно ли выбрать образец: стандартное (имперский арсенал основной книги —
 * папка «Имперское / Рукопашное / Примитивное») примитивное рукопашное
 * оружие хотя бы с одним профилем R Dmg.
 * @param {{type?:string, system?:object, folderPath?:string[]}} entry
 *   folderPath — имена папок от корня пака: ["Имперское","Рукопашное","Примитивное"]
 */
export function isTelekineticBladeCandidate(entry) {
  if (!entry || (entry.type && entry.type !== "weapon")) return false;
  const path = entry.folderPath ?? [];
  if (path[0] !== "Имперское" || path[path.length - 1] !== "Примитивное") return false;
  const sys = entry.system ?? {};
  if (sys.weaponClass !== "melee") return false;
  return isRending(sys) || (sys.profiles ?? []).some(isRending);
}

const withProp = (props, key) => {
  const out = (props ?? []).map(p => (typeof p === "string" ? { key: p } : { ...p }));
  if (!out.some(p => p.key === key)) out.push({ key });
  return out;
};

const patchProfile = (p, pr, unseenKey) => ({
  ...p,
  damage: addFlatDamage(p.damage, pr),
  penetration: (Number(p.penetration) || 0) + pr,
  weaponProps: withProp(p.weaponProps, unseenKey)
});

/**
 * Данные клинка из образца (toObject() предмета компендиума).
 * Только профили R Dmg: если основной профиль не R — его место занимает
 * первый R-профиль из списка.
 * @param {object} base
 * @param {{epr?:number, powerId?:string, index?:number}} opts
 */
export function telekineticBladeWeaponData(base, { epr = 0, powerId = "", index = 0 } = {}) {
  const data = globalThis.foundry?.utils?.deepClone ? globalThis.foundry.utils.deepClone(base) : structuredClone(base);
  delete data._id;
  const pr = Math.max(0, Number(epr) || 0);
  const sys = data.system ?? (data.system = {});
  const rendProfiles = (sys.profiles ?? []).filter(isRending);
  if (!isRending(sys) && rendProfiles.length) {
    const first = rendProfiles.shift();
    for (const k of ["damage", "damageType", "penetration", "weaponProps"]) if (k in first) sys[k] = first[k];
  }
  // Частичное Незримое — своим свойством; полное (с Точным Телекинезом)
  // включает бой сам, по живому поддержанию (combat/attack.mjs).
  Object.assign(sys, patchProfile(sys, pr, "unseenPartial"));
  sys.profiles = rendProfiles.map(p => patchProfile(p, pr, "unseenPartial"));
  data.name = `${base.name} (Телекинетический Клинок${index ? ` ${index + 1}` : ""})`;
  sys.equipped = true;
  sys.stored = false;
  sys.quantity = 1;
  sys.availability = 0;
  sys.weight = 0;
  data.flags = { ...(data.flags ?? {}) };
  data.flags["warhammer-dbc"] = { ...(data.flags["warhammer-dbc"] ?? {}),
    ...summonFlagData({ sourceId: powerId, kind: TK_BLADE_KIND, psychic: true }) };
  return data;
}

/**
 * weaponBuff Телекинетического Лезвия на выбранное оружие: +эPR Dmg,
 * Reinforced; +эPR Pen — только если оружие наносит R Dmg.
 */
export function telekineticEdgeBuff(weapon, epr) {
  const pr = Math.max(0, Number(epr) || 0);
  const rend = isRending(weapon?.system);
  return {
    enabled: true, scope: "equipped", weaponId: String(weapon?.id ?? weapon?._id ?? ""),
    damageMod: pr, penMod: rend ? pr : 0, rangeMod: 0,
    addProps: [{ key: "reinforced" }]
  };
}
