// test/combat/extra-successes.test.mjs
//
// wdbc-r3379: Бой Один На Один (Палач) и Искусный (Ренегат) — «+1 Успех на
// успешные тесты» — теперь и в приёмах Борьбы и контактных приёмах (общий
// расчёт combat/extra-successes.mjs), а не только в атаке и защите.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { extraSuccessDegrees } from "../../module/combat/extra-successes.mjs";

const SINGLE = { hasFlag: () => true, tokenOf: () => ({ id: "t1" }), enemiesOf: t => (t.id === "t1" ? [{ id: "e1" }] : [{ id: "t1" }]) };
const CROWD = { hasFlag: () => true, tokenOf: () => ({ id: "t1" }), enemiesOf: t => (t.id === "t1" ? [{ id: "e1" }, { id: "e2" }] : [{ id: "t1" }]) };
const adroit = ch => ({ items: [{ type: "trait", name: "Adroit / Искусный", flags: { "warhammer-dbc": { adroitChar: ch } } }] });
const plain = { items: [] };

describe("extraSuccessDegrees", () => {
  it("Бой Один На Один: +1 на успех WS/S/A один на один, не на провал, не в толпе", () => {
    expect(extraSuccessDegrees(plain, { success: true, charKey: "ws" }, SINGLE)).toBe(1);
    expect(extraSuccessDegrees(plain, { success: true, charKey: "s" }, SINGLE)).toBe(1);
    expect(extraSuccessDegrees(plain, { success: false, charKey: "ws" }, SINGLE)).toBe(0);
    expect(extraSuccessDegrees(plain, { success: true, charKey: "ws" }, CROWD)).toBe(0);
    expect(extraSuccessDegrees(plain, { success: true, charKey: "int" }, SINGLE)).toBe(0);
  });

  it("Искусный: +1 на успех по выбранной характеристике, прочие — нет", () => {
    expect(extraSuccessDegrees(adroit("ws"), { success: true, charKey: "ws" })).toBe(1);
    expect(extraSuccessDegrees(adroit("ws"), { success: true, charKey: "s" })).toBe(0);
    expect(extraSuccessDegrees(adroit("ws"), { success: false, charKey: "ws" })).toBe(0);
  });

  it("обе Черты складываются; без Черт — 0", () => {
    expect(extraSuccessDegrees(adroit("ws"), { success: true, charKey: "ws" }, SINGLE)).toBe(2);
    expect(extraSuccessDegrees(plain, { success: true, charKey: "ws" })).toBe(0);
    expect(extraSuccessDegrees(null, { success: true, charKey: "ws" })).toBe(0);
  });
});
