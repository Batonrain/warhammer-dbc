// test/rules/tentacle-hand-form.test.mjs
//
// Мутация Tentacle/Щупальце, субмутация 9 «Изменчивое» (wdbc-2ynk) — чистая
// логика формы руки/щупальца, без Foundry.

import { describe, it, expect } from "vitest";
import {
  isTentacleItem, isTentacleShiftItem, tentacleIsHandForm, tentacleBonusSuppressed,
  TENTACLE_HAND_FORM_FLAG
} from "../../module/rules/tentacle-hand-form.mjs";

function tentacleItem({ subLabel = "9", handForm = false } = {}) {
  return {
    type: "mutation",
    name: "Tentacle / Щупальце",
    system: { submutation: { label: subLabel } },
    flags: { "warhammer-dbc": handForm ? { [TENTACLE_HAND_FORM_FLAG]: true } : {} }
  };
}

describe("isTentacleItem", () => {
  it("узнаёт Щупальце по половине билингвального имени", () => {
    expect(isTentacleItem(tentacleItem())).toBe(true);
  });
  it("не путает с другой Мутацией", () => {
    expect(isTentacleItem({ type: "mutation", name: "Tail / Хвост" })).toBe(false);
  });
  it("не путает с оружием того же имени", () => {
    expect(isTentacleItem({ type: "weapon", name: "Tentacle / Щупальце" })).toBe(false);
  });
});

describe("isTentacleShiftItem", () => {
  it("строка 9 «Изменчивое» — форма руки доступна", () => {
    expect(isTentacleShiftItem(tentacleItem({ subLabel: "9" }))).toBe(true);
  });
  it("другая строка — форма руки недоступна", () => {
    expect(isTentacleShiftItem(tentacleItem({ subLabel: "8" }))).toBe(false);
  });
  it("субмутация ещё не выбрана (label пуст) — недоступна", () => {
    expect(isTentacleShiftItem(tentacleItem({ subLabel: "" }))).toBe(false);
  });
});

describe("tentacleIsHandForm", () => {
  it("по умолчанию — щупальце, не рука", () => {
    expect(tentacleIsHandForm(tentacleItem())).toBe(false);
  });
  it("флаг включён — форма руки", () => {
    expect(tentacleIsHandForm(tentacleItem({ handForm: true }))).toBe(true);
  });
});

describe("tentacleBonusSuppressed", () => {
  it("нет Щупальца — не гасится (вопрос не имеет смысла, бонуса и так нет)", () => {
    expect(tentacleBonusSuppressed({ items: [] })).toBe(false);
  });
  it("Щупальце в форме щупальца — бонус жив", () => {
    expect(tentacleBonusSuppressed({ items: [tentacleItem({ handForm: false })] })).toBe(false);
  });
  it("единственное Щупальце в форме руки — бонус гасится", () => {
    expect(tentacleBonusSuppressed({ items: [tentacleItem({ handForm: true })] })).toBe(true);
  });
  it("два Щупальца, хоть одно ещё щупальце — бонус жив", () => {
    const items = [tentacleItem({ handForm: true }), tentacleItem({ handForm: false })];
    expect(tentacleBonusSuppressed({ items })).toBe(false);
  });
  it("два Щупальца, оба в форме руки — бонус гасится", () => {
    const items = [tentacleItem({ handForm: true }), tentacleItem({ handForm: true })];
    expect(tentacleBonusSuppressed({ items })).toBe(true);
  });
});
