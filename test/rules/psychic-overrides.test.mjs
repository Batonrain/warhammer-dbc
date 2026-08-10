// Шаг 3.3 плана: вытеснение (`overrides`) — механизм, ради которого затевался
// весь план. Проверяется на паре правил, описывающих одну психосилу в двух
// версиях, через настоящий реестр источников: правило доходит до результата тем
// же путём, каким его получит лист персонажа.
//
// Пара живёт в тесте, а не в module/rules/library/: в содержании системы двух
// версий одной психосилы пока нет. Библиотека Либрариума помечена «только на
// Космодесантников», но её силы — отдельные записи с собственными требованиями,
// а не астартесовские варианты базовых. Придумывать числа, которых нет в книге,
// ради демонстрации механизма нельзя, поэтому взят пример из
// docs/rules-format.md.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { collectRules } from "../../module/rules/collect.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const SMITE = {
  id: "smite.baseline",
  label: "Smite / Сокрушение",
  effects: [{ kind: "damageDice", target: "power:smite", value: "1d10" }]
};

const SMITE_ASTARTES = {
  id: "smite.astartes",
  label: "Smite / Сокрушение (Астартес)",
  overrides: ["smite.baseline"],
  when: { race: ["astartes"], hasTrait: "Gene-Seed" },
  effects: [{ kind: "damageDice", target: "power:smite", value: "1d10+PR" }]
};

const geneSeed = { type: "trait", name: "Gene-Seed / Геносемя" };

const astartes = { system: { race: "astartes", size: 1 }, items: [geneSeed] };
const human    = { system: { race: "human", size: 0 }, items: [] };

const saved = getRuleSources();

beforeEach(() => {
  clearRuleSources();
  registerRuleSource("test.powers", () => [SMITE, SMITE_ASTARTES]);
});

afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

describe("вытеснение версий психосилы", () => {
  it("у Астартес действует только астартесовская версия", () => {
    expect(collectRules(astartes)).toEqual([SMITE_ASTARTES]);
  });

  it("у человека действует только базовая", () => {
    expect(collectRules(human)).toEqual([SMITE]);
  });

  it("у каждого по одному правилу, и это разные правила", () => {
    const [a] = collectRules(astartes);
    const [h] = collectRules(human);
    expect(collectRules(astartes)).toHaveLength(1);
    expect(collectRules(human)).toHaveLength(1);
    expect(a.id).not.toBe(h.id);
  });

  // Порядок разбора: сначала отбор по `when`, потом снятие вытесненных. Иначе
  // астартесовская версия убрала бы базовую и у человека, оставив его без силы.
  it("не прошедшая отбор версия ничего не вытесняет", () => {
    const noGeneSeed = { system: { race: "astartes", size: 1 }, items: [] };
    expect(collectRules(noGeneSeed)).toEqual([SMITE]);
  });
});
