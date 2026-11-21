// Расплата (Талант Дредноутов, Разобрать r8b8m).
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { paybackCheck, paybackPilotOf, hasPayback } from "../../module/combat/payback.mjs";

const pilot = (sanity = 50) => ({
  uuid: "Actor.pilot", name: "Пилот", type: "character",
  system: { sanity: { value: sanity } },
  items: [
    { type: "talent", name: "Payback / Расплата" },
    { type: "talent", name: "Hatred / Ненависть", system: { targets: [{ kind: "actorType", value: "npc" }] } }
  ]
});
const foe = { uuid: "Actor.foe", name: "Враг", type: "npc", system: {} };
const friend = { uuid: "Actor.f", name: "Свой", type: "character", system: {} };

describe("Расплата", () => {
  it("узнаёт Талант", () => expect(hasPayback(pilot())).toBe(true));
  it("Ненавистный и непоглощённый урон — кнопка", () => {
    expect(paybackCheck(pilot(), foe, 3).ok).toBe(true);
  });
  it("без урона, не Ненавистный — молчит", () => {
    expect(paybackCheck(pilot(), foe, 0)).toEqual({ ok: false, pilot: null, reason: "" });
    expect(paybackCheck(pilot(), friend, 3).ok).toBe(false);
  });
  it("Здравомыслие 20 и ниже — не работает, с подписью", () => {
    const c = paybackCheck(pilot(20), foe, 3);
    expect(c.ok).toBe(false);
    expect(c.reason).toMatch(/Здравомыслие 20/);
  });
  it("урон по Дредноуту — отвечает назначенный пилот", () => {
    const p = pilot();
    const dread = { type: "vehicle", system: { vehicleClass: "Дредноут", stations: [{ role: "pilot", uuid: "Actor.pilot" }] } };
    expect(paybackPilotOf(dread, u => (u === "Actor.pilot" ? p : null))).toBe(p);
    expect(paybackCheck(dread, foe, 2, { resolveUuid: u => (u === "Actor.pilot" ? p : null) }).ok).toBe(true);
  });
});
