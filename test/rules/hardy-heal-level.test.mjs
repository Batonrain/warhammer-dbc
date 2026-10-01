// test/rules/hardy-heal-level.test.mjs
//
// wdbc-y9pfz. Hardy / Крепкий: «В отношении лечения персонаж всегда
// считается легко раненным» — ключ уровня для лечения всегда light, даже при
// критических Ранах; настоящий woundLevel (лист, предикаты, регенерация
// Огрина) не меняется.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { healLevel, regimenHeal, HARDY_CAPABILITY } from "../../module/rules/healing-clock.mjs";
import { woundLevel } from "../../module/rules/wound-tier.mjs";
import { registerRuleSource, clearRuleSources } from "../../module/rules/sources.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const sys = (value, critical = 0) => ({
  wounds: { value, max: 20, critical }, characteristics: { t: { bonus: 4 } }
});
const bearer = { name: "Крепкий", items: [] };
const plain = { name: "Обычный", items: [] };

beforeEach(() => {
  clearRuleSources();
  registerRuleSource("test", a => a === bearer
    ? [{ id: "test.hardy", when: {}, effects: [{ kind: "grantFlag", target: HARDY_CAPABILITY }] }]
    : []);
});

describe("healLevel", () => {
  it("без Hardy — настоящий уровень", () => {
    expect(healLevel(plain, sys(5)).key).toBe("heavy");
    expect(healLevel(plain, sys(0, 3)).key).toBe("critical");
  });
  it("с Hardy тяжёлое и критическое лечатся как лёгкое", () => {
    expect(healLevel(bearer, sys(5)).key).toBe("light");
    const crit = healLevel(bearer, sys(0, 3));
    expect(crit.key).toBe("light");
    expect(crit.crit).toBe(3);
    expect(crit.hardy).toBe(true);
  });
  it("настоящий woundLevel Hardy не замечает", () => {
    expect(woundLevel(sys(0, 3)).key).toBe("critical");
  });
  it("следствие: Постельный режим критического даёт T.b, а не 1 Рану", () => {
    const crit = healLevel(bearer, sys(0, 3));
    expect(regimenHeal("bedRest", crit.key, crit.tb).amount).toBe(4);
    expect(regimenHeal("bedRest", "critical", 4).amount).toBe(1);
  });
});

describe("данные пака", () => {
  it("Талант Hardy выдаёт возможность resilience.core.hardy", () => {
    const hardy = allPackDocuments("talents").map(({ doc }) => doc).find(d => d.name?.startsWith("Hardy"));
    const keys = (hardy.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain(HARDY_CAPABILITY);
  });
});
