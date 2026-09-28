// test/apps/mechanics-or-when.test.mjs
//
// ИЛИ-выбор Конструктора показывает только ветки, чьё «Когда» выполнено.
// Раньше диалог предлагал и ветку, которую applyMechEntry потом молча
// отбрасывала (Божественно Одарённый Нумен выбирал Дар чужого Бога и не
// получал ничего).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { orChoiceEntries } from "../../module/apps/mechanics.mjs";

const corr = (id, when = {}) => ({ id, kind: "corruption", corruptionValue: "1", when });
const actor = patronGod => ({ system: { patronGod }, items: [] });

describe("ИЛИ-выбор и «Когда»", () => {
  const entries = [
    corr("mutation"),
    corr("khorne", { patronGod: ["khorne"] }),
    corr("nurgle", { patronGod: ["nurgle"] })
  ];

  it("без Покровителя — только ветка без условия", () => {
    expect(orChoiceEntries(actor(""), entries).map(e => e.id)).toEqual(["mutation"]);
  });

  it("с Покровителем — ветка его Бога и ветка без условия", () => {
    expect(orChoiceEntries(actor("khorne"), entries).map(e => e.id)).toEqual(["mutation", "khorne"]);
  });

  it("незаполненная ветка по-прежнему не предлагается", () => {
    expect(orChoiceEntries(actor(""), [corr("a"), { id: "b", kind: "corruption", corruptionValue: "" }])
      .map(e => e.id)).toEqual(["a"]);
  });
});
