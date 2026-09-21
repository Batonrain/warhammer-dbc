// test/combat/reload-ap-cost.test.mjs
//
// Стр. 35, wdbc-x1nz.2.54: «Перезарядка: Действие: Зависит от оружия; Тип:
// Физическое.» system.reload («½»/целое N/«–»/«†»/«N×M»/«¼») раньше нигде не
// читался — перезарядка была полностью бесплатной по ОД. Теперь: «½» → 1 ОД
// (Полудействие), целое N → 2N ОД (N Полных действий за один Ход, не хватило
// бюджета — блокируется целиком). Прочие форматы (почти исключительно у
// оружия техники, либо сноска-«†» без числа) остаются бесплатными — честный
// остаток, не гадаем число за книгу.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { reloadApCost, _reloadWeapon } from "../../module/combat/reload.mjs";
import { weaponFor, actorFor } from "../support/combat-fixtures.mjs";

/** Боеприпас с update() — combat-fixtures.mjs::ammoFor его не даёт, а тут нужен. */
function ammoFor({ quantity = 1, weaponTypes = ["any"] } = {}, { id = "ammo-1", name = "Боеприпас" } = {}) {
  const item = {
    id, name, type: "ammo", system: { properties: [], quantity, weaponTypes },
    getFlag: () => undefined,
    async update(data) { for (const [path, value] of Object.entries(data)) item.system[path.replace(/^system\./, "")] = value; }
  };
  return item;
}

describe("reloadApCost: разбор system.reload", () => {
  it('"½" — 1 ОД (Полудействие)', () => expect(reloadApCost("½")).toBe(1));
  it('"1" — 2 ОД (1 Полное действие)', () => expect(reloadApCost("1")).toBe(2));
  it('"2" — 4 ОД (2 Полных действия)', () => expect(reloadApCost("2")).toBe(4));
  it('"10" — 20 ОД', () => expect(reloadApCost("10")).toBe(20));
  it('"–" (не перезаряжается) — бесплатно', () => expect(reloadApCost("–")).toBe(0));
  it("пустая строка — бесплатно", () => expect(reloadApCost("")).toBe(0));
  it('"†" (сноска без числа, экзотика) — бесплатно', () => expect(reloadApCost("†")).toBe(0));
  it('"4×4" (почти всегда техника) — бесплатно', () => expect(reloadApCost("4×4")).toBe(0));
  it('"¼" — бесплатно', () => expect(reloadApCost("¼")).toBe(0));
  it("undefined/null — бесплатно", () => {
    expect(reloadApCost(undefined)).toBe(0);
    expect(reloadApCost(null)).toBe(0);
  });
});

function combatCharacter(items, { ap = 2 } = {}) {
  const a = actorFor({ items });
  a.type = "character";
  a.system.actionPoints = { value: ap, max: 2 };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
  };
  return a;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = { started: true }; });
afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("_reloadWeapon: расход ОД по system.reload (wdbc-x1nz.2.54)", () => {
  it('reload="1" — тратит 2 ОД (1 Полное действие), перезаряжает магазин', async () => {
    const weapon = weaponFor({ magazineCur: 0, magazineMax: 24, reload: "1" }, { id: "w1" });
    const ammo   = ammoFor({ quantity: 3, weaponTypes: ["any"] });
    const actor  = combatCharacter([weapon, ammo], { ap: 2 });

    await _reloadWeapon(actor, weapon);

    expect(weapon.system.magazineCur).toBe(24);
    expect(actor.system.actionPoints.value).toBe(0);
    expect(captured.chat).toHaveLength(1);
  });

  it('reload="½" — тратит только 1 ОД (Полудействие)', async () => {
    const weapon = weaponFor({ magazineCur: 0, magazineMax: 6, reload: "½" }, { id: "w1" });
    const ammo   = ammoFor({ quantity: 3, weaponTypes: ["any"] });
    const actor  = combatCharacter([weapon, ammo], { ap: 2 });

    await _reloadWeapon(actor, weapon);

    expect(weapon.system.magazineCur).toBe(6);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  it('не хватает ОД на "2" (нужно 4) — блокируется целиком, магазин не трогает', async () => {
    const weapon = weaponFor({ magazineCur: 0, magazineMax: 24, reload: "2" }, { id: "w1" });
    const ammo   = ammoFor({ quantity: 3, weaponTypes: ["any"] });
    const actor  = combatCharacter([weapon, ammo], { ap: 2 });

    await _reloadWeapon(actor, weapon);

    expect(weapon.system.magazineCur).toBe(0);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(captured.warnings.length).toBeGreaterThan(0);
    expect(captured.chat).toHaveLength(0);
  });

  it('reload="–" — бесплатно, как раньше', async () => {
    const weapon = weaponFor({ magazineCur: 0, magazineMax: 24, reload: "–" }, { id: "w1" });
    const ammo   = ammoFor({ quantity: 3, weaponTypes: ["any"] });
    const actor  = combatCharacter([weapon, ammo], { ap: 2 });

    await _reloadWeapon(actor, weapon);

    expect(weapon.system.magazineCur).toBe(24);
    expect(actor.system.actionPoints.value).toBe(2);
  });

  it("вне боя — бесплатно независимо от reload", async () => {
    globalThis.game.combat = undefined;
    const weapon = weaponFor({ magazineCur: 0, magazineMax: 24, reload: "2" }, { id: "w1" });
    const ammo   = ammoFor({ quantity: 3, weaponTypes: ["any"] });
    const actor  = combatCharacter([weapon, ammo], { ap: 2 });

    await _reloadWeapon(actor, weapon);

    expect(weapon.system.magazineCur).toBe(24);
    expect(actor.system.actionPoints.value).toBe(2);
  });

  it("отмена выбора боеприпаса — ОД не тратятся вовсе", async () => {
    const weapon = weaponFor({ magazineCur: 0, magazineMax: 24, reload: "1" }, { id: "w1" });
    const ammoA  = ammoFor({ quantity: 3, weaponTypes: ["any"] }, { id: "ammo-a" });
    const ammoB  = ammoFor({ quantity: 3, weaponTypes: ["any"] }, { id: "ammo-b" });
    const actor  = combatCharacter([weapon, ammoA, ammoB], { ap: 2 });
    globalThis.Dialog = class {
      constructor(opts) { this.opts = opts; }
      render() { this.opts.buttons.cancel.callback(); }
    };

    await _reloadWeapon(actor, weapon);

    expect(actor.system.actionPoints.value).toBe(2);
    expect(weapon.system.magazineCur).toBe(0);
  });
});
