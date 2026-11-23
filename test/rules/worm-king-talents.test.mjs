// Король Червей: Таланты поверх Повелителя Червей (21.11.2026).
import { describe, it, expect } from "vitest";
import {
  isReleasedSwarm, isMaggotMarked, shellGuardTemplateOk, wormwalkerTake, wormwalkerStats, handOfPlentyPeople
} from "../../module/rules/worm-king-talents.mjs";

const withFlags = f => ({ flags: { "warhammer-dbc": f } });

describe("Король Червей", () => {
  it("отпущенный Рой и Метка Опарыша читаются с меток", () => {
    expect(isReleasedSwarm(withFlags({ wormReleased: true }))).toBe(true);
    expect(isReleasedSwarm(withFlags({}))).toBe(false);
    expect(isMaggotMarked(withFlags({ maggotMarkOf: "Actor.k" }), "Actor.k")).toBe(true);
    expect(isMaggotMarked(withFlags({ maggotMarkOf: "Actor.k" }), "Actor.x")).toBe(false);
  });
  it("Стражи Панциря: не больше трёх шаблонов, старый шаблон — всегда", () => {
    const king = withFlags({ shellGuardTemplates: ["a", "b", "c"] });
    expect(shellGuardTemplateOk(king, "a")).toBe(true);
    expect(shellGuardTemplateOk(king, "d")).toBe(false);
    expect(shellGuardTemplateOk(withFlags({ shellGuardTemplates: ["a"] }), "d")).toBe(true);
  });
  it("Червеход: 5 Ран за труп, Рой не уходит в ноль", () => {
    expect(wormwalkerTake(20, 2)).toEqual({ count: 2, woundsLost: 10 });
    expect(wormwalkerTake(11, 5)).toEqual({ count: 2, woundsLost: 10 });
    expect(wormwalkerTake(5, 3)).toEqual({ count: 0, woundsLost: 0 });
    expect(wormwalkerStats(4)).toEqual({ charPenalty: -20, wounds: 16 });
  });
  it("Рука Изобилия: Cor.b × 100", () => {
    expect(handOfPlentyPeople(4)).toBe(400);
  });
});
