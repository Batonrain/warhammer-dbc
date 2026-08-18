// Вид записи «Возможность» (kind:"capability") — общий способ сказать данными
// «этот источник даёт актору вот такую способность». Под ним живёт бо́льшая
// часть оставшихся Локусов: снятие штрафа, подмена характеристики, авто-успех,
// бонусное действие, база приёма, аура, деление Ужасов, игнор Linger.
//
// Читается общим hasRuleFlag() (module/rules/flags.mjs) — тем же, которым уже
// пользуются Ассистенты, безоружный профиль Астартес и подбор снаряжения.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { hasRuleFlag, ruleFlagLabels } from "../../module/rules/flags.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const SYSTEM = "warhammer-dbc";
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

const item = (name, entries) => ({
  id: name, name,
  flags: { [SYSTEM]: { mechanics: [{ id: "g", operator: "AND", entries }] } }
});
const cap = (over = {}) => ({
  id: "e1", kind: "capability", capabilityKey: "penalty.twoWeapon.off", label: "", ...over
});

describe("запись «Возможность»", () => {
  it("превращается в правило с эффектом grantFlag", () => {
    expect(rulesFromItemMechanics([item("Локус Быстроты", [cap()])])).toEqual([{
      id: "item.Локус Быстроты.e1",
      label: "Локус Быстроты",
      when: {},
      effects: [{ kind: "grantFlag", target: "penalty.twoWeapon.off" }]
    }]);
  });

  it("один источник может дать несколько возможностей", () => {
    const rules = rulesFromItemMechanics([item("Локус Подношения", [
      cap({ id: "a", capabilityKey: "calledShot.notMental" }),
      cap({ id: "b", capabilityKey: "penalty.calledShot.head.reduce20" })
    ])]);
    expect(rules.map(r => r.effects[0].target))
      .toEqual(["calledShot.notMental", "penalty.calledShot.head.reduce20"]);
  });

  it("без имени возможности запись отбрасывается с жалобой", () => {
    expect(rulesFromItemMechanics([item("И", [cap({ capabilityKey: "" })])])).toEqual([]);
    expect(errors).toHaveBeenCalled();
  });
});

describe("возможность доходит до hasRuleFlag", () => {
  const actor = { system: {}, items: [item("Локус Быстроты", [cap()])] };

  beforeEach(() => {
    registerRuleSource("items", a => rulesFromItemMechanics(a?.items ?? []));
  });

  it("спрашивается по имени", () => {
    expect(hasRuleFlag(actor, "penalty.twoWeapon.off")).toBe(true);
    expect(hasRuleFlag(actor, "нет.такой")).toBe(false);
  });

  it("подпись правила видна интерфейсу — игрок должен знать, ЧТО сняло штраф", () => {
    expect(ruleFlagLabels(actor, "penalty.twoWeapon.off")).toEqual(["Локус Быстроты"]);
  });
});

describe("новые области: щиты и встречные тесты", () => {
  const reroll = (scope) => item("Локус", [{
    id: "e", kind: "reroll", rerollScope: scope, rerollMode: "keepBest"
  }]);

  it("область «щит» собирается", () => {
    expect(rulesFromItemMechanics([reroll("shield")])[0].effects[0].target).toBe("shield");
  });

  it("область «встречный тест» собирается", () => {
    expect(rulesFromItemMechanics([reroll("opposed")])[0].effects[0].target).toBe("opposed");
  });
});

describe("переброс, навязанный ЦЕЛИ", () => {
  it("помечается в правиле, иначе демон перебрасывал бы свой бросок", () => {
    const rules = rulesFromItemMechanics([item("Локус Кровопролития", [{
      id: "e", kind: "reroll", rerollScope: "opposed", rerollMode: "keepWorst",
      rerollWho: "target"
    }])]);
    expect(rules[0].effects[0]).toMatchObject({
      kind: "rollMode", target: "opposed", mode: "keepWorst", who: "target"
    });
  });

  it("по умолчанию переброс свой", () => {
    const rules = rulesFromItemMechanics([item("Локус Грации", [{
      id: "e", kind: "reroll", rerollScope: "char", rerollChar: "ag"
    }])]);
    expect(rules[0].effects[0].who).toBe("self");
  });
});
