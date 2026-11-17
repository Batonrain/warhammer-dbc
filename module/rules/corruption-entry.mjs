// module/rules/corruption-entry.mjs
//
// Условия и предел записи Конструктора kind:"corruption" (Порча от Архетипа,
// Черты, предмета). Книга описывает Порчу не только числом «+N Cor», но и
// оговорками: Одержимый — «+3d5 Cor, но не выше Cor 90»; встречаются и «если
// Порчи меньше X, то получает Y / Zd5». Три необязательных поля записи
// выражают это без нового вида записи:
//
//   corruptionCap     — «не выше N»: итоговая Порча после прибавки не
//                       поднимается выше N (если уже ≥ N — прибавка 0);
//   corruptionIfBelow — «только если Порча меньше N»: при текущей Порче ≥ N
//                       основная формула НЕ бросается;
//   corruptionElse    — «иначе»: формула на случай, когда условие
//                       corruptionIfBelow не выполнено (пусто — не получает
//                       ничего).
//
// Пустые поля — прежнее поведение (бросить corruptionValue и прибавить),
// так что записи без этих полей не меняются. Чистые функции, Foundry не нужен
// — проверяются test/rules/corruption-entry.test.mjs.

/** Число из поля записи; пустое/нечисловое → null (поле не задано). */
export function corruptionLimit(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Какая формула бросается при текущей Порче: основная или «иначе».
 * @returns {{formula: string, branch: "main"|"else"}} formula "" — ничего не получает.
 */
export function planCorruption(entry, current) {
  const below = corruptionLimit(entry.corruptionIfBelow);
  if (below !== null && current >= below) {
    return { formula: String(entry.corruptionElse ?? "").trim(), branch: "else" };
  }
  return { formula: String(entry.corruptionValue || "0").trim(), branch: "main" };
}

/** Прибавка с учётом «не выше N»; вычитание и прибавка ≤ 0 предел не трогает. */
export function capCorruptionGain(entry, current, signed) {
  const cap = corruptionLimit(entry.corruptionCap);
  if (cap === null || signed <= 0) return signed;
  return Math.max(0, Math.min(signed, cap - current));
}

/** Хвост подписи записи: «, но не выше Cor 90», «, если Порча < 30, иначе +1». */
export function corruptionLimitsSuffix(entry) {
  const parts = [];
  const cap = corruptionLimit(entry.corruptionCap);
  if (cap !== null) parts.push(`не выше Cor ${cap}`);
  const below = corruptionLimit(entry.corruptionIfBelow);
  if (below !== null) {
    const alt = String(entry.corruptionElse ?? "").trim();
    parts.push(`только если Порча < ${below}${alt ? `, иначе +${alt}` : ""}`);
  }
  return parts.length ? `, ${parts.join(", ")}` : "";
}
