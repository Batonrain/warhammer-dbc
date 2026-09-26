import { describe, it, expect } from "vitest";
import { possessionStep, possessionBarredRemaining, possessionInRange, POSSESSION_BAR_SECONDS }
  from "../../module/rules/possession-attack.mjs";

const side = (success, deg, threshold = 40, unnatural = false) => ({ success, deg, threshold, unnatural });

describe("possessionStep — расширенный тест W vs W (wdbc-q267)", () => {
  it("копит чистые Успехи атакующего и вселяет на +5", () => {
    let r = possessionStep(0, side(true, 3), side(false, 1));
    expect(r.tally).toBe(4);
    expect(r.outcome).toBe("continue");
    r = possessionStep(r.tally, side(true, 1), side(true, 1, 30));
    expect(r.outcome).toBe("possessed");
  });

  it("жертва отбивается на −5", () => {
    const r = possessionStep(-2, side(false, 2), side(true, 1));
    expect(r.tally).toBe(-5);
    expect(r.outcome).toBe("repelled");
  });

  it("Unnatural W атакующего не спасает его «ничьей» при проигрыше", () => {
    const r = possessionStep(0, side(false, 1, 40, true), side(true, 2, 40, false));
    expect(r.delta).toBeLessThan(0);
  });

  it("Unnatural W жертвы по-прежнему даёт ей «ничью» по общему правилу", () => {
    const r = possessionStep(0, side(true, 2, 30), side(false, 1, 50, true));
    // ничья решается Пределом — у жертвы выше, она берёт 1
    expect(r.delta).toBe(-1);
  });
});

describe("запрет 24 ч и дистанция", () => {
  it("считает остаток запрета только для отбившей цели", () => {
    const barred = { "Actor.v": 1000 };
    expect(possessionBarredRemaining(barred, "Actor.v", 1000 + 3600)).toBe(POSSESSION_BAR_SECONDS - 3600);
    expect(possessionBarredRemaining(barred, "Actor.v", 1000 + POSSESSION_BAR_SECONDS)).toBe(0);
    expect(possessionBarredRemaining(barred, "Actor.x", 0)).toBe(0);
  });
  it("не далее W.b метров; без токенов не мешает", () => {
    expect(possessionInRange(5, 5)).toBe(true);
    expect(possessionInRange(5, 6)).toBe(false);
    expect(possessionInRange(5, null)).toBe(true);
  });
});
