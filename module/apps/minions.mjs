// module/apps/minions.mjs
// ════════════════════════════════════════════════════════════════════════
//  Миньоны (корбук стр. 111-113).
//
//  Здесь остались только справочники групп и уровней да две связи, которыми
//  пользуется Конструктор Механики: кто чей слуга и как меняется Лояльность.
//  Всё остальное переехало: расчёты создания — в rules/minion-build.mjs, окно
//  генератора — в apps/minion-creator.mjs, панель Хозяина — в
//  sheets/tabs/minions-panel.mjs, а сам слуга стал типом актора `minion` со
//  своим листом.
//
//  Ссылку хранит МИНЬОН, а не Хозяин, и список миньонов собирается перебором
//  акторов. Хранить список на Хозяине значило бы держать одну связь в двух
//  документах: удалённый миньон оставлял бы висячую строку, а перепривязка
//  требовала бы двух правок вместо одной.
//
//  Базовую Лояльность даёт ЗНАЧЕНИЕ (total, не бонус) характеристики Хозяина,
//  своей у каждой группы миньонов (стр. 111): F у человека, P у зверя,
//  I у машины, W у демона.
//
//  Функции принимают актора и список акторов мира, а не game — поэтому
//  проверяются без запуска Foundry.
// ════════════════════════════════════════════════════════════════════════

export const MINION_TYPES = {
  human:   { label: "Человек", masterChar: "fel" },
  beast:   { label: "Зверь",   masterChar: "per" },
  machine: { label: "Машина",  masterChar: "int" },
  daemon:  { label: "Демон",   masterChar: "wp"  }
};

export const MINION_TIERS = {
  lesser:   "Низший",
  standard: "Обычный",
  greater:  "Высший",
  horde:    "Орда Миньонов",
  superior: "Превосходящий Миньон"
};

/** Кто может иметь миньонов и кто может быть миньоном. */
export const MASTER_ACTOR_TYPES = ["character", "daemon", "demonPrince"];
export const MINION_ACTOR_TYPES = ["character", "daemon"];

/** Акторы, чей masterUuid указывает на этого — его миньоны. */
export function minionsOf(actor, actors = []) {
  if (!actor?.uuid) return [];
  return [...actors].filter(a => a?.system?.masterUuid === actor.uuid);
}

/** Базовая Лояльность миньона — значение нужной характеристики Хозяина. */
export function baseLoyaltyFor(master, minionType) {
  const charKey = MINION_TYPES[minionType]?.masterChar;
  if (!charKey || !master) return 0;
  return Number(master.system?.characteristics?.[charKey]?.total) || 0;
}

/**
 * Новое значение Лояльности после прибавки. Ниже нуля не опускается, а выше
 * максимума — только если максимум задан: у миньона, которому Лояльность ещё
 * не считали, max равен нулю, и потолок в ноль обнулял бы любую прибавку.
 */
export function loyaltyAfterChange(minion, delta) {
  const cur = Number(minion?.system?.loyalty?.value) || 0;
  const max = Number(minion?.system?.loyalty?.max)   || 0;
  const next = cur + (Number(delta) || 0);
  return Math.max(0, max ? Math.min(max, next) : next);
}
