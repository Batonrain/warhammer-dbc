// test/rules/gun-arm.test.mjs
//
// Дар «Рука-Пушка» (wdbc-spsd): по книге бесконечный боезапас получает ОДНО
// оружие — то, что вросло в предплечье. До этой правки проверка была «класс
// pistol|basic И у актора есть возможность», а возможность висит на персонаже
// — и патроны переставал тратить ЛЮБОЙ его пистолет, включая только что
// вынутый из рюкзака.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { ammoIsFree } from "../../module/rules/ammo-free.mjs";
import { gunArmAppliesTo, isGunArmWeapon, gunArmWeaponOf, GUN_ARM_CAPABILITY }
  from "../../module/rules/gun-arm.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const FLAG = "warhammer-dbc";
const saved = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

let seq = 0;
/** Оружие; grafted — несёт метку «вросло в предплечье». */
function weapon({ cls = "pistol", grafted = false, name = "Ствол" } = {}) {
  const id = `w${++seq}`;
  const flags = grafted ? { [FLAG]: { gunArmSource: "gift-1" } } : {};
  return { id, name, type: "weapon", system: { weaponClass: cls }, flags,
           getFlag: (scope, key) => flags[scope]?.[key] };
}

/** Персонаж с Даром (возможность) и набором оружия. */
function hero(items, withGift = true) {
  clearRuleSources();
  registerRuleSource("test", () => withGift
    ? [{ id: "gift", label: "Рука-Пушка", when: {},
         effects: [{ kind: "grantFlag", target: GUN_ARM_CAPABILITY }] }]
    : []);
  return { system: {}, items };
}

describe("Рука-Пушка действует только на вросшее оружие", () => {
  it("вросший пистолет патроны не тратит", () => {
    const grafted = weapon({ grafted: true });
    expect(ammoIsFree(grafted, hero([grafted]))).toBe(true);
  });

  it("ВТОРОЙ пистолет того же персонажа патроны тратит — вот в чём был баг", () => {
    const grafted = weapon({ grafted: true });
    const spare   = weapon({ name: "Запасной пистолет" });
    const actor   = hero([grafted, spare]);
    expect(ammoIsFree(grafted, actor)).toBe(true);
    expect(ammoIsFree(spare, actor)).toBe(false);
  });

  it("пока оружие не выбрано, Дар не действует ни на что", () => {
    // Намеренно строго: книга даёт бесконечные патроны конкретному стволу, и
    // «какому-нибудь» — это не то же самое.
    const gun = weapon();
    expect(ammoIsFree(gun, hero([gun]))).toBe(false);
  });

  it("вросшее рукопашное оружие не считается — Дар про пистолет и винтовку", () => {
    const blade = weapon({ cls: "melee", grafted: true, name: "Клинок" });
    expect(ammoIsFree(blade, hero([blade]))).toBe(false);
  });

  it("метка без самого Дара ничего не даёт", () => {
    const grafted = weapon({ grafted: true });
    expect(ammoIsFree(grafted, hero([grafted], false))).toBe(false);
  });

  it("винтовка (класс basic) тоже втягивается", () => {
    const rifle = weapon({ cls: "basic", grafted: true, name: "Винтовка" });
    expect(gunArmAppliesTo(rifle, hero([rifle]))).toBe(true);
  });
});

describe("метка вросшего оружия", () => {
  it("опознаётся и на документе с getFlag, и на голом объекте", () => {
    const g = weapon({ grafted: true });
    expect(isGunArmWeapon(g)).toBe(true);
    expect(isGunArmWeapon({ type: "weapon", flags: { [FLAG]: { gunArmSource: "x" } } })).toBe(true);
    expect(isGunArmWeapon(weapon())).toBe(false);
  });

  it("вросшее оружие актора находится одним запросом", () => {
    const grafted = weapon({ grafted: true, name: "Вросший" });
    const actor = hero([weapon(), grafted, weapon()]);
    expect(gunArmWeaponOf(actor)?.name).toBe("Вросший");
    expect(gunArmWeaponOf(hero([weapon()]))).toBeNull();
  });
});
