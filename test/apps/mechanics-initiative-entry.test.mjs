// test/apps/mechanics-initiative-entry.test.mjs
//
// Инициатива как псевдо-характеристика Конструктора (wdbc-v9a7):
// kind:"characteristic" c charKey:"initiative" целится в system.initiative
// напрямую (не через bonusFx/totalFx — у Инициативы нет Бонуса/Итога).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { characteristicEffectKey, describeMechEntry, blankMechEntry } from "../../module/apps/mechanics.mjs";

describe("characteristicEffectKey: charKey:initiative", () => {
  it("целится в system.initiative напрямую, игнорируя entry.field", () => {
    expect(characteristicEffectKey({ charKey: "initiative", field: "total" })).toBe("system.initiative");
    expect(characteristicEffectKey({ charKey: "initiative", field: "bonus" })).toBe("system.initiative");
  });

  it("обычная характеристика по-прежнему целится в bonusFx/totalFx", () => {
    expect(characteristicEffectKey({ charKey: "ws", field: "total" })).toBe("system.characteristics.ws.totalFx");
    expect(characteristicEffectKey({ charKey: "ws", field: "bonus" })).toBe("system.characteristics.ws.bonusFx");
  });
});

describe("describeMechEntry: запись Инициативы", () => {
  it("показывает «Инициатива: ± N», а не абревиатуру несуществующей характеристики", () => {
    const entry = { ...blankMechEntry("characteristic"), charKey: "initiative", op: "subtract", value: 2 };
    expect(describeMechEntry(entry)).toBe("Инициатива: − 2");
  });
});
