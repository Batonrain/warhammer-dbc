// test/rules/success-mul.test.mjs
//
// Множитель Успехов (20.11.2026, wdbc-l6o6j / wdbc-qyit4): Кортекс Малагры
// «утраивает Успехи на встречных тестах на сопротивление Ноотеургии и
// Аниматеургии и удваивает на сопротивление психосилам на разум». Галочка в
// окне броска (testMod modValueMode:"successMul") → множитель Успехов в исходе
// теста ДО сравнения встречного.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { resolveKindOutcome } from "../../module/rules/kind-outcome.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import { successMulChecked } from "../../module/rules/roll-mods.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const DEFAULT_SOURCES = getRuleSources();
const actor = () => ({ system: { characteristics: {} }, items: [], getFlag: () => undefined, setFlag: async () => {} });
beforeEach(() => clearRuleSources());
afterEach(() => { clearRuleSources(); for (const [k, fn] of DEFAULT_SOURCES) registerRuleSource(k, fn); });

const CORTEX = packDocById("packs-src/traits/Элитные_архетипы/Малагра", "BYcmE2XugaiNFxI9");
const cortexItem = { id: "cortex", name: CORTEX.name, flags: CORTEX.flags };

describe("Кортекс Малагры — данные пака", () => {
  it("две записи: встречный ×3, психосила на разум ×2", () => {
    const rules = rulesFromItemMechanics([cortexItem]);
    const effects = rules.flatMap(r => r.effects);
    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "successMul", target: "all", value: 3 }),
      expect.objectContaining({ kind: "successMul", target: "psychicMind", value: 2 })
    ]));
  });

  it("в окне психосилы на разум — галочка ×2, в любом другом окне — ×3", () => {
    const rules = rulesFromItemMechanics([cortexItem]);
    const psy = rollModsFromRules(rules, { actor: actor(), kind: "skill", char: "wp", psychicThreat: true });
    expect(psy.map(m => m.successMul)).toContain(2);
    const opp = rollModsFromRules(rules, { actor: actor(), kind: "skill", char: "int" });
    expect(opp.map(m => m.successMul)).toContain(3);
  });
});

describe("successMulChecked", () => {
  const mods = [{ ruleId: "a", successMul: 3 }, { ruleId: "b", successMul: 2 }, { ruleId: "c", value: 10 }];
  it("ничего не отмечено — 1", () => expect(successMulChecked(mods, ["c"])).toBe(1));
  it("отмечено — множитель", () => expect(successMulChecked(mods, ["b"])).toBe(2));
  it("два отмеченных не перемножаются — берётся больший", () => expect(successMulChecked(mods, ["a", "b"])).toBe(3));
});

describe("resolveKindOutcome — successMul", () => {
  it("Успех: Успехи умножаются, строка в карточке", async () => {
    const a = actor();
    const base = await resolveKindOutcome(a, { baseEff: 65, rv: 34, ctx: { actor: a, kind: "skill", char: "wp" } });
    const o = await resolveKindOutcome(a, { baseEff: 65, rv: 34, ctx: { actor: a, kind: "skill", char: "wp" }, successMul: 3 });
    expect(o.deg).toBe(base.deg * 3);
    expect(o.unnaturalLine).toContain("×3");
  });

  it("Провал: множитель не трогает Провалы", async () => {
    const a = actor();
    const o = await resolveKindOutcome(a, { baseEff: 30, rv: 80, ctx: { actor: a, kind: "skill", char: "wp" }, successMul: 3 });
    expect(o.success).toBe(false);
    expect(o.unnaturalLine).not.toContain("×3");
  });

  it("встречный: умножение решает исход сравнения", async () => {
    const a = actor();
    // Мы: Порог 45, бросок 40 → 1 Успех. Соперник: Порог 50, бросок 35 → 2 Успеха.
    const args = { baseEff: 45, rv: 40, ctx: { actor: a, kind: "skill", char: "wp" },
      opposed: { threshold: 50, roll: 35, unnatural: false } };
    const plain = await resolveKindOutcome(a, args);
    expect(plain.opposedLine).toContain("Соперник побеждает");
    const tripled = await resolveKindOutcome(a, { ...args, successMul: 3 });
    expect(tripled.deg).toBe(plain.deg * 3);
    expect(tripled.opposedLine).toContain("Вы побеждаете");
  });
});
