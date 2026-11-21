// module/rules/boneless.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Бескостный / Boneless (Общие мутации, wdbc-1rno.9) — чистая логика.
//
//  «Пока он в полном жёстком доспехе, его плоть может использовать его как
//  внешний скелет… Без опоры он должен проходить тест на Athletics+0 просто
//  чтобы устоять на ногах — в противном случае он получает Трейты Amorphous и
//  Crawler и оседает на землю. В форме аморфной горы плоти персонаж получает
//  −20 на все тесты S, уменьшает рейтинг своего Трейта Unnatural S на 2 и
//  получает +30 на все тесты Карабканья (игнорируя штрафы к тестам S от этой
//  мутации). Персонаж получает +10 к A, уменьшает вдвое любой I(Cr) Dmg
//  (окр.▲) до Поглощения и игнорирует все Критические Эффекты от переломов…
//  Если броня его торса модифицирована… Трейт Quadruped (1).»
//
//  Обвязка — combat/boneless.mjs (кнопки), combat/damage.mjs (½ I(Cr)),
//  штрафы аморфной формы — rules/library/boneless.mjs.
// ════════════════════════════════════════════════════════════════════════════

export const BONELESS_CAP = "mutation.boneless";
/** Метка на Чертах, выданных мутацией (Amorphous/Crawler/Quadruped): снять своё, не чужое. */
export const BONELESS_GRANT_FLAG = "bonelessGrant";

/** Жёсткая броня: панцирная, силовая, аспектная (Flak/Mesh/простая — мягкие). */
const RIGID = new Set(["carapace", "power", "aspect"]);
const LOCS = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];

/**
 * «Полный жёсткий доспех»: надетая жёсткая броня закрывает все шесть мест
 * попадания (AP > 0), одним предметом или несколькими.
 */
export function wearsFullRigidArmour(actor) {
  const rigid = [...(actor?.items ?? [])].filter(i => i?.type === "armor" && i.system?.equipped
    && RIGID.has(i.system?.armorType));
  if (!rigid.length) return false;
  return LOCS.every(loc => rigid.some(i => (Number(i.system?.[loc]) || 0) > 0));
}

/**
 * ½ I(Cr) Dmg до Поглощения, окр. вверх. Только Impact подвида Crushing.
 * @returns {{raw:number, halved:boolean}}
 */
export function bonelessDamage(raw, damageType, damageSubtype) {
  const n = Number(raw) || 0;
  if (damageType !== "impact" || damageSubtype !== "crushing" || n <= 0) return { raw: n, halved: false };
  return { raw: Math.ceil(n / 2), halved: true };
}

/**
 * Критический Эффект «перелом»: строка таблицы говорит о сломанной кости
 * (перелом/сломан(а)/раздроблен(а)). Бескостному такой Эффект не грозит —
 * карточка подсказывает, Эффект не применяется.
 */
const FRACTURE_RE = /(перелом|сломан|сломал|раздробл|дробит\S* кост|кост\S* (?:трескается|ломается))/i;
export function isFractureCrit(text) {
  return FRACTURE_RE.test(String(text ?? ""));
}
