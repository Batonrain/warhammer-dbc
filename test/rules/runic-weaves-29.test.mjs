// test/rules/runic-weave-dread.test.mjs
//
// Sahara runic-weaves-29: вязи «Щит Отвращения» (−5), «Щит Безмятежности» (−10),
// «Щит Неизбежности» (полностью) смягчают штраф W от демонического присутствия —
// тот же путь, что Инфернальное Знакомство (regions/auras.mjs::dreadReductionFor).

import { describe, it, expect } from "vitest";
import { dreadReductionTotal, reduceDaemonicDread, INFERNAL_FAMILIARITY_CAP } from "../../module/rules/defiance-talents.mjs";

const has = (...keys) => k => keys.includes(k);
const dread = x => ({
  name: `Daemonic Dread (−${x} W) / Демонический Ужас`,
  effects: [{ name: `Ужас (−${x} W)`, system: { changes: [{ key: "system.characteristics.wp.totalFx", value: -x }] } }],
  system: { benefit: `−${x} к Итого Воли` }
});

describe("смягчение штрафа демонического присутствия", () => {
  it("ничего — 0", () => expect(dreadReductionTotal(has())).toBe(0));
  it("Щит Отвращения −5, Безмятежности −10, складываются с Инфернальным Знакомством", () => {
    expect(dreadReductionTotal(has("runicWeave.shieldOfRevulsion"))).toBe(5);
    expect(dreadReductionTotal(has("runicWeave.shieldOfSerenity"))).toBe(10);
    expect(dreadReductionTotal(has("runicWeave.shieldOfSerenity", INFERNAL_FAMILIARITY_CAP))).toBe(15);
  });
  it("Щит Неизбежности — штраф не выдаётся вовсе", () => {
    const cut = dreadReductionTotal(has("runicWeave.shieldOfInevitability"));
    expect(Number.isFinite(cut)).toBe(true);
    expect(reduceDaemonicDread(dread(20), cut)).toBeNull();
  });
  it("Щит Безмятежности на −15: остаётся −5", () => {
    const out = reduceDaemonicDread(dread(15), dreadReductionTotal(has("runicWeave.shieldOfSerenity")));
    expect(out.effects[0].system.changes[0].value).toBe(-5);
  });
});

import { ringWeaveBonus, isCircleRitual } from "../../module/rules/runic-weave.mjs";

describe("Длань Кольценосца / Владыки Колец — ритуалы с кругами", () => {
  it("круг — по движковому типу или по книжному типу предмета", () => {
    expect(isCircleRitual({ type: "circle" }, null)).toBe(true);
    expect(isCircleRitual({ type: "other" }, { system: { ritualType: "circle" } })).toBe(true);
    expect(isCircleRitual({ type: "summon" }, { system: { ritualType: "summon" } })).toBe(false);
  });
  it("+5 Кольценосца, +10 Владыки, вместе — большая", () => {
    const R = { type: "circle" };
    expect(ringWeaveBonus(has("runicWeave.handOfTheRingbearer"), R)).toMatchObject({ bonus: 5 });
    expect(ringWeaveBonus(has("runicWeave.handOfTheLordOfRings", "runicWeave.handOfTheRingbearer"), R)).toMatchObject({ bonus: 10 });
    expect(ringWeaveBonus(has("runicWeave.handOfTheRingbearer"), { type: "summon" })).toBeNull();
  });
});
