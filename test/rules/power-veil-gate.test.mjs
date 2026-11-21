// test/rules/power-veil-gate.test.mjs
//
// Sahara 0-toad-psykers (dbc-83): психосила, которая «может быть манифестирована
// только при Истончении Реальности 0 или выше» (toad-psykers.json, Diabolic
// Savant / Демонический Слуга). Порог лежит на предмете-психосиле в
// system.veilMin; null — условия нет (у ритуала 0 значит «нет условия», а у
// психосилы 0 — настоящий порог, поэтому поле обнуляемое).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { powerVeilGate, powerVeilMessage } from "../../module/rules/veil-steps.mjs";
import { PsychicPowerData } from "../../module/data/item/psychic-power.mjs";

const power = veilMin => ({ name: "Демонический Слуга", system: { veilMin } });
const steps = total => () => ({ scene: total, aura: 0, total });

describe("powerVeilGate: Истончение Реальности для психосилы", () => {
  it("условия нет (null) — можно всегда, Завесу не читаем", () => {
    let read = false;
    const g = powerVeilGate(power(null), {}, { stepsFn: () => { read = true; return { scene: -3, aura: 0, total: -3 }; } });
    expect(g.ok).toBe(true);
    expect(read).toBe(false);
  });
  it("порог 0: Завеса −1 — нельзя", () => {
    expect(powerVeilGate(power(0), {}, { stepsFn: steps(-1) }).ok).toBe(false);
  });
  it("порог 0: Завеса 0 и +2 — можно", () => {
    expect(powerVeilGate(power(0), {}, { stepsFn: steps(0) }).ok).toBe(true);
    expect(powerVeilGate(power(0), {}, { stepsFn: steps(2) }).ok).toBe(true);
  });
  it("сообщение называет силу, порог и Завесу", () => {
    const g = powerVeilGate(power(0), {}, { stepsFn: steps(-2) });
    expect(powerVeilMessage(g, "Демонический Слуга")).toMatch(/Демонический Слуга.*0 или выше/);
    expect(powerVeilMessage(g, "")).toContain("-2");
  });
});

describe("схема психосилы: veilMin обнуляемое, по умолчанию null", () => {
  it("поле есть и пустое по умолчанию", () => {
    const f = PsychicPowerData.defineSchema().veilMin;
    expect(f).toBeDefined();
    expect(f.initial).toBeNull();
    expect(f.options.nullable).toBe(true);
  });
});
