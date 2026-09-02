// test/apps/mechanics-size-entry.test.mjs
//
// wdbc-w8ws: Размер как псевдо-характеристика Конструктора, тем же приёмом,
// что Инициатива (mechanics-initiative-entry.test.mjs). Два charKey:
// "size" → system.sizeMod (двигает SPD, как обычная Черта Размера);
// "sizeNoSpd" → system.sizeModNoSpd (Absurdly Fat: Размер, НЕ двигающий SPD).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { characteristicEffectKey, describeMechEntry, blankMechEntry } from "../../module/apps/mechanics.mjs";

describe("characteristicEffectKey: charKey:size / sizeNoSpd", () => {
  it("size целится в system.sizeMod напрямую, игнорируя entry.field", () => {
    expect(characteristicEffectKey({ charKey: "size", field: "total" })).toBe("system.sizeMod");
    expect(characteristicEffectKey({ charKey: "size", field: "bonus" })).toBe("system.sizeMod");
  });

  it("sizeNoSpd целится в отдельный system.sizeModNoSpd", () => {
    expect(characteristicEffectKey({ charKey: "sizeNoSpd", field: "total" })).toBe("system.sizeModNoSpd");
  });
});

describe("describeMechEntry: запись Размера", () => {
  it("size показывает «Размер: ± N»", () => {
    const entry = { ...blankMechEntry("characteristic"), charKey: "size", op: "add", value: 1 };
    expect(describeMechEntry(entry)).toBe("Размер: + 1");
  });

  it("sizeNoSpd помечает «без влияния на SPD»", () => {
    const entry = { ...blankMechEntry("characteristic"), charKey: "sizeNoSpd", op: "add", value: 1 };
    expect(describeMechEntry(entry)).toBe("Размер: + 1 (без влияния на SPD)");
  });
});
