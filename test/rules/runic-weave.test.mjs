import { describe, it, expect } from "vitest";
import { activeRunicWeaveId, siblingRunicWeaves } from "../../module/rules/runic-weave.mjs";

describe("Рунические Вязи — какая активна", () => {
  it("одна вязь без позиции — активна сама по себе", () => {
    expect(activeRunicWeaveId([{ id: "a", wornPosition: "" }])).toBe("a");
  });

  it("внутренняя перекрывает внешнюю", () => {
    const weaves = [{ id: "outer", wornPosition: "outer" }, { id: "inner", wornPosition: "inner" }];
    expect(activeRunicWeaveId(weaves)).toBe("inner");
  });

  it("порядок в массиве не важен — внутренняя всё равно побеждает", () => {
    const weaves = [{ id: "inner", wornPosition: "inner" }, { id: "outer", wornPosition: "outer" }];
    expect(activeRunicWeaveId(weaves)).toBe("inner");
  });

  it("обе снаружи (не задано) — побеждает первая по порядку", () => {
    const weaves = [{ id: "first", wornPosition: "outer" }, { id: "second", wornPosition: "" }];
    expect(activeRunicWeaveId(weaves)).toBe("first");
  });

  it("пустой список — нет активной", () => {
    expect(activeRunicWeaveId([])).toBeNull();
    expect(activeRunicWeaveId(undefined)).toBeNull();
  });
});

describe("siblingRunicWeaves", () => {
  const weave = (id, installedOn) => ({ id, type: "gear", system: { gearCategory: "runicWeave", installedOn } });

  it("без installedOn — вязь одна сама с собой", () => {
    const w = weave("a", "");
    expect(siblingRunicWeaves([w], w)).toEqual([w]);
  });

  it("находит все вязи на том же предмете, включая себя", () => {
    const a = weave("a", "armor1");
    const b = weave("b", "armor1");
    const other = weave("c", "armor2");
    const gearItem = { id: "d", type: "gear", system: { gearCategory: "misc" } };
    const result = siblingRunicWeaves([a, b, other, gearItem], a);
    expect(result.map(w => w.id).sort()).toEqual(["a", "b"]);
  });
});
