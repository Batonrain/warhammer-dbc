// test/rules/hands.test.mjs
//
// Занятость рук (wdbc-3xqh + wdbc-3hxg). Книжные факты, проверяемые тут:
// Пистолет/Метательное — 1 рука, Винтовка/Тяжёлое/Пусковое — 2 (стр. 171),
// Independent/Wrist — 0 (исключение из правила «оружие занимает руку»),
// «Multiple Arms (X)» — X это ПОЛНОЕ число рук, не «доп.» (apps/cybernetic-
// excellence.mjs:BASE_ARMS), lostHands/lostArms срезают бюджет.

import "../support/foundry-stub.mjs";

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

// Предмет-носитель возможности: Механика с записью kind:"capability" — тем же
// способом возможности выдают Таланты в паке (Commando, Double Grip).
const withCapability = (name, capabilityKey) => ({
  type: "talent", name, system: {}, getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [
    { id: "g1", operator: "AND", entries: [{ id: "e1", kind: "capability", capabilityKey, label: "" }] }
  ] } }
});

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
  it("специальный хват (Об/Бл/Кл/Мх) без явного 1р/2р — 1 рука по умолчанию", () => {
    expect(weaponHandsRequired(weapon({ system: { grips: "Об" } }))).toBe(1);
  });
  it("части тела (Хв/Зуб/Кист/Щуп) — 0 рук: не удерживаемое снаряжение, а хвост/зуб/кулак/щупальце", () => {
    expect(weaponHandsRequired(weapon({ system: { grips: "Хв" } }))).toBe(0);
    expect(weaponHandsRequired(weapon({ system: { grips: "Зуб" } }))).toBe(0);
    expect(weaponHandsRequired(weapon({ system: { grips: "Кист" } }))).toBe(0);
    expect(weaponHandsRequired(weapon({ system: { grips: "Щуп" } }))).toBe(0);
  });
  it("5 Даров Одержимого (Клинок/Когти/Коса/Хлыст) — «1р» по-прежнему съедает 1 руку, не 0", () => {
    expect(weaponHandsRequired(weapon({ system: { grips: "1р" } }))).toBe(1);
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
  // wdbc-f7iw / wdbc-6tzk: Откатная Перчатка, Подавители Отдачи и Дар
  // «Рука-Пушка» разрешают держать винтовку одной рукой. Бюджет рук обязан
  // знать про этот хват так же, как окно атаки, иначе лист не даст взять
  // оружие, которым по правилам можно стрелять с одной руки.
  it("Винтовка без возможности — 2 руки, даже если игрок выбрал «1р»", () => {
    const w = weapon({ system: { weaponClass: "basic", grips: "2р" } });
    expect(weaponHandsRequired(w, actor())).toBe(2);
  });
  it("Винтовка + weapon.oneHandedRifle — «1р» становится доступен, 1 рука", () => {
    const w = weapon({ system: { weaponClass: "basic", grips: "2р" } });
    setHeldHand(w, null);
    w.setFlag("warhammer-dbc", "hudGrip", "1р");
    const a = actor([withCapability("Откатная Перчатка", "weapon.oneHandedRifle")]);
    expect(weaponHandsRequired(w, a)).toBe(1);
  });
  it("Возможность не трогает Тяжёлое — книга даёт её только винтовке", () => {
    const w = weapon({ id: "hv", system: { weaponClass: "heavy", grips: "2р" } });
    const a = actor([withCapability("Откатная Перчатка", "weapon.oneHandedRifle")]);
    expect(weaponHandsRequired(w, a)).toBe(2);
  });
  it("weapon.ignoreRecoil снимает гейт Отдачи по S.b", () => {
    const sys = { weaponClass: "basic", grips: "1р (2р)", weaponProps: [{ key: "recoil", rating: 4 }] };
    const weak = weapon({ id: "r1", system: sys });
    expect(weaponHandsRequired(weak, actor([], {}, 2))).toBe(2);

    const glove = weapon({ id: "r2", system: sys });
    const a = actor([withCapability("Откатная Перчатка (Good.Q)", "weapon.ignoreRecoil")], {}, 2);
    expect(weaponHandsRequired(glove, a)).toBe(1);
  });
  it("Стационарное с заполненным Хватом «2р» — всё равно 0 рук (wdbc-7utm)", () => {
    // «2р» у станкового говорит, КАК за него берутся, а не сколько рук оно
    // отнимает: оружие стоит на станке. Бэкфилл поля grips не должен был
    // превратить турель в двуручное.
    const w = weapon({ system: { weaponClass: "stationary", grips: "2р" } });
    expect(weaponHandsRequired(w, actor())).toBe(0);
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

describe("Рука Смерти (wdbc-hftn, стр. 46) — всегда 1 рука/хват «1р»", () => {
  it("мелейное двуручное, слитое — 1 рука вместо 2", async () => {
    const w = weapon({ id: "hod1", system: { weaponClass: "melee", grips: "2р" } });
    await w.setFlag("warhammer-dbc", "handOfDeathSource", "mut1");
    expect(weaponHandsRequired(w)).toBe(1);
    expect(currentMeleeGrip(w)).toBe("1р");
  });
  it("игнорирует сохранённый hudGrip (Об/Кл/…) на слитом оружии", async () => {
    const w = weapon({ id: "hod2", system: { weaponClass: "melee", grips: "Об" } });
    await w.setFlag("warhammer-dbc", "hudGrip", "Об");
    await w.setFlag("warhammer-dbc", "handOfDeathSource", "mut1");
    expect(currentMeleeGrip(w)).toBe("1р");
    expect(weaponHandsRequired(w)).toBe(1);
  });
  it("дальнобойное двуручное (basic), слитое — 1 рука вместо 2, Отдача не мешает", async () => {
    const w = weapon({ id: "hod3", system: {
      weaponClass: "basic", grips: "2р",
      weaponProps: [{ key: "recoil", rating: 8 }]
    } });
    await w.setFlag("warhammer-dbc", "handOfDeathSource", "mut1");
    expect(weaponHandsRequired(w, actor([], {}, 0))).toBe(1);
  });
  it("не слитое оружие — правило не применяется", () => {
    const w = weapon({ id: "hod4", system: { weaponClass: "melee", grips: "2р" } });
    expect(weaponHandsRequired(w)).toBe(2);
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


// ── wdbc-9dg8: свойства «руку не занимает» должны работать везде ────────────
//
// Три случая одной природы: свойство «руки не занимает» есть, а рука всё равно
// числится занятой.
//   C — у рукопашного эти свойства не читались вовсе (проверка стояла ПОСЛЕ
//       ветки melee): Поцелуй Арлекина надет на запястье и съедал руку;
//   B — свойство, ПРИШЕДШЕЕ ОТ МОДИФИКАЦИИ (Наплечное/Наручное), не читалось
//       ни у кого: hands.mjs был единственным потребителем свойств, который
//       смотрел мимо модификаций;
//   A — пальцевое оружие (перстень на палец) по книге не занимает руки вообще,
//       а система считала его обычным пистолетом.

/** Модификация оружия, дарующая свойства (тот же вид, что в паке weapon-mods). */
const propMod = (installedOn, addProps, removeProps = []) => ({
  type: "weaponMod", id: `mod-${installedOn}`, name: "Модификация",
  system: { installedOn, effects: { addProps, removeProps } }
});

/** Актор с предметами, у которых проставлен parent — как у настоящих документов. */
function actorOwning(items, conditions = {}, sBonus = 0) {
  const a = actor(items, conditions, sBonus);
  for (const i of items) i.parent = a;
  return a;
}

describe("weaponHandsRequired — рукопашное тоже читает Independent/Wrist (wdbc-9dg8 C)", () => {
  it("Поцелуй Арлекина: рукопашное с «1р» и свойством Запястье — 0 рук", () => {
    const kiss = weapon({ id: "kiss", system: {
      weaponClass: "melee", grips: "1р", weaponProps: [{ key: "wrist" }]
    } });
    expect(weaponHandsRequired(kiss)).toBe(0);
  });

  it("рукопашное с Independent — тоже 0 рук", () => {
    const w = weapon({ id: "ind", system: {
      weaponClass: "melee", grips: "1р", weaponProps: [{ key: "independent" }] } });
    expect(weaponHandsRequired(w)).toBe(0);
  });

  it("обычное рукопашное «1р» без таких свойств — по-прежнему 1 рука", () => {
    expect(weaponHandsRequired(weapon({ id: "sw", system: { weaponClass: "melee", grips: "1р" } }))).toBe(1);
  });
});

describe("weaponHandsRequired — свойства от модификаций (wdbc-9dg8 B)", () => {
  it("Наплечное на болтере (мод даёт independent) — 0 рук", () => {
    const bolter = weapon({ id: "b1", system: { weaponClass: "basic", grips: "2р" } });
    const a = actorOwning([bolter, propMod("b1", [{ key: "independent" }])]);
    expect(weaponHandsRequired(bolter, a)).toBe(0);
  });

  it("Наручное (мод даёт wrist) — 0 рук", () => {
    const gun = weapon({ id: "b2", system: { weaponClass: "pistol", grips: "1р" } });
    const a = actorOwning([gun, propMod("b2", [{ key: "wrist" }])]);
    expect(weaponHandsRequired(gun, a)).toBe(0);
  });

  it("тот же болтер без модификации — 2 руки", () => {
    const bolter = weapon({ id: "b3", system: { weaponClass: "basic", grips: "2р" } });
    const a = actorOwning([bolter]);
    expect(weaponHandsRequired(bolter, a)).toBe(2);
  });

  it("модификация чужого оружия на бюджет не влияет", () => {
    const bolter = weapon({ id: "b4", system: { weaponClass: "basic", grips: "2р" } });
    const other  = weapon({ id: "b5", system: { weaponClass: "basic", grips: "2р" } });
    const a = actorOwning([bolter, other, propMod("b5", [{ key: "independent" }])]);
    expect(weaponHandsRequired(bolter, a)).toBe(2);
  });

  it("бюджет рук считает модификации сам, без явного актора (parent предмета)", () => {
    const bolter = weapon({ id: "b6", system: { weaponClass: "basic", grips: "2р", equipped: true } });
    const a = actorOwning([bolter, propMod("b6", [{ key: "independent" }])]);
    expect(handsOccupied(a).used).toBe(0);
  });
});

describe("weaponHandsRequired — пальцевое оружие (wdbc-9dg8 A)", () => {
  const finger = id => weapon({ id, system: {
    weaponClass: "pistol", grips: "1р", equipped: true, weaponProps: [{ key: "digital" }]
  } });

  it("перстень-пистолет не занимает руки", () => {
    expect(weaponHandsRequired(finger("f1"))).toBe(0);
  });

  it("четыре пальцевых на одной руке и меч в ней же — занята 1 рука, а не 5", () => {
    const sword = weapon({ id: "sw", system: { weaponClass: "melee", grips: "1р", equipped: true } });
    const a = actorOwning([finger("f1"), finger("f2"), finger("f3"), finger("f4"), sword]);
    const occ = handsOccupied(a);
    expect(occ.used).toBe(1);
    expect(occ.over).toBe(false);
  });
});
