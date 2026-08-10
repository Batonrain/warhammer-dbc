import { describe, it, expect } from "vitest";
import { parseRequirement } from "../module/constants/talent-requirements.mjs";

describe("parseRequirement", () => {
  it("«Нет» не даёт требований", () => {
    expect(parseRequirement("Нет")).toEqual([]);
  });

  it("«A 60 и WS 50» — два обязательных требования", () => {
    const parts = parseRequirement("A 60 и WS 50");
    expect(parts).toHaveLength(2);
    expect(parts[0].alts[0]).toMatchObject({ kind: "char", key: "ag", value: 60 });
    expect(parts[1].alts[0]).toMatchObject({ kind: "char", key: "ws", value: 50 });
  });

  it("«X или Y» — один пункт с двумя вариантами", () => {
    const [part] = parseRequirement("Frenzy или Quick Draw");
    expect(part.alts).toHaveLength(2);
  });

  it("кириллическая «А» читается как латинская", () => {
    const [part] = parseRequirement("А 35");
    expect(part.alts[0]).toMatchObject({ kind: "char", key: "ag", value: 35 });
  });

  it("специализация раскрывается в варианты", () => {
    const [part] = parseRequirement("Forbidden Lore (Warp или Xenos) +20");
    expect(part.alts.map(a => a.specialty)).toEqual(["Warp", "Xenos"]);
  });
});
