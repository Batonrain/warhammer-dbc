// Состояние «Спит», Чуткий Сон и Сон Разума (остаток Талантов, 20.11.2026).
import { describe, it, expect } from "vitest";
import { CONDITION_RULES } from "../../module/rules/library/conditions.mjs";
import { sleepDropTriggered, dreamingKeepId } from "../../module/combat/psychic-sustain.mjs";
import { CONDITIONS_DEF } from "../../module/constants/conditions.mjs";

describe("Спит", () => {
  it("есть в реестре Состояний", () => expect(CONDITIONS_DEF.asleep?.label).toBe("Спит"));
  it("штраф к тестам от P, Чуткий Сон гасит", () => {
    const r = CONDITION_RULES.find(x => x.id === "conditions.asleep");
    expect(r.when.hasCondition).toBe("asleep");
    expect(r.when.lacksTrait).toContain("Light Sleeper");
    expect(r.effects[0]).toMatchObject({ kind: "rollBonus", target: "basedon:per", value: -30 });
  });
  it("обрыв поддержания — на Спит, Без сознания и Кому", () => {
    expect(sleepDropTriggered({ system: { conditions: { asleep: true } } })).toBe(true);
    expect(sleepDropTriggered({ system: { conditions: { unconscious: true } } })).toBe(true);
    expect(sleepDropTriggered({ system: { conditions: { asleep: false } } })).toBe(false);
    expect(sleepDropTriggered({ system: { wounds: { value: 3 } } })).toBe(false);
  });
  it("Сон Разума держит выбранную силу только при Таланте", () => {
    const flags = { "warhammer-dbc": { dreamingOfMindPower: "p1" } };
    expect(dreamingKeepId({ items: [{ type: "talent", name: "Dreaming of Mind / Сон Разума" }], flags })).toBe("p1");
    expect(dreamingKeepId({ items: [], flags })).toBeNull();
  });
});
