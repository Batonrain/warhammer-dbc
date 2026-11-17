import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, sheetOf } from "../support/foundry-stub.mjs";
import { setFactionIndex, clearFactionIndex } from "../../module/rules/factions.mjs";

const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");

const TREE = [
  { key: "imperium", name: "Империум" },
  { key: "adeptus-astartes", name: "Адептус Астартес", parent: "imperium" },
  { key: "chaos", name: "Хаос" }
];

beforeEach(() => { resetCaptured(); setFactionIndex(TREE); });
afterEach(() => clearFactionIndex());

const AW = { id: "aw", type: "talent", name: "Ancient Warrior / Древний Воин", system: {}, getFlag: () => undefined };

function node(initial = {}) {
  const handlers = {};
  const n = {
    dataset: {}, style: {}, value: "", checked: false, hidden: false, textContent: "", innerHTML: "",
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    handlers,
    addEventListener(type, fn) { (handlers[type] ??= []).push(fn); },
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    appendChild() {}, insertBefore() {}, setAttribute() {}, dispatchEvent() {},
    ...initial
  };
  n.currentTarget = n;
  return n;
}

function fakeRoot() {
  const nodes = {
    "#skill-char-select": node({ value: "fel" }),
    "#skill-target": node({ value: "40" }),
    "#skill-modifier": node({ value: "0" }),
    "#test-difficulty": node({ value: "0" }),
    "#social-faction-select": node({ value: "" }),
    "#kind-combined": node({ checked: true }),
    ".cmb-col-a": node({ querySelector: sel => (sel === ".cmb-col-a-slot" ? node() : null) }),
    ".cmb-col-b": node(),
    "#cmb-a-threshold": node({ textContent: "Порог: —" }),
    "#cmb-b-threshold": node({ textContent: "Порог: —" }),
    "#cmb-b-target-select": node({ value: "skill:charm" }),
    "#cmb-b-char-select": node({ value: "fel" }),
    "#cmb-b-target": node({ value: "50" }),
    "#cmb-b-difficulty": node({ value: "0" }),
    "#cmb-b-modifier": node({ value: "0" }),
    "#cmb-b-mods-slot": node(),
    "#rule-auto-mods-slot": node()
  };
  const root = {
    nodes,
    querySelector: sel => nodes[sel] ?? null,
    querySelectorAll: () => []
  };
  return root;
}

describe("Комбинированный тест: смена «Собеседник» пересчитывает подписи Порога", () => {
  it("обе подписи обновляются и учитывают выбранную фракцию", async () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [AW],
      characteristics: { fel: { total: 40 }, int: { total: 40 }, ag: { total: 35 } },
      skills: { charm: { total: 40 } },
      fatigue: { value: 0 }
    });
    const root = fakeRoot();
    sheet._showSkillRollDialog("Очарование", 40, "fel", false, { skill: "charm" });
    captured.dialog.render(null, { element: root, setPosition() {} });

    const select = root.nodes["#social-faction-select"];

    select.value = "talent:ancient-warrior";
    for (const fn of select.handlers.change) fn({ currentTarget: select });

    expect(root.nodes["#cmb-a-threshold"].textContent).toBe("Порог: 50");
    expect(root.nodes["#cmb-b-threshold"].textContent).toBe("Порог: 60");
  });
});
