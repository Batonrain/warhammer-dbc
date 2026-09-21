// test/combat/legacy-opportunist-extreme.test.mjs
//
// Оппортунист/versatile 10-10, Оружие Наследия (wdbc-1rno.35, стр. 427):
// «Оружие бросает на Экстремальный Урон два раза и выбирает больший
// результат.» Синтетический флаг wp.legacyOpportunistDoubleRoll, тем же
// приёмом, что Мучитель/wp.legacyExtremeOnOne
// (test/combat/legacy-tormentor-extreme-on-one.test.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { rollExtremeDamage } from "../../module/combat/attack.mjs";

const rollWithFace = (result, faces = 10) => ({ terms: [{ faces, results: [{ active: true, result }] }] });

beforeEach(resetCaptured);

describe("rollExtremeDamage: wp.legacyOpportunistDoubleRoll (Оппортунист)", () => {
  it("второй бросок больше первого — берётся он", async () => {
    captured.dice = [2, 5]; // первый 1d5=2 (extremeLevel 2), второй 1d5=5 (extremeLevel 5)
    const { hasExtreme, extremeLevel, exRoll } = await rollExtremeDamage(rollWithFace(10), {
      wp: { extremeThreshold: 10, legacyOpportunistDoubleRoll: true }, damageType: "rending"
    });
    expect(hasExtreme).toBe(true);
    expect(extremeLevel).toBe(5);
    expect(exRoll.total).toBe(5);
  });

  it("первый бросок больше второго — остаётся первый", async () => {
    captured.dice = [5, 2];
    const { extremeLevel, exRoll } = await rollExtremeDamage(rollWithFace(10), {
      wp: { extremeThreshold: 10, legacyOpportunistDoubleRoll: true }, damageType: "rending"
    });
    expect(extremeLevel).toBe(5);
    expect(exRoll.total).toBe(5);
  });

  it("флаг выключен — только один бросок, второй не катается", async () => {
    captured.dice = [3];
    const { extremeLevel } = await rollExtremeDamage(rollWithFace(10), {
      wp: { extremeThreshold: 10, legacyOpportunistDoubleRoll: false }, damageType: "rending"
    });
    expect(extremeLevel).toBe(3);
    expect(captured.dice.length).toBe(0);
  });

  it("нет Экстремального Урона — второй бросок не катается вовсе", async () => {
    captured.dice = [];
    const { hasExtreme, extremeLevel } = await rollExtremeDamage(rollWithFace(3), {
      wp: { extremeThreshold: 10, legacyOpportunistDoubleRoll: true }, damageType: "rending"
    });
    expect(hasExtreme).toBe(false);
    expect(extremeLevel).toBe(0);
  });

  it("совместно с Кромсающим (1d10−2 мин.1) — оба броска той же формулой", async () => {
    captured.dice = [3, 9]; // 1d10=3 → max(1,1)=1; 1d10=9 → max(1,7)=7
    const { extremeLevel, exRoll } = await rollExtremeDamage(rollWithFace(10), {
      wp: { extremeThreshold: 10, legacyOpportunistDoubleRoll: true, legacyCleavingRollActive: true }, damageType: "rending"
    });
    expect(extremeLevel).toBe(7);
    expect(exRoll.total).toBe(9);
  });
});
