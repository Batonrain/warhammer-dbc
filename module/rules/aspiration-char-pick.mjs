// module/rules/aspiration-char-pick.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Стремления с выбором Характеристик (Black Crusade, стр. 22): «Совершенство» —
//  «+5 к одной Характеристике по выбору, −3 к двум другим».
//
//  Группа «ИЛИ» Конструктора выбирает одну готовую запись из заранее
//  заведённых, а здесь сочетаний слишком много (10 × 36) и половина выбора —
//  «две из оставшихся», поэтому предмет-Стремление несёт в флаге `charPick`
//  только ПРАВИЛО выбора, а игрок отвечает при выдаче. Ответ превращается в
//  обычные записи `characteristic` на копии Стремления у актора
//  (apps/aspirations.mjs::grantAspiration) — дальше их ведёт Конструктор как
//  любые другие, без отдельной ветки в расчёте.
//
//  Чистые функции: без Foundry, проверяются напрямую.
// ════════════════════════════════════════════════════════════════════════════

/** Ключ флага предмета (`flags.warhammer-dbc.charPick`) с правилом выбора. */
export const CHAR_PICK_FLAG = "charPick";

/** Правило выбора из флага; пусто/мусор → null (у предмета выбора нет). */
export function normalizeCharPick(cfg) {
  if (!cfg || typeof cfg !== "object") return null;
  const plus = Number(cfg.plus);
  const minus = Number(cfg.minus);
  const minusCount = Math.trunc(Number(cfg.minusCount));
  if (!Number.isFinite(plus) || !Number.isFinite(minus) || !(minusCount >= 1)) return null;
  return { plus: Math.abs(plus), minus: Math.abs(minus), minusCount };
}

/**
 * Состояние выбора у слота: "none" — у Стремления нет правила выбора;
 * "needed" — правило есть, ответа игрока нет (запись выдана до появления
 * выбора или ответ потерян); "chosen" — ответ сохранён на выданной копии.
 */
export function charPickState(cfg, chosen) {
  if (!normalizeCharPick(cfg)) return "none";
  return chosen ? "chosen" : "needed";
}

/**
 * Годится ли ответ игрока: `pick` = { plus: ключ, minus: [ключи] }. Плюс — одна
 * известная Характеристика; минусы — ровно `minusCount` РАЗНЫХ Характеристик,
 * ни одна не совпадает с плюсовой («две ДРУГИЕ»).
 * @returns {{ok:boolean, reason?:string}}
 */
export function validateCharPick(cfg, pick, charKeys) {
  const rule = normalizeCharPick(cfg);
  if (!rule) return { ok: false, reason: "У Стремления нет правила выбора." };
  const known = new Set(charKeys);
  if (!known.has(pick?.plus)) return { ok: false, reason: "Выберите Характеристику для бонуса." };
  const minus = Array.isArray(pick?.minus) ? pick.minus : [];
  if (minus.length !== rule.minusCount || minus.some(k => !known.has(k))) {
    return { ok: false, reason: `Выберите ${rule.minusCount} Характеристики для штрафа.` };
  }
  if (new Set(minus).size !== minus.length) return { ok: false, reason: "Штрафы должны лечь на разные Характеристики." };
  if (minus.includes(pick.plus)) return { ok: false, reason: "Штраф должен лечь на другие Характеристики, не на ту, что получает бонус." };
  return { ok: true };
}

/**
 * Ответ → изменения Характеристик в порядке книги (плюс, затем минусы).
 * Неверный ответ — пустой список, а не частичный: полбонуса без штрафа хуже,
 * чем ничего.
 */
export function charPickChanges(cfg, pick, charKeys) {
  if (!validateCharPick(cfg, pick, charKeys).ok) return [];
  const rule = normalizeCharPick(cfg);
  return [
    { charKey: pick.plus, op: "add", value: rule.plus },
    ...pick.minus.map(charKey => ({ charKey, op: "subtract", value: rule.minus }))
  ];
}
