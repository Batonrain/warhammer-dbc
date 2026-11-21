// module/rules/void-split.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Пустота Парии: поштучное гашение варповых частей мутаций и Даров
//  (task-f568, таблица docs/pariah-mutations-table.md, утверждена 21.11.2026).
//
//  Три вида гашения:
//   • запись Механики — when.predicates { inPariahVoid: false } (живые правила
//     сразу; долговечные эффекты, Черты/Таланты и интегральные атаки —
//     пересборкой apps/mechanics.mjs::syncNullZoneSuppression при входе/выходе);
//   • кнопка kind:"script" (условие when не читает) — pariahVoidBlocks внутри кода;
//   • читатель по имени предмета (Чёрные Глаза, Тёмная Муза, Одеяния,
//     Освежеванный, Камень Душ) — inVoidMark в самом читателе.
//
//  Без импортов: проверка метки по имени — то же, что PREDICATES.inPariahVoid
//  (Черту-метку выдаёт аура Парии, regions/auras.mjs), но годится и там, где
//  rules/predicates.mjs притянул бы цикл.
// ════════════════════════════════════════════════════════════════════════════

export const PARIAH_VOID_MARK = "In the Pariah's Void";
/** Условие записи «гаснет в Пустоте». */
export const VOID_GATE = Object.freeze({ inPariahVoid: false });

/** Актор стоит в Пустоте Парии (несёт Черту-метку). */
export function inVoidMark(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "trait"
    && String(i?.name ?? "").trim().startsWith(PARIAH_VOID_MARK));
}

/** У предмета есть записи, гаснущие в Пустоте (нужна пересборка при входе/выходе). */
export function hasVoidGatedEntries(mechanics) {
  return (mechanics ?? []).some(g => (g?.entries ?? []).some(e =>
    ["predicates", "predicatesAll"].some(k => e?.when?.[k] && Object.hasOwn(e.when[k], "inPariahVoid"))));
}

/**
 * when записи с добавленным гейтом Пустоты (не трогает остальные условия).
 * При anyOf гейт идёт в predicatesAll — иначе стал бы одной из альтернатив.
 */
export function withVoidGate(when) {
  const w = when && typeof when === "object" ? when : { negate: false, conditions: [] };
  const key = w.anyOf ? "predicatesAll" : "predicates";
  return { ...w, [key]: { ...(w[key] ?? {}), ...VOID_GATE } };
}

/**
 * Для кнопок kind:"script": в Пустоте — предупреждение и true (кнопка
 * ничего не делает). Вне Пустоты — false.
 */
export function pariahVoidBlocks(actor, title = "") {
  if (!inVoidMark(actor)) return false;
  globalThis.ui?.notifications?.warn(`${title ? `${title}: ` : ""}в Пустоте Парии сила Варпа не отвечает.`);
  return true;
}
