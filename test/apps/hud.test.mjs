// test/apps/hud.test.mjs
//
// wdbc-jpls: боевой HUD — единственное окно, которое игрок держит открытым
// весь бой — должен показывать ОД/Реакции и гейтить кнопку ОГОНЬ/УДАР по тому
// же предикату, что вкладка БОЙ листа (wdbc-qjnk, apSpendGate). Проверяются
// только данные (hudData) — сама отрисовка/клики нуждаются в живом Foundry,
// см. план теста тикета («живая проверка владельцем»).

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { hudData } from "../../module/apps/hud.mjs";
import { movementMenuItems } from "../../module/combat/movement-actions.mjs";

/** Актор HUD-типа "character" — тип обязателен: hasActionEconomy смотрит именно на него. */
function hudActor({ type = "character", items = [], ...system } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return {
    id: "actor-1", name: "Подставной", type,
    system: {
      characteristics: { ws: { total: 45, bonus: 4 }, ag: { total: 35, bonus: 3 }, t: { total: 40, bonus: 4 } },
      ...system
    },
    items: list
  };
}

/** Экипированное оружие в правой руке — минимум полей, которые читает hudData. */
function weaponItem({ id = "w1", weaponClass = "basic", hand = "right" } = {}) {
  return {
    id, name: "Тестовое оружие", type: "weapon",
    system: { weaponClass, equipped: true, magazineCur: 10, magazineMax: 10 },
    getFlag: (scope, key) => (key === "weaponHand" ? hand : undefined)
  };
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("hudData: секция ОД/Реакции (wdbc-jpls)", () => {
  it("несущий экономику действий актор — ap/reactions из system, encounterActive по game.combat", () => {
    const actor = hudActor({
      actionPoints: { value: 1, max: 2 },
      reactions: { value: 0, max: 1 }
    });
    const data = hudData(actor);
    expect(data.actionEconomy).toEqual({
      ap: { value: 1, max: 2 },
      reactions: { value: 0, max: 1 },
      encounterActive: false
    });
  });

  it("в активном Encounter encounterActive: true", () => {
    globalThis.game.combat = { started: true };
    const actor = hudActor({ actionPoints: { value: 2, max: 2 }, reactions: { value: 1, max: 1 } });
    expect(hudData(actor).actionEconomy.encounterActive).toBe(true);
  });

  it("Орда/техника — actionEconomy отсутствует (не несёт экономику действий)", () => {
    const actor = hudActor({ type: "horde" });
    expect(hudData(actor).actionEconomy).toBeNull();
  });
});

describe("hudData: гейт кнопки ОГОНЬ/УДАР (wdbc-jpls, тот же предикат, что wdbc-qjnk)", () => {
  it("рукопашное оружие при 0 ОД в бою — fireGate.disabled с причиной", () => {
    globalThis.game.combat = { started: true };
    const weapon = weaponItem({ weaponClass: "melee" });
    const actor = hudActor({ items: [weapon], actionPoints: { value: 0, max: 2 } });
    const hand = hudData(actor).hands.find(h => h.slot === "main");
    expect(hand.fireGate.disabled).toBe(true);
    expect(hand.fireGate.title).toContain("ОД");
  });

  it("рукопашное оружие при достаточных ОД — не гейтится", () => {
    globalThis.game.combat = { started: true };
    const weapon = weaponItem({ weaponClass: "melee" });
    const actor = hudActor({ items: [weapon], actionPoints: { value: 2, max: 2 } });
    const hand = hudData(actor).hands.find(h => h.slot === "main");
    expect(hand.fireGate.disabled).toBe(false);
  });

  it("дальнобойное оружие при 0 ОД — не гейтится (стрельба ОД не тратит)", () => {
    globalThis.game.combat = { started: true };
    const weapon = weaponItem({ weaponClass: "basic" });
    const actor = hudActor({ items: [weapon], actionPoints: { value: 0, max: 2 } });
    const hand = hudData(actor).hands.find(h => h.slot === "main");
    expect(hand.fireGate.disabled).toBe(false);
  });

  it("вне Encounter — рукопашное оружие не гейтится, даже при 0 ОД", () => {
    const weapon = weaponItem({ weaponClass: "melee" });
    const actor = hudActor({ items: [weapon], actionPoints: { value: 0, max: 2 } });
    const hand = hudData(actor).hands.find(h => h.slot === "main");
    expect(hand.fireGate.disabled).toBe(false);
  });
});

describe("hudData: вкладка «Движение» (wdbc-zdu4) — те же пункты, что movementMenuItems, без функций action()", () => {
  it("список пунктов совпадает по ключам с movementMenuItems(actor), action не сериализуется в данные", () => {
    const actor = hudActor();
    const data = hudData(actor);
    const expected = movementMenuItems(actor).map(i => i.key);
    expect(data.movement.map(m => m.key)).toEqual(expected);
    for (const m of data.movement) {
      expect(m).not.toHaveProperty("action");
      expect(typeof m.label).toBe("string");
    }
  });

  it("в активном Encounter появляются боевые пункты (halfmove и т.п.)", () => {
    globalThis.game.combat = { started: true };
    const data = hudData(hudActor());
    expect(data.movement.map(m => m.key)).toContain("halfmove");
  });
});

describe("hudData: вкладка «Химия» (wdbc-zdu4) — препараты актора для быстрого применения", () => {
  function drugItem({ id = "d1", name = "Стимм", quantity = 1, active = false, roundsRemaining = 0 } = {}) {
    return {
      id, name, type: "drug",
      system: {
        quantity, effect: "Тестовый эффект",
        activeEffect: { isActive: active, roundsRemaining }
      }
    };
  }

  it("препарат с количеством > 0 попадает в список, с полями для кнопки «Применить»", () => {
    const actor = hudActor({ items: [drugItem({ id: "d1", name: "Стимм", quantity: 2 })] });
    const data = hudData(actor);
    expect(data.chemistry).toHaveLength(1);
    expect(data.chemistry[0]).toMatchObject({ id: "d1", name: "Стимм", quantity: 2, active: false });
  });

  it("препарат с нулевым количеством, но активным эффектом — остаётся в списке (виден таймер)", () => {
    const actor = hudActor({ items: [drugItem({ id: "d2", quantity: 0, active: true, roundsRemaining: 4 })] });
    const data = hudData(actor);
    expect(data.chemistry).toHaveLength(1);
    expect(data.chemistry[0]).toMatchObject({ active: true, roundsRemaining: 4 });
  });

  it("препарат с нулевым количеством и без активного эффекта — не показывается (закончился)", () => {
    const actor = hudActor({ items: [drugItem({ id: "d3", quantity: 0, active: false })] });
    expect(hudData(actor).chemistry).toHaveLength(0);
  });

  it("предметы других типов (оружие, снаряжение) в список Химии не попадают", () => {
    const actor = hudActor({ items: [weaponItem(), drugItem({ id: "d4" })] });
    const ids = hudData(actor).chemistry.map(d => d.id);
    expect(ids).toEqual(["d4"]);
  });
});

describe("hudData: наручное/наплечное оружие (Independent/Wrist) — регрессия pr-reviewer перед пушем wdbc-mzno", () => {
  it("Болтшторм-перчатка (wrist, 0 занятости руки) остаётся в слоте руки с магазином, не в лотке «Безоружный бой»", () => {
    const gauntlet = {
      id: "gauntlet1", name: "Болтшторм Перчатка", type: "weapon",
      system: {
        weaponClass: "pistol", equipped: true,
        magazineCur: 48, magazineMax: 48,
        weaponProps: [{ key: "wrist" }]
      },
      getFlag: (scope, key) => (key === "weaponHand" ? "right" : undefined)
    };
    const actor = hudActor({ items: [gauntlet] });
    const data = hudData(actor);
    const main = data.hands.find(h => h.slot === "main");
    expect(main.empty).toBe(false);
    expect(main.id).toBe("gauntlet1");
    expect(main.clipMax).toBe(48);
    expect(data.zeroHand.find(z => z.id === "gauntlet1")).toBeUndefined();
  });

  it("интегральная атака с нулевым хватом (например, укус) — в лотке «Безоружный бой», не в слоте руки", () => {
    const bite = {
      id: "bite1", name: "Укус", type: "weapon",
      system: { weaponClass: "melee", equipped: true, grips: "Зуб", weaponProps: [] },
      getFlag: (scope, key) => (key === "integralAttack" ? true : undefined)
    };
    const actor = hudActor({ items: [bite] });
    const data = hudData(actor);
    expect(data.hands.find(h => h.slot === "main").empty).toBe(true);
    expect(data.zeroHand.map(z => z.id)).toContain("bite1");
  });
});
