// test/rules/calm-warp.test.mjs
//
// «Усмирение Варпа» (Очко Бесчестия, Cor 20+) и бесплатный переброс Прорыва
// Черты «Имперское Санкционирование» (Беглый Псайкер).

import { describe, it, expect } from "vitest";
import { calmWarpAllowed, calmWarpCor, calmWarpResult, offerFreePerilReroll,
         hasImperialSanctioning, CALM_WARP_COR, IMPERIAL_SANCTIONING } from "../../module/rules/calm-warp.mjs";

const psyker = (cor, items = []) => ({ type: "character", system: { corruption: { value: cor } }, items });
const sanctioning = {
  id: "is", name: "Imperial Sanctioning / Имперское Санкционирование", type: "trait",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: IMPERIAL_SANCTIONING, label: "" }] }] } }
};

describe("Усмирение Варпа", () => {
  it("открывается с Cor 20 — как на полосе Очков Бесчестия", () => {
    expect(CALM_WARP_COR).toBe(20);
    expect(calmWarpAllowed(psyker(19)).ok).toBe(false);
    expect(calmWarpAllowed(psyker(19)).reason).toMatch(/20/);
    expect(calmWarpAllowed(psyker(20)).ok).toBe(true);
  });

  it("у Демон-Принца Порча считается 100", () => {
    expect(calmWarpCor({ type: "demonPrince", system: {} })).toBe(100);
  });

  it("переброс Феномена: 75+ — Прорыв, и бросок Прорыва читается по таблице", () => {
    const calm = calmWarpResult("phenomenon", { phenTotal: 30 });
    expect(calm.perilTriggered).toBe(false);
    expect(calm.peril).toBe(null);
    const bad = calmWarpResult("phenomenon", { phenTotal: 80, perilTotal: 3 });
    expect(bad.perilTriggered).toBe(true);
    expect(bad.peril.label).toBe("Бормотание");
  });

  it("Феномен «Варп-Безумие» (72–74) сам вызывает Прорыв", () => {
    expect(calmWarpResult("phenomenon", { phenTotal: 73 }).perilTriggered).toBe(true);
  });

  it("переброс Прорыва — по таблице Прорывов", () => {
    expect(calmWarpResult("peril", { perilTotal: 100 }).peril.label).toBe("Аннигиляция");
  });
});

describe("Имперское Санкционирование", () => {
  it("Черта узнаётся по возможности из Конструктора", () => {
    expect(hasImperialSanctioning(psyker(0, [sanctioning]))).toBe(true);
    expect(hasImperialSanctioning(psyker(0))).toBe(false);
  });

  it("бесплатный переброс Прорыва — только после оплаченного переброса Феномена, вызвавшего Прорыв", () => {
    const base = { table: "phenomenon", free: false, perilTriggered: true, sanctioned: true };
    expect(offerFreePerilReroll(base)).toBe(true);
    expect(offerFreePerilReroll({ ...base, sanctioned: false })).toBe(false);
    expect(offerFreePerilReroll({ ...base, perilTriggered: false })).toBe(false);
    expect(offerFreePerilReroll({ ...base, table: "peril" })).toBe(false);
    expect(offerFreePerilReroll({ ...base, free: true })).toBe(false);
  });
});
