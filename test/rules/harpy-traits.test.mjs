// test/rules/harpy-traits.test.mjs
//
// Сверка Гарпии с книгой (глава I, «Гарпия»): Стартовые Трейты и расовые
// Черты. Фикстуры — настоящие JSON из packs-src: зелёный тест обязан
// доказывать, что механика едет с самим предметом, а не с подставной копией.
//
//   Deadly Natural Weapons (2, Когти.Р (на руках и ногах)) — рейтинг 2 и
//     атаки выбраны самой расой (книга: «формат (X, Y), где Y — конкретный тип
//     естественного оружия»), окно с галочками не нужно;
//   Flyer (A.b×2) — рейтинг формулой, скорость в полёте — SPD X вместо обычной
//     (core.json, «Flyer (X) / Летун»), считается от текущего A.b;
//   Hollow Bones — T.b вдвое (окр.▲) при Поглощении I(Cr);
//   Razor Talons — Razor Sharp только когтям на НОГАХ;
//   Limited Lift — летит только с грузом не тяжелее Ношения; S от силовой
//     брони Ношение для полёта не поднимает, броня свой вес не гасит.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { grantedTraitFlags } from "../../module/rules/trait-grant.mjs";
import { optionalIntegralEntries, integralEntrySelected } from "../../module/rules/integral-rating.mjs";
import { flightSpeedOf, RATING_FORMULA_FLAG } from "../../module/rules/flight-speed.mjs";
import { hollowBonesTb } from "../../module/rules/hollow-bones.mjs";
import { flightStrengthBonus, limitedLiftStatus } from "../../module/rules/limited-lift.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { weaponPropsFromRules } from "../../module/rules/resolve-test.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const RACE = packDocById("packs-src/races/Отродия", "yc1v6PVjcQ6IqTlu");
const DNW = packDocById("packs-src/traits", "izr4BASd4MVkw3Cm");
const FLYER = packDocById("packs-src/traits", "6PG9FuSMS13O6Ou8");
const HOLLOW = packDocById("packs-src/traits", "MeOKbN0YrlnsffCP");
const RAZOR = packDocById("packs-src/traits", "7ndlWBYDdDlr2ayU");
const LIFT = packDocById("packs-src/traits", "Lh7dmYbtZhScM3J8");
const CLAWS = packDocById("packs-src/weapons/Интегральные_атаки", "MdAKKPWWE2aYVHza");
const FOOT = packDocById("packs-src/weapons/Интегральные_атаки", "hRpFootTalons2Kx");

const raceEntries = RACE.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const traitEntry = id => raceEntries.find(e => e.kind === "trait" && e.sourceUuid.endsWith(`.${id}`));

function itemOf(doc, extra = {}) {
  return { id: doc._id, name: doc.name, type: doc.type, system: structuredClone(doc.system),
           flags: structuredClone(doc.flags ?? {}), ...extra };
}
function actorWith(items, system = {}) {
  return { id: "a1", type: "character", system, items: Object.assign([...items], { contents: items }) };
}

describe("Гарпия: Deadly Natural Weapons (2, Когти (на руках и ногах))", () => {
  const entry = traitEntry("izr4BASd4MVkw3Cm");

  it("раса выдаёт Черту с рейтингом 2", () => {
    expect(Number(entry.rating)).toBe(2);
  });

  it("атаки выбраны расой: Когти и Когти на Ногах — окно выбора не спрашивает", () => {
    const flags = grantedTraitFlags(entry);
    expect(flags.integralChosen).toEqual(["MdAKKPWWE2aYVHza", "hRpFootTalons2Kx"]);
    const optional = optionalIntegralEntries(DNW.flags["warhammer-dbc"].mechanics);
    const picked = optional.filter(e => integralEntrySelected(e, flags.integralChosen));
    expect(picked.map(e => e.equipSourceName)).toEqual([CLAWS.name, FOOT.name]);
  });

  it("Когти на Ногах — тот же профиль «Когти», но атака ногами", () => {
    expect(FOOT.system.damage).toBe(CLAWS.system.damage);
    expect(FOOT.system.weaponProps).toEqual(CLAWS.system.weaponProps);
    expect(FOOT.flags["warhammer-dbc"].penetrationFromRating).toBe(true);
    expect(FOOT.system.grips).toBe("Ног");
  });

  it("запись без выбора (Зверолюд, мутации) ничего не предрешает", () => {
    expect(grantedTraitFlags({ kind: "trait", rating: 1 })).toEqual({});
  });
});

describe("Гарпия: Flyer (A.b×2)", () => {
  const entry = traitEntry("6PG9FuSMS13O6Ou8");

  it("рейтинг — формула A.b×2, и она запоминается на выданной Черте", () => {
    expect(entry.rating).toBe("ag*2");
    expect(grantedTraitFlags(entry)).toEqual({ [RATING_FORMULA_FLAG]: "ag*2" });
  });

  it("число в рейтинге формулой не считается", () => {
    expect(grantedTraitFlags({ kind: "trait", rating: 6 })).toEqual({});
    expect(grantedTraitFlags({ kind: "trait", rating: "6" })).toEqual({});
  });

  it("скорость полёта — от ТЕКУЩЕГО A.b, а не от числа на момент выдачи", () => {
    const flyer = itemOf(FLYER);
    flyer.system.rating = 6;                       // посчитано при выдаче (A.b 3)
    flyer.flags["warhammer-dbc"] = { ...flyer.flags["warhammer-dbc"], [RATING_FORMULA_FLAG]: "ag*2" };
    expect(flightSpeedOf([flyer], { ag: 5 })).toBe(10);
  });

  it("Flyer с числовым рейтингом (демоны, бестиарий) — SPD X", () => {
    const flyer = itemOf(FLYER);
    flyer.system.rating = 8;
    expect(flightSpeedOf([flyer], { ag: 3 })).toBe(8);
  });

  it("без Черты полёта скорости полёта нет", () => {
    expect(flightSpeedOf([itemOf(HOLLOW)], { ag: 3 })).toBeNull();
  });
});

describe("Гарпия: Hollow Bones — T.b вдвое (окр.▲) против I(Cr)", () => {
  const harpy = actorWith([itemOf(HOLLOW)]);
  const human = actorWith([]);

  it("Дробящий урон: T.b 5 → 3", () => {
    expect(hollowBonesTb(harpy, 5, "crushing")).toEqual({ tb: 3, halved: true });
  });
  it("другой подвид/без подвида — T.b целиком", () => {
    expect(hollowBonesTb(harpy, 5, "fragmentation")).toEqual({ tb: 5, halved: false });
    expect(hollowBonesTb(harpy, 5, "")).toEqual({ tb: 5, halved: false });
  });
  it("без Черты — T.b целиком", () => {
    expect(hollowBonesTb(human, 5, "crushing")).toEqual({ tb: 5, halved: false });
  });
});

describe("Гарпия: Razor Talons — Razor Sharp только когтям на ногах", () => {
  const actor = actorWith([itemOf(RAZOR)]);
  const rules = rulesFromItemMechanics(actor.items, () => true, actor);
  const props = weapon => weaponPropsFromRules(rules, { kind: "attack", weapon, isMelee: true }).map(p => p.key);

  it("Когти на Ногах получают Razor Sharp", () => {
    expect(props(itemOf(FOOT))).toEqual(["razorSharp"]);
  });
  it("Когти на руках — нет", () => {
    expect(props(itemOf(CLAWS))).toEqual([]);
  });
});

describe("Гарпия: Limited Lift", () => {
  it("S от силовой брони не поднимает Ношение для полёта", () => {
    // S 45 = 35 своих + 10 от брони: S.b 4, без брони 3; Unnatural S (+1) остаётся
    expect(flightStrengthBonus({ bonus: 5, total: 45 }, 10)).toBe(4);
    expect(flightStrengthBonus({ bonus: 4, total: 45 }, 0)).toBe(4);
  });

  it("груз тяжелее Ношения для полёта — взлететь нельзя", () => {
    expect(limitedLiftStatus({ load: 40, carry: 36 })).toEqual({ load: 40, carry: 36, canFly: false });
    expect(limitedLiftStatus({ load: 36, carry: 36 })).toEqual({ load: 36, carry: 36, canFly: true });
  });
});

// ── Через расчёт листа (documents/actor.mjs) ────────────────────────────────

function prepared({ items = [], altitude = "landed", ag = 35, s = 25, t = 20 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ag.base = ag;
  system.characteristics.s.base = s;
  system.characteristics.t.base = t;
  system.movement.altitude = altitude;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Гарпия", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

function liveItem(doc, patch = {}) {
  const it = itemOf(doc, patch);
  it.getFlag = (scope, key) => it.flags?.[scope]?.[key];
  return it;
}

describe("Гарпия на листе: скорость полёта и Ношение для полёта", () => {
  const flyer = () => {
    const f = liveItem(FLYER);
    f.system.rating = 6;
    f.flags["warhammer-dbc"] = { ...f.flags["warhammer-dbc"], [RATING_FORMULA_FLAG]: "ag*2" };
    return f;
  };

  it("на земле — обычный SPD (A.b 3 → Полудвижение 3)", () => {
    expect(prepared({ items: [flyer()] }).movement.halfMove).toBe(3);
  });

  it("в полёте — SPD = A.b×2 (Полудвижение 6, Бег 36)", () => {
    const sys = prepared({ items: [flyer()], altitude: "low" });
    expect(sys.movement.halfMove).toBe(6);
    expect(sys.movement.run).toBe(36);
    expect(sys.movement.spdBreakdown[0].label).toMatch(/Полёт/);
  });

  it("Limited Lift: груз тяжелее Ношения — нельзя лететь; без Черты — не считается", () => {
    const heavy = { id: "g1", name: "Ящик", type: "gear", system: { weight: 500, quantity: 1 },
                    getFlag: () => undefined };
    const withLift = prepared({ items: [flyer(), liveItem(LIFT), heavy] });
    expect(withLift.encumbrance.flight.canFly).toBe(false);
    const light = prepared({ items: [flyer(), liveItem(LIFT)] });
    expect(light.encumbrance.flight.canFly).toBe(true);
    const noLift = prepared({ items: [flyer(), heavy] });
    expect(noLift.encumbrance.flight ?? null).toBeNull();
  });

  it("Limited Lift: силовая броня не гасит свой вес и не даёт Ношения для полёта", () => {
    const pa = { id: "pa", name: "Силовая броня", type: "armor",
                 system: { weight: 40, equipped: true, armorType: "power", active: true, strengthBonus: 20 },
                 getFlag: () => undefined };
    const sys = prepared({ items: [flyer(), liveItem(LIFT), pa] });
    expect(sys.encumbrance.current).toBe(0);                 // для ходьбы броня несёт себя сама
    expect(sys.encumbrance.flight.load).toBe(40);            // для полёта — нет
    const bare = prepared({ items: [flyer(), liveItem(LIFT)] });
    expect(sys.encumbrance.flight.carry).toBe(bare.encumbrance.flight.carry);
    expect(sys.encumbrance.carry).toBeGreaterThan(sys.encumbrance.flight.carry);
  });
});
