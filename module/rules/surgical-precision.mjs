// module/rules/surgical-precision.mjs
//
// Талант «Хирургическая Точность» (Медик, medic.core.surgicalPrecision; 3-dc87).
// Книга: «Перед нанесением урона от одиночной Избирательной атаки по
// биологической цели персонаж может пройти тест Medicae−10 и получить +1 Dmg
// за каждый нечётный Успех. Если атака убивает цель, он может вместо этого
// парализовать её. Против не-людей нужен комбинированный тест: Астартес —
// For.Lore(Astartes Implants)−10; Ксеносы — For.Lore(Xenobiology)−10; Звери —
// Schol.Lore(Beasts)−10.»
//
// Комбинированный тест в системе — ОДИН бросок против наименьшего Предела
// (combat/defense.mjs, Шагоход). Чистая арифметика; живой бросок и правка
// кнопки урона — combat/surgical-precision.mjs.

import { findGroupEntry } from "../constants/skill-specializations.mjs";

/** Тип цели → вторая часть комбинированного теста (null — Человек, одиночный Medicae). */
export const SURGICAL_TARGETS = {
  human:   { label: "Человек", lore: null },
  astartes: { label: "Астартес", lore: { group: "forbiddenLore", spec: "astartesImplants", name: "For.Lore(Astartes Implants)" } },
  xenos:   { label: "Ксенос", lore: { group: "forbiddenLore", spec: "xenobiology", name: "For.Lore(Xenobiology)" } },
  beast:   { label: "Зверь", lore: { group: "scholasticLore", spec: "beasts", name: "Schol.Lore(Beasts)" } }
};

/** Штраф теста по книге. */
export const SURGICAL_PENALTY = -10;

/** Нечётные Успехи среди 1..deg: 1, 3, 5… — их ceil(deg/2). Провал даёт 0. */
export function oddSuccesses(deg, success = true) {
  if (!success) return 0;
  return Math.ceil(Math.max(0, Number(deg) || 0) / 2);
}

/**
 * Предел теста: Medicae−10 и, для не-людей, Lore−10; берётся меньший.
 * Нет записи нужной специализации — Навык не изучен: Int−20 как нетренированный.
 * @returns {{threshold:number, parts:string[]}}
 */
export function surgicalThreshold(medic, kind) {
  const medicae = Number(medic?.system?.skills?.medicae?.total)
    || ((Number(medic?.system?.characteristics?.int?.total) || 20) - 20);
  const parts = [`Medicae ${medicae}${SURGICAL_PENALTY}`];
  let threshold = medicae + SURGICAL_PENALTY;
  const lore = SURGICAL_TARGETS[kind]?.lore;
  if (lore) {
    const entry = findGroupEntry(medic, lore.group, lore.spec);
    const loreTotal = Number.isFinite(entry?.total)
      ? entry.total
      : (Number(medic?.system?.characteristics?.int?.total) || 20) - 20;
    parts.push(`${lore.name} ${loreTotal}${SURGICAL_PENALTY}`);
    threshold = Math.min(threshold, loreTotal + SURGICAL_PENALTY);
  }
  return { threshold, parts };
}
