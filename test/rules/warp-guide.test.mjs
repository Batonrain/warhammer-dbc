import { describe, it, expect } from "vitest";
import {
  guideKindFor, guideNavPenalty, guideExitPenalty, guideEncounterBonus,
  guideRollsEncounterTwice, guideDecadeUpkeep, guideNeedsLoyaltyCheck
} from "../../module/rules/warp-guide.mjs";

const character = (system = {}, items = []) => ({ type: "character", system, items });
const daemon = () => ({ type: "daemon", system: {}, items: [] });
const demonPrince = () => ({ type: "demonPrince", system: {}, items: [] });

describe("guideKindFor: кто ведёт судно через варп", () => {
  it("нет актора — null", () => {
    expect(guideKindFor(null)).toBeNull();
  });

  it("демон — всегда 'daemon'", () => {
    expect(guideKindFor(daemon())).toBe("daemon");
  });

  it("принц демона — всегда 'demonPrince'", () => {
    expect(guideKindFor(demonPrince())).toBe("demonPrince");
  });

  it("персонаж субрасы navigator — 'navigator'", () => {
    expect(guideKindFor(character({ subrace: "navigator" }))).toBe("navigator");
  });

  it("псайкер-человек (не навигатор) — 'psychoactive'", () => {
    expect(guideKindFor(character({ race: "human", isPsyker: true }))).toBe("psychoactive");
  });

  it("псайкер-астартес — тоже 'psychoactive'", () => {
    expect(guideKindFor(character({ race: "astartes", isPsyker: true }))).toBe("psychoactive");
  });

  it("псайкер, но не человек и не астартес (напр. эльдар) — не годится", () => {
    expect(guideKindFor(character({ race: "asuryani", isPsyker: true }))).toBeNull();
  });

  it("человек без псайкерства и не навигатор — не годится", () => {
    expect(guideKindFor(character({ race: "human" }))).toBeNull();
  });

  it("одержимый (alignment heretic + possessed) без дара Рулевой — 'possessed'", () => {
    expect(guideKindFor(character({ alignment: "heretic", possessed: true }))).toBe("possessed");
  });

  it("одержимый С даром Рулевой (Helmsman) — считается навигатором", () => {
    const a = character({ alignment: "heretic", possessed: true },
      [{ type: "talent", name: "Helmsman / Дар: Рулевой" }]);
    expect(guideKindFor(a)).toBe("navigator");
  });

  it("одержимый через Элитный архетип «Одержимый» (без ручного флага) — тоже 'possessed'", () => {
    expect(guideKindFor(character({ eliteArchetype: "Одержимый" }))).toBe("possessed");
  });
});

describe("модификаторы по виду Проводника", () => {
  it("навигатор — без штрафов и бонусов вовсе", () => {
    expect(guideNavPenalty("navigator")).toBe(0);
    expect(guideExitPenalty("navigator")).toBe(0);
    expect(guideEncounterBonus("navigator")).toBe(0);
    expect(guideRollsEncounterTwice("navigator")).toBe(false);
    expect(guideDecadeUpkeep("navigator")).toEqual({ corruption: 0, fatigue: 0 });
    expect(guideNeedsLoyaltyCheck("navigator")).toBe(false);
  });

  it("психоактивный — −20 навигация, +10 столкновения, 1 Порча + 1 Усталость/10 дней", () => {
    expect(guideNavPenalty("psychoactive")).toBe(-20);
    expect(guideEncounterBonus("psychoactive")).toBe(10);
    expect(guideExitPenalty("psychoactive")).toBe(0);
    expect(guideRollsEncounterTwice("psychoactive")).toBe(false);
    expect(guideDecadeUpkeep("psychoactive")).toEqual({ corruption: 1, fatigue: 1 });
  });

  it("демон — двойной бросок столкновений, доп. −30 к Выходу, нужен тест лояльности", () => {
    expect(guideRollsEncounterTwice("daemon")).toBe(true);
    expect(guideExitPenalty("daemon")).toBe(-30);
    expect(guideEncounterBonus("daemon")).toBe(0);
    expect(guideNeedsLoyaltyCheck("daemon")).toBe(true);
  });

  it("одержимый БЕЗ человеческого соучастия — как демон (двойной бросок, −30 к Выходу)", () => {
    expect(guideRollsEncounterTwice("possessed", false)).toBe(true);
    expect(guideExitPenalty("possessed", false)).toBe(-30);
    expect(guideDecadeUpkeep("possessed", false)).toEqual({ corruption: 0, fatigue: 0 });
  });

  it("одержимый С человеческим соучастием — отменяет двойной бросок и штраф Выхода, но даёт Порчу/10 дней", () => {
    expect(guideRollsEncounterTwice("possessed", true)).toBe(false);
    expect(guideExitPenalty("possessed", true)).toBe(0);
    expect(guideDecadeUpkeep("possessed", true)).toEqual({ corruption: 1, fatigue: 0 });
  });

  it("принц демона — без штрафов/бонусов, как навигатор, но лояльность не проверяется", () => {
    expect(guideNavPenalty("demonPrince")).toBe(0);
    expect(guideExitPenalty("demonPrince")).toBe(0);
    expect(guideEncounterBonus("demonPrince")).toBe(0);
    expect(guideRollsEncounterTwice("demonPrince")).toBe(false);
    expect(guideNeedsLoyaltyCheck("demonPrince")).toBe(false);
  });
});
