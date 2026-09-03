// test/rules/corruption-threshold.test.mjs
//
// Ближайший Порог Мутации (wdbc-2l2x) — панель ПОРЧА должна сама показывать,
// на каком значении Cor персонаж бросит следующую мутацию/дар, без ручной
// сверки с книгой (корбук стр. 440-441).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { nextMutationThreshold } from "../../module/rules/character.mjs";

describe("nextMutationThreshold", () => {
  it("человек: первый порог — 10", () => {
    expect(nextMutationThreshold({ race: "human", corruption: { value: 0 } })).toBe(10);
  });

  it("человек: между порогами возвращает следующий непройденный", () => {
    expect(nextMutationThreshold({ race: "human", corruption: { value: 15 } })).toBe(20);
    expect(nextMutationThreshold({ race: "human", corruption: { value: 20 } })).toBe(40);
  });

  it("человек: ровно на последнем пороге (80) — дальше их нет", () => {
    expect(nextMutationThreshold({ race: "human", corruption: { value: 80 } })).toBeNull();
    expect(nextMutationThreshold({ race: "human", corruption: { value: 99 } })).toBeNull();
  });

  it("хаосит-астартес: своя таблица без пятого порога", () => {
    expect(nextMutationThreshold({ race: "astartes", alignment: "heretic", corruption: { value: 0 } })).toBe(10);
    expect(nextMutationThreshold({ race: "astartes", alignment: "heretic", corruption: { value: 30 } })).toBe(60);
    expect(nextMutationThreshold({ race: "astartes", alignment: "heretic", corruption: { value: 90 } })).toBeNull();
  });

  it("лоялист-астартес: игнорирует первые 2 порога, тестирует только с Cor 60", () => {
    expect(nextMutationThreshold({ race: "astartes", alignment: "loyalist", corruption: { value: 0 } })).toBe(60);
    expect(nextMutationThreshold({ race: "astartes", alignment: "loyalist", corruption: { value: 10 } })).toBe(60);
    expect(nextMutationThreshold({ race: "astartes", alignment: "loyalist", corruption: { value: 60 } })).toBe(90);
    expect(nextMutationThreshold({ race: "astartes", alignment: "loyalist", corruption: { value: 90 } })).toBeNull();
  });

  it("нет корректного system.corruption — не падает, считает Cor 0", () => {
    expect(nextMutationThreshold({ race: "human" })).toBe(10);
    expect(nextMutationThreshold({})).toBe(10);
  });
});
