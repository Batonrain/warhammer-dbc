// test/constants/rig-size.test.mjs
//
// wdbc-e2lt: itemSize «0» — предмет, физически не занимающий места в
// Разгрузке (вживлённая модификация брони, интегральная атака). Проверяем
// itemSizeStr/parseSize/hasNoStowageFootprint напрямую, без rigManagerData.

import { describe, it, expect } from "vitest";
import { itemSizeStr, parseSize, hasNoStowageFootprint } from "../../module/constants/rig.mjs";

describe("itemSizeStr — размер 0", () => {
  it("явный system.itemSize «0» возвращается как есть", () => {
    expect(itemSizeStr({ type: "gear", system: { itemSize: "0" } })).toBe("0");
  });

  it("интегральная атака (flags.warhammer-dbc.integralAttack) — «0» даже у melee", () => {
    const fist = { type: "weapon", system: { weaponClass: "melee" },
      flags: { "warhammer-dbc": { integralAttack: true } } };
    expect(itemSizeStr(fist)).toBe("0");
  });

  it("явный system.itemSize важнее флага integralAttack", () => {
    const item = { type: "weapon", system: { weaponClass: "melee", itemSize: "2x1" },
      flags: { "warhammer-dbc": { integralAttack: true } } };
    expect(itemSizeStr(item)).toBe("2x1");
  });

  it("обычное melee-оружие без явного размера — фолбэк 4x1, как раньше", () => {
    expect(itemSizeStr({ type: "weapon", system: { weaponClass: "melee" } })).toBe("4x1");
  });
});

describe("parseSize — «0»", () => {
  it("«0» разбирается как 0x0, а не как 1x1", () => {
    expect(parseSize("0")).toEqual({ w: 0, h: 0 });
  });
  it("обычный размер разбирается как раньше", () => {
    expect(parseSize("4x1")).toEqual({ w: 4, h: 1 });
  });
});

describe("hasNoStowageFootprint", () => {
  it("true для itemSize «0»", () => {
    expect(hasNoStowageFootprint({ type: "gear", system: { itemSize: "0" } })).toBe(true);
  });
  it("false для обычного предмета", () => {
    expect(hasNoStowageFootprint({ type: "gear", system: { itemSize: "1x1" } })).toBe(false);
  });
});
