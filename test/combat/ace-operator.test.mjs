// Ас Оператор и Танковый Командир (остаток Талантов, 20.11.2026).
import { describe, it, expect } from "vitest";
import { aceOperatorLeft, aceOperatorButtonHtml, commandedVehicle, crewInitiatives } from "../../module/combat/ace-operator.mjs";

describe("Ас Оператор", () => {
  it("Провалов меньше на A.b, не ниже нуля", () => {
    expect(aceOperatorLeft(5, 3)).toBe(2);
    expect(aceOperatorLeft(2, 4)).toBe(0);
  });
  it("кнопка только у водителя с Талантом и на провале", () => {
    const d = { uuid: "A.d", items: [{ type: "talent", name: "Ace Operator / Ас Оператор" }], system: { characteristics: { ag: { bonus: 4 } } } };
    const v = { uuid: "A.v" };
    expect(aceOperatorButtonHtml(d, v, { kind: "swerve", failures: 2 })).toMatch(/wh-ace-operator-btn/);
    expect(aceOperatorButtonHtml(d, v, { kind: "swerve", failures: 0 })).toBe("");
    expect(aceOperatorButtonHtml({ ...d, items: [] }, v, { kind: "swerve", failures: 2 })).toBe("");
  });
});

describe("Танковый Командир", () => {
  it("машина, где актор — командир", () => {
    const v = { type: "vehicle", system: { stations: [{ role: "Commander", uuid: "A.c" }, { role: "driver", uuid: "A.d" }] } };
    expect(commandedVehicle({ uuid: "A.c" }, [v])).toBe(v);
    expect(commandedVehicle({ uuid: "A.d" }, [v])).toBeNull();
  });
  it("экипаж сразу после командира", () => {
    expect(crewInitiatives(15, ["x", "y"])).toEqual([{ id: "x", value: 14.99 }, { id: "y", value: 14.98 }]);
  });
});
