import { describe, it, expect } from "vitest";
import { fateBonusOutcome, FATE_BONUS } from "../../module/rules/fate-bonus.mjs";

describe("fateBonusOutcome", () => {
  it("поднимает порог, а выпавшее на кубе оставляет как есть", () => {
    const out = fateBonusOutcome({ rv: 48, threshold: 45 });
    expect(out.base).toBe(45);
    expect(out.threshold).toBe(45 + FATE_BONUS);
    expect(out.rv).toBe(48);          // куб не перебрасывается и не сдвигается
    expect(out.success).toBe(true);
  });

  it("на низком броске добавляет Степень Успеха", () => {
    const before = { rv: 5, threshold: 40 };
    const plain  = Math.floor((before.threshold - before.rv) / 10) + 1;   // 4 степени
    const out    = fateBonusOutcome(before);
    expect(out.degrees).toBe(plain + 1);
    expect(out.success).toBe(true);
  });

  it("превращает провал в успех, когда броска не хватало ровно на надбавку", () => {
    expect(fateBonusOutcome({ rv: 52, threshold: 45 }).success).toBe(true);
    expect(fateBonusOutcome({ rv: 56, threshold: 45 }).success).toBe(false);
  });

  it("провал считает степенями от нового порога", () => {
    const out = fateBonusOutcome({ rv: 80, threshold: 45 });
    expect(out.success).toBe(false);
    expect(out.degrees).toBe(Math.floor((80 - 55) / 10) + 1);
  });

  it("надбавку можно задать другую", () => {
    expect(fateBonusOutcome({ rv: 60, threshold: 40, bonus: 20 }).threshold).toBe(60);
    expect(fateBonusOutcome({ rv: 60, threshold: 40, bonus: 20 }).success).toBe(true);
  });

  it("без разобранного порога или броска надбавку применять не к чему", () => {
    expect(fateBonusOutcome({ rv: 50, threshold: null })).toBeNull();
    expect(fateBonusOutcome({ rv: NaN, threshold: 50 })).toBeNull();
    expect(fateBonusOutcome()).toBeNull();
  });
});
