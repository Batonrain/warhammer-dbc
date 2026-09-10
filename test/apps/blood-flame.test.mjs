// test/apps/blood-flame.test.mjs
//
// Дар «Кровавое Пламя» (wdbc-1rno): активация полудействием на выбранном
// оружии актора — самоурон, Power Field/Flame, флаги. Боевой такт
// (убийство/конец боя) — test/combat/blood-flame.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { activateBloodFlame, isBloodFlameItem } from "../../module/apps/blood-flame.mjs";
import { ACTIVE_FLAG, KILLS_FLAG, ADDED_PROPS_FLAG } from "../../module/rules/blood-flame.mjs";

function fakeWeapon({ id, name = "Цепной топор", weaponClass = "melee", damageType = "rending", weaponProps = [], destroyed = false } = {}) {
  const store = {};
  const item = {
    id, type: "weapon", name,
    system: { weaponClass, damageType, weaponProps, destroyed },
    getFlag: (ns, key) => store[key],
    setFlag: async (ns, key, value) => { store[key] = value; return item; },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        if (path.startsWith("flags.warhammer-dbc.")) { store[path.slice("flags.warhammer-dbc.".length)] = value; continue; }
        const parts = path.split(".");
        let target = item;
        for (const p of parts.slice(0, -1)) target = (target[p] ??= {});
        target[parts.at(-1)] = value;
      }
      return item;
    }
  };
  return item;
}

function fakeActor(items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = {
    type: "character", name: "Испытуемый", items: list,
    // wounds.value — ОСТАВШИЕСЯ Раны (как HP), не накопленный урон: полное
    // здоровье в начале, самоурон уменьшает его, а не поднимает от 0.
    system: { wounds: { value: 10, critical: 0, max: 12, ablative: 0, ablativeMax: 0 } },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = actor;
        for (const p of parts.slice(0, -1)) target = (target[p] ??= {});
        target[parts.at(-1)] = value;
      }
      return actor;
    }
  };
  return actor;
}

describe("activateBloodFlame", () => {
  let actor, weapon;
  beforeEach(() => {
    weapon = fakeWeapon({ id: "w1" });
    actor = fakeActor([weapon]);
  });

  it("наносит 1 непоглощаемый R Dmg в Раны", async () => {
    await activateBloodFlame(actor, weapon);
    expect(actor.system.wounds.value).toBe(9); // было 10
  });

  it("добавляет Power Field и Flame, если их ещё не было", async () => {
    await activateBloodFlame(actor, weapon);
    const keys = weapon.system.weaponProps.map(p => p.key);
    expect(keys).toContain("powerField");
    expect(keys).toContain("flame");
  });

  it("не задваивает уже имеющееся свойство (Пламенное оружие)", async () => {
    weapon = fakeWeapon({ id: "w1", weaponProps: [{ key: "flame" }] });
    actor = fakeActor([weapon]);
    await activateBloodFlame(actor, weapon);
    expect(weapon.system.weaponProps.filter(p => p.key === "flame")).toHaveLength(1);
    expect(weapon.getFlag("warhammer-dbc", ADDED_PROPS_FLAG)).toEqual(["powerField"]);
  });

  it("ставит флаги активации, kills начинается с 0", async () => {
    await activateBloodFlame(actor, weapon);
    expect(weapon.getFlag("warhammer-dbc", ACTIVE_FLAG)).toBe(true);
    expect(weapon.getFlag("warhammer-dbc", KILLS_FLAG)).toBe(0);
  });

  it("дальнобойное оружие — отказ, самоурон не наносится", async () => {
    const ranged = fakeWeapon({ id: "w2", weaponClass: "basic" });
    const a = fakeActor([ranged]);
    await activateBloodFlame(a, ranged);
    expect(a.system.wounds.value).toBe(10);
    expect(ranged.getFlag("warhammer-dbc", ACTIVE_FLAG)).toBeUndefined();
  });

  it("оружие не с уроном R — отказ", async () => {
    const impact = fakeWeapon({ id: "w3", damageType: "impact" });
    const a = fakeActor([impact]);
    await activateBloodFlame(a, impact);
    expect(a.system.wounds.value).toBe(10);
    expect(impact.getFlag("warhammer-dbc", ACTIVE_FLAG)).toBeUndefined();
  });

  it("уничтоженное оружие — отказ", async () => {
    const broken = fakeWeapon({ id: "w4", destroyed: true });
    const a = fakeActor([broken]);
    await activateBloodFlame(a, broken);
    expect(a.system.wounds.value).toBe(10);
  });

  it("уже активно — повторная активация отказана, самоурон не удваивается", async () => {
    await activateBloodFlame(actor, weapon);
    await activateBloodFlame(actor, weapon);
    expect(actor.system.wounds.value).toBe(9); // не 8
  });
});

describe("isBloodFlameItem — реэкспорт из apps/", () => {
  it("работает так же, как rules/blood-flame.mjs", () => {
    expect(isBloodFlameItem({ type: "mutation", name: "Blood Flame / Кровавое Пламя", flags: {} })).toBe(true);
  });
});
