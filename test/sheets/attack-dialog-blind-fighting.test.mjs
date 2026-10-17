// test/sheets/attack-dialog-blind-fighting.test.mjs
//
// Бой Вслепую (глава 3, Внимательность): «уменьшает штрафы на рукопашные
// Атаки … от слепоты, тьмы и уменьшенной видимости в 2 раза» — строки
// «Дым / туман», «Тьма» и «Ослеплён» окна рукопашной атаки вдвое меньше.
// Стрелковая атака Таланта не замечает.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const html = () => captured.dialog?.content ?? "";

function modValue(label) {
  const idx = html().indexOf(`<span>${label} (`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 400), idx);
  const tag = before.slice(before.lastIndexOf("<input"));
  const m = tag.match(/data-value="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

const blindFighting = () => ({ id: "bf", type: "talent", name: "Blind Fighting / Бой Вслепую", system: {}, getFlag: () => undefined });

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Бой Вслепую в окне атаки", () => {
  it("рукопашная без Таланта: Дым −10, Тьма −20", () => {
    const weapon = weaponFor({ weaponClass: "melee" });
    showAttackDialog(actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" }), weapon);
    expect(modValue("Дым / туман")).toBe(-10);
    expect(modValue("Тьма")).toBe(-20);
  });

  it("рукопашная с Талантом: Дым −5, Тьма −10", () => {
    const weapon = weaponFor({ weaponClass: "melee" });
    showAttackDialog(actorFor({ items: [weapon, blindFighting()], fatigue: { value: 0 }, aiming: "none" }), weapon);
    expect(modValue("Дым / туман")).toBe(-5);
    expect(modValue("Тьма")).toBe(-10);
  });

  it("Ослеплённый носитель: −15 вместо −30", () => {
    const weapon = weaponFor({ weaponClass: "melee" });
    const actor = actorFor({ items: [weapon, blindFighting()], fatigue: { value: 0 }, aiming: "none",
      conditions: { blinded: true } });
    showAttackDialog(actor, weapon);
    expect(modValue("Ослеплён")).toBe(-15);
  });

  it("стрелковая атака с Талантом: штрафы прежние", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    showAttackDialog(actorFor({ items: [weapon, blindFighting()], fatigue: { value: 0 }, aiming: "none" }), weapon);
    expect(modValue("Тьма")).toBe(-30);
    expect(modValue("Дым / туман")).toBe(-20);
  });
});
