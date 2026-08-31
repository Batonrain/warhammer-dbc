// test/rules/hands.test.mjs
//
// Занятость рук (wdbc-3xqh + wdbc-3hxg). Книжные факты, проверяемые тут:
// Пистолет/Метательное — 1 рука, Винтовка/Тяжёлое/Пусковое — 2 (стр. 171),
// Independent/Wrist — 0 (исключение из правила «оружие занимает руку»),
// «Multiple Arms (X)» — X это ПОЛНОЕ число рук, не «доп.» (apps/cybernetic-
// excellence.mjs:BASE_ARMS), lostHands/lostArms срезают бюджет.

import { describe, it, expect } from "vitest";
import {
  currentMeleeGrip, weaponHandsRequired, getHeldHand, setHeldHand,
  baseHandsFromTraits, maxHands, handHeldItems, handsOccupied, canEquipInHands
} from "../../module/rules/hands.mjs";

const flags = {};
const item = (type, over = {}) => ({
  type, id: over.id ?? "it1", name: over.name ?? "Предмет",
  system: { equipped: true, weaponClass: "melee", grips: "", weaponProps: [], ...over.system },
  getFlag: (ns, key) => (flags[over.id ?? "it1"] || {})[key],
  setFlag: async (ns, key, val) => { (flags[over.id ?? "it1"] ||= {})[key] = val; return val; }
});
const weapon = over => item("weapon", over);
const trait  = (name, rating) => ({ type: "trait", name, system: { rating } });

const actor = (items = [], conditions = {}, sBonus = 0) =>
  ({ items, system: { conditions, characteristics: { s: { bonus: sBonus } } } });

describe("weaponHandsRequired — рукопашное (GRIPS)", () => {
  it("1р — 1 рука", () => {
    expect(weaponHandsRequired(weapon({ system: { grips: "1р" } }))).toBe(1);
  });
  it("2р — 2 руки", () => {
    expect(weaponHandsRequired(weapon({ system: { grips: "2р (1р)" } }))).toBe(2);
  });
  it("П (запястье) и Л (ладонь) — 0 рук, как книжные Independent/Wrist", () => {
    expect(weaponHandsRequired(weapon({ system: { grips: "П" } }))).toBe(0);
    expect(weaponHandsRequired(weapon({ system: { grips: "Л" } }))).toBe(0);
  });
  it("специальный хват (Об/Бл/Кл/Мх/Хв) без явного 1р/2р — 1 рука по умолчанию", () => {
    expect(weaponHandsRequired(weapon({ system: { grips: "Об" } }))).toBe(1);
  });
  it("выбранный в диалоге атаки хват (hudGrip) перекрывает список профиля", () => {
    const w = weapon({ id: "w1", system: { grips: "1р (2р)" } });
    w.setFlag("warhammer-dbc", "hudGrip", "2р");
    expect(weaponHandsRequired(w)).toBe(2);
  });
});

describe("weaponHandsRequired — стрелковое (корбук стр. 171)", () => {
  it("Пистолет — 1 рука", () => {
    expect(weaponHandsRequired(weapon({ system: { weaponClass: "pistol" } }))).toBe(1);
  });
  it("Метательное — 1 рука", () => {
    expect(weaponHandsRequired(weapon({ system: { weaponClass: "thrown" } }))).toBe(1);
  });
  it("Винтовка (basic) — 2 руки", () => {
    expect(weaponHandsRequired(weapon({ system: { weaponClass: "basic" } }))).toBe(2);
  });
  it("Тяжёлое — 2 руки", () => {
    expect(weaponHandsRequired(weapon({ system: { weaponClass: "heavy" } }))).toBe(2);
  });
  it("Стационарное (на технике) — 0 рук", () => {
    expect(weaponHandsRequired(weapon({ system: { weaponClass: "stationary" } }))).toBe(0);
  });
  it("Independent — 0 рук даже у Тяжёлого", () => {
    const w = weapon({ system: { weaponClass: "heavy", weaponProps: [{ key: "independent" }] } });
    expect(weaponHandsRequired(w)).toBe(0);
  });
  it("Wrist — 0 рук даже у Пускового", () => {
    const w = weapon({ system: { weaponClass: "launcher", weaponProps: [{ key: "wrist" }] } });
    expect(weaponHandsRequired(w)).toBe(0);
  });
});

describe("weaponHandsRequired — дальнобойный Хват и Отдача (wdbc-3hxg, стр. 166)", () => {
  it("sys.grips «1р» без Отдачи — 1 рука", () => {
    const w = weapon({ system: { weaponClass: "basic", grips: "1р" } });
    expect(weaponHandsRequired(w, actor())).toBe(1);
  });
  it("sys.grips «2р» — 2 руки, класс не важен", () => {
    const w = weapon({ system: { weaponClass: "pistol", grips: "2р" } });
    expect(weaponHandsRequired(w, actor())).toBe(2);
  });
  it("Отдача (X): S.b актора меньше X — «1р» недоступен, эффективно 2 руки", () => {
    const w = weapon({ system: {
      weaponClass: "basic", grips: "1р (2р)",
      weaponProps: [{ key: "recoil", rating: 4 }]
    } });
    expect(weaponHandsRequired(w, actor([], {}, 2))).toBe(2);
  });
  it("Отдача (X): S.b актора хватает — «1р» разрешён, 1 рука без штрафа", () => {
    const w = weapon({ system: {
      weaponClass: "basic", grips: "1р (2р)",
      weaponProps: [{ key: "recoil", rating: 4 }]
    } });
    expect(weaponHandsRequired(w, actor([], {}, 4))).toBe(1);
  });
  it("без sys.grips — падает обратно на таблицу по weaponClass", () => {
    const w = weapon({ system: { weaponClass: "heavy", grips: "" } });
    expect(weaponHandsRequired(w, actor())).toBe(2);
  });
});

describe("щиты", () => {
  it("щит (shieldAP не null) — 1 рука, класс не важен", () => {
    const shield = weapon({ system: { weaponClass: "melee", grips: "", shieldAP: 3 } });
    expect(weaponHandsRequired(shield)).toBe(1);
  });
});

describe("getHeldHand/setHeldHand — единый флаг поверх shieldHand/weaponHand", () => {
  it("новый флаг heldHand имеет приоритет", () => {
    const w = weapon({ id: "w2" });
    w.setFlag("warhammer-dbc", "shieldHand", "left");
    w.setFlag("warhammer-dbc", "heldHand", "right");
    expect(getHeldHand(w)).toBe("right");
  });
  it("без heldHand читает старый shieldHand", () => {
    const w = weapon({ id: "w3" });
    w.setFlag("warhammer-dbc", "shieldHand", "left");
    expect(getHeldHand(w)).toBe("left");
  });
  it("без heldHand читает старый weaponHand", () => {
    const w = weapon({ id: "w4" });
    w.setFlag("warhammer-dbc", "weaponHand", "right");
    expect(getHeldHand(w)).toBe("right");
  });
  it("setHeldHand пишет в heldHand", async () => {
    const w = weapon({ id: "w5" });
    await setHeldHand(w, "left");
    expect(getHeldHand(w)).toBe("left");
  });
});

describe("baseHandsFromTraits / maxHands", () => {
  it("без Трейта — обычные 2 руки", () => {
    expect(baseHandsFromTraits(actor())).toBe(2);
  });
  it("Multiple Arms (4) — рейтинг это ПОЛНОЕ число рук, не +4", () => {
    const a = actor([trait("Multiple Arms (4) / Множество Рук (4)", 4)]);
    expect(baseHandsFromTraits(a)).toBe(4);
    expect(maxHands(a)).toBe(4);
  });
  it("lostHandsCount/lostArmsCount срезают бюджет", () => {
    const a = actor([], { lostHandsCount: 1 });
    expect(maxHands(a)).toBe(1);
    const b = actor([], { lostHandsCount: 1, lostArmsCount: 1 });
    expect(maxHands(b)).toBe(0);
  });
  it("не уходит в минус", () => {
    const a = actor([], { lostHandsCount: 5 });
    expect(maxHands(a)).toBe(0);
  });
});

describe("handsOccupied / canEquipInHands", () => {
  it("пистолет + пистолет — обе руки заняты, третий не влезет", () => {
    const p1 = weapon({ id: "p1", system: { weaponClass: "pistol" } });
    const p2 = weapon({ id: "p2", system: { weaponClass: "pistol" } });
    const a = actor([p1, p2]);
    const occ = handsOccupied(a);
    expect(occ).toEqual({ max: 2, used: 2, free: 0, over: false, items: [p1, p2] });

    const p3 = weapon({ id: "p3", system: { weaponClass: "pistol" }, equippedNew: true });
    expect(canEquipInHands(a, p3)).toBe(false);
  });

  it("тяжёлое оружие (2 руки) исключает одновременный пистолет (wdbc-3xqh)", () => {
    const heavy = weapon({ id: "h1", system: { weaponClass: "heavy" } });
    const a = actor([heavy]);
    const pistol = weapon({ id: "p1", system: { weaponClass: "pistol" } });
    expect(canEquipInHands(a, pistol)).toBe(false);
  });

  it("щит + пистолет — влезают, оба по 1 руке", () => {
    const shield = weapon({ id: "s1", system: { weaponClass: "melee", shieldAP: 3 } });
    const a = actor([shield]);
    const pistol = weapon({ id: "p1", system: { weaponClass: "pistol" } });
    expect(canEquipInHands(a, pistol)).toBe(true);
  });

  it("exclude не считает сам проверяемый предмет как уже надетый", () => {
    const heavy = weapon({ id: "h1", system: { weaponClass: "heavy" } });
    const a = actor([heavy]);
    // Тот же предмет, что уже занимает 2 руки — переоценка не должна давать false.
    expect(canEquipInHands(a, heavy)).toBe(true);
  });

  it("Independent — всегда влезает, руки не считаются", () => {
    const heavy = weapon({ id: "h1", system: { weaponClass: "heavy" } });
    const a = actor([heavy]);
    const indep = weapon({ id: "i1", system: { weaponClass: "basic", weaponProps: [{ key: "independent" }] } });
    expect(canEquipInHands(a, indep)).toBe(true);
  });

  it("Multiple Arms(4) — влезают тяжёлое оружие и щит одновременно", () => {
    const a = actor([trait("Multiple Arms (4) / Многорукий (4)", 4)]);
    const heavy = weapon({ id: "h1", system: { weaponClass: "heavy" } });
    a.items.push(heavy);
    const shield = weapon({ id: "s1", system: { weaponClass: "melee", shieldAP: 3 } });
    expect(canEquipInHands(a, shield)).toBe(true);
  });
});

describe("handHeldItems", () => {
  it("не считает неэкипированные и broня/снаряжение без рук", () => {
    const equippedPistol = weapon({ id: "p1", system: { weaponClass: "pistol", equipped: true } });
    const unequipped = weapon({ id: "p2", system: { weaponClass: "pistol", equipped: false } });
    const armor = item("armor", { id: "a1", system: { equipped: true } });
    const a = actor([equippedPistol, unequipped, armor]);
    expect(handHeldItems(a)).toEqual([equippedPistol]);
  });
});
