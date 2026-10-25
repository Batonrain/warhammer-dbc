// test/combat/fire-threat.test.mjs
//
// Fire Threat / Огневая Угроза (Стрелок; Sahara 3-5fbf): «Когда он вооружен
// стрелковым оружием, кроме длинной винтовки и тяжелого, персонаж может
// проводить Давление, используя BS вместо WS, но тогда он не сможет последовать
// за целью, если успешно заставит ее подвигаться».
// Давление через BS: по умолчанию BS (sheets/tabs/combat.mjs), победа без
// «последовать за целью» (combat/feint-press.mjs::resolvePressSuccess).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { resolvePressSuccess } from "../../module/combat/feint-press.mjs";
import { fireThreatWeapon } from "../../module/rules/gunner-talents.mjs";

const THREAT = { key: "rangedCore.core.fireThreat", name: "Fire Threat / Огневая Угроза" };
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const gun = (system = {}) => weaponFor({ weaponClass: "basic", equipped: true, ...system }, { name: "Лазган" });
const target = () => ({ name: "Цель", uuid: "t", system: { movement: { halfMove: 6 } }, getFlag: () => undefined });

beforeEach(() => resetCaptured());

describe("Огневая Угроза: подходящее оружие", () => {
  it("пистолет и ручное оружие в руках с Талантом (имя и ключ) — подходят", () => {
    const w = gun();
    expect(fireThreatWeapon(actorFor({ items: [w, byName(THREAT.name)] }))).toBe(w);
    expect(fireThreatWeapon(actorFor({ items: [w, byKey(THREAT.key)] }))).toBe(w);
    const p = gun({ weaponClass: "pistol" });
    expect(fireThreatWeapon(actorFor({ items: [p, byName(THREAT.name)] }))).toBe(p);
  });

  it("длинная винтовка, тяжёлое, не экипированное и отсутствие Таланта — нет", () => {
    const talent = byName(THREAT.name);
    expect(fireThreatWeapon(actorFor({ items: [gun({ weaponProps: [{ key: "longRifle" }] }), talent] }))).toBeNull();
    expect(fireThreatWeapon(actorFor({ items: [gun({ weaponClass: "heavy" }), talent] }))).toBeNull();
    expect(fireThreatWeapon(actorFor({ items: [gun({ equipped: false }), talent] }))).toBeNull();
    expect(fireThreatWeapon(actorFor({ items: [gun()] }))).toBeNull();
    expect(fireThreatWeapon(actorFor({ items: [weaponFor({ weaponClass: "melee", equipped: true }), talent] }))).toBeNull();
  });
});

describe("Давление через BS: без «последовать за целью»", () => {
  it("noFollow: карточка говорит, что за целью не следуют", async () => {
    const actor = actorFor({}); actor.name = "Стрелок";
    await resolvePressSuccess(actor, { deg: 4, target: target(), noFollow: true });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("до <b>4 м</b>");
    expect(html).toContain("за целью НЕ следует");
    expect(html).not.toContain("может последовать");
  });

  it("обычное Давление по-прежнему разрешает последовать за целью", async () => {
    const actor = actorFor({}); actor.name = "Боец";
    await resolvePressSuccess(actor, { deg: 4, target: target() });
    expect(captured.chat.at(-1).content).toContain("может последовать");
  });
});
