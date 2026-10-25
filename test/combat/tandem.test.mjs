// test/combat/tandem.test.mjs
//
// Tandem / Тандем (Sahara 3-9d40): встроить пистолет/винтовку в тяжёлое оружие и достать обратно.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { embedTandem, extractTandem } from "../../module/combat/tandem.mjs";
import { tandemProfiles } from "../../module/rules/tandem.mjs";

const TAND = {
  id: "t-tandem", name: "Tandem / Тандем", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "weaponsmith.core.tandem", label: "" }] }] } }
};

function build({ talent = true } = {}) {
  const host = weaponFor({ weaponClass: "heavy", weight: 20, profiles: [], rof_single: 0, rof_semi: 0, rof_full: 6 }, { id: "heavy", name: "Тяжёлый болтер" });
  const guest = weaponFor({ weaponClass: "basic", weight: 4, damage: "1d10+3", reload: "½", rof_single: 1, rof_semi: 3, rof_full: 0, magazineCur: 17, magazineMax: 60 }, { id: "gun", name: "Лазган" });
  guest.toObject = () => structuredClone({ name: guest.name, type: "weapon", system: guest.system });
  guest.deleted = false;
  guest.delete = async () => { guest.deleted = true; };
  host.unsetFlag = async () => {};
  const items = [host, guest, ...(talent ? [TAND] : [])];
  const actor = actorFor({ items });
  actor.name = "Оружейник";
  actor.created = [];
  actor.createEmbeddedDocuments = async (type, docs) => { actor.created.push(...docs); return docs; };
  return { actor, host, guest };
}

beforeEach(() => resetCaptured());

describe("Тандем: встроить", () => {
  it("тяжёлое получает профиль-тандем со стволом встроенного, вес складывается, исходный предмет уходит", async () => {
    const { actor, host, guest } = build();
    expect(await embedTandem(actor, host, guest)).toBe(true);
    const t = tandemProfiles(host);
    expect(t).toHaveLength(1);
    expect(t[0].profile).toMatchObject({ ownFire: true, tandem: true, magazineCur: 17, reload: "1", damage: "1d10+3", rof_semi: 3 });
    expect(host.system.weight).toBe(24);
    expect(guest.deleted).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Тандем");
  });

  it("без Таланта — отказ, ничего не меняется", async () => {
    const { actor, host, guest } = build({ talent: false });
    expect(await embedTandem(actor, host, guest)).toBe(false);
    expect(tandemProfiles(host)).toHaveLength(0);
    expect(guest.deleted).toBe(false);
    expect(captured.warnings.some(w => w.includes("Tandem"))).toBe(true);
  });

  it("в не-тяжёлое и не-ствол встроить нельзя; второе встроенное — отказ", async () => {
    const { actor, host, guest } = build();
    expect(await embedTandem(actor, guest, host)).toBe(false);
    await embedTandem(actor, host, guest);
    const other = weaponFor({ weaponClass: "pistol", rof_single: 1 }, { id: "p2", name: "Пистолет" });
    other.toObject = () => ({ name: other.name, system: other.system });
    other.delete = async () => {};
    actor.items.push(other);
    expect(await embedTandem(actor, host, other)).toBe(false);
    expect(captured.warnings.some(w => w.includes("уже встроено"))).toBe(true);
  });
});

describe("Тандем: извлечь", () => {
  it("возвращает оружие отдельным предметом с остатком патронов и снимает профиль и вес", async () => {
    const { actor, host, guest } = build();
    await embedTandem(actor, host, guest);
    // выстрелили из встроенного: остаток в профиле
    host.system.profiles[0].magazineCur = 9;
    expect(await extractTandem(actor, host, 0)).toBe(true);
    expect(actor.created).toHaveLength(1);
    expect(actor.created[0]).toMatchObject({ name: "Лазган", system: { magazineCur: 9, equipped: false } });
    expect(tandemProfiles(host)).toHaveLength(0);
    expect(host.system.weight).toBe(20);
  });

  it("нечего извлекать — отказ", async () => {
    const { actor, host } = build();
    expect(await extractTandem(actor, host, 0)).toBe(false);
  });
});
