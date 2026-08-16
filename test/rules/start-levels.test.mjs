// test/rules/start-levels.test.mjs
//
// Уровень стартовой игры (стр. 23): строка таблицы даёт стартовый опыт и
// бонусы к Влиянию и Порче. У Десантника опыт меньше — он дороже качается.
// «Inf и Cor стартового персонажа не могут превышать 60» — потолок из книги,
// и он же режет ручную добавку.

import { describe, it, expect } from "vitest";
import { START_LEVELS, START_CAP, startLevelValues } from "../../module/constants/start-levels.mjs";

describe("таблица Уровней старта", () => {
  it("восемь строк, как в книге", () => {
    expect(START_LEVELS).toHaveLength(8);
    expect(START_LEVELS[0]).toMatchObject({ astartes: 3000, mortal: 3750, infamy: 0, corruption: 0 });
    expect(START_LEVELS.at(-1)).toMatchObject({ astartes: 30000, mortal: 37500, infamy: 60, corruption: 60 });
  });

  it("опыт Десантника всюду ниже опыта прочих", () => {
    for (const l of START_LEVELS) expect(l.astartes).toBeLessThan(l.mortal);
  });
});

describe("startLevelValues", () => {
  it("берёт колонку по тому, Десантник персонаж или нет", () => {
    expect(startLevelValues({ level: "l3", astartes: true }).xp).toBe(9000);
    expect(startLevelValues({ level: "l3", astartes: false }).xp).toBe(11250);
  });

  it("бонусы Влияния и Порчи — из строки", () => {
    expect(startLevelValues({ level: "l4" })).toMatchObject({ infamy: 30, corruption: 36 });
  });

  it("ручная добавка складывается со строкой", () => {
    const out = startLevelValues({ level: "l2", extraXp: 500, extraInf: 5, extraCor: 3 });
    expect(out).toMatchObject({ xp: 8000, infamy: 15, corruption: 15 });
    expect(out.capped).toBe(false);
  });

  it("выше 60 Влияние и Порча не поднимаются, и об этом сообщается", () => {
    const out = startLevelValues({ level: "l7", extraInf: 20, extraCor: 20 });
    expect(out).toMatchObject({ infamy: START_CAP, corruption: START_CAP, capped: true });
  });

  it("отрицательная добавка не уводит опыт в минус", () => {
    expect(startLevelValues({ level: "l1", extraXp: -99999 }).xp).toBe(0);
  });

  it("неизвестный уровень — null, а не догадка", () => {
    expect(startLevelValues({ level: "нет-такого" })).toBeNull();
    expect(startLevelValues()).toBeNull();
  });
});
