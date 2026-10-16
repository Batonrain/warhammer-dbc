// module/rules/research-findings.mjs
// ════════════════════════════════════════════════════════════════════════
//  Итог проекта-Исследования в Мастерской Крафта (книга — глава
//  «Исследование», корбук стр. 21-22), когда смена заполняет Банк Успехов:
//
//  - Чертёж / Истинное имя / Иное — создаётся предмет-знание на крафтере
//    (generic "gear", описание называет находку), чтобы открытие было
//    осязаемым на листе, а не только числом в чате.
//  - Психосила / ритуал / вязь — книга явно отдаёт эти три подряд, в
//    системе у каждого свой тип предмета (psychicPower/ritual/runicWeave);
//    игрок выбирает, что именно открыто (psychicResultType проекта).
//    Книга: «ГМ одобряет концепт и назначает Навыки/сложность/банк» — эти
//    числа уже настраиваются вручную существующими полями Мастерской
//    (skillChoices/baseBank/gmMod), здесь просто создаётся черновой предмет
//    под то, что ГМ впишет, с напоминанием о трате Опыта на изучение.
//  - Изучение (Logic, «вместо создания знаний») — НЕ предмет: книга прямо
//    противопоставляет эту находку созданию знания — обоснование для
//    продвижения Навыка группы Lore. Фиксируется только в Журнале
//    Исследований с тем, для чего (studyTarget — текст игрока).
//
//  Чистая логика, без Foundry (game/ui/canvas/Roll не используются) —
//  module/apps/craft-workshop.mjs вызывает это на исходе смены и сам решает,
//  что делать с актором (createEmbeddedDocuments/setFlag).
// ════════════════════════════════════════════════════════════════════════

/** Флаг actor, под которым живёт Журнал Исследований (массив записей). */
export const RESEARCH_JOURNAL_FLAG = "researchJournal";

/** Психосила/Ритуал/Вязь — книга называет все три как итог одной находки. */
export const PSYCHIC_RESULT_TYPES = [
  { key: "psychicPower", label: "Психосила",        itemType: "psychicPower" },
  { key: "ritual",       label: "Ритуал",           itemType: "ritual" },
  { key: "runicWeave",   label: "Руническая вязь",  itemType: "runicWeave" }
];

const KIND_LABELS = {
  blueprint: "Чертёж / рецепт для крафта",
  psychic:   "Психосила / ритуал / вязь",
  truename:  "Истинное имя демона",
  lore:      "Изучение (обоснование Навыка)",
  other:     "Иное знание"
};
export function researchKindLabel(kind) { return KIND_LABELS[kind] || kind || ""; }

const PSYCHIC_REMINDER = "Открыто Исследованием — ГМ назначает механику силы/ритуала/вязи; псайкер всё равно должен потратить Опыт, чтобы изучить и использовать результат (книга, «Психические Исследования»).";

function psychicItemData(title, resultTypeKey) {
  const def = PSYCHIC_RESULT_TYPES.find(t => t.key === resultTypeKey) || PSYCHIC_RESULT_TYPES[0];
  const data = { name: title || def.label, type: def.itemType,
    system: { description: `<p>${PSYCHIC_REMINDER}</p>` } };
  // Ritual — единственный из трёх, у кого есть поле "Откуда получено".
  if (def.itemType === "ritual") data.system.source = "Исследование";
  return data;
}

const GENERIC_FINDING_LABEL = { blueprint: "Чертёж", truename: "Истинное имя", other: "Находка" };

function genericFindingItemData(title, kind) {
  const label = GENERIC_FINDING_LABEL[kind] || "Находка";
  return {
    name: title || label, type: "gear",
    system: { description: `<p>${label}, открыт(о) Исследованием.</p>`, gearCategory: "misc" }
  };
}

/**
 * Данные предмета для createEmbeddedDocuments({kind,resultType,title}) —
 * null у "lore" (книга: «Изучение» заменяет создание знания, не производит его).
 */
export function researchFindingItemData({ kind, resultType, title } = {}) {
  if (kind === "lore") return null;
  if (kind === "psychic") return psychicItemData(title, resultType);
  return genericFindingItemData(title, kind);
}

/** Одна запись Журнала Исследований — append-only, без своего id/даты (порядок — сам журнал). */
export function researchJournalEntry({ kind, title, skillLabel, studyTarget, itemId, itemName } = {}) {
  return {
    kind, kindLabel: researchKindLabel(kind),
    title: title || "", skillLabel: skillLabel || "",
    studyTarget: kind === "lore" ? (studyTarget || "") : "",
    itemId: itemId || null, itemName: itemName || ""
  };
}

/** Добавить запись в Журнал (массив из флага актора), капа — как у bioLog/doseLog. */
export function appendResearchJournal(log, entry, cap = 50) {
  return [...(Array.isArray(log) ? log : []), entry].slice(-cap);
}
