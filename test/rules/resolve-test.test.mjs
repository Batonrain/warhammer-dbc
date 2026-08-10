import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTestContext, resolveTest, rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

/** Снимок настоящих источников: тесты подменяют реестр и возвращают как было. */
const DEFAULT_SOURCES = getRuleSources();

const actor = ({ items = [], ...system } = {}) => ({
  system: { characteristics: {}, ...system },
  items
});

let errors;

beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  clearRuleSources();
});

afterEach(() => {
  errors.mockRestore();
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  delete globalThis.Hooks;
});

describe("фаза 1: контекст", () => {
  it("вид теста по умолчанию — навык: так лист собирал контекст и раньше", () => {
    expect(buildTestContext({ skill: "medicae" })).toMatchObject({ kind: "skill", skill: "medicae" });
  });

  it("переданные поля сохраняются, актор доступен отдельным полем", () => {
    const a = actor({ race: "astartes" });
    const ctx = buildTestContext({ actor: a, kind: "attack", char: "ws", target: true });
    expect(ctx).toMatchObject({ actor: a, kind: "attack", char: "ws", target: true });
  });

  it("без актора контекст всё равно собирается", () => {
    expect(buildTestContext().actor).toBe(null);
  });
});

describe("фаза 2: сбор", () => {
  it("правила приходят от всех источников, включая не подходящие актору", () => {
    registerRuleSource("first",  () => [{ id: "a" }]);
    registerRuleSource("second", () => [{ id: "b", when: { race: ["astartes"] } }]);

    const { rules } = resolveTest({ actor: actor({ race: "human" }) });
    // Собраны оба, отбор снял второе — значит сбор дошёл до обоих источников.
    expect(rules.map(r => r.id)).toEqual(["a"]);
  });

  it("хук дописывает правило до отбора, и оно просеивается наравне с остальными", () => {
    registerRuleSource("first", () => [{ id: "a" }]);
    globalThis.Hooks = {
      callAll: (name, ctx, bag) => {
        expect(name).toBe("dbc.collectRules");
        expect(ctx.skill).toBe("medicae");
        bag.push({ id: "fromHook" }, { id: "hookMiss", when: { race: ["astartes"] } });
      }
    };

    const { rules } = resolveTest({ actor: actor({ race: "human" }), skill: "medicae" });
    expect(rules.map(r => r.id)).toEqual(["a", "fromHook"]);
  });

  it("без Foundry конвейер работает: хука просто нет", () => {
    registerRuleSource("first", () => [{ id: "a" }]);
    expect(typeof globalThis.Hooks).toBe("undefined");
    expect(resolveTest({ actor: actor() }).rules.map(r => r.id)).toEqual(["a"]);
  });
});

describe("фаза 3: отбор", () => {
  it("вытеснение снимает правило по overrides", () => {
    registerRuleSource("s", () => [
      { id: "smite.baseline" },
      { id: "smite.astartes", overrides: ["smite.baseline"], when: { race: ["astartes"] } }
    ]);

    const astartes = resolveTest({ actor: actor({ race: "astartes" }) });
    const human    = resolveTest({ actor: actor({ race: "human" }) });
    expect(astartes.rules.map(r => r.id)).toEqual(["smite.astartes"]);
    expect(human.rules.map(r => r.id)).toEqual(["smite.baseline"]);
  });

  it("правило добавлено хуком и вытесняет собранное источником", () => {
    registerRuleSource("s", () => [{ id: "base" }]);
    globalThis.Hooks = { callAll: (name, ctx, bag) => bag.push({ id: "mod", overrides: ["base"] }) };
    expect(resolveTest({ actor: actor() }).rules.map(r => r.id)).toEqual(["mod"]);
  });
});

describe("галочки из эффектов", () => {
  const rule = (effects, over = {}) => ({ id: "r", label: "Правило", effects, ...over });

  it("rollBonus в любом тесте: target «all» и без target", () => {
    const mods = rollModsFromRules([
      rule([{ kind: "rollBonus", target: "all", value: 10 }]),
      rule([{ kind: "rollBonus", value: -5 }], { id: "r2" })
    ], buildTestContext({ skill: "medicae" }));
    expect(mods.map(m => m.value)).toEqual([10, -5]);
    expect(mods[0]).toMatchObject({ ruleId: "r", label: "Правило", halvePenalty: false });
  });

  it("skill:<ключ> попадает только в свой навык", () => {
    const rules = [rule([{ kind: "rollBonus", target: "skill:psyniscience", value: 10 }])];
    expect(rollModsFromRules(rules, buildTestContext({ skill: "psyniscience" }))).toHaveLength(1);
    expect(rollModsFromRules(rules, buildTestContext({ skill: "medicae" }))).toHaveLength(0);
  });

  it("char:<ключ> попадает в тест характеристики, но не в навык на той же характеристике", () => {
    const rules = [rule([{ kind: "rollBonus", target: "char:wp", value: 10 }])];
    expect(rollModsFromRules(rules, buildTestContext({ char: "wp" }))).toHaveLength(1);
    expect(rollModsFromRules(rules, buildTestContext({ skill: "psyniscience", char: "wp" }))).toHaveLength(0);
  });

  it("initiative — только бросок Инициативы", () => {
    const rules = [rule([{ kind: "rollBonus", target: "initiative", value: 4 }])];
    expect(rollModsFromRules(rules, buildTestContext({ kind: "initiative" }))).toHaveLength(1);
    expect(rollModsFromRules(rules, buildTestContext({ char: "ag" }))).toHaveLength(0);
  });

  it("penaltyMul 0.5 даёт галочку «ополовинить штраф»", () => {
    const mods = rollModsFromRules(
      [rule([{ kind: "penaltyMul", target: "skill:psyniscience", factor: 0.5 }])],
      buildTestContext({ skill: "psyniscience" }));
    expect(mods).toEqual([{ ruleId: "r", label: "Правило", value: 0, halvePenalty: true }]);
  });

  it("иной множитель штрафа диалог не умеет: галочки нет, в консоли ошибка", () => {
    const mods = rollModsFromRules(
      [rule([{ kind: "penaltyMul", target: "all", factor: 0.25 }])],
      buildTestContext({ skill: "medicae" }));
    expect(mods).toEqual([]);
    expect(errors).toHaveBeenCalledOnce();
  });

  it("эффекты урона и брони в диалог броска не просятся", () => {
    const mods = rollModsFromRules([rule([
      { kind: "damageBonus", target: "all", value: 2 },
      { kind: "apBonus", target: "all", value: 1 }
    ])], buildTestContext({ skill: "medicae" }));
    expect(mods).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("неизвестный вид эффекта — ошибка в консоль, а не молчание", () => {
    const mods = rollModsFromRules([rule([{ kind: "rolBonus", target: "all", value: 10 }])],
      buildTestContext({ skill: "medicae" }));
    expect(mods).toEqual([]);
    expect(errors).toHaveBeenCalledOnce();
  });

  it("своя подпись эффекта важнее подписи правила", () => {
    const [mod] = rollModsFromRules(
      [rule([{ kind: "rollBonus", target: "all", value: 10, label: "Подпись эффекта" }])],
      buildTestContext({ skill: "medicae" }));
    expect(mod.label).toBe("Подпись эффекта");
  });

  it("resolveTest отдаёт галочки вместе с правилами", () => {
    registerRuleSource("s", () => [
      { id: "bonus", label: "Плюс", effects: [{ kind: "rollBonus", target: "skill:medicae", value: 10 }] }
    ]);
    const { rules, mods } = resolveTest({ actor: actor(), skill: "medicae" });
    expect(rules.map(r => r.id)).toEqual(["bonus"]);
    expect(mods).toEqual([{ ruleId: "bonus", label: "Плюс", value: 10, halvePenalty: false }]);
  });
});
