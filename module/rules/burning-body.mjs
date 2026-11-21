// module/rules/burning-body.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Пылающее Тело / Burning Body (Общие мутации, wdbc-1rno.16) — чистая логика.
//
//  «…иммунитет к экстремальным температурам и эффектам Горения. За
//  полудействие персонаж может пройти тест на W+0, чтобы подавить пламя и все
//  его эффекты (включая иммунитеты) на 1 час, или пока он не решит вернуть его
//  свободным действием. Противники, что совершают по нему рукопашную атаку с
//  Rng 0-1 или попытку Захвата после атаки (успешной или нет), должны пройти
//  тест на A+0, или получить попадание с 1d10 E(Fl) Dmg, Pen 0, Tainted.
//  Противники в Борьбе с персонажем автоматически получают такое попадание в
//  начале своего Хода.»
//
//  Подавление — флаг SUPPRESS_FLAG на самой мутации: apps/effects.mjs::
//  isItemActive считает её неактивной, и вместе с ней гаснут все записи
//  Механики (иммунитет к Flame, к Жаре/Холоду) — rulesFromItemMechanics
//  неактивные предметы пропускает. Обвязка — combat/burning-body.mjs.
// ════════════════════════════════════════════════════════════════════════════

export const BURNING_BODY_CAP = "mutation.burningBody";
/** Флаг на мутации: { until: worldTime } — пламя подавлено носителем. */
export const SUPPRESS_FLAG = "selfSuppressed";
export const SUPPRESS_SECONDS = 3600;

const NS = "warhammer-dbc";

/** Мутация Пылающее Тело на акторе (по записи capability в Механике). */
export function burningBodyItem(actor) {
  return [...(actor?.items ?? [])].find(i => (i?.flags?.[NS]?.mechanics ?? [])
    .some(g => (g?.entries ?? []).some(e => e?.capabilityKey === BURNING_BODY_CAP))) ?? null;
}

/** Строка субмутации d10 → ключ. */
export function burningSubKind(label) {
  switch (String(label ?? "").trim()) {
    case "1":   return "flicker";
    case "2-3": return "flare";
    case "4-5": return "entwine";
    case "6":   return "invisible";
    case "7":   return "choking";
    case "8":   return "khorne";
    case "9":   return "sorcerous";
    case "10":  return "controlled";
    default:    return "";
  }
}

/** Подавление истекло (час прошёл)? Флаг без срока считается бессрочным. */
export function suppressionExpired(flag, now) {
  if (!flag) return false;
  const until = Number(flag?.until);
  return Number.isFinite(until) && now >= until;
}

/**
 * Срабатывает ли ответное пламя на эту атаку: рукопашная с Rng 0-1 (если
 * дистанцию измерить нечем — считаем контактом) или приём «Захват».
 */
export function burningRetaliates({ isMelee, technique = "", edgeM = null }) {
  if (technique === "grapple") return true;
  if (!isMelee) return false;
  return edgeM == null || !Number.isFinite(edgeM) || edgeM <= 1;
}

/**
 * Профиль попадания пламени по субмутации.
 *  «2-3» Вспыхивающее — Tearing, кроме попадания, вызванного промахом по носителю;
 *  «8» Пламя Кхорна — 2d10, 3d10 против псайкеров;
 *  «9» Колдовское — непоглощённый урон даёт +1 Порчи (подсказка на карточке).
 * @returns {{formula:string, tearing:boolean, corruption:boolean, label:string}}
 */
export function burningHitProfile(sub, { psyker = false, attackMissed = false } = {}) {
  let formula = "1d10";
  if (sub === "khorne") formula = psyker ? "3d10" : "2d10";
  const tearing = sub === "flare" && !attackMissed;
  const label = sub === "khorne" ? "Пламя Кхорна" : sub === "sorcerous" ? "Колдовское пламя" : "Пылающее Тело";
  return { formula, tearing, corruption: sub === "sorcerous", label };
}
