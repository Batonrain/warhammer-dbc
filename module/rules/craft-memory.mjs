// module/rules/craft-memory.mjs
// ════════════════════════════════════════════════════════════════════════
//  Память Крафта: что персонаж уже создавал и в каком Качестве, где ассистировал
//  (Талант Prototyping / Прототипирование, корбук гл. 3, 3-3a64). Чистая логика
//  без Foundry; флаг на акторе пишет Мастерская (apps/craft-workshop.mjs).
//
//  Предмет опознаётся по НАЗВАНИЮ проекта (поле «название» над проектом в
//  Мастерской), нормализованному: регистр, ё/е и лишние пробелы не важны. Это
//  решение дизайна, а не книги: «этот предмет» книга не определяет (ни модель,
//  ни ссылка на запись), а у проекта Мастерской других признаков предмета нет.
//  Безымянный проект в память не пишется и Талант не получает.
//
//  Хранится на акторе-крафтере: flags.warhammer-dbc.craftedItems =
//    { <нормализованное имя>: { name, made: [ключи Качества…], assisted: bool } }
//  Пишется для ЛЮБОГО крафтера, а не только владельца Таланта: «однажды создав»
//  может случиться до того, как Талант куплен.
// ════════════════════════════════════════════════════════════════════════

export const CRAFTED_ITEMS_FLAG = "craftedItems";

/** Порядок Качества Крафта снизу вверх (ключи как в constants/craft.mjs::CRAFT_QUALITY). */
const QUALITY_ORDER = ["poor", "common", "good", "best"];
const rank = q => QUALITY_ORDER.indexOf(q);

/** Ключ предмета: без регистра, ё = е, пробелы схлопнуты. Пусто — предмета нет. */
export function normalizeItemName(name) {
  // «.» и «=» нельзя оставлять в ключе флага: Foundry раскрывает точку во вложенные объекты
  // (ObjectField#reconstructOperators), «-=»/«==» читает как оператор удаления/замены — «Лазган Мк.II»
  // тогда не находится, а журнал портится. Тот же приём, что drugKey (rules/drug-withdrawal.mjs).
  return String(name ?? "").toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim()
    .replaceAll(".", "·").replaceAll("=", "＝");
}

/** Журнал актора ({} если нет). */
export function craftedItemsOf(actor) {
  const log = actor?.getFlag?.("warhammer-dbc", CRAFTED_ITEMS_FLAG)
    ?? actor?.flags?.["warhammer-dbc"]?.[CRAFTED_ITEMS_FLAG];
  return log && typeof log === "object" ? log : {};
}

/** Журнал с записью «создал предмет в этом Качестве». Новый объект, вход не меняется. */
export function recordCreation(log, name, quality) {
  const key = normalizeItemName(name);
  if (!key || rank(quality) < 0) return { ...(log ?? {}) };
  const prev = log?.[key] ?? { name: String(name).trim(), made: [], assisted: false };
  const made = prev.made.includes(quality) ? prev.made : [...prev.made, quality];
  return { ...(log ?? {}), [key]: { ...prev, made } };
}

/** Журнал с записью «ассистировал при создании предмета». */
export function recordAssist(log, name) {
  const key = normalizeItemName(name);
  if (!key) return { ...(log ?? {}) };
  const prev = log?.[key] ?? { name: String(name).trim(), made: [], assisted: false };
  return { ...(log ?? {}), [key]: { ...prev, assisted: true } };
}

/**
 * Что даёт Прототипирование для этого предмета в этом Качестве:
 *  • reroll — «уже создавал этот предмет в таком же Качестве»;
 *  • halveBank — «уже создавал в Качестве хотя бы на 1 ниже» (мультипликатор Банка вдвое);
 *  • noImprovePenalty — «создал сам или ассистировал» (снимает −20 Улучшения).
 */
export function prototypingFor(log, name, quality) {
  const entry = log?.[normalizeItemName(name)];
  if (!entry) return { known: false, reroll: false, halveBank: false, noImprovePenalty: false };
  const made = entry.made ?? [];
  const q = rank(quality);
  return {
    known: true,
    reroll: made.includes(quality),
    halveBank: q >= 0 && made.some(m => rank(m) >= 0 && rank(m) < q),
    noImprovePenalty: made.length > 0 || !!entry.assisted
  };
}
