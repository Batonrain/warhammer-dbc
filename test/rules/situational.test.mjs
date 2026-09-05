// Ситуативные штрафы состояния тела и снаряжения в реестре правил (wdbc-n17t).
//
// Числа здесь НЕ проверяются заново по книге — их считают те же функции, что и
// раньше (у каждой свои тесты: conditions.test.mjs, encumbrance.test.mjs,
// armor-mods). Проверяется упаковка: те же числа доезжают до конвейера теста,
// едут отдельным списком от галочек и не зацикливают сборку правил.

import "../support/foundry-stub.mjs";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { situationalRules, helmetlessBonus } from "../../module/rules/situational.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { gatherRules } from "../../module/rules/collect.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const actor = ({ items = [], ...system } = {}) => ({
  system: { characteristics: { t: { bonus: 0 } }, ...system },
  items
});

const idsOf = rules => rules.map(r => r.id);

describe("situationalRules: упаковка штрафов в записи правил", () => {
  it("у отдохнувшего и снаряжённого персонажа записей нет вовсе", () => {
    expect(situationalRules(actor({ fatigue: { value: 0 } }), { char: "ag" })).toEqual([]);
  });

  it("Усталость даёт одну запись с автоматическим модификатором", () => {
    const rules = situationalRules(actor({ fatigue: { value: 1 } }), { char: "ag" });
    expect(idsOf(rules)).toEqual(["situational.fatigue"]);
    expect(rules[0].effects).toEqual([{
      kind: "rollBonus", target: "all", value: -10, label: "😓 Усталость", auto: true
    }]);
  });

  it("характеристика теста решает: Стойкость Усталость не трогает", () => {
    expect(situationalRules(actor({ fatigue: { value: 3 } }), { char: "t" })).toEqual([]);
  });

  it("снятый шлем помогает только Товариществу", () => {
    const bald = actor({ helmetlessActive: true, fatigue: { value: 0 } });
    expect(idsOf(situationalRules(bald, { char: "fel" }))).toEqual(["situational.helmetless"]);
    expect(situationalRules(bald, { char: "ws" })).toEqual([]);
  });

  it("Перевес инвентаря бьёт по физическим характеристикам, а не по мысли", () => {
    const loaded = actor({ fatigue: { value: 0 }, encumbrance: { effectiveCurrent: 80, carry: 60 } });
    expect(idsOf(situationalRules(loaded, { char: "s" }))).toEqual(["situational.inventoryOverload"]);
    expect(situationalRules(loaded, { char: "int" })).toEqual([]);
  });

  it("несколько штрафов сразу — несколько записей, каждая со своей подписью", () => {
    const wreck = actor({
      fatigue: { value: 1 }, helmetlessActive: true,
      encumbrance: { effectiveCurrent: 80, carry: 60 }
    });
    // Товарищество: шлем помогает, Перевес нет — по одной записи на источник.
    expect(idsOf(situationalRules(wreck, { char: "fel" })))
      .toEqual(["situational.fatigue", "situational.helmetless"]);
  });

  it("ключ группового навыка не теряется: Перевес видит и ctx.group", () => {
    const loaded = actor({ fatigue: { value: 0 }, encumbrance: { effectiveCurrent: 80, carry: 60 } });
    // Уклонение/Парирование — единственные, кого различает ключ навыка; у
    // Перевеса инвентаря ставка та же, но путь чтения ключа общий с бронёй.
    expect(idsOf(situationalRules(loaded, { group: "dodge" }))).toEqual(["situational.inventoryOverload"]);
  });
});

describe("helmetlessBonus", () => {
  it("+5 Товариществу без шлема", () => {
    expect(helmetlessBonus(actor({ helmetlessActive: true }), "fel")).toBe(5);
  });

  it("в шлеме прибавки нет", () => {
    expect(helmetlessBonus(actor({ helmetlessActive: false }), "fel")).toBe(0);
  });

  it("без актора не падает", () => {
    expect(helmetlessBonus(null, "fel")).toBe(0);
  });
});

describe("конвейер теста: автоматические модификаторы отдельно от галочек", () => {
  it("Усталость едет в autoMods, а не в mods", () => {
    const tired = actor({ fatigue: { value: 1 } });
    const { mods, autoMods } = resolveTest({ actor: tired, kind: "skill", char: "ag", skill: "dodge" });
    expect(autoMods).toEqual([{ ruleId: "situational.fatigue", label: "😓 Усталость", value: -10, halvePenalty: false }]);
    expect(mods.map(m => m.ruleId)).not.toContain("situational.fatigue");
  });

  it("список галочек у отдохнувшего персонажа пуст, как и был", () => {
    const { mods, autoMods } = resolveTest({ actor: actor({ fatigue: { value: 0 } }), kind: "skill", char: "ag" });
    expect(mods).toEqual([]);
    expect(autoMods).toEqual([]);
  });

  it("правило без auto по-прежнему галочка, а не автомат", () => {
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("тест", () => [
      { id: "ручное", label: "Ручное", effects: [{ kind: "rollBonus", target: "all", value: 10 }] }
    ]);
    try {
      const { mods, autoMods } = resolveTest({ actor: actor(), kind: "skill", char: "ag" });
      expect(mods.map(m => m.ruleId)).toEqual(["ручное"]);
      expect(autoMods).toEqual([]);
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });
});

describe("защита сборки от повторного входа", () => {
  let errors;
  beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { errors.mockRestore(); });

  it("источник, который сам спрашивает правила того же актора, не зацикливается", () => {
    const saved = getRuleSources();
    clearRuleSources();
    let depth = 0;
    registerRuleSource("рекурсивный", (a, ctx) => {
      depth += 1;
      // Так ведёт себя настоящий источник, спрашивающий возможность актора
      // (rules/flags.mjs::hasRuleFlag): внутри — новая сборка по тому же актору.
      gatherRules(a, ctx);
      return [{ id: "глубина", effects: [] }];
    });
    try {
      expect(idsOf(gatherRules(actor(), {}))).toEqual(["глубина"]);
      expect(depth).toBe(1);
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });

  it("вложенная сборка по ДРУГОМУ актору не глушится — cross-actor правила живы", () => {
    const saved = getRuleSources();
    clearRuleSources();
    const other = actor({ race: "other" });
    const seen = [];
    registerRuleSource("сосед", (a, ctx) => {
      seen.push(a);
      if (a !== other) gatherRules(other, ctx);
      return [];
    });
    try {
      gatherRules(actor(), {});
      expect(seen).toHaveLength(2);
      expect(seen[1]).toBe(other);
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });
});

// ── Партия 3/3: разовые способности (wdbc-ct65.3) ─────────────────────────
//
// Проверяется не каждая способность по отдельности (их восемнадцать, и у
// каждой своя обвязка с диалогами и чатом), а сам общий сборщик, которым все
// они теперь пользуются: он обязан складывать автоматические штрафы вместе с
// правилами-галочками и различать области.
describe("collectTestMods: общий сбор для мест без диалога", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("складывает автоматический штраф и правило области в одно число", async () => {
    const { collectTestMods } = await import("../../module/rules/roll-mods.mjs");
    registerRuleSource("испытание", () => [
      { id: "черта", label: "Черта", effects: [{ kind: "rollBonus", target: "skill:dodge", value: 10 }] }
    ]);
    const tired = actor({ fatigue: { value: 1 } });
    const got = collectTestMods(tired, { kind: "skill", skill: "dodge", char: "ag" });
    expect(got.total).toBe(0);                       // −10 Усталости и +10 Черты
    expect(got.parts).toEqual(["😓 Усталость -10", "Черта +10"]);
  });

  it("правило чужой области в сбор не попадает", async () => {
    const { collectTestMods } = await import("../../module/rules/roll-mods.mjs");
    registerRuleSource("испытание", () => [
      { id: "черта", label: "Черта", effects: [{ kind: "rollBonus", target: "skill:stealth", value: 10 }] }
    ]);
    const got = collectTestMods(actor({ fatigue: { value: 0 } }), { kind: "skill", skill: "dodge", char: "ag" });
    expect(got.total).toBe(0);
    expect(got.parts).toEqual([]);
  });
});
