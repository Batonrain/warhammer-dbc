// test/rules/ratling.test.mjs
//
// Ратлинг против книги (Основная книга, глава I «Расы» — текст владельца):
// данные расы в паке, резерв-константы и машинная часть трёх его Черт —
// Barefoot / Босоногий, Runt / Коротышка (Fast Learner (15), Size (−1),
// Unnatural BS/P (2) сверяют общие сторожа race-traits-vs-book и
// fast-learner-race-rating).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { RACES } from "../../module/constants/races.mjs";
import { PREDICATES, wearsFootwear } from "../../module/rules/predicates.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import {
  RUNT_CAPABILITY, RUNT_WOUNDS_MAX, isRunt, hasCompactMod,
  runtRifleIsLong, runtForbidsOneHand, woundsMaxMods
} from "../../module/rules/runt.mjs";
import { getModEffects, mergeWeaponPropEntries } from "../../module/combat/weapon-mods.mjs";

const FLAG = "warhammer-dbc";
const race     = packDocById("packs-src/races/Люди", "L5v7S3jLjyupDVJq");
const barefoot = packDocById("packs-src/traits", "3MsfNfn6Ihq7Q0zq");
const runt     = packDocById("packs-src/traits", "0F7VNlzKoO0RVtEn");

const entries = doc => (doc.flags?.[FLAG]?.mechanics || []).flatMap(g => g.entries || []);

// ── Данные расы ────────────────────────────────────────────────────────────
describe("Ратлинг: данные расы = книга", () => {
  // «WS BS S T A I P W F Cor Inf / 25 35 15 20 30 25 30 25 25 0 14»
  const BOOK_CHARS = { ws: 25, bs: 35, s: 15, t: 20, ag: 30, int: 25, per: 30, wp: 25, fel: 25, inf: 14 };

  it("стартовые Характеристики — в паке и в резерв-константах", () => {
    expect(race.system.chars).toEqual(BOOK_CHARS);
    expect(RACES.ratling.chars).toEqual(BOOK_CHARS);
  });

  it("Бонусные Броски 1, Бонусные Очки 4, Смещение 1, Размер −1", () => {
    expect([race.system.bonusRolls, race.system.bonusPoints, race.system.charShift, race.system.size])
      .toEqual([1, 4, 1, -1]);
  });

  it("снаряжение — дословно книга, одинаково в паке и в константах", () => {
    const BOOK_GEAR = "5 элементов Снаряжения и Инструментов до R1 из них 2 Good.Q и 1 Best.Q, Vox-Bead";
    expect(race.system.gear).toBe(BOOK_GEAR);
    expect(RACES.ratling.gear).toBe(BOOK_GEAR);
  });

  it("Trade (Cook + любое 1): Повар выдаётся сам, второе Ремесло — выбором и без Повара", () => {
    const trades = entries(race).filter(e => e.kind === "skill" && e.skillKey === "trade");
    const cook = trades.find(e => e.specKey === "cook");
    const choice = trades.find(e => e.specKey === "__choice__");
    expect(cook).toMatchObject({ skillScope: "group", rank: "knows", specialty: "Повар" });
    expect(choice).toMatchObject({ skillScope: "group", rank: "knows", specChoiceCount: 1 });
    expect(choice.specChoiceKeys).not.toContain("cook");
    expect(choice.specChoiceKeys.length).toBeGreaterThan(10);
  });

  it("Sleight of Hand +10 и Stealth +10 — ступень «trained»", () => {
    const sk = key => entries(race).find(e => e.kind === "skill" && e.skillKey === key);
    expect(sk("sleightOfHand").rank).toBe("trained");
    expect(sk("stealth").rank).toBe("trained");
  });
});

// ── Barefoot / Босоногий ────────────────────────────────────────────────────
const actorWith = (...items) => ({ system: { race: "ratling" }, items });
const legArmour = (equipped = true) => ({ type: "armor", name: "Flak / Флак", system: { equipped, leftLeg: 2, rightLeg: 2, body: 2 } });
const vest      = () => ({ type: "armor", name: "Flak Vest / Флак Жилет", system: { equipped: true, body: 3 } });
const magBoots  = (equipped = true) => ({ type: "gear", name: "Mag Boots / Маг Сапоги", system: { equipped } });

describe("Обувь: предикат wearsFootwear", () => {
  it("надетая броня, закрывающая ноги, — обут", () => {
    expect(wearsFootwear(actorWith(legArmour()))).toBe(true);
  });
  it("броня только на торс, снятая броня на ноги — босиком", () => {
    expect(wearsFootwear(actorWith(vest()))).toBe(false);
    expect(wearsFootwear(actorWith(legArmour(false)))).toBe(false);
    expect(wearsFootwear(actorWith())).toBe(false);
  });
  it("надетые Маг-Сапоги — обут", () => {
    expect(wearsFootwear(actorWith(magBoots()))).toBe(true);
    expect(wearsFootwear(actorWith(magBoots(false)))).toBe(false);
  });
  it("в реестре условий: wearsFootwear:false — «босиком»", () => {
    expect(PREDICATES.wearsFootwear(actorWith(), {}, false)).toBe(true);
    expect(PREDICATES.wearsFootwear(actorWith(legArmour()), {}, false)).toBe(false);
    expect(PREDICATES.wearsFootwear(actorWith(legArmour()), {}, true)).toBe(true);
  });
});

describe("Barefoot: правила от Черты", () => {
  const rulesFor = actor => rulesFromItemMechanics([barefoot], () => true, actor)
    .flatMap(r => r.effects.map(e => ({ ...e, label: r.label })));

  it("босиком: +20 и переброс Stealth, +20 и переброс теста Трудного Ландшафта", () => {
    const fx = rulesFor(actorWith());
    expect(fx).toContainEqual(expect.objectContaining({ kind: "rollBonus", target: "skill:stealth", value: 20 }));
    expect(fx).toContainEqual(expect.objectContaining({ kind: "rollMode", target: "skill:stealth", mode: "keepBest" }));
    expect(fx).toContainEqual(expect.objectContaining({ kind: "rollBonus", target: "terrain", value: 20 }));
    expect(fx).toContainEqual(expect.objectContaining({ kind: "rollMode", target: "terrain", mode: "keepBest" }));
  });

  it("Stealth-бонус подписан как бесшумное передвижение — это галочка, не безусловный плюс", () => {
    const stealth = rulesFor(actorWith()).find(e => e.kind === "rollBonus" && e.target === "skill:stealth");
    expect(stealth.auto).toBeFalsy();
    expect(stealth.label).toMatch(/бесшумн/i);
  });

  it("в обуви — ничего", () => {
    expect(rulesFor(actorWith(legArmour()))).toEqual([]);
  });

  it("область «terrain» срабатывает только в тесте Трудного Ландшафта", () => {
    const actor = actorWith({ ...barefoot, type: "trait" });
    const onTerrain = resolveTest({ actor, kind: "skill", char: "ag", terrain: true });
    expect(onTerrain.mods.map(m => m.value)).toContain(20);
    expect(onTerrain.rerolls.length).toBeGreaterThan(0);
    const plainAg = resolveTest({ actor, kind: "skill", char: "ag" });
    expect(plainAg.mods.map(m => m.value)).not.toContain(20);
    expect(plainAg.rerolls).toEqual([]);
  });
});

// ── Runt / Коротышка ───────────────────────────────────────────────────────
const runtTrait = { ...runt, type: "trait" };
const compact = (weaponId) => ({ type: "weaponMod", name: "Compact / Компактное", system: { installedOn: weaponId, effects: {} } });
const weapon = (id, weaponClass, grips, props = []) => ({
  id, type: "weapon", name: id, system: { weaponClass, grips, weaponProps: props }
});
const lasgun  = weapon("lasgun", "basic", "2р");
const carbine = weapon("carbine", "basic", "2р (1р)");
const pistol  = weapon("pistol", "pistol", "1р (2р)");
const heavy   = weapon("heavy", "heavy", "2р");
const knife   = weapon("knife", "melee", "1р");

describe("Runt: кто Коротышка", () => {
  it("по Черте из пака (имя) и по возможности trait.runt", () => {
    expect(isRunt(actorWith(runtTrait))).toBe(true);
    expect(isRunt(actorWith())).toBe(false);
    const byKey = entries(runt).find(e => e.kind === "capability");
    expect(byKey?.capabilityKey).toBe(RUNT_CAPABILITY);
  });
});

describe("Runt: −4 к максимуму Ран", () => {
  it("книжное число", () => {
    expect(RUNT_WOUNDS_MAX).toBe(-4);
  });
  it("поправка к максимуму есть у Коротышки и нет у других", () => {
    expect(woundsMaxMods(actorWith(runtTrait))).toEqual([{ label: "Коротышка", value: -4 }]);
    expect(woundsMaxMods(actorWith())).toEqual([]);
  });
});

describe("Runt: оружие", () => {
  const a = (...extra) => actorWith(runtTrait, lasgun, carbine, pistol, heavy, knife, ...extra);

  it("винтовка считается длинной; пистолет, тяжёлое и рукопашное — нет", () => {
    const actor = a();
    expect(runtRifleIsLong(actor, lasgun)).toBe(true);
    expect(runtRifleIsLong(actor, carbine)).toBe(true);
    expect(runtRifleIsLong(actor, pistol)).toBe(false);
    expect(runtRifleIsLong(actor, heavy)).toBe(false);
    expect(runtRifleIsLong(actor, knife)).toBe(false);
  });

  it("двуручное стрелковое нельзя одной рукой; пистолет и рукопашное — можно", () => {
    const actor = a();
    expect(runtForbidsOneHand(actor, carbine)).toBe(true);
    expect(runtForbidsOneHand(actor, lasgun)).toBe(true);
    expect(runtForbidsOneHand(actor, heavy)).toBe(true);
    expect(runtForbidsOneHand(actor, pistol)).toBe(false);
    expect(runtForbidsOneHand(actor, knife)).toBe(false);
  });

  it("модификация Compact снимает оба штрафа", () => {
    const actor = a(compact("carbine"));
    expect(hasCompactMod(actor, carbine)).toBe(true);
    expect(runtRifleIsLong(actor, carbine)).toBe(false);
    expect(runtForbidsOneHand(actor, carbine)).toBe(false);
    expect(runtRifleIsLong(actor, lasgun)).toBe(true);
  });

  it("не-Коротышке ничего не мешает", () => {
    const human = actorWith(lasgun, carbine);
    expect(runtRifleIsLong(human, lasgun)).toBe(false);
    expect(runtForbidsOneHand(human, carbine)).toBe(false);
  });

  it("свойство «Длинная Винтовка» доезжает до итогового списка свойств оружия", () => {
    const actor = a();
    const keys = w => mergeWeaponPropEntries(w, getModEffects(actor, w)).map(p => p.key);
    expect(keys(lasgun)).toContain("longRifle");
    expect(keys(pistol)).not.toContain("longRifle");
    const withCompact = a(compact("lasgun"));
    expect(mergeWeaponPropEntries(lasgun, getModEffects(withCompact, lasgun)).map(p => p.key))
      .not.toContain("longRifle");
  });
});

// ── Тексты Черт ────────────────────────────────────────────────────────────
describe("Черты Ратлинга: полный книжный текст", () => {
  it("Barefoot", () => {
    expect(barefoot.system.benefit).toMatch(/Когда Ратлинг не носит обувь, он получает бонус \+20 и может перебрасывать тесты Stealth для бесшумного передвижения и тесты Трудного Ландшафта/);
  });
  it("Runt", () => {
    expect(runt.system.benefit).toMatch(/Ратлинг получает –4 к максимуму Ран/);
    expect(runt.system.benefit).toMatch(/Модификация Compact нивелирует эти штрафы/);
  });
});
