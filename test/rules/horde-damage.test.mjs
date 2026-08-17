// test/rules/horde-damage.test.mjs
//
// Счёт урона по Орде. Главное правило: попадание, пробившее Поглощение, стоит
// ровно 1 Магнитуды — сколько бы урона ни прошло. Поэтому проверяем не суммы
// урона, а ЧИСЛО попаданий и то, что оно упирается в Поглощение целиком.

import { describe, it, expect } from "vitest";
import {
  hordeSizeFor, hordeMagDamageDice, hordeExtraHits, hordeMagnitudeLoss,
  massDamageThreshold, needsMassDamageTest, psychDamageFor, hordeState,
  noRecoveryHours, hitsAbsorbedByHorde, HORDE_SIZE_LABELS
} from "../../module/rules/horde-damage.mjs";

describe("Размер Орды по Магнитуде", () => {
  it("идёт по границам таблицы", () => {
    expect(hordeSizeFor(9)).toBe(1);
    expect(hordeSizeFor(10)).toBe(2);
    expect(hordeSizeFor(29)).toBe(2);
    expect(hordeSizeFor(30)).toBe(3);
    expect(hordeSizeFor(59)).toBe(3);
    expect(hordeSizeFor(60)).toBe(4);
    expect(hordeSizeFor(89)).toBe(4);
    expect(hordeSizeFor(90)).toBe(5);
    expect(hordeSizeFor(119)).toBe(5);
    expect(hordeSizeFor(120)).toBe(6);
    expect(hordeSizeFor(400)).toBe(6);
  });

  it("у каждой ступени таблицы есть подпись", () => {
    for (const size of [2, 3, 4, 5, 6]) expect(HORDE_SIZE_LABELS[size]).toBeTruthy();
  });
});

describe("бонусные кубы урона Орды", () => {
  it("появляются на 10 и удваиваются на 20", () => {
    expect(hordeMagDamageDice(9)).toBe(0);
    expect(hordeMagDamageDice(10)).toBe(1);
    expect(hordeMagDamageDice(19)).toBe(1);
    expect(hordeMagDamageDice(20)).toBe(2);
    expect(hordeMagDamageDice(200)).toBe(2);
  });
});

describe("дополнительные попадания по Орде", () => {
  it("без свойств попадание одно", () => {
    expect(hordeExtraHits({}).hits).toBe(1);
  });

  it("Взрывное (X) добавляет X", () => {
    expect(hordeExtraHits({ blast: 3 }).hits).toBe(4);
  });

  it("Огонь и Силовое Поле дают по одному", () => {
    expect(hordeExtraHits({ flame: true }).hits).toBe(2);
    expect(hordeExtraHits({ powerField: true }).hits).toBe(2);
    expect(hordeExtraHits({ flame: true, powerField: true }).hits).toBe(3);
  });

  it("Распыление даёт Rng/5 с округлением вниз", () => {
    expect(hordeExtraHits({ spray: true, range: 20 }).hits).toBe(5);
    expect(hordeExtraHits({ spray: true, range: 24 }).hits).toBe(5);
    expect(hordeExtraHits({ spray: true, range: 4 }).hits).toBe(1);
  });

  it("крупный боец в рукопашной задевает мелюзгу лишний раз", () => {
    expect(hordeExtraHits({ melee: true, attackerSize: 1, creatureSize: 0 }).hits).toBe(2);
    expect(hordeExtraHits({ melee: true, attackerSize: 2, creatureSize: -1 }).hits).toBe(2);
  });

  it("бонус Размера не работает в стрельбе и против крупных существ", () => {
    expect(hordeExtraHits({ melee: false, attackerSize: 2, creatureSize: 0 }).hits).toBe(1);
    expect(hordeExtraHits({ melee: true, attackerSize: 0, creatureSize: 0 }).hits).toBe(1);
    expect(hordeExtraHits({ melee: true, attackerSize: 1, creatureSize: 1 }).hits).toBe(1);
  });

  it("свойства складываются, и каждое объясняет себя в примечаниях", () => {
    const { hits, notes } = hordeExtraHits({ blast: 2, flame: true, spray: true, range: 15 });
    expect(hits).toBe(1 + 2 + 1 + 3);
    expect(notes).toHaveLength(3);
  });
});

describe("урон в Магнитуду", () => {
  it("пробившее Поглощение попадание стоит ровно 1 Магнитуды", () => {
    expect(hordeMagnitudeLoss({ rawDamage: 12, absorption: 5 }).magLoss).toBe(1);
  });

  it("огромный одиночный урон всё равно стоит 1 — толпе он неинтересен", () => {
    expect(hordeMagnitudeLoss({ rawDamage: 200, absorption: 5 }).magLoss).toBe(1);
  });

  it("урон, не превысивший Поглощение, не снимает ничего", () => {
    expect(hordeMagnitudeLoss({ rawDamage: 5, absorption: 5 })).toMatchObject({ pierced: false, magLoss: 0 });
    expect(hordeMagnitudeLoss({ rawDamage: 4, absorption: 5 }).magLoss).toBe(0);
  });

  it("каждое дополнительное попадание снимает свою Магнитуду", () => {
    expect(hordeMagnitudeLoss({ rawDamage: 12, absorption: 5, hits: 4 }).magLoss).toBe(4);
  });

  it("Опустошительное и Таланты добавляют урон сверх попаданий", () => {
    expect(hordeMagnitudeLoss({ rawDamage: 12, absorption: 5, hits: 2, devastating: 3 }).magLoss).toBe(5);
    expect(hordeMagnitudeLoss({ rawDamage: 12, absorption: 5, talentBonus: 2 }).magLoss).toBe(3);
  });

  it("надбавки не пробивают Поглощение в обход общего правила", () => {
    expect(hordeMagnitudeLoss({ rawDamage: 3, absorption: 5, devastating: 9, talentBonus: 9 }).magLoss).toBe(0);
  });
});

describe("массивный урон за Раунд", () => {
  it("порог — четверть стартовой Магнитуды, с округлением вверх", () => {
    expect(massDamageThreshold(60)).toBe(15);
    expect(massDamageThreshold(50)).toBe(13);
  });

  it("тест требуется начиная с порога", () => {
    expect(needsMassDamageTest({ roundDamage: 14, startMagnitude: 60 })).toBe(false);
    expect(needsMassDamageTest({ roundDamage: 15, startMagnitude: 60 })).toBe(true);
  });

  it("у Орды без стартовой Магнитуды теста не бывает", () => {
    expect(needsMassDamageTest({ roundDamage: 99, startMagnitude: 0 })).toBe(false);
  });
});

describe("психологический урон", () => {
  it("множители разные у теста массивных потерь, Страха и Запугивания", () => {
    expect(psychDamageFor("massDamage", 4)).toBe(12);
    expect(psychDamageFor("fear", 4)).toBe(8);
    expect(psychDamageFor("intimidate", 4)).toBe(4);
  });

  it("неизвестный источник урона не наносит", () => {
    expect(psychDamageFor("что-то", 4)).toBe(0);
  });
});

describe("состояние Орды", () => {
  it("боеспособна выше половины", () => {
    expect(hordeState({ value: 31, start: 60 })).toBe("steady");
  });

  it("ровно половина — уже Ослаблена", () => {
    expect(hordeState({ value: 30, start: 60 })).toBe("weakened");
  });

  it("четверть и меньше — Сломлена", () => {
    expect(hordeState({ value: 15, start: 60 })).toBe("broken");
  });

  it("несломляемая Орда доходит до Ослабленной и на этом останавливается", () => {
    expect(hordeState({ value: 1, start: 60, immune: true })).toBe("weakened");
  });

  it("часы без лечения психологического урона считаются от W.b", () => {
    expect(noRecoveryHours(3)).toBe(7);
    expect(noRecoveryHours(12)).toBe(0);
  });
});

describe("прячась в Орде", () => {
  it("одиночный выстрел: чётный бросок — в персонажа, нечётный — в Орду", () => {
    expect(hitsAbsorbedByHorde({ hitsCount: 1, rv: 42 })).toEqual([false]);
    expect(hitsAbsorbedByHorde({ hitsCount: 1, rv: 43 })).toEqual([true]);
  });

  it("очередь отдаёт Орде каждое нечётное попадание", () => {
    expect(hitsAbsorbedByHorde({ hitsCount: 5, rv: 42, burst: true }))
      .toEqual([true, false, true, false, true]);
  });

  it("очередь не смотрит на бросок — чётность там своя, по счёту попаданий", () => {
    expect(hitsAbsorbedByHorde({ hitsCount: 4, rv: 43, burst: true }))
      .toEqual([true, false, true, false]);
  });

  it("без попаданий делить нечего", () => {
    expect(hitsAbsorbedByHorde({ hitsCount: 0, rv: 43 })).toEqual([]);
  });
});
