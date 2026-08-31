// module/rules/aptitude-overrides.mjs — override friendly/hostile Навык/Талант/
// Характеристика от расы/субрасы (Африэль/Эльданар/Серый Человек, wdbc-zk69).
// Собирается общим движком правил, как и hasRuleFlag (см. test/rules/flags.test.mjs),
// поэтому тестируется тем же приёмом — registerRuleSource с сырым правилом.

import { describe, it, expect, afterEach } from "vitest";
import { resolveAptitudeOverride } from "../../module/rules/aptitude-overrides.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const actor = () => ({ system: {}, items: [] });

const withRule = (effects) => {
  clearRuleSources();
  registerRuleSource("test", () => [{ id: "test.rule", when: {}, effects }]);
};

describe("resolveAptitudeOverride", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("без актора/имени — null", () => {
    expect(resolveAptitudeOverride(null, "skill", "Deceive")).toBeNull();
    expect(resolveAptitudeOverride(actor(), "skill", "")).toBeNull();
  });

  it("нет override у актора — null", () => {
    clearRuleSources();
    expect(resolveAptitudeOverride(actor(), "skill", "Deceive")).toBeNull();
  });

  it("навык — совпадение по подстроке имени (как cultureCat)", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "skill", match: "Deceive", align: "ally" }]);
    expect(resolveAptitudeOverride(actor(), "skill", "Deceive")).toBe("ally");
    // «Hatred (Imperial Fists)» ловится как «Hatred» — тот же приём для override.
    withRule([{ kind: "grantAptitudeOverride", scope: "talent", match: "Hatred", align: "enemy" }]);
    expect(resolveAptitudeOverride(actor(), "talent", "Hatred (Imperial Fists)")).toBe("enemy");
  });

  it("характеристика — совпадение только точным ключом, не подстрокой", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "characteristic", match: "ws", align: "ally" }]);
    expect(resolveAptitudeOverride(actor(), "characteristic", "ws")).toBe("ally");
    expect(resolveAptitudeOverride(actor(), "characteristic", "wsx")).toBeNull();
  });

  it("scope должен совпадать — skill-override не отвечает на запрос talent", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "skill", match: "Deceive", align: "ally" }]);
    expect(resolveAptitudeOverride(actor(), "talent", "Deceive")).toBeNull();
  });

  it("«группа:Имя» — вся группа целиком (Серый Человек: ветка Скорость)", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "talent", match: "группа:Скорость", align: "ally" }]);
    expect(resolveAptitudeOverride(actor(), "talent", "Sprint", "Скорость")).toBe("ally");
    expect(resolveAptitudeOverride(actor(), "talent", "Sprint", "Внимательность")).toBeNull();
  });

  it("«группа:Имя!Искл» — вся группа, кроме перечисленных исключений", () => {
    withRule([{ kind: "grantAptitudeOverride", scope: "talent", match: "группа:Берсерк!cold fury", align: "ally" }]);
    expect(resolveAptitudeOverride(actor(), "talent", "Frenzy", "Берсерк")).toBe("ally");
    expect(resolveAptitudeOverride(actor(), "talent", "Cold Fury", "Берсерк")).toBeNull();
  });

  it("враждебность побеждает дружественность при конфликте разных записей", () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.a", when: {}, effects: [{ kind: "grantAptitudeOverride", scope: "skill", match: "Deceive", align: "ally" }] },
      { id: "test.b", when: {}, effects: [{ kind: "grantAptitudeOverride", scope: "skill", match: "Deceive", align: "enemy" }] }
    ]);
    expect(resolveAptitudeOverride(actor(), "skill", "Deceive")).toBe("enemy");
  });

  it("не прошедшее отбор (`when`) правило override не даёт", () => {
    clearRuleSources();
    registerRuleSource("test", () => [{
      id: "test.gated", when: { hasTrait: "Afriel" },
      effects: [{ kind: "grantAptitudeOverride", scope: "skill", match: "Deceive", align: "ally" }]
    }]);
    expect(resolveAptitudeOverride(actor(), "skill", "Deceive")).toBeNull();
    expect(resolveAptitudeOverride({
      system: {}, items: [{ type: "trait", name: "Afriel" }]
    }, "skill", "Deceive")).toBe("ally");
  });
});
