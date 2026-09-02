// test/rules/mech-blocks.test.mjs
//
// Блок Requirement+Condition+Effect — связка трёх частей плана
// (doombc-req-condition-effect-plan). blockFires() решает «сработал бы этот
// блок на это событие для этого актора», ничего не применяет.

import { describe, it, expect } from "vitest";
import {
  blankMechBlock, blockRequirementMet, blockHasEffect, blockFires,
  getMechBlocks, blocksFiring
} from "../../module/rules/mech-blocks.mjs";

const actor = (items = []) => ({ items, system: { characteristics: {}, corruption: {}, insanity: {} } });

describe("blankMechBlock", () => {
  it("нет Requirement, Condition onGrant по умолчанию, 0 Effect", () => {
    const b = blankMechBlock();
    expect(b.requirement).toBeNull();
    expect(b.condition.kind).toBe("onGrant");
    expect(b.effects).toEqual([]);
  });
});

describe("blockRequirementMet", () => {
  it("нет Requirement — всегда true", () => {
    expect(blockRequirementMet(actor(), { requirement: null })).toBe(true);
  });

  it("есть Requirement — делегирует reqBlockMet", () => {
    const req = { tier: "secondary", forbid: false, group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "X" }] } };
    expect(blockRequirementMet(actor(), { requirement: req })).toBe(false);
    expect(blockRequirementMet(actor([{ type: "trait", name: "X", system: {} }]), { requirement: req })).toBe(true);
  });
});

describe("blockHasEffect — под предупреждение «нужен хотя бы один эффект»", () => {
  it("пустой effects — false", () => {
    expect(blockHasEffect(blankMechBlock())).toBe(false);
  });
  it("хотя бы один — true", () => {
    const b = blankMechBlock();
    b.effects.push({ kind: "corruption", corruptionValue: "5" });
    expect(blockHasEffect(b)).toBe(true);
  });
});

describe("blockFires — Requirement И Condition разом", () => {
  it("Requirement не выполнен — блок не срабатывает, даже если Condition совпал", () => {
    const b = {
      requirement: { tier: "secondary", forbid: false, group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "X" }] } },
      condition: { kind: "onGrant" }, effects: []
    };
    expect(blockFires(actor(), b, { kind: "onGrant" })).toBe(false);
  });

  it("Requirement выполнен, но Condition не тот момент — не срабатывает", () => {
    const b = { requirement: null, condition: { kind: "onRemove" }, effects: [] };
    expect(blockFires(actor(), b, { kind: "onGrant" })).toBe(false);
  });

  it("оба сошлись — срабатывает", () => {
    const b = { requirement: null, condition: { kind: "onTestResult", outcome: "success" }, effects: [] };
    expect(blockFires(actor(), b, { kind: "onTestResult", outcome: "success" })).toBe(true);
    expect(blockFires(actor(), b, { kind: "onTestResult", outcome: "fail" })).toBe(false);
  });
});

describe("getMechBlocks / blocksFiring — на уровне предмета", () => {
  const item = (blocks) => ({ flags: { "warhammer-dbc": { mechBlocks: blocks } } });

  it("нет флага — пустой список", () => {
    expect(getMechBlocks({})).toEqual([]);
  });

  it("blocksFiring фильтрует только сработавшие", () => {
    const always = { requirement: null, condition: { kind: "onGrant" }, effects: [{ kind: "wounds", woundsValue: "1" }] };
    const onlyKhorne = {
      requirement: { tier: "primary", forbid: true, group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "Khornate" }] } },
      condition: { kind: "onGrant" }, effects: [{ kind: "characteristic", charKey: "wp", value: 20 }]
    };
    const i = item([always, onlyKhorne]);

    expect(blocksFiring(actor(), i, { kind: "onGrant" })).toEqual([always]);

    const khornate = actor([{ type: "trait", name: "Khornate", system: {} }]);
    expect(blocksFiring(khornate, i, { kind: "onGrant" })).toEqual([always, onlyKhorne]);

    // на другое событие оба молчат
    expect(blocksFiring(khornate, i, { kind: "onRemove" })).toEqual([]);
  });
});
