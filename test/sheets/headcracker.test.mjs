// test/sheets/headcracker.test.mjs
//
// Headcracker / Головолом (Пугилист, стр. 62; Sahara 3-eddb): «Когда он
// совершает безоружный удар головой (не рогами), он уменьшает штраф на
// Избирательные атаки в голову на 20». Скидка к штрафу — в окне атаки
// (aimTargets), та же точка, что у Локуса Подношения.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { isHeadbutt, headcrackerHeadReduction, headCalledShotPenalty } from "../../module/rules/pugilist-talents.mjs";

const HEADCRACKER = { id: "hc", name: "Headcracker / Головолом", type: "talent", system: {} };

function headbutt(name = "Удар головой", grips = "Гол") {
  const w = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки", grips, balance: -1, equipped: true },
    { id: "head", name });
  w.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "integralAttack") ? true : undefined;
  return w;
}

function who(items) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none" });
  a.updates = [];
  a.update = async data => { a.updates.push(data); };
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  return a;
}

beforeEach(() => resetCaptured());

describe("чистые функции", () => {
  it("isHeadbutt: удар головой — да; рога и обычное оружие — нет", () => {
    expect(isHeadbutt(headbutt())).toBe(true);
    expect(isHeadbutt(headbutt("Horns (Natural Weapons) / Рога"))).toBe(false);
    expect(isHeadbutt(weaponFor({ grips: "1р" }))).toBe(false);
  });
  it("скидка 20 только у носителя Таланта", () => {
    const w = headbutt();
    expect(headcrackerHeadReduction(who([HEADCRACKER, w]), w)).toBe(20);
    expect(headcrackerHeadReduction(who([w]), w)).toBe(0);
  });
  it("штраф головы: 0 скидок −20; 20 → 0; 40 (Локус + Головолом) → не выше 0", () => {
    expect([0, 20, 40].map(headCalledShotPenalty)).toEqual([-20, 0, 0]);
  });
});

describe("окно атаки: опция «Голова»", () => {
  it("удар головой с Головоломом: Голова (0)", () => {
    const w = headbutt();
    showAttackDialog(who([HEADCRACKER, w]), w);
    expect(captured.dialog.content).toContain("Голова (0)");
  });
  it("без Таланта: Голова (−20) (регрессия)", () => {
    const w = headbutt();
    showAttackDialog(who([w]), w);
    expect(captured.dialog.content).toContain("Голова (−20)");
  });
  it("кулак (не голова) с Головоломом: штраф прежний", () => {
    const f = headbutt("Кулак", "Кист");
    showAttackDialog(who([HEADCRACKER, f]), f);
    expect(captured.dialog.content).toContain("Голова (−20)");
  });
  it("рога с Головоломом: штраф прежний", () => {
    const horns = headbutt("Horns (Natural Weapons) / Рога");
    showAttackDialog(who([HEADCRACKER, horns]), horns);
    expect(captured.dialog.content).toContain("Голова (−20)");
  });
});
