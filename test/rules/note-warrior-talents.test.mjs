// Воин Ноты: Вальс, Крещендо, Финале, Лейтмотив (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  dancerAgValue, waltzContestOptions, crescendoAimedHits, finaleRestore, leitmotifDeg
} from "../../module/rules/note-warrior-talents.mjs";

const warrior = (names = [], dancer = "trained") => ({
  items: names.map(n => ({ type: "talent", name: n })),
  system: { characteristics: { ag: { total: 55 } },
            groupSkills: { trade: dancer ? [{ specKey: "dancer", rank: dancer }] : [] } }
});

describe("Воин Ноты", () => {
  it("Trade(Dancer)(A): без записи — −20", () => {
    expect(dancerAgValue(warrior([], ""))).toBe(35);
    expect(dancerAgValue(warrior([], "trained"))).toBeGreaterThan(35);
  });
  it("Вальс — лишний вариант только у Напролома", () => {
    const w = warrior(["Waltz / Вальс"]);
    const [o] = waltzContestOptions(w, { label: "Напролом" });
    expect(o).toMatchObject({ skillKey: "trade", charKey: "ag", resist: [{ skill: "awareness" }] });
    expect(waltzContestOptions(w, { label: "Финт" })).toEqual([]);
    expect(waltzContestOptions(warrior(), { label: "Напролом" })).toEqual([]);
  });
  it("Крещендо: ½A.b (окр.▲), не меньше 2, только Избирательная Быстрая/Молниеносная", () => {
    const w = warrior(["Crescendo"]);
    expect(crescendoAimedHits(w, { aimed: true, technique: "swift" })).toBe(3);
    expect(crescendoAimedHits(w, { aimed: true, technique: "standard" })).toBe(2);
    expect(crescendoAimedHits(w, { aimed: false, technique: "lightning" })).toBe(2);
    expect(crescendoAimedHits(warrior(), { aimed: true, technique: "swift" })).toBe(2);
  });
  it("Финале: 1 Очко или 1d5, если сломлены все и их не меньше 6", () => {
    expect(finaleRestore(0, 3)).toBe(0);
    expect(finaleRestore(2, 3)).toBe(1);
    expect(finaleRestore(3, 3)).toBe(1);
    expect(finaleRestore(6, 6)).toBe("1d5");
  });
  it("Лейтмотив: Inf 30+, ½Inf.b окр.▲", () => {
    const champ = inf => ({ system: { characteristics: { inf: { total: inf } } } });
    expect(leitmotifDeg(champ(29))).toBe(0);
    expect(leitmotifDeg(champ(30))).toBe(2);
    expect(leitmotifDeg(champ(55))).toBe(3);
  });
});
