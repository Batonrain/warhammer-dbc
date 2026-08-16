// test/apps/rig-slots.test.mjs
//
// Слоты разгрузки с заменами. У Ремня каждую кобуру «можно заменить ножнами под
// нож/меч/длинный меч или неудобной петлёй под одноручное» — от замены меняется
// размер слота и удобство, поэтому вариант выбирается в окне Разгрузки, а
// выбор лежит на самом предмете (переставили Ремень другому — замены с ним).

import { describe, it, expect } from "vitest";
import { expandSlots, slotVariants, fits, RIG_VARIANT_FLAG } from "../../module/constants/rig.mjs";

/** Предмет-разгрузка без Foundry: expandSlots читает только id, system и flags. */
const rigItem = (slots, chosen = {}) => ({
  id: "belt1",
  system: { isRig: true, rig: { comfort: "normal", backSlot: false, slots, magLocks: [] } },
  flags: { "warhammer-dbc": { [RIG_VARIANT_FLAG]: chosen } }
});

const HOLSTERS = {
  size: "2x1", count: 2, note: "кобуры под пистолет",
  variants: [
    { key: "sheath", label: "ножны", size: "4x1" },
    { key: "loop",   label: "петля", size: "4x1", awkward: true }
  ]
};

describe("варианты слота", () => {
  it("первый вариант — сам слот, как он описан", () => {
    const [base] = slotVariants(HOLSTERS);
    expect(base).toMatchObject({ key: "", size: "2x1", awkward: false });
  });

  it("слот без замен вариантов не предлагает", () => {
    const [slot] = expandSlots(rigItem([{ size: "1x1", count: 1, note: "карман" }]));
    expect(slot.variants).toEqual([]);
    expect(slot.size).toBe("1x1");
  });

  it("по умолчанию слот в исходном виде", () => {
    const slots = expandSlots(rigItem([HOLSTERS]));
    expect(slots).toHaveLength(2);
    expect(slots[0].size).toBe("2x1");
    expect(slots[0].awkward).toBe(false);
    expect(slots[0].variants.map(v => v.key)).toEqual(["", "sheath", "loop"]);
  });

  it("выбранный вариант меняет размер слота — и только у своего слота", () => {
    const [first, second] = expandSlots(rigItem([HOLSTERS], { "belt1:s:0:1": "sheath" }));
    expect(first.size).toBe("2x1");     // первая кобура осталась кобурой
    expect(second.size).toBe("4x1");    // вторая стала ножнами
    expect(second.variants.find(v => v.selected).key).toBe("sheath");
  });

  it("петля неудобна, ножны — нет", () => {
    const loop = expandSlots(rigItem([HOLSTERS], { "belt1:s:0:0": "loop" }))[0];
    expect(loop.awkward).toBe(true);
    const sheath = expandSlots(rigItem([HOLSTERS], { "belt1:s:0:0": "sheath" }))[0];
    expect(sheath.awkward).toBe(false);
  });

  it("после замены на ножны в слот входит меч, а в кобуру — нет", () => {
    const sword = "4x1";                                   // рукопашное оружие
    const holster = expandSlots(rigItem([HOLSTERS]))[0];
    const sheath  = expandSlots(rigItem([HOLSTERS], { "belt1:s:0:0": "sheath" }))[0];
    expect(fits(sword, holster.size)).toBe(false);
    expect(fits(sword, sheath.size)).toBe(true);
  });

  it("неизвестный вариант в флаге откатывает слот к исходному", () => {
    const [slot] = expandSlots(rigItem([HOLSTERS], { "belt1:s:0:0": "нет-такого" }));
    expect(slot.size).toBe("2x1");
  });
});
