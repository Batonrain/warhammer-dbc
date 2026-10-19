// module/rules/hollow-bones.mjs
// ════════════════════════════════════════════════════════════════════════
//  Hollow Bones / Пустые Кости (Гарпия, глава I): «Гарпия уменьшает свой
//  T.b вдвое (окр.▲) при Поглощении I(Cr) урона».
//
//  Возможность trait.hollowBones раздаёт запись «Возможность» самой Черты
//  (packs-src/traits/Hollow_Bones…); читает combat/damage.mjs, где T.b входит
//  в Поглощение. I(Cr) — подвид урона "crushing" (constants/items.mjs,
//  DAMAGE_SUBTYPES): кулаки, пинки, дубины, копыта и т.п. Падение — обычный I без (Cr), Пустые Кости на него не действуют (решение владельца 01.10.2026, wdbc-eyd1l).
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

export const HOLLOW_BONES_CAPABILITY = "trait.hollowBones";

/**
 * T.b для Поглощения этого попадания.
 * @param {object} actor
 * @param {number} tb — T.b после прочих срезок (Разящее и т.п.)
 * @param {string} damageSubtype
 * @returns {{tb:number, halved:boolean}}
 */
export function hollowBonesTb(actor, tb, damageSubtype) {
  const n = Number(tb) || 0;
  if (damageSubtype !== "crushing" || n <= 0 || !hasRuleFlag(actor, HOLLOW_BONES_CAPABILITY))
    return { tb: n, halved: false };
  return { tb: Math.ceil(n / 2), halved: true };
}
