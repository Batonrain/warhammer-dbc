import { describe, it, expect } from "vitest";
import { fateSpent, fateSaved, fatePoolLabel, FATE_SAVE_ON } from "../../module/rules/fate-save.mjs";

describe("fateSpent", () => {
  it("считает трату по разнице значений", () => {
    expect(fateSpent(3, 2)).toBe(1);
    expect(fateSpent(3, 0)).toBe(3);
  });

  it("восстановление и рост пула тратой не считаются", () => {
    expect(fateSpent(1, 3)).toBe(0);
    expect(fateSpent(2, 2)).toBe(0);
  });

  it("без прежнего значения бросать нечего", () => {
    expect(fateSpent(undefined, 2)).toBe(0);
    expect(fateSpent(null, 2)).toBe(0);
  });
});

describe("fateSaved", () => {
  it("возвращает Очко за каждую выпавшую грань возврата", () => {
    expect(fateSaved([FATE_SAVE_ON])).toBe(1);
    expect(fateSaved([FATE_SAVE_ON, 7, FATE_SAVE_ON])).toBe(2);
  });

  it("прочие грани ничего не возвращают", () => {
    expect(fateSaved([2, 9, 10])).toBe(0);
    expect(fateSaved([])).toBe(0);
  });
});

describe("fatePoolLabel", () => {
  it("у хаосита пул называется Бесчестьем", () => {
    expect(fatePoolLabel({ system: { alignment: "heretic" } })).toBe("Бесчестья");
  });

  it("у остальных — Судьбой", () => {
    expect(fatePoolLabel({ system: {} })).toBe("Судьбы");
    expect(fatePoolLabel(null)).toBe("Судьбы");
  });
});
