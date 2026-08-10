// Шаг 2.3: сверка старого и нового. Конвейер работает рядом со старым кодом,
// поэтому вклад каждого источника галочек можно сравнить по сценариям.
//
// Здесь проверяется всё, что считается без Foundry: отбор Особенностей
// Происхождения, отбор предметных rollMods и вклад реестра правил. Сложение
// галочек и безусловные поправки (Усталость, снятый шлем) живут в листе
// персонажа, который без Foundry не загружается, — они в docs/checks/stage-2.md
// помечены как ручные.

import { describe, it, expect } from "vitest";
import { homeworldRollMods, matchesContext } from "../../module/constants/homeworlds.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";

const actor = ({ items = [], ...system } = {}) => ({
  system: { characteristics: {}, ...system },
  items
});

/** Актор с применённым Происхождением: ключ лежит на предмете-носителе. */
const withHomeworld = (key, over = {}) => actor({
  ...over,
  items: [...(over.items ?? []), { type: "homeworld", system: { key } }]
});

/** Отбор предметных rollMods — то же, что делает WarhammerCharacterSheet#_itemRollModsHtml. */
const itemMods = (items, ctx) =>
  items.flatMap(i => (i.rollMods ?? []).filter(m => matchesContext(m.when, ctx)));

const sum = mods => mods.reduce((acc, m) => acc + (Number(m.value) || 0), 0);

const SCENARIOS = [
  {
    name: "тест навыка без модификаторов",
    hw: "", ctx: { kind: "skill", skill: "medicae", char: "int" }, expected: 0
  },
  {
    name: "навык с Происхождением: Пограничный мир, Tech-Use (+20 и +10)",
    hw: "frontier", ctx: { kind: "skill", skill: "techUse", char: "int" }, expected: 30
  },
  {
    name: "навык с предметным rollMods (+10)",
    hw: "", ctx: { kind: "skill", skill: "medicae", char: "int" }, expected: 10,
    items: [{ rollMods: [{ when: { kind: "skill", skill: "medicae" }, value: 10, label: "Аптечка" }] }]
  },
  {
    name: "два источника сразу: Пограничный мир и предмет (+30 и +5)",
    hw: "frontier", ctx: { kind: "skill", skill: "techUse", char: "int" }, expected: 35,
    items: [{ rollMods: [{ when: { kind: "skill", skill: "techUse" }, value: 5, label: "Мультиключ" }] }]
  },
  {
    name: "тест характеристики: Схола Прогениум, W (ополовинить штраф)",
    hw: "schola", ctx: { kind: "skill", char: "wp" }, expected: 0, halve: true
  },
  {
    name: "специализация группового навыка: Улей, Navigation (Surface) (+20)",
    hw: "hive", ctx: { kind: "skill", group: "navigation", specialty: "Surface", char: "int" }, expected: 20
  },
  {
    name: "псайкер: Пси-чутьё без модификаторов",
    hw: "", ctx: { kind: "skill", skill: "psyniscience", char: "per" }, expected: 0,
    system: { psyRating: 3 }
  },
  {
    name: "друкхари: тест навыка без модификаторов",
    hw: "", ctx: { kind: "skill", skill: "dodge", char: "ag" }, expected: 0,
    system: { race: "drukhari" }
  },
  {
    name: "флаговый контекст: Мир-сад, Подавление (+10)",
    hw: "garden", ctx: { kind: "skill", char: "wp", suppression: true }, expected: 10
  },
  {
    name: "астартес: тест навыка без модификаторов",
    hw: "", ctx: { kind: "skill", skill: "awareness", char: "per" }, expected: 0,
    system: { race: "astartes" }
  }
];

describe("шаг 2.3: конвейер не меняет суммы старых источников", () => {
  for (const s of SCENARIOS) {
    it(s.name, () => {
      const a = s.hw
        ? withHomeworld(s.hw, { ...s.system, items: s.items ?? [] })
        : actor({ ...s.system, items: s.items ?? [] });

      const hwMods   = homeworldRollMods(s.hw, s.ctx);
      const itMods   = itemMods(s.items ?? [], s.ctx);
      const ruleMods = resolveTest({ actor: a, ...s.ctx }).mods;

      // Библиотека правил пока пуста (наполняется на этапе 3), поэтому третий
      // источник ничего не добавляет и итог в диалоге совпадает со старым.
      expect(ruleMods).toEqual([]);
      expect(sum([...hwMods, ...itMods, ...ruleMods])).toBe(s.expected);
      if (s.halve) expect([...hwMods, ...itMods].some(m => m.halvePenalty)).toBe(true);
    });
  }
});

describe("положительный контроль", () => {
  it("правило с rollBonus доходит до диалога — значит пустота выше от пустой библиотеки", async () => {
    const { registerRuleSource, clearRuleSources, getRuleSources } =
      await import("../../module/rules/sources.mjs");
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Проверка", effects: [{ kind: "rollBonus", target: "skill:medicae", value: 10 }] }
    ]);
    try {
      const { mods } = resolveTest({ actor: actor(), kind: "skill", skill: "medicae" });
      expect(sum(mods)).toBe(10);
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });
});
