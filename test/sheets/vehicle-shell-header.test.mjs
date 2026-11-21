// test/sheets/vehicle-shell-header.test.mjs
//
// task-8ff8: шапка окна «Стрельба» техники показывала урон/пробитие орудия,
// а не заряженного снаряда (выстрел при этом считался верно).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";

const { vehicleShellHeader } = await import("../../module/sheets/vehicle-sheet.mjs");

const mortar = { damage: "", penetration: 0, range: 300 };

describe("vehicleShellHeader", () => {
  it("снаряд со своими Dmg/Pen заменяет базу орудия", () => {
    const he = { name: "HE Shell", system: { damageOverride: "2d10+4", penetrationOverride: 2 } };
    expect(vehicleShellHeader(mortar, he)).toMatchObject({ damage: "2d10+4", penetration: 2, range: 300, shellName: "HE Shell" });
  });
  it("дальность снаряда заменяет дальность орудия", () => {
    const sh = { name: "S", system: { rangeOverride: 150 } };
    expect(vehicleShellHeader(mortar, sh).range).toBe(150);
  });
  it("без снаряда — база орудия", () => {
    expect(vehicleShellHeader({ damage: "3d10", penetration: 5, range: 100 }, null))
      .toEqual({ damage: "3d10", penetration: 5, range: 100, shellName: "" });
  });
});
