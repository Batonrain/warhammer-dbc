// test/combat/reload-fully-armed.test.mjs
//
// 62-0252 Q3 (решение владельца 24.10.2026). Во Всеоружии (Fully Armed, Черта):
// «Персонаж снижает стоимость перезарядки всего оружия с модификацией Custom
// Grip на 1 ОД (вплоть до ½)». ½ = Полудействие = 1 ОД — ниже не опускается.
// Быстрая Перезарядка (Rapid Reload): время вдвое (окр.▼). Обе скидки НЕ
// складываются: берётся лучшая из двух (меньшая цена в ОД).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _reloadWeapon } from "../../module/combat/reload.mjs";
import { fullyArmedReloadApCost } from "../../module/combat/fully-armed.mjs";
import { weaponFor, actorFor } from "../support/combat-fixtures.mjs";

const FA   = { type: "trait", name: "Fully Armed / Во Всеоружии", system: {} };
const RR   = { type: "talent", name: "Rapid Reload / Быстрая Перезарядка", system: {} };
const grip = installedOn => ({ type: "weaponMod", name: "Personal Grip / Персональный Хват", system: { installedOn } });

function ammo() {
  const item = {
    id: "ammo-1", name: "Боеприпас", type: "ammo", system: { properties: [], quantity: 3, weaponTypes: ["any"] },
    getFlag: () => undefined,
    async update(data) { for (const [p, v] of Object.entries(data)) item.system[p.replace(/^system\./, "")] = v; }
  };
  return item;
}

/** Стрелок на 6 ОД (хватит на любую перезарядку), оружие класса `cls` с перезарядкой `reload`. */
async function reload({ reload: rl, extra = [], cls = "basic", withGrip = true, ap = 6 } = {}) {
  const weapon = weaponFor({ magazineCur: 0, magazineMax: 10, reload: rl, weaponClass: cls }, { id: "w1" });
  const items = [weapon, ammo(), ...extra, ...(withGrip ? [grip("w1")] : [])];
  const a = actorFor({ items });
  a.type = "character";
  a.system.actionPoints = { value: ap, max: ap };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
  };
  await _reloadWeapon(a, weapon);
  return { a, weapon, spent: ap - a.system.actionPoints.value };
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = { started: true }; });
afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("fullyArmedReloadApCost (чистая арифметика)", () => {
  const a = items => ({ items: [...items] });
  const w = { id: "w1", type: "weapon", system: { weaponClass: "basic" } };
  it("−1 ОД «вплоть до ½»: 2→1, 4→3, 6→5; ½ (1 ОД) ниже не опускается; бесплатное остаётся бесплатным", () => {
    const actor = a([w, FA, grip("w1")]);
    expect(fullyArmedReloadApCost(actor, w, 2)).toBe(1);
    expect(fullyArmedReloadApCost(actor, w, 4)).toBe(3);
    expect(fullyArmedReloadApCost(actor, w, 6)).toBe(5);
    expect(fullyArmedReloadApCost(actor, w, 1)).toBe(1);
    expect(fullyArmedReloadApCost(actor, w, 0)).toBe(0);
  });
  it("нужны И Черта, И мод Custom Grip именно на этом оружии", () => {
    expect(fullyArmedReloadApCost(a([w, grip("w1")]), w, 4)).toBe(4);
    expect(fullyArmedReloadApCost(a([w, FA]), w, 4)).toBe(4);
    expect(fullyArmedReloadApCost(a([w, FA, grip("other")]), w, 4)).toBe(4);
  });
  it("книга: «всего оружия с Custom Grip» — класс не ограничивает (тяжёлое тоже)", () => {
    const heavy = { id: "h1", type: "weapon", system: { weaponClass: "heavy" } };
    expect(fullyArmedReloadApCost(a([heavy, FA, grip("h1")]), heavy, 4)).toBe(3);
  });
});

describe("_reloadWeapon: Во Всеоружии", () => {
  it("«2» (4 ОД) с модом и Чертой — 3 ОД, строка Черты на карточке", async () => {
    const { spent } = await reload({ reload: "2", extra: [FA] });
    expect(spent).toBe(3);
    expect(captured.chat.at(-1).content).toContain("Во Всеоружии");
  });

  it("«1» (2 ОД) — 1 ОД", async () => {
    expect((await reload({ reload: "1", extra: [FA] })).spent).toBe(1);
  });

  it("«½» (1 ОД) — по-прежнему 1 ОД: «вплоть до ½», строки Черты нет", async () => {
    const { spent } = await reload({ reload: "½", extra: [FA] });
    expect(spent).toBe(1);
    expect(captured.chat.at(-1).content).not.toContain("Во Всеоружии");
  });

  it("без Custom Grip на оружии — полная цена", async () => {
    expect((await reload({ reload: "2", extra: [FA], withGrip: false })).spent).toBe(4);
  });

  it("без Черты (мод есть) — полная цена", async () => {
    expect((await reload({ reload: "2" })).spent).toBe(4);
  });
});

describe("_reloadWeapon: Во Всеоружии + Быстрая Перезарядка — лучшая скидка, не сумма", () => {
  it("«2» (4 ОД): Быстрая → 2, Во Всеоружии → 3; берётся 2 (не 1 и не 0)", async () => {
    expect((await reload({ reload: "2", extra: [FA, RR] })).spent).toBe(2);
  });

  it("«1» (2 ОД): обе дают 1 — берётся 1 (не 0)", async () => {
    expect((await reload({ reload: "1", extra: [FA, RR] })).spent).toBe(1);
  });

  it("«½» (1 ОД): Быстрая → бесплатно, Во Всеоружии → 1; лучшая — бесплатно", async () => {
    expect((await reload({ reload: "½", extra: [FA, RR] })).spent).toBe(0);
  });
});
