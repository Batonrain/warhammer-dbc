// test/rules/library/ratling.test.mjs
//
// Сверка расы Ратлинг с корбуком (глава I): Архетипы расы, Trade (Cook +1),
// Коротышка (Раны, винтовки, одна рука, Compact), Босоногий (переключатель,
// Трудный Ландшафт), Ловит на Лету к стартовому опыту.

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { packDocById } from "../../support/pack-doc.mjs";
import { resolveTest } from "../../../module/rules/resolve-test.mjs";
import { hasRuleFlag } from "../../../module/rules/flags.mjs";
import { isItemActive } from "../../../module/apps/effects.mjs";
import { archetypesForRace } from "../../../module/apps/archetypes.mjs";
import { RUNT_FIT_FLAG, runtLongRifle, runtRangedGrips, hasCompactMod } from "../../../module/rules/runt-fit.mjs";
import { startLevelValues, START_LEVELS } from "../../../module/constants/start-levels.mjs";

const RACE = packDocById("packs-src/races/Люди", "L5v7S3jLjyupDVJq");
const OGRYN = packDocById("packs-src/races/Люди", "tjQaSHFHxbt1tvWU");
const BAREFOOT = packDocById("packs-src/traits", "3MsfNfn6Ihq7Q0zq");
const RUNT = packDocById("packs-src/traits", "0F7VNlzKoO0RVtEn");

const entries = doc => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const actorWith = (items, conditions = {}) => ({ system: { race: "ratling", characteristics: {}, conditions }, items });

describe("раса Ратлинг против книги", () => {
  it("Trade: Cook постоянно + любое 1 (без Cook в выборе)", () => {
    const trade = entries(RACE).filter(e => e.kind === "skill" && e.skillKey === "trade");
    expect(trade.find(e => e.specKey === "cook")).toBeTruthy();
    const choice = trade.find(e => e.specKey === "__choice__");
    expect(choice.specChoiceCount).toBe(1);
    expect(choice.specChoiceKeys).not.toContain("cook");
  });

  it("Архетипы — только книжный список (Ратлинг 7, Огрин 3)", () => {
    expect(RACE.system.allowedArchetypes).toEqual(["apostate", "heresiarch", "renegade", "pirate", "savage", "witch", "numen"]);
    expect(OGRYN.system.allowedArchetypes).toEqual(["renegade", "pirate", "savage"]);
  });

  it("фильтр Архетипов: Огрину нет Благородного и Ведьмы, Человеку — всё", () => {
    const ogryn = archetypesForRace("ogryn").map(([k]) => k);
    expect(ogryn.sort()).toEqual(["pirate", "renegade", "savage"]);
    const ratling = archetypesForRace("ratling").map(([k]) => k);
    expect(ratling).toContain("numen");
    expect(ratling).not.toContain("noble");
    expect(archetypesForRace("human").map(([k]) => k)).toContain("noble");
  });
});

describe("Коротышка", () => {
  it("−4 к максимуму Ран и возможность weapons.runt в Механике", () => {
    const e = entries(RUNT);
    expect(e.find(x => x.kind === "wounds")).toMatchObject({ op: "subtract", woundsValue: "4" });
    expect(hasRuleFlag(actorWith([RUNT]), RUNT_FIT_FLAG)).toBe(true);
  });

  it("винтовка — длинная, пока нет Compact; длинная и пистолет не трогаются", () => {
    expect(runtLongRifle({ isRunt: true, weaponClass: "basic" })).toBe(true);
    expect(runtLongRifle({ isRunt: true, weaponClass: "basic", compact: true })).toBe(false);
    expect(runtLongRifle({ isRunt: true, weaponClass: "pistol" })).toBe(false);
    expect(runtLongRifle({ isRunt: false, weaponClass: "basic" })).toBe(false);
  });

  it("двуручное стрелковое теряет «1р» даже от модификаций; Compact возвращает", () => {
    expect(runtRangedGrips(["2р", "1р"], { isRunt: true, ownGrips: ["2р", "1р"], weaponClass: "basic" })).toEqual(["2р"]);
    expect(runtRangedGrips(["2р", "1р"], { isRunt: true, compact: true, ownGrips: ["2р"], weaponClass: "basic" })).toEqual(["2р", "1р"]);
    expect(runtRangedGrips(["1р", "2р"], { isRunt: true, ownGrips: ["1р", "2р"], weaponClass: "pistol" })).toEqual(["1р", "2р"]);
    expect(runtRangedGrips(["2р", "1р"], { isRunt: false, ownGrips: ["2р"], weaponClass: "basic" })).toEqual(["2р", "1р"]);
  });

  it("Compact узнаётся по установленной модификации", () => {
    expect(hasCompactMod([{ type: "weaponMod", name: "Compact / Компактное" }])).toBe(true);
    expect(hasCompactMod([{ type: "weaponMod", name: "Pistol Grip / Пистолетная Рукоять" }])).toBe(false);
  });
});

describe("Босоногий — переключатель «босиком»", () => {
  it("включаемая Черта, по умолчанию ВКЛ", () => {
    expect(BAREFOOT.system).toMatchObject({ activatable: true, active: true });
    expect(isItemActive({ type: "trait", system: { activatable: true, active: false } })).toBe(false);
    expect(isItemActive({ type: "trait", system: {} })).toBe(true);
  });

  it("босиком: тест Трудного Ландшафта +20 и переброс; Stealth — галочки", () => {
    const a = actorWith([BAREFOOT]);
    const terrain = resolveTest({ actor: a, kind: "skill", char: "ag", terrain: true });
    expect(terrain.mods.concat(terrain.autoMods).some(m => m.value === 20)).toBe(true);
    expect(terrain.rerolls.length).toBe(1);
    const stealth = resolveTest({ actor: a, kind: "skill", skill: "stealth", char: "ag" });
    expect(stealth.mods.some(m => m.value === 20)).toBe(true);
    expect(stealth.rerolls.length).toBe(1);
    const dodge = resolveTest({ actor: a, kind: "skill", skill: "dodge", char: "ag" });
    expect(dodge.mods.some(m => m.value === 20)).toBe(false);
  });

  it("обут (выкл) — ничего", () => {
    const shod = { ...BAREFOOT, system: { ...BAREFOOT.system, active: false } };
    const t = resolveTest({ actor: actorWith([shod]), kind: "skill", char: "ag", terrain: true });
    expect(t.mods.concat(t.autoMods).some(m => m.value === 20)).toBe(false);
    expect(t.rerolls.length).toBe(0);
  });
});

describe("Ловит на Лету — стартовый опыт", () => {
  it("+15% к стартовому опыту, округление вверх", () => {
    const level = START_LEVELS.find(l => l.mortal > 0).key;
    const plain = startLevelValues({ level });
    const fast = startLevelValues({ level, fastLearnerPct: 15 });
    expect(fast.xp).toBe(Math.ceil(plain.xp * 1.15));
    expect(fast.fastLearnerXp).toBe(fast.xp - plain.xp);
  });
});
