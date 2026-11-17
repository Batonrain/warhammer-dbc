// module/rules/amorphous.mjs
// Аморфный (Amorphous): «вдвое (окр. вверх) уменьшает SPD пешком». Минимум SPD — 0.5 (стр. 28).
export const AMORPHOUS_SPD_CAP = "movement.walkHalved";
export const AMORPHOUS_ESCAPE_CAP = "grapple.autoEscape";

/** SPD после деления пополам с округлением вверх; не ниже книжного минимума 0.5. */
export const amorphousSpd = spd => Math.max(0.5, Math.ceil((Number(spd) || 0) / 2));

// ── Смена Размера (раз в Ход) ───────────────────────────────────────────────
// «Раз в Ход может увеличить или уменьшить свой Размер на 1 или 2 — это не влияет на SPD, но может
// влиять на сложность попадания по нему, протискивание и бонусы/штрафы в Борьбе.» Смещение копится
// во флаге актора и входит в итоговый Размер (sizeTotal) без SPD — как «Необъятный».
export const AMORPHOUS_SIZE_CAP = "size.amorphousShift";
export const AMORPHOUS_SIZE_FLAG = "amorphousSizeShift";
export const AMORPHOUS_SIZE_ROUND_FLAG = "amorphousSizeRound";
export const AMORPHOUS_SIZE_STEPS = [-2, -1, 1, 2];

/** Текущее смещение Размера (целое, 0 — обычная форма). */
export function amorphousSizeShiftOf(actor) {
  const v = actor?.flags?.["warhammer-dbc"]?.[AMORPHOUS_SIZE_FLAG] ?? actor?.getFlag?.("warhammer-dbc", AMORPHOUS_SIZE_FLAG);
  return Math.trunc(Number(v) || 0);
}

/** Ключ Раунда боя; вне боя — пустая строка (Ходов нет, ограничения нет). */
export const amorphousRoundKey = combat => (combat?.id ? `${combat.id}:${Number(combat.round) || 0}` : "");

/** Можно ли менять Размер в этом Ходу (раз за Раунд боя). Вне боя — всегда. */
export function amorphousSizeAvailable(actor, combat) {
  const key = amorphousRoundKey(combat);
  if (!key) return true;
  const used = actor?.flags?.["warhammer-dbc"]?.[AMORPHOUS_SIZE_ROUND_FLAG] ?? actor?.getFlag?.("warhammer-dbc", AMORPHOUS_SIZE_ROUND_FLAG);
  return used !== key;
}

/** Новое смещение после шага; шаг вне списка (±1, ±2) отвергается — вернётся null. */
export function amorphousNextShift(current, step) {
  const s = Number(step);
  return AMORPHOUS_SIZE_STEPS.includes(s) ? (Math.trunc(Number(current) || 0) + s) : null;
}
