// test/combat/weapon-jam-reliability.test.mjs
//
// Стр. 41, wdbc-x1nz.2.61: «Клин и Надёжность».
// 1) Обычное стрелковое (Надёжность 0, без свойства) клинит на стандартном
//    пределе Критического Провала 96+ — module/combat/weapon-properties.mjs::
//    jamThreshold раньше возвращал null («клин не моделируется»).
// 2) Заклинившее оружие портит 2×RoF патронов из магазина (module/combat/
//    attack.mjs) — уходят в system.jammedAmmo, не пропадают насовсем.
// 3) Восстановление испорченных патронов — отдельный тест
//    Trade(Weaponsmith)+10 вне боя (module/combat/clear-jam.mjs::
//    rollRestoreJammedAmmo), не связанный с самим Расклином.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { jamThreshold } from "../../module/combat/weapon-properties.mjs";
import { rollRestoreJammedAmmo } from "../../module/combat/clear-jam.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("jamThreshold: обычное стрелковое (Надёжность 0) клинит на 96+", () => {
  it("без единого свойства Надёжности — предел 96, не null", () => {
    expect(jamThreshold({ reliabilityScore: 0 })).toBe(96);
  });
});

describe("Клин портит 2×RoF патронов из магазина (wdbc-x1nz.2.61)", () => {
  it("одиночный выстрел (RoF 1), Клин на rv=97 — теряет 2 патрона из магазина в jammedAmmo", async () => {
    const weapon = weaponFor({ magazineCur: 10, magazineMax: 10, rof_single: 1 }, { id: "w1" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [97];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.jammed).toBe(true);
    expect(weapon.system.magazineCur).toBe(8);
    expect(weapon.system.jammedAmmo).toBe(2);
  });

  it("короткая очередь (RoF 3), Клин — теряет 2×3=6 патронов", async () => {
    const weapon = weaponFor({ magazineCur: 10, magazineMax: 10, rof_semi: 3 }, { id: "w1" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [97];

    await _executeAttackRoll(actor, weapon, "bs", 45, "semi", null, {});

    expect(weapon.system.magazineCur).toBe(4);
    expect(weapon.system.jammedAmmo).toBe(6);
  });

  it("в магазине меньше, чем 2×RoF — портится не больше, чем есть", async () => {
    const weapon = weaponFor({ magazineCur: 1, magazineMax: 10, rof_single: 1 }, { id: "w1" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [97];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.magazineCur).toBe(0);
    expect(weapon.system.jammedAmmo).toBe(1);
  });

  it("карточка Клина упоминает количество испорченных патронов", async () => {
    const weapon = weaponFor({ magazineCur: 10, magazineMax: 10, rof_single: 1 }, { id: "w1" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [97];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Испорчено патронов");
    expect(card()).toContain("Trade (Weaponsmith)+10");
  });

  it("Reliable (Надёжность +1) — не клинит на rv=97, магазин не трогается", async () => {
    const weapon = weaponFor({
      magazineCur: 10, magazineMax: 10, rof_single: 1,
      weaponProps: [{ key: "reliable" }]
    }, { id: "w1" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [97, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.jammed).toBeFalsy();
    expect(weapon.system.magazineCur).toBe(9); // обычный расход 1 патрона на выстрел, не порча Клином
    expect(weapon.system.jammedAmmo ?? 0).toBe(0);
  });
});

describe("Восстановление испорченных Клином патронов — Trade(Weaponsmith)+10, вне боя (wdbc-x1nz.2.61)", () => {
  function grenadeLikeWeapon({ jammedAmmo = 5, magazineCur = 3, magazineMax = 10 } = {}) {
    const item = {
      name: "Лазган",
      system: { jammedAmmo, magazineCur, magazineMax },
      update: async patch => {
        for (const [path, value] of Object.entries(patch)) item.system[path.replace(/^system\./, "")] = value;
      }
    };
    return item;
  }
  function smith({ weaponsmithTotal = 60 } = {}) {
    return {
      name: "Оружейник",
      system: { groupSkills: { trade: [{ specialty: "Weaponsmith", total: weaponsmithTotal }] } }
    };
  }

  it("успех — все испорченные патроны возвращаются в магазин (не выше max)", async () => {
    const weapon = grenadeLikeWeapon({ jammedAmmo: 5, magazineCur: 3, magazineMax: 10 });
    const actor = smith({ weaponsmithTotal: 90 });
    captured.dice = [10]; // rv=10 против Порога 90+10=100 — успех

    await rollRestoreJammedAmmo(actor, weapon);

    expect(weapon.system.jammedAmmo).toBe(0);
    expect(weapon.system.magazineCur).toBe(8);
  });

  it("успех, но восстановление уткнулось в потолок магазина", async () => {
    const weapon = grenadeLikeWeapon({ jammedAmmo: 5, magazineCur: 8, magazineMax: 10 });
    const actor = smith({ weaponsmithTotal: 90 });
    captured.dice = [10];

    await rollRestoreJammedAmmo(actor, weapon);

    expect(weapon.system.magazineCur).toBe(10);
  });

  it("провал — патроны остаются испорченными", async () => {
    const weapon = grenadeLikeWeapon({ jammedAmmo: 5, magazineCur: 3, magazineMax: 10 });
    const actor = smith({ weaponsmithTotal: 10 });
    captured.dice = [50]; // rv=50 против Порога 10+10=20 — провал

    await rollRestoreJammedAmmo(actor, weapon);

    expect(weapon.system.jammedAmmo).toBe(5);
    expect(weapon.system.magazineCur).toBe(3);
  });

  it("нечего восстанавливать (jammedAmmo=0) — тест не катается вовсе", async () => {
    const weapon = grenadeLikeWeapon({ jammedAmmo: 0 });
    const actor = smith();
    captured.dice = [];

    await rollRestoreJammedAmmo(actor, weapon);

    expect(captured.chat.length).toBe(0);
  });
});
