// test/rules/rules-cache.test.mjs
//
// Кэш сборки правил на время одного пересчёта (wdbc-uvap).
//
// Проблема: hasRuleFlag() собирает ВСЕ правила актора заново на каждый вопрос,
// а пересчёт листа задаёт их несколько. Замер до правки (tools/bench-sheet.mjs,
// актор на 120 предметов): источник «items» — то есть полный обход всех
// предметов и всех записей Конструктора каждого — отрабатывал ШЕСТЬ раз за один
// prepareDerivedData.
//
// Кэш живёт только внутри withRulesCache(fn) и умирает вместе с ней: за время
// синхронного пересчёта актор измениться не может, поэтому устареть кэшу негде.
// Долгоживущего кэша с инвалидацией по хукам здесь намеренно НЕТ — он ловил бы
// правки актора, о которых сборка правил не знает (чужой Дредноут, мировое
// время Зависимости), и молча отдавал бы вчерашний ответ.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { collectRules, gatherRules, withRulesCache } from "../../module/rules/collect.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { hasRuleFlag, ruleFlags } from "../../module/rules/flags.mjs";

const DEFAULT_SOURCES = getRuleSources();

const restore = () => {
  clearRuleSources();
  for (const [k, fn] of DEFAULT_SOURCES) registerRuleSource(k, fn);
};

const actor = () => ({ system: { characteristics: {} }, items: [] });

let calls;

beforeEach(() => {
  calls = 0;
  clearRuleSources();
  registerRuleSource("bench", () => {
    calls++;
    return [{ id: "bench.rule", label: "Замер", when: {},
              effects: [{ kind: "grantFlag", target: "bench.flag" }] }];
  });
});

afterEach(restore);

describe("withRulesCache — сбор правил один раз на пересчёт", () => {
  it("без обёртки каждый вопрос собирает правила заново", () => {
    const a = actor();
    hasRuleFlag(a, "bench.flag");
    hasRuleFlag(a, "bench.flag");
    hasRuleFlag(a, "bench.flag");
    expect(calls).toBe(3);
  });

  it("внутри обёртки источник спрашивают один раз, ответ тот же", () => {
    const a = actor();
    const out = withRulesCache(() => {
      const first = hasRuleFlag(a, "bench.flag");
      const second = hasRuleFlag(a, "bench.flag");
      const third = ruleFlags(a).has("bench.flag");
      return [first, second, third];
    });
    expect(out).toEqual([true, true, true]);
    expect(calls).toBe(1);
  });

  it("кэш не переживает обёртку: следующий пересчёт видит новые данные", () => {
    const a = actor();
    withRulesCache(() => hasRuleFlag(a, "bench.flag"));
    expect(calls).toBe(1);
    withRulesCache(() => hasRuleFlag(a, "bench.flag"));
    expect(calls).toBe(2);
  });

  it("разные акторы не делят один ответ", () => {
    const a = actor();
    const b = actor();
    withRulesCache(() => { collectRules(a); collectRules(b); });
    expect(calls).toBe(2);
  });

  it("вложенная обёртка не сбрасывает кэш внешней раньше времени", () => {
    const a = actor();
    withRulesCache(() => {
      collectRules(a);
      withRulesCache(() => collectRules(a));
      collectRules(a);
    });
    expect(calls).toBe(1);
  });

  it("непустой контекст не кэшируется: ответ зависит от него", () => {
    const a = actor();
    withRulesCache(() => {
      collectRules(a, { targetActor: {} });
      collectRules(a, { targetActor: {} });
    });
    expect(calls).toBe(2);
  });

  it("обёртка возвращает значение и снимает кэш даже при исключении", () => {
    const a = actor();
    expect(withRulesCache(() => 42)).toBe(42);
    expect(() => withRulesCache(() => { throw new Error("бум"); })).toThrow("бум");
    collectRules(a);
    collectRules(a);
    expect(calls).toBe(2);
  });
});

describe("withRulesCache не подменяет усечённый вложенный ответ полным", () => {
  // Предохранитель от рекурсии (IN_FLIGHT в collect.mjs) выкидывает из сборки
  // источник, который спросил правила сам у себя. Такой ответ ЗАВЕДОМО неполон,
  // и класть его в кэш нельзя. Ловушка не теоретическая: источник «situational»
  // (wdbc-n17t) спрашивает у актора возможность прямо во время своей работы, и
  // ответ на тот вложенный вопрос идёт БЕЗ самого «situational».
  //
  // Опасный порядок — когда снаружи вопрос с контекстом (он не кэшируется и
  // потому не перезапишет кэш собой), а вложенный вопрос пустой:
  it("вложенный ответ не остаётся в кэше вместо полного", () => {
    const a = actor();
    let innerIds = null;
    clearRuleSources();
    registerRuleSource("selfAsking", (act) => {
      innerIds ??= collectRules(act).map(r => r.id);   // вложенный, пустой контекст
      return [{ id: "self.rule", when: {},
                effects: [{ kind: "grantFlag", target: "self.flag" }] }];
    });
    registerRuleSource("other", () => [{ id: "other.rule", when: {}, effects: [] }]);

    const ids = withRulesCache(() => {
      collectRules(a, { targetActor: {} });   // снаружи — с контекстом, мимо кэша
      return collectRules(a).map(r => r.id);  // а вот этот мог бы прийти усечённым
    });

    expect(innerIds).toEqual(["other.rule"]);   // вложенный и правда усечён
    expect(ids).toContain("self.rule");         // а верхний — полон
    expect(ids).toContain("other.rule");
  });
});
