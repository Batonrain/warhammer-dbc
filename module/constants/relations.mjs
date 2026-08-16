// module/constants/relations.mjs
//
// Отношения по Умениям: один и тот же модификатор называется по-разному в
// зависимости от того, каким Навыком к персонажу подступаются. «+20» — это
// Нежность для Обаяния, Преданность для Командования, Доверие для Обмана и
// Напуган для Запугивания.
//
// Модификатор ставится СВОЙ на каждый Навык: отношение бывает несимметричным —
// «предан, но не верит» это Командование +20 при Обмане −10.

/** Навыки, по которым считаются Отношения (ключи из constants/skills.mjs). */
export const RELATION_SKILLS = [
  { key: "charm",      label: "Обаяние" },
  { key: "command",    label: "Командование" },
  { key: "deceive",    label: "Обман" },
  { key: "intimidate", label: "Запугивание" }
];

/** Ступени модификатора — от лучшего к худшему, как в таблице книги. */
export const RELATION_STEPS = [30, 20, 10, 0, -10, -20, -30];

/** Название отношения: ступень → подпись для каждого Навыка. */
export const RELATION_LABELS = {
  30:  { charm: "Безрассудство", command: "Фанатизм",    deceive: "Легковерие",  intimidate: "В ужасе" },
  20:  { charm: "Нежность",      command: "Преданность", deceive: "Доверие",     intimidate: "Напуган" },
  10:  { charm: "Благосклонность", command: "Верность",  deceive: "Согласие",    intimidate: "Оцепенение" },
  0:   { charm: "Безразличие",   command: "Безразличие", deceive: "Безразличие", intimidate: "Безразличие" },
  "-10": { charm: "Презрение",     command: "Неприязнь",   deceive: "Подозрение",  intimidate: "Храбрость" },
  "-20": { charm: "Пренебрежение", command: "Вероломство", deceive: "Скептицизм",  intimidate: "Отважность" },
  "-30": { charm: "Отвращение",    command: "Мятежность",  deceive: "Отрицание",   intimidate: "Безбашенность" }
};

/** Ближайшая ступень таблицы: между строками отношения не живут. */
export function relationStep(value) {
  const v = Number(value) || 0;
  return RELATION_STEPS.reduce((best, step) =>
    Math.abs(step - v) < Math.abs(best - v) ? step : best, 0);
}

/** Как называется это отношение по такому Навыку. */
export function relationLabel(skillKey, value) {
  return RELATION_LABELS[String(relationStep(value))]?.[skillKey] ?? "";
}

/** Пустой набор модификаторов — Безразличие по всем четырём Навыкам. */
export function emptyRelationMods() {
  return Object.fromEntries(RELATION_SKILLS.map(s => [s.key, 0]));
}
