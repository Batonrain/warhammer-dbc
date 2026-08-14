// test/apps/effects.test.mjs
//
// isItemActive решает, действуют ли эффекты предмета: именно им выставляется
// `disabled` при переносе механики (migrations/item-effects.mjs) и при каждой
// смене состояния (syncItemEffectsDisabled). У модификаций к «установлен и
// включён» добавляется надетость носителя: старый расчёт модификаций брони
// смотрел на неё (getInstalledArmorMods в combat/armor-mods.mjs), и механика,
// уехавшая в ActiveEffect, обязана считать так же — иначе Керамит из рюкзака
// даёт AP наравне с надетым.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { isItemActive } from "../../module/apps/effects.mjs";

/** Актор с предметами: модификации нужен доступ к носителю через parent. */
function actorWith(...items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { items: list };
  for (const item of list) item.parent = actor;
  return actor;
}

const armor = (id, equipped) => ({ id, type: "armor", system: { equipped } });
const mod   = (installedOn, extra = {}) =>
  ({ id: "mod", type: "armorMod", system: { installedOn, ...extra } });

describe("isItemActive: модификация и её носитель", () => {
  it("установлена на надетую броню — активна", () => {
    const m = mod("armor-1");
    actorWith(armor("armor-1", true), m);

    expect(isItemActive(m)).toBe(true);
  });

  it("носитель снят — неактивна", () => {
    const m = mod("armor-1");
    actorWith(armor("armor-1", false), m);

    expect(isItemActive(m)).toBe(false);
  });

  it("включаемая система на надетой броне без включения неактивна", () => {
    const m = mod("armor-1", { activatable: true, active: false });
    actorWith(armor("armor-1", true), m);

    expect(isItemActive(m)).toBe(false);
  });

  it("не установлена — неактивна", () => {
    expect(isItemActive(mod(""))).toBe(false);
  });

  it("носителя не найти (предмет пака, битая ссылка) — судим по своим полям", () => {
    expect(isItemActive(mod("armor-1"))).toBe(true);
  });
});
