// test/sheets/attack-dialog-hidden-joints.test.mjs
//
// Скрытые Сочленения (core.json, «Броня», раздел «Скрытые Сочленения»,
// wdbc-x1nz.4): одежда/Мягкая броня НАД Жёсткой на одной локации цели
// усложняет Избирательную атаку в Сочленение/Шею — штраф растёт на 10.
// Приближённая автоматизация (решение владельца): система не знает, что
// надето СВЕРХУ, только что Мягкая (soft) и Жёсткая (hard) присутствуют на
// одной локации одновременно (armorKey "head" для Сочленение/Шея).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attacker(over = {}) {
  const a = actorFor({ items: [], fatigue: { value: 0 }, aiming: "none", ...over });
  a.update = async () => {};
  return a;
}

function armorItem(props, head) {
  return { type: "armor", system: { equipped: true, head, properties: props } };
}

function targetWith(items = []) {
  return { uuid: "Actor.target", type: "character", name: "Цель", system: {}, items };
}

function htmlNode() {
  let out = "";
  return { get innerHTML() { return out; }, set innerHTML(v) { out = String(v); } };
}

function textNode() {
  let text = "";
  return {
    get textContent() { return text; },
    set textContent(v) { text = String(v); },
    style: {}, classList: { add: () => {}, remove: () => {} }
  };
}

/** Форма с выбранным прицелом «Сочленение/Шея» (penalty −40, как в aimTargets). */
function jointAimForm(fields = {}) {
  return {
    "#atk-char": "bs", "#atk-modifier": "0",
    "#atk-aim": "joint", "#atk-aim option:checked": { dataset: { penalty: "-40" } },
    ...fields
  };
}

/** Живой пересчёт порога (как в attack-dialog-vehicle-side.test.mjs) — отдаёт breakdown.innerHTML. */
function rerenderBreakdown(fields) {
  const breakdown = htmlNode();
  captured.rerender(fakeForm({
    ...fields,
    "#atk-total-display": textNode(), "#atk-threshold-breakdown": breakdown, ".av-adv-hint": textNode()
  }));
  return breakdown;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Скрытые Сочленения — штраф −10, только при Избирательной в Сочленение/Шею (wdbc-x1nz.4)", () => {
  it("у цели и Мягкая, и Жёсткая на голове, прицел в Сочленение — отдельная строка −10", () => {
    setTargets([targetWith([armorItem(["soft"], 2), armorItem(["hard"], 5)])]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = rerenderBreakdown(jointAimForm());
    expect(breakdown.innerHTML).toContain("Скрытые Сочленения цели");
    expect(breakdown.innerHTML).toContain("-10");
  });

  it("только Мягкая (без Жёсткой) — штрафа нет", () => {
    setTargets([targetWith([armorItem(["soft"], 2)])]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = rerenderBreakdown(jointAimForm());
    expect(breakdown.innerHTML).not.toContain("Скрытые Сочленения цели");
  });

  it("только Жёсткая (без Мягкой) — штрафа нет", () => {
    setTargets([targetWith([armorItem(["hard"], 5)])]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = rerenderBreakdown(jointAimForm());
    expect(breakdown.innerHTML).not.toContain("Скрытые Сочленения цели");
  });

  it("обе есть, но прицел не в Сочленение — штрафа нет", () => {
    setTargets([targetWith([armorItem(["soft"], 2), armorItem(["hard"], 5)])]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = rerenderBreakdown({
      "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "head",
      "#atk-aim option:checked": { dataset: { penalty: "0" } }
    });
    expect(breakdown.innerHTML).not.toContain("Скрытые Сочленения цели");
  });

  it("нет цели вовсе — штрафа нет, диалог не падает", () => {
    setTargets([]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = rerenderBreakdown(jointAimForm());
    expect(breakdown.innerHTML).not.toContain("Скрытые Сочленения цели");
  });

  it("цель — техника — штрафа нет (нет понятия Сочленение/Шея у машин)", () => {
    setTargets([{ uuid: "Actor.veh", type: "vehicle", name: "Техника", system: { chassis: {} },
      items: [armorItem(["soft"], 2), armorItem(["hard"], 5)] }]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = rerenderBreakdown(jointAimForm());
    expect(breakdown.innerHTML).not.toContain("Скрытые Сочленения цели");
  });

  it("снятая (не equipped) Жёсткая не считается", () => {
    setTargets([targetWith([
      armorItem(["soft"], 2),
      { type: "armor", system: { equipped: false, head: 5, properties: ["hard"] } }
    ])]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = rerenderBreakdown(jointAimForm());
    expect(breakdown.innerHTML).not.toContain("Скрытые Сочленения цели");
  });
});
