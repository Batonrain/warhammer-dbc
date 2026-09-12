// test/rules/armour-of-the-gods.test.mjs
//
// Armour of the Gods / Доспехи Богов (wdbc-1rno, Общие Мутации): чистая
// логика идемпотентности («уже Броненосец») и данные предмета-брони
// «Божественные Латы». Спавн предмета Архетипа/роллы/списание —
// module/apps/armour-of-the-gods.mjs, интеграционные тесты там же.

import { describe, it, expect } from "vitest";
import { hasIroncladArchetype, divinePlateArmourData, IRONCLAD_ARCHETYPE_NAME }
  from "../../module/rules/armour-of-the-gods.mjs";

describe("hasIroncladArchetype", () => {
  it("нет ни в основном, ни в дополнительных — false", () => {
    expect(hasIroncladArchetype({ eliteArchetype: "", eliteArchetypesExtra: [] })).toBe(false);
  });

  it("совпадает с основным полем — true", () => {
    expect(hasIroncladArchetype({ eliteArchetype: IRONCLAD_ARCHETYPE_NAME })).toBe(true);
  });

  it("есть в дополнительных — true", () => {
    expect(hasIroncladArchetype({ eliteArchetype: "Другой", eliteArchetypesExtra: [IRONCLAD_ARCHETYPE_NAME] })).toBe(true);
  });

  it("другое имя в основном и дополнительных — false", () => {
    expect(hasIroncladArchetype({ eliteArchetype: "Другой", eliteArchetypesExtra: ["Третий"] })).toBe(false);
  });

  it("пустой/отсутствующий system — не падает, false", () => {
    expect(hasIroncladArchetype(undefined)).toBe(false);
    expect(hasIroncladArchetype({})).toBe(false);
  });
});

describe("divinePlateArmourData", () => {
  it("AP 8/10/8/8 по книге Черты, не складывается, всегда надета", () => {
    const data = divinePlateArmourData();
    expect(data.type).toBe("armor");
    expect(data.system).toMatchObject({
      head: 8, body: 10, leftArm: 8, rightArm: 8, leftLeg: 8, rightLeg: 8,
      stacks: false, equipped: true
    });
  });
});
