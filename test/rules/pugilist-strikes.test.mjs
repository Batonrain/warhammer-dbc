// test/rules/pugilist-strikes.test.mjs
//
// Таланты Пугилиста про удар кулаком и пинок (Sahara 3-eddb), чистая логика:
//   Haymaker / Тяжёлый Хук (core.json, стр. 62): «Он может при совершении атаки кулаком (до броска на
//     попадание) выбрать отказаться от атаки еще одной рукой в этот Ход, чтобы дать этой атаке +½ T.b Dmg
//     (окр. ▼), и, если цель получила попадание, она должна пройти встречный тест S+0 vs S+0, или ее Сбивает с ног.»
//   Goading Strike / Направляющий Удар: «Когда персонаж совершает атаку кулаком, он может дать ей штраф –20,
//     чтобы при Успехе (даже если цель Избежала от попадания) сразу же провести против этой цели Давление
//     за свободное действие.»
//   Knee Strike / Удар с Колена: «Если он успешно взял цель в Захват как минимум 2-мя руками, персонаж может
//     немедленно нанести по цели автоматическое попадание ногой, которой он еще не атаковал в этот Ход,
//     используя профиль безоружного пинка ... Если он побеждает в тесте Athletics на взятие в Захват на 5+
//     Успехов, персонаж может нанести это попадание в голову вместо торса и дать ему свойство Concussive (0).»

import { describe, it, expect } from "vitest";
import {
  isFistWeapon, haymakerOffered, haymakerApplies, haymakerDamageBonus, haymakerBlocksSecondHand,
  HAYMAKER_FORFEIT_FLAG,
  goadingStrikeOffered, goadingStrikeApplies, goadingStrikePenalty, GOADING_STRIKE_PENALTY,
  legsFree, LEG_ATTACKS_FLAG, kneeStrikeHandsOk, kneeStrikeHeadOffered, KNEE_STRIKE_HEAD_MARGIN
} from "../../module/rules/pugilist-talents.mjs";

const byKey = key => ({
  type: "talent", name: "ИСПОРЧЕННОЕ ИМЯ", system: {}, getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key }] }] } }
});
const byName = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
const HAY = { key: "pugilist.core.haymaker", name: "Haymaker / Тяжёлый Хук" };
const GOAD = { key: "pugilist.core.goadingStrike", name: "Goading Strike / Направляющий Удар" };
const KNEE = { key: "pugilist.core.kneeStrike", name: "Knee Strike / Удар с Колена" };

const fist = { system: { meleeCategory: "Кулаки", grips: "Кист" } };
const sword = { system: { meleeCategory: "Меч", grips: "П" } };
const tentacle = { system: { meleeCategory: "Кулаки", grips: "Щуп" } };

const hero = (items = [], { tb = 5, flags = {}, quadruped = false } = {}) => ({
  system: { characteristics: { t: { bonus: tb } } },
  items: quadruped ? [...items, { type: "trait", name: "Quadruped", system: {} }] : items,
  getFlag: (_s, k) => flags[k]
});

describe("кулак", () => {
  it("кулак — рукопашное категории «Кулаки»; меч и щупальце — нет", () => {
    expect(isFistWeapon(fist)).toBe(true);
    expect(isFistWeapon(sword)).toBe(false);
    expect(isFistWeapon(tentacle)).toBe(false);
    expect(isFistWeapon(null)).toBe(false);
  });
});

describe("Тяжёлый Хук", () => {
  it("предлагается носителю Таланта с кулаком; по имени и по ключу", () => {
    expect(haymakerOffered(hero([byKey(HAY.key)]), fist)).toBe(true);
    expect(haymakerOffered(hero([byName(HAY.name)]), fist)).toBe(true);
    expect(haymakerOffered(hero([]), fist)).toBe(false);
    expect(haymakerOffered(hero([byKey(HAY.key)]), sword)).toBe(false);
  });

  it("срабатывает по галочке на кулаке; переброс (replay) сохраняет эффект без галочки", () => {
    const a = hero([byKey(HAY.key)]);
    expect(haymakerApplies(a, { weapon: fist, isMelee: true, toggles: { haymaker: true } })).toBe(true);
    expect(haymakerApplies(a, { weapon: fist, isMelee: true, toggles: {} })).toBe(false);
    expect(haymakerApplies(a, { weapon: fist, isMelee: true, toggles: {}, replay: true })).toBe(true);
    expect(haymakerApplies(a, { weapon: sword, isMelee: true, toggles: { haymaker: true } })).toBe(false);
    expect(haymakerApplies(a, { weapon: fist, isMelee: false, toggles: { haymaker: true } })).toBe(false);
    expect(haymakerApplies(hero([]), { weapon: fist, isMelee: true, toggles: { haymaker: true } })).toBe(false);
  });

  it("+½T.b Dmg, округление вниз", () => {
    expect(haymakerDamageBonus(hero([], { tb: 5 }))).toBe(2);
    expect(haymakerDamageBonus(hero([], { tb: 4 }))).toBe(2);
    expect(haymakerDamageBonus(hero([], { tb: 1 }))).toBe(0);
    expect(haymakerDamageBonus(hero([], { tb: 0 }))).toBe(0);
    expect(haymakerDamageBonus(null)).toBe(0);
  });

  it("отказ от второй руки: «Обе руки» нельзя ни вместе с Хуком, ни после него в этом Ходу", () => {
    const a = hero([byKey(HAY.key)]);
    expect(haymakerBlocksSecondHand(a, { toggles: { haymaker: true }, dual: true })).toMatch(/Тяжёлый Хук/);
    expect(haymakerBlocksSecondHand(a, { toggles: {}, dual: true })).toBe("");
    expect(haymakerBlocksSecondHand(a, { toggles: { haymaker: true }, dual: false })).toBe("");
    const spent = hero([byKey(HAY.key)], { flags: { [HAYMAKER_FORFEIT_FLAG]: true } });
    expect(haymakerBlocksSecondHand(spent, { toggles: {}, dual: true })).toMatch(/отказал/);
    expect(haymakerBlocksSecondHand(spent, { toggles: {}, dual: false })).toBe("");
  });
});

describe("Направляющий Удар", () => {
  it("штраф −20 и срабатывание: Талант + кулак + галочка", () => {
    const a = hero([byKey(GOAD.key)]);
    expect(GOADING_STRIKE_PENALTY).toBe(-20);
    expect(goadingStrikeOffered(a, fist)).toBe(true);
    expect(goadingStrikeOffered(a, sword)).toBe(false);
    expect(goadingStrikeOffered(hero([]), fist)).toBe(false);
    expect(goadingStrikeApplies(a, { weapon: fist, isMelee: true, toggles: { goadingStrike: true } })).toBe(true);
    expect(goadingStrikeApplies(a, { weapon: fist, isMelee: true, toggles: {} })).toBe(false);
    expect(goadingStrikePenalty(a, { weapon: fist, isMelee: true, toggles: { goadingStrike: true } })).toBe(-20);
    expect(goadingStrikePenalty(a, { weapon: fist, isMelee: true, toggles: {} })).toBe(0);
    expect(goadingStrikePenalty(a, { weapon: sword, isMelee: true, toggles: { goadingStrike: true } })).toBe(0);
    expect(goadingStrikePenalty(hero([byName(GOAD.name)]), { weapon: fist, isMelee: true, toggles: { goadingStrike: true } })).toBe(-20);
  });
});

describe("Удар с Колена", () => {
  it("ноги: две (четыре у Четвероногого) минус уже атаковавшие в этом Ходу", () => {
    expect(legsFree(hero([]))).toBe(2);
    expect(legsFree(hero([], { flags: { [LEG_ATTACKS_FLAG]: 1 } }))).toBe(1);
    expect(legsFree(hero([], { flags: { [LEG_ATTACKS_FLAG]: 2 } }))).toBe(0);
    expect(legsFree(hero([], { flags: { [LEG_ATTACKS_FLAG]: 5 } }))).toBe(0);
    expect(legsFree(hero([], { quadruped: true, flags: { [LEG_ATTACKS_FLAG]: 2 } }))).toBe(2);
  });

  it("Захват минимум двумя руками; в голову — победа на 5+ Успехов", () => {
    expect(kneeStrikeHandsOk(1)).toBe(false);
    expect(kneeStrikeHandsOk(2)).toBe(true);
    expect(kneeStrikeHandsOk(3)).toBe(true);
    expect(KNEE_STRIKE_HEAD_MARGIN).toBe(5);
    expect(kneeStrikeHeadOffered(4)).toBe(false);
    expect(kneeStrikeHeadOffered(5)).toBe(true);
    expect(kneeStrikeHeadOffered(undefined)).toBe(false);
  });

  it("ключи Талантов найдены в реестре Пугилиста", () => {
    expect(KNEE.key).toBe("pugilist.core.kneeStrike");
  });
});
