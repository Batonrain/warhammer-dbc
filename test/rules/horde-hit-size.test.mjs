// test/rules/horde-hit-size.test.mjs
//
// «Орды», Магнитуда: Размер Орды по Магнитуде считается «в расчёте атак по
// орде и тестов Stealth (но не SPD)». Попадание по толпе в 60 Магнитуды — как
// по Размеру 4, каким бы ростом ни были её члены; Борьба/Повалить и прочее,
// что меряет рост существ, по-прежнему читают sizeOf.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { hitSizeOf, sizeOf } from "../../module/rules/predicates.mjs";

const horde = (value, sizeMod = 0) => ({ type: "horde", system: { magnitude: { value, start: value }, sizeMod } });

describe("hitSizeOf", () => {
  it("Орда — Размер по таблице Магнитуды", () => {
    expect(hitSizeOf(horde(15))).toBe(2);
    expect(hitSizeOf(horde(45))).toBe(3);
    expect(hitSizeOf(horde(60))).toBe(4);
    expect(hitSizeOf(horde(130))).toBe(6);
  });

  it("собственный рост существ Орды на попадание не влияет, но остаётся в sizeOf", () => {
    expect(hitSizeOf(horde(60, -1))).toBe(4);
    expect(sizeOf(horde(60, -1))).toBe(-1);
  });

  it("не-Орда — обычный Размер", () => {
    expect(hitSizeOf({ type: "character", system: { sizeTotal: 1 } })).toBe(1);
  });
});
