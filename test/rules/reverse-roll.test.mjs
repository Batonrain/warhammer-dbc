// test/rules/reverse-roll.test.mjs
//
// «Обратить цифры» броска d100 (Ветеран Долгой Войны и др., элитные архетипы):
// 73 → 37. Игрок не держит это в голове — бросок обращается сам, и только
// если так выгоднее (на d100 выгоднее меньшее).

import { describe, it, expect } from "vitest";
import { reverseD100, applyReverse, pickReroll } from "../../module/rules/reroll-pick.mjs";
import { rerollsFromRules } from "../../module/rules/resolve-test.mjs";
import { mergeReroll } from "../../module/rules/test-kind-widget.mjs";

describe("reverseD100", () => {
  it("меняет десятки и единицы местами", () => {
    expect(reverseD100(73)).toBe(37);
    expect(reverseD100(7)).toBe(70);
    expect(reverseD100(55)).toBe(55);
  });
  it("100 обращать нечего; 10 → 01, то есть 1", () => {
    expect(reverseD100(100)).toBe(100);
    expect(reverseD100(10)).toBe(1);
  });
});

describe("applyReverse: обращаем только к выгоде", () => {
  it("73 → 37", () => {
    expect(applyReverse({ value: 73, index: 0, dropped: [] })).toMatchObject({ value: 37, reversed: true, original: 73 });
  });
  it("37 остаётся 37 — обращение дало бы 73", () => {
    const r = applyReverse({ value: 37, index: 0, dropped: [] });
    expect(r.value).toBe(37);
    expect(r.reversed).toBeFalsy();
  });
  it("pickReroll(…, \"reverse\") берёт первый бросок и обращает его", () => {
    expect(pickReroll([91], "reverse")).toMatchObject({ value: 19, reversed: true });
  });
});

describe("rerollsFromRules принимает режим reverse с одним броском", () => {
  it("правило не отбрасывается как «переброс из одного броска»", () => {
    const rules = [{ id: "r", label: "Обращение", effects: [{ kind: "rollMode", mode: "reverse", target: "all" }] }];
    const out = rerollsFromRules(rules, {});
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ mode: "reverse", rolls: 1 });
  });
});

describe("mergeReroll: обращение + Преимущество", () => {
  it("Преимущество выбирает бросок, затем он обращается", () => {
    const m = mergeReroll({ mode: "reverse", rolls: 1, label: "Мудрец" }, "advantage");
    expect(m.reverse).toBe(true);
    expect(m.mode).toBe("keepBest");
    expect(m.label).toContain("Мудрец");
  });
});
