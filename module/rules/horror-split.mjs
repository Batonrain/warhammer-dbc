// module/rules/horror-split.mjs
// ════════════════════════════════════════════════════════════════════════
//  Разделение Ужасов Тзинча (Книга Хаоса, «Розовый Ужас») — чистая часть
//  (Sahara 578-1f7a). Кнопка и спавн — combat/horror-split.mjs.
//
//  Книга: «Когда Розовый Ужас опускается ниже 0 Ран, кроме как от
//  священного оружия, варп-оружия, выжигания души, или нестабильности, он
//  разваливается на 2 Синих Ужаса … Синие Ужасы при смерти разваливаются на
//  2 Серных Ужаса … Возвышенные Ужасы при смерти разделяются на 2 Розовых
//  Ужаса. … действуют в ту же Инициативу, что и оригинал.»
//  Локус Трансмогрификации (Герольд Тзинча): «делятся на 3 меньших Ужаса
//  вместо 2-х» — возможность horror.splitsIntoThree на Черте-Локусе.
//  Радиус Локуса — ½W герольда м (Книга Хаоса, стр. 27).
// ════════════════════════════════════════════════════════════════════════

export const TRANSMOGRIFICATION_CAP = "horror.splitsIntoThree";

const ruName = name => {
  const parts = String(name ?? "").split(" / ");
  return (parts.length > 1 ? parts.at(-1) : String(name ?? "")).trim();
};

/** Есть ли у актора Талант/Черта «Разделение». */
export const hasHorrorSplit = actor => [...(actor?.items ?? [])]
  .some(i => /^(Разделение|Split)(?!\p{L})/iu.test(String(i?.name ?? "").trim()));

/**
 * Во что разваливается Ужас (имя записи Бестиария) или null.
 * Возвышенный (Радужный) — в Розовых; Розовый — в Синих; Синий — в Серных.
 */
export function horrorSplitInto(actor) {
  if (!hasHorrorSplit(actor)) return null;
  const name = ruName(actor.name).toLowerCase();
  if (actor.system?.rank === "exalted" || name.includes("радужн")) return "Розовый Ужас";
  if (name.includes("розов")) return "Синий Ужас";
  if (name.includes("син")) return "Серный Ужас";
  return null;
}

/** Сколько меньших Ужасов: 2, под Локусом Трансмогрификации — 3. */
export const horrorSplitCount = transmogrified => (transmogrified ? 3 : 2);

/**
 * Блокирует ли источник урона Разделение: священное оружие, варп-оружие,
 * Выжигание Души, нестабильность.
 */
export function horrorSplitBlocked({ sanctified = false, warpWeapon = false, soulBurn = false, instability = false } = {}) {
  return !!(sanctified || warpWeapon || soulBurn || instability);
}

/** Радиус Локуса герольда: ½W м. */
export const heraldLocusRadius = herald => Math.floor((Number(herald?.system?.characteristics?.wp?.total) || 0) / 2);
