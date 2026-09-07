// test/rules/dual-wield-talents.test.mjs
//
// Шесть Талантов ветки «Два оружия» за пределами парного штрафа (wdbc-pb60).
// Здесь — условия «вооружён чем» и числа. Подключение к конвейеру (Парирование,
// исход атаки, бонус Уклонения цели) проверяется своими тестами рядом, а сами
// документы пака — test/rules/dual-wield-talent-docs.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import {
  crossblockPair, pounderPair, savagePair, savageExtraHits, gunGuardCancelsDodgeBonus,
  CAP_CROSSBLOCK, CAP_POUNDER, CAP_SAVAGE, CAP_GUN_GUARD
} from "../../module/rules/dual-wield-talents.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const saved = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

let idSeq = 0;

/** Оружие в руке: hands.mjs считает занятой рукой всё equipped, требующее рук. */
function weapon({ cls = "melee", cat = "", balance = 0, name = "оружие" } = {}) {
  return {
    id: `w${++idSeq}`, name, type: "weapon",
    system: { equipped: true, weaponClass: cls, meleeCategory: cat, balance,
              hands: 1, weaponProps: [], mods: [] }
  };
}

/** Персонаж с руками и перечисленными возможностями ветки. */
function hero(items, ...caps) {
  clearRuleSources();
  registerRuleSource("test", () => caps.map(c => ({
    id: c, label: c, when: {}, effects: [{ kind: "grantFlag", target: c }]
  })));
  return { system: {}, items };
}

describe("Крестовой Блок — две рукопашные с Балансом ≥ 0", () => {
  it("пара мечей с Балансом 0 годится", () => {
    const a = hero([weapon({ cat: "Меч", balance: 0 }), weapon({ cat: "Меч", balance: 1 })],
                        CAP_CROSSBLOCK);
    expect(crossblockPair(a)).not.toBeNull();
  });

  it("оружие с Балансом −1 не годится — условие книги про Баланс, а не про пару", () => {
    const a = hero([weapon({ cat: "Меч", balance: 0 }), weapon({ cat: "Топор", balance: -1 })],
                        CAP_CROSSBLOCK);
    expect(crossblockPair(a)).toBeNull();
  });

  it("без Таланта пара мечей ничего не даёт", () => {
    const a = hero([weapon({ cat: "Меч" }), weapon({ cat: "Меч" })]);
    expect(crossblockPair(a)).toBeNull();
  });

  it("пистолет второй рукой не считается — нужны ДВА рукопашных", () => {
    const a = hero([weapon({ cat: "Меч" }), weapon({ cls: "pistol" })], CAP_CROSSBLOCK);
    expect(crossblockPair(a)).toBeNull();
  });
});

describe("Молотильщик — топоры, булавы и молоты, в том числе вперемешку", () => {
  it("топор с булавой годятся: книга разрешает комбинацию", () => {
    const a = hero([weapon({ cat: "Топор" }), weapon({ cat: "Булава" })], CAP_POUNDER);
    expect(pounderPair(a)).not.toBeNull();
  });

  it("молот с мечом не годится — меча в списке книги нет", () => {
    const a = hero([weapon({ cat: "Молот" }), weapon({ cat: "Меч" })], CAP_POUNDER);
    expect(pounderPair(a)).toBeNull();
  });
});

describe("Дикарь — парные когти", () => {
  it("две пары когтей в руках дают правило", () => {
    const a = hero([weapon({ cat: "Когти" }), weapon({ cat: "Когти" })], CAP_SAVAGE);
    expect(savagePair(a)).not.toBeNull();
  });

  it("одни когти и нож — нет", () => {
    const a = hero([weapon({ cat: "Когти" }), weapon({ cat: "Нож" })], CAP_SAVAGE);
    expect(savagePair(a)).toBeNull();
  });
});

describe("Винтовочная Гарда — цель не получает бонуса на Уклонение", () => {
  const rifle = () => weapon({ cls: "basic", name: "винтовка" });

  it("рукопашное с Балансом −1 в руке — бонус снят", () => {
    const r = rifle();
    const a = hero([weapon({ cat: "Меч", balance: -1 }), r], CAP_GUN_GUARD);
    expect(gunGuardCancelsDodgeBonus(a, r)).toBe(true);
  });

  it("Баланс −2 не годится — книга требует не ниже −1", () => {
    const r = rifle();
    const a = hero([weapon({ cat: "Меч", balance: -2 }), r], CAP_GUN_GUARD);
    expect(gunGuardCancelsDodgeBonus(a, r)).toBe(false);
  });

  it("выстрел из пистолета бонуса не снимает — Талант про винтовку", () => {
    const p = weapon({ cls: "pistol" });
    const a = hero([weapon({ cat: "Меч", balance: 0 }), p], CAP_GUN_GUARD);
    expect(gunGuardCancelsDodgeBonus(a, p)).toBe(false);
  });

  it("без рукопашного в руке Талант не работает", () => {
    const r = rifle();
    const a = hero([r], CAP_GUN_GUARD);
    expect(gunGuardCancelsDodgeBonus(a, r)).toBe(false);
  });

  it("без Таланта бонус остаётся", () => {
    const r = rifle();
    const a = hero([weapon({ cat: "Меч", balance: 0 }), r]);
    expect(gunGuardCancelsDodgeBonus(a, r)).toBe(false);
  });
});

describe("Дикарь — надбавка Успехов считается только по когтям пары", () => {
  it("удар когтем из пары даёт +2", () => {
    const c1 = weapon({ cat: "Когти" }), c2 = weapon({ cat: "Когти" });
    expect(savageExtraHits(hero([c1, c2], CAP_SAVAGE), c1)).toBe(2);
  });

  it("удар мечом той же руки надбавки не даёт", () => {
    const c1 = weapon({ cat: "Когти" }), c2 = weapon({ cat: "Когти" });
    const sword = weapon({ cat: "Меч" });
    expect(savageExtraHits(hero([c1, c2, sword], CAP_SAVAGE), sword)).toBe(0);
  });

  it("без второго когтя надбавки нет", () => {
    const c1 = weapon({ cat: "Когти" });
    expect(savageExtraHits(hero([c1, weapon({ cat: "Меч" })], CAP_SAVAGE), c1)).toBe(0);
  });
});
