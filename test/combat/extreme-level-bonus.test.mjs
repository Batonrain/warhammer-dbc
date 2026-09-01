// test/combat/extreme-level-bonus.test.mjs
//
// rollExtremeDamage: wp.extremeLevelBonus (wdbc-tejb, Monofilament — «+2
// Экстремальный урон ИЛИ Крит. эффект», в этом движке extremeLevel сразу и
// то, и другое, поэтому один флаг закрывает оба варианта книги).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { rollExtremeDamage } from "../../module/combat/attack.mjs";

/** Бросок урона с одним активным кубом ≥ порога — гарантированно Экстремальный. */
function extremeDmgRoll(threshold = 10) {
  return { terms: [{ faces: 10, results: [{ active: true, result: threshold }] }] };
}

const wp = (extremeLevelBonus = 0) => ({ extremeThreshold: 10, extremeLevelBonus });

beforeEach(resetCaptured);

describe("rollExtremeDamage: extremeLevelBonus", () => {
  it("без бонуса — extremeLevel равен броску 1d5 как есть", async () => {
    captured.dice = [4];
    const { extremeLevel } = await rollExtremeDamage(extremeDmgRoll(), {
      wp: wp(0), damageType: "rending"
    });
    expect(extremeLevel).toBe(4);
  });

  it("Monofilament (+2): extremeLevel = бросок + 2", async () => {
    captured.dice = [4];
    const { extremeLevel } = await rollExtremeDamage(extremeDmgRoll(), {
      wp: wp(2), damageType: "rending"
    });
    expect(extremeLevel).toBe(6);
  });

  it("бонус влияет и на critEffect (getCriticalEffect читает тот же extremeLevel)", async () => {
    captured.dice = [4];
    const withoutBonus = await rollExtremeDamage(extremeDmgRoll(), { wp: wp(0), damageType: "rending", hitLocation: "Торс" });
    captured.dice = [4];
    const withBonus = await rollExtremeDamage(extremeDmgRoll(), { wp: wp(2), damageType: "rending", hitLocation: "Торс" });
    expect(withBonus.critEffect).not.toBe(withoutBonus.critEffect);
  });

  it("нет Экстремального урона (куб ниже порога) — бонус ни на что не влияет", async () => {
    const lowRoll = { terms: [{ faces: 10, results: [{ active: true, result: 5 }] }] };
    const { hasExtreme, extremeLevel } = await rollExtremeDamage(lowRoll, { wp: wp(2), damageType: "rending" });
    expect(hasExtreme).toBe(false);
    expect(extremeLevel).toBe(0);
  });
});
