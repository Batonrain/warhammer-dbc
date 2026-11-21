// module/rules/terminator-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Таланты Чемпиона Терминатора — чистая логика (Foundry-сторона —
//  combat/terminator-talents.mjs).
//
//  Anointed / Помазанник — после успешного теста Forbidden Lore (Heresy)(W)+10
//    метка ANOINTED_SHIELD_FLAG: следующий бросок силового щита получает +35 к
//    рейтингу и снимает метку (combat/damage.mjs::_rollActiveShield).
//  Devourer / Поглотитель — в расчёте Борьбы на 1 Размер больше
//    (combat/grapple.mjs::grappleSize).
//  Phoenician / Фениксиец — вторая атака Обратного Удара древковым оружием —
//    основным профилем (sheets/attack/dialog.mjs).
//  Death Shroud / Саван Смерти — древковое оружие для атаки по всем в 1 м.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

const NS = "warhammer-dbc";
export const ANOINTED_SHIELD_FLAG = "anointedShield";
export const ANOINTED_SHIELD_BONUS = 35;
/** Древковое оружие книги: Копьё, Глефа, Посох (категории Арсенала). */
export const POLEARM_CATEGORIES = ["Копьё", "Глефа", "Посох"];

/** Разовая прибавка Помазанника к рейтингу щита (0 — нет метки). */
export function anointedShieldBonus(actor) {
  const f = actor?.flags?.[NS]?.[ANOINTED_SHIELD_FLAG] ?? actor?.getFlag?.(NS, ANOINTED_SHIELD_FLAG);
  return f ? ANOINTED_SHIELD_BONUS : 0;
}

/** Поглотитель: +1 Размер в Борьбе. */
export function devourerGrappleSize(actor) {
  return hasItemNamed(actor, "Devourer", ["talent"]) ? 1 : 0;
}

export const hasDevourer = actor => hasItemNamed(actor, "Devourer", ["talent"]);

/** Метка «Поглотитель идёт Напролом»: следующий сдвиг токена — сквозь стены и без Трудного Ландшафта. */
export const DEVOURER_RAM_FLAG = "devourerRam";
export const DEVOURER_RAM_ACTION = "devourerRam";
export const devourerRamming = actor =>
  !!(actor?.flags?.[NS]?.[DEVOURER_RAM_FLAG] ?? actor?.getFlag?.(NS, DEVOURER_RAM_FLAG));

/**
 * Рукопашное оружие Rng 0 или 1, которым Поглотитель бьёт сбитых Напролом/
 * Повалить вместо урона приёма. Экипированное предпочтительнее; из нескольких —
 * с большим средним уроном формулы (грубая оценка по числам в строке).
 */
export function devourerWeapon(actor) {
  if (!hasDevourer(actor)) return null;
  const reach = w => Number(w.system?.range ?? 0) || 0;
  const avg = w => String(w.system?.damage ?? "").match(/\d+/g)?.map(Number).reduce((a, b) => a + b, 0) ?? 0;
  const list = [...(actor?.items ?? [])].filter(w => w.type === "weapon" && w.system?.weaponClass === "melee"
    && [0, 1].includes(reach(w)) && !w.system?.destroyed);
  if (!list.length) return null;
  return list.sort((a, b) => (!!b.system?.equipped - !!a.system?.equipped) || (avg(b) - avg(a)))[0];
}

/** Древковое ли рукопашное оружие. */
export function isPolearm(item) {
  return item?.type === "weapon" && POLEARM_CATEGORIES.includes(String(item.system?.meleeCategory ?? "").trim());
}

/** Фениксиец: вторая атака Обратного Удара этим оружием — основным профилем. */
export function phoenicianMainProfile(actor, item) {
  return isPolearm(item) && hasItemNamed(actor, "Phoenician", ["talent"]);
}

/** Урон одного попадания Савана Смерти: профиль оружия + S.b. */
export function deathShroudDamageFormula(actor, item) {
  const base = String(item?.system?.damage ?? "").trim() || "1d10";
  const sb = Math.max(0, Number(actor?.system?.characteristics?.s?.bonus) || 0);
  return sb ? `${base} + ${sb}` : base;
}
