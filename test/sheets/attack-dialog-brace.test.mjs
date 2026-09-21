// test/sheets/attack-dialog-brace.test.mjs
//
// Стр. 35, wdbc-x1nz.2.56: галочка «Тяжёлое оружие: без Закрепления» теперь
// автоотмечается по настоящему состоянию Закрепления (combat/brace-weapon.mjs),
// а не остаётся вечно снятой, как раньше (когда Закрепление было только
// текстовым допущением без всякого состояния).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { declareBrace } from "../../module/combat/brace-weapon.mjs";

function html() { return captured.dialog?.content ?? ""; }

function modLine(label) {
  const idx = html().indexOf(`<span>${label} (`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 400), idx);
  const inputStart = before.lastIndexOf("<input");
  const inputTag = before.slice(inputStart);
  const valueMatch = inputTag.match(/data-value="(-?\d+)"/);
  const checked = /\schecked(\s|\/|>)/.test(inputTag);
  return { value: valueMatch ? Number(valueMatch[1]) : null, checked };
}

/** Актор с флагами и токеном на сцене — Закрепление нужно и то, и другое. */
function braceActor(overrides = {}) {
  const a = actorFor(overrides);
  a.type = "character";
  a.uuid = "Actor.a1";
  a.system.actionPoints = { value: 2, max: 2 };
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
  };
  return a;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
  globalThis.game.combat = { started: true };
});

describe("Тяжёлое оружие: галочка «без Закрепления» следует настоящему состоянию", () => {
  it("тяжёлое оружие, Закрепление не объявлено — галочка отмечена (штраф действует)", () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Тяжёлое оружие: без Закрепления")).toMatchObject({ value: -30, checked: true });
  });

  it("тяжёлое оружие, реально Закреплено — галочка снята", async () => {
    const weapon = weaponFor({ weaponClass: "heavy" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" });
    globalThis.canvas.tokens.placeables.push({ actor, document: { x: 0, y: 0, width: 1, height: 1, rotation: 0 } });
    await declareBrace(actor, weapon);

    showAttackDialog(actor, weapon);

    expect(modLine("Тяжёлое оружие: без Закрепления")).toMatchObject({ value: -30, checked: false });
  });

  it("не тяжёлое оружие — галочка снята по умолчанию, как раньше", () => {
    const weapon = weaponFor({ weaponClass: "basic" }, { id: "w1" });
    const actor  = braceActor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Тяжёлое оружие: без Закрепления")).toMatchObject({ checked: false });
  });
});
