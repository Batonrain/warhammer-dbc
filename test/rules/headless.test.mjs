// test/rules/headless.test.mjs — Безголовый (wdbc-1rno.20).
import { describe, it, expect } from "vitest";
import { isHeadless, headlessSightAngle, redirectHitLocationForHeadless } from "../../module/rules/headless.mjs";

const headless = { items: [{ type: "mutation", name: "Headless / Безголовый", system: {} }] };
const plain = { items: [] };

describe("Безголовый", () => {
  it("опознаётся по мутации", () => {
    expect(isHeadless(headless)).toBe(true);
    expect(isHeadless(plain)).toBe(false);
  });

  it("голова и глаз — в торс; суставы/шея и прочее — без изменений", () => {
    expect(redirectHitLocationForHeadless("Голова", headless)).toBe("Торс");
    expect(redirectHitLocationForHeadless("Глаз (Голова)", headless)).toBe("Торс");
    expect(redirectHitLocationForHeadless("Сочленение / Шея", headless)).toBe("Сочленение / Шея");
    expect(redirectHitLocationForHeadless("Рука", headless)).toBe("Рука");
    expect(redirectHitLocationForHeadless("Голова", plain)).toBe("Голова");
  });

  it("обзор не шире 120°, более узкий остаётся", () => {
    expect(headlessSightAngle(headless, 210)).toBe(120);
    expect(headlessSightAngle(headless, 90)).toBe(90);
    expect(headlessSightAngle(plain, 210)).toBe(210);
  });
});
