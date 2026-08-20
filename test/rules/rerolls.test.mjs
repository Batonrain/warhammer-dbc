// Перебросы из правил: «раз в Раунд перебросить любой тест A» (Локус Грации),
// «перебросить тест WS» (Локус Мастерства) и прочие того же вида.
//
// Проверяется отбор — какие перебросы предложить на ЭТОМ броске. Сам бросок и
// выбор лучшего из двух — фаза 5 конвейера, она живёт в листе.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rerollsFromRules, resolveTest } from "../../module/rules/resolve-test.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
let errors;

beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  clearRuleSources();
});
afterEach(() => {
  errors.mockRestore();
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

const rule = (id, effects, when = {}) => ({ id, label: id, when, effects });
const grace = rule("locus.grace", [
  { kind: "rollMode", target: "char:ag", mode: "keepBest", rolls: 2 }
]);

describe("rerollsFromRules: отбор по области теста", () => {
  it("переброс теста Ловкости предлагается на тесте Ловкости", () => {
    expect(rerollsFromRules([grace], { kind: "skill", char: "ag" }))
      .toEqual([{ ruleId: "locus.grace", label: "locus.grace", mode: "keepBest", rolls: 2, who: "self" }]);
  });

  it("и не предлагается на тесте другой характеристики", () => {
    expect(rerollsFromRules([grace], { kind: "skill", char: "wp" })).toEqual([]);
  });

  it("тест навыка на Ловкости — не тест Ловкости: у книги это разные правила", () => {
    // Та же развилка, что у rollBonus: наличие ctx.skill отличает одно от другого.
    expect(rerollsFromRules([grace], { kind: "skill", skill: "acrobatics" })).toEqual([]);
  });

  it("область «attack» ловит любой удар и выстрел", () => {
    const rampage = rule("locus.rampage", [
      { kind: "rollMode", target: "attack", mode: "keepBest", rolls: 2 }
    ]);
    expect(rerollsFromRules([rampage], { kind: "attack", isMelee: true })).toHaveLength(1);
    expect(rerollsFromRules([rampage], { kind: "skill", char: "ag" })).toEqual([]);
  });

  it("пустая область — переброс любого теста", () => {
    const any = rule("any", [{ kind: "rollMode", mode: "keepBest", rolls: 2 }]);
    expect(rerollsFromRules([any], { kind: "skill", skill: "medicae" })).toHaveLength(1);
  });
});

describe("rerollsFromRules: разбор записи", () => {
  it("режим по умолчанию — «лучший из двух»: так книга описывает переброс", () => {
    const bare = rule("bare", [{ kind: "rollMode", target: "char:t" }]);
    expect(rerollsFromRules([bare], { kind: "skill", char: "t" }))
      .toEqual([{ ruleId: "bare", label: "bare", mode: "keepBest", rolls: 2, who: "self" }]);
  });

  it("«худший из двух» тоже понимается — им пишутся штрафные перебросы", () => {
    const worst = rule("worst", [{ kind: "rollMode", target: "char:t", mode: "keepWorst", rolls: 2 }]);
    expect(rerollsFromRules([worst], { kind: "skill", char: "t" })[0].mode).toBe("keepWorst");
  });

  it("меньше двух бросков перебросом не является — запись отбрасывается с жалобой", () => {
    const bad = rule("bad", [{ kind: "rollMode", target: "char:t", rolls: 1 }]);
    expect(rerollsFromRules([bad], { kind: "skill", char: "t" })).toEqual([]);
    expect(errors).toHaveBeenCalled();
  });

  it("неизвестный режим не превращается молча в «лучший» — жалуемся", () => {
    const bad = rule("bad", [{ kind: "rollMode", target: "char:t", mode: "keepMiddle", rolls: 2 }]);
    expect(rerollsFromRules([bad], { kind: "skill", char: "t" })).toEqual([]);
    expect(errors).toHaveBeenCalled();
  });

  it("свой label эффекта важнее подписи правила", () => {
    const named = rule("locus.grace", [
      { kind: "rollMode", target: "char:ag", mode: "keepBest", rolls: 2, label: "Локус Грации" }
    ]);
    expect(rerollsFromRules([named], { kind: "skill", char: "ag" })[0].label).toBe("Локус Грации");
  });
});

describe("resolveTest отдаёт перебросы рядом с модификаторами", () => {
  it("не ломая прежний договор {ctx, rules, mods}", () => {
    registerRuleSource("test", () => [grace, rule("plus", [
      { kind: "rollBonus", target: "char:ag", value: 10 }
    ])]);
    const out = resolveTest({ actor: { system: {}, items: [] }, kind: "skill", char: "ag" });
    expect(out.mods).toHaveLength(1);
    expect(out.rerolls).toEqual([
      { ruleId: "locus.grace", label: "locus.grace", mode: "keepBest", rolls: 2, who: "self" }
    ]);
  });

  it("перебросов нет — пустой список, а не отсутствующее поле", () => {
    registerRuleSource("test", () => []);
    expect(resolveTest({ actor: { system: {}, items: [] }, kind: "skill", char: "ag" }).rerolls)
      .toEqual([]);
  });
});
