// test/documents/legion-property.test.mjs
//
// Пометка свойства Legion на оружии переделывает его профиль (Легион-вариант),
// а снятие — возвращает прежний. Прежние значения лежат во флаге предмета:
// без него откат был бы угадыванием, а повторная пометка удваивала бы прибавки.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerItem } from "../../module/documents/item.mjs";

const NS = "warhammer-dbc";

/** Предмет-заглушка: _preUpdate читает только type, system и флаг. */
function weaponLike(system = {}, flags = {}) {
  return Object.assign(Object.create(WarhammerItem.prototype), {
    type: "weapon",
    system: { weaponClass: "melee", weaponType: "chain", damage: "1d10+3",
              penetration: 2, weight: 5, availability: 1, special: "",
              weaponProps: [], ...system },
    flags,
    getFlag(ns, key) { return this.flags?.[ns]?.[key]; }
  });
}

/** super._preUpdate у заглушки Item отсутствует — подставляем пустой. */
Object.getPrototypeOf(WarhammerItem.prototype)._preUpdate = async () => undefined;
Object.getPrototypeOf(WarhammerItem.prototype)._preCreate = async () => undefined;

const run = async (item, changed) => {
  await WarhammerItem.prototype._preUpdate.call(item, changed, {}, null);
  return changed;
};

describe("свойство Legion на оружии", () => {
  it("добавление переделывает профиль и запоминает прежний", async () => {
    const item = weaponLike();
    const out = await run(item, { system: { weaponProps: [{ key: "legion" }] } });

    expect(out.system).toMatchObject({ weight: 10, damage: "1d10+4", penetration: 3, availability: 2 });
    expect(out.flags[NS].legionUpgrade.before)
      .toMatchObject({ weight: 5, damage: "1d10+3", penetration: 2, availability: 1 });
  });

  it("снятие возвращает профиль и убирает флаг", async () => {
    const item = weaponLike(
      { weaponProps: [{ key: "legion" }], weight: 10, damage: "1d10+4", penetration: 3, availability: 2 },
      { [NS]: { legionUpgrade: { before: { weight: 5, damage: "1d10+3", penetration: 2, availability: 1 } } } }
    );
    const out = await run(item, { system: { weaponProps: [] } });

    expect(out.system).toMatchObject({ weight: 5, damage: "1d10+3", penetration: 2, availability: 1 });
    expect(out.flags[NS]["-=legionUpgrade"]).toBeNull();
  });

  it("оружие, что и так легионное, при прочих правках не пересчитывается", async () => {
    const item = weaponLike({ weaponProps: [{ key: "legion" }] });
    const out = await run(item, { system: { weaponProps: [{ key: "legion" }, { key: "tearing" }] } });
    expect(out.system.weight).toBeUndefined();
  });

  it("повторная пометка не удваивает прибавки", async () => {
    const item = weaponLike({ weaponProps: [] },
      { [NS]: { legionUpgrade: { before: { weight: 5 } } } });
    const out = await run(item, { system: { weaponProps: [{ key: "legion" }] } });
    expect(out.system.weight).toBeUndefined();
  });

  it("роду оружия без Легион-варианта профиль не трогают", async () => {
    const item = weaponLike({ weaponType: "exotic" });
    const out = await run(item, { system: { weaponProps: [{ key: "legion" }] } });
    expect(out.system.weight).toBeUndefined();
    expect(out.flags).toBeUndefined();
  });

  it("примитивному дописывается памятка о модификациях", async () => {
    const item = weaponLike({ weaponType: "primitive", special: "Хват 2р." });
    const out = await run(item, { system: { weaponProps: [{ key: "legion" }] } });
    expect(out.system.special).toMatch(/Хват 2р\./);
    expect(out.system.special).toMatch(/Hardened и Mono/);
  });
});
