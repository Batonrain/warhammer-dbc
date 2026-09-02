// test/apps/rig-manager-data.test.mjs
//
// Данные окна Разгрузки (rigManagerData): жалоба игрока была «нельзя
// заменить слот разгрузки» — вещь, уже лежащую в одном слоте (или в чужой
// разгрузке), нельзя было переложить в другой слот одним выбором, только
// через «Убрать» и заново «Положить». Список кандидатов слота отсекал такие
// вещи фильтром «нет валидной локации», хотя _assign переносит предмет
// между локациями атомарно (ключ флага — id предмета, не слот-источник).

import { describe, it, expect } from "vitest";
import { rigManagerData } from "../../module/constants/rig.mjs";

/** Предмет без Foundry: rigManagerData читает id/name/type/system. */
function gearItem(id, name, overrides = {}) {
  return { id, name, type: "gear", system: { weight: 0, ...overrides } };
}

function beltItem(id = "belt1") {
  return {
    id, name: "Belt / Ремень", type: "gear",
    system: {
      isRig: true, weight: 1,
      rig: {
        comfort: "normal", backSlot: false,
        slots: [
          { size: "1x1", count: 1, note: "спереди" },
          { size: "1x1", count: 1, note: "спереди" }
        ],
        magLocks: []
      }
    },
    flags: {}
  };
}

/** Актор без Foundry: нужны .items (с .filter/.get), .getFlag, .name. */
function actor(items, stow = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return {
    name: "Испытуемый",
    items: list,
    getFlag: (_scope, key) => (key === "stowage" ? stow : undefined)
  };
}

describe("rigManagerData — перекладка между слотами", () => {
  it("вещь из занятого слота предлагается кандидатом в другой слот", () => {
    const belt = beltItem();
    const knife = gearItem("knife1", "Нож");
    const a = actor([belt, knife], { knife1: "belt1:s:0:0" }); // нож уже в первом слоте

    const data = rigManagerData(a);
    const [slot0, slot1] = data.rigs[0].slots;

    expect(slot0.item?.id).toBe("knife1");
    // Второй слот пуст, но нож (занявший ПЕРВЫЙ слот) должен быть в его опциях —
    // переложить одним выбором, не убирая заранее.
    expect(slot1.opts.map(o => o.id)).toContain("knife1");
  });

  it("собственный слот вещи не предлагает её как замену самой себе", () => {
    const belt = beltItem();
    const knife = gearItem("knife1", "Нож");
    const a = actor([belt, knife], { knife1: "belt1:s:0:0" });

    const data = rigManagerData(a);
    const [slot0] = data.rigs[0].slots;

    expect(slot0.opts.map(o => o.id)).not.toContain("knife1");
  });

  it("вещь из рюкзака другой разгрузки тоже предлагается слоту, если влезает", () => {
    const belt = beltItem();
    const backpack = {
      id: "bp1", name: "Backpack / Рюкзак", type: "gear",
      system: { isRig: true, weight: 1, rig: { comfort: "normal", backSlot: true, slots: [], magLocks: [] } },
      flags: {}
    };
    const knife = gearItem("knife1", "Нож");
    const a = actor([belt, backpack, knife], { knife1: "bp:bp1" }); // нож лежит в рюкзаке

    const data = rigManagerData(a);
    const beltView = data.rigs.find(r => r.id === "belt1");
    expect(beltView.slots[0].opts.map(o => o.id)).toContain("knife1");
  });

  it("после переклада вещь по-прежнему не числится «не размещённой»", () => {
    // Пока вещь стоит в валидном слоте (даже не своём), список «не размещено»
    // должен оставаться прежним — переклад не должен ронять её как забытую.
    const belt = beltItem();
    const knife = gearItem("knife1", "Нож");
    const a = actor([belt, knife], { knife1: "belt1:s:0:0" });

    const data = rigManagerData(a);
    expect(data.unassigned.map(i => i.id)).not.toContain("knife1");
  });

  it("неразмещённая вещь остаётся кандидатом слота, как раньше", () => {
    const belt = beltItem();
    const knife = gearItem("knife1", "Нож");
    const a = actor([belt, knife]); // ничего не размещено

    const data = rigManagerData(a);
    expect(data.rigs[0].slots[0].opts.map(o => o.id)).toContain("knife1");
    expect(data.unassigned.map(i => i.id)).toContain("knife1");
  });
});

describe("rigManagerData — предмет, надетый на другой (wornOn)", () => {
  it("визор, надетый на шлем, не числится «не размещённым» и не занимает слот", () => {
    const belt = beltItem();
    const helmet = { id: "helm1", name: "Шлем", type: "armor", system: { weight: 2, equipped: true } };
    const visor = gearItem("visor1", "Визор", { wornOn: "helm1" });
    const a = actor([belt, helmet, visor]);

    const data = rigManagerData(a);
    expect(data.unassigned.map(i => i.id)).not.toContain("visor1");
    expect(data.rigs[0].slots[0].opts.map(o => o.id)).not.toContain("visor1");
  });

  it("wornOn на несуществующий/неподходящий id не освобождает от слота (вещь остаётся обычной)", () => {
    const belt = beltItem();
    const visor = gearItem("visor1", "Визор", { wornOn: "nope" });
    const a = actor([belt, visor]);

    const data = rigManagerData(a);
    expect(data.unassigned.map(i => i.id)).toContain("visor1");
  });
});

// Fully Armed / Во Всеоружии (wdbc-1rno): не-тяжёлое стрелковое оружие с
// Custom Grip весит вдвое меньше (окр.▼) в расчёте Разгрузки — только у
// актора, владеющего самой Чертой. См. module/combat/fully-armed.mjs.
describe("rigManagerData — вес оружия с Fully Armed (wdbc-1rno)", () => {
  function pistolWithGrip(weight = 1.2) {
    return { id: "gun1", name: "Пистолет", type: "weapon", system: { weaponClass: "pistol", weight } };
  }
  function customGripMod() {
    return { id: "mod1", name: "Personal Grip / Персональный Хват", type: "weaponMod", system: { installedOn: "gun1" } };
  }
  function fullyArmedTrait() {
    return { id: "trait1", name: "Fully Armed / Во Всеоружии", type: "trait", system: {} };
  }

  it("Черта + мод — вес оружия в слоте показан вдвое меньше", () => {
    const belt = beltItem();
    const gun = pistolWithGrip(1.2);
    const a = actor([belt, gun, customGripMod(), fullyArmedTrait()], { gun1: "belt1:s:0:0" });

    const data = rigManagerData(a);
    expect(data.rigs[0].slots[0].item.weight).toBeCloseTo(0.6, 5);
  });

  it("нет Черты — вес оружия обычный, несмотря на мод", () => {
    const belt = beltItem();
    const gun = pistolWithGrip(1.2);
    const a = actor([belt, gun, customGripMod()], { gun1: "belt1:s:0:0" });

    const data = rigManagerData(a);
    expect(data.rigs[0].slots[0].item.weight).toBe(1.2);
  });

  it("тяжёлое оружие с модом и Чертой — вес обычный", () => {
    const belt = beltItem();
    const gun = { id: "gun1", name: "Тяжёлый болтер", type: "weapon", system: { weaponClass: "heavy", weight: 20 } };
    const a = actor([belt, gun, customGripMod(), fullyArmedTrait()], { gun1: "belt1:s:0:0" });

    const data = rigManagerData(a);
    expect(data.rigs[0].slots[0].item.weight).toBe(20);
  });
});
