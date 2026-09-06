// test/rules/initiative.test.mjs
//
// wdbc-7zzr: четыре Таланта корбука (стр. 62) и Черта Эльдарского Тела
// (wdbc-s2tp) обещали Инициативу, которой не было. Здесь проверяются все три
// механизма из module/rules/initiative.mjs по отдельности и в связке — связка
// важнее всего: книга Аэльдари прямо говорит, что 3 броска расы и Талант
// «бросает 2 раза» дают ЧЕТЫРЕ, а не три и не два.

import { describe, it, expect } from "vitest";

import { initiativeCharKey, initiativeRolls, fastestHandBonus,
         INITIATIVE_CHAR_PREFIX, INITIATIVE_ADVANTAGE_CAPABILITY,
         INITIATIVE_EXTRA_ROLL_CAPABILITY, FASTEST_HAND_CAPABILITY, initiativeHint }
  from "../../module/rules/initiative.mjs";
import { isKnownCapability } from "../../module/constants/capabilities.mjs";

/** Актор с предметами, выдающими перечисленные возможности через Конструктор. */
function actorWith(capabilities = [], weapons = []) {
  const items = capabilities.map((key, i) => ({
    id: `cap${i}`, type: "trait",
    flags: { "warhammer-dbc": { mechanics: [{ id: `g${i}`, operator: "AND", entries: [
      { id: `e${i}`, kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  })).concat(weapons);
  return { items: Object.assign([...items], { contents: items }) };
}

/** Оружие в руке: класс и категория — то, по чему Самая Быстрая Рука решает. */
const weapon = (weaponClass, meleeCategory = "") => ({
  id: `w-${weaponClass}-${meleeCategory}`, type: "weapon",
  system: { equipped: true, weaponClass, meleeCategory, grips: "" },
  getFlag: () => null
});

/** Врождённая атака: тот же предмет-оружие, но помеченный integralAttack. */
const integral = (weaponClass, name = "врождённое") => ({
  id: `i-${weaponClass}-${name}`, type: "weapon", name,
  system: { equipped: true, weaponClass, meleeCategory: "", grips: "" },
  getFlag: (_ns, key) => (key === "integralAttack" ? true : null)
});

const CHARS = {
  ws:  { bonus: 4 }, bs: { bonus: 5 }, s: { bonus: 3 }, t: { bonus: 3 },
  ag:  { bonus: 3 }, int: { bonus: 6 }, per: { bonus: 2 }, wp: { bonus: 3 },
  fel: { bonus: 3 }
};

describe("initiativeCharKey: чем считается Инициатива (wdbc-7zzr)", () => {
  it("без возможностей — Ловкость", () => {
    expect(initiativeCharKey(actorWith(), CHARS)).toBe("ag");
  });

  it("Боевое Построение подменяет Ловкость Интеллектом", () => {
    const actor = actorWith([`${INITIATIVE_CHAR_PREFIX}int`]);
    expect(initiativeCharKey(actor, CHARS)).toBe("int");
  });

  it("подмена на ХУДШУЮ характеристику не срабатывает — книга разрешает, а не обязывает", () => {
    // Чувство Боя даёт P.b (2), Ловкость 3. «Может использовать» — значит
    // игрок оставил бы Ловкость, и система оставляет её за него.
    const actor = actorWith([`${INITIATIVE_CHAR_PREFIX}per`]);
    expect(initiativeCharKey(actor, CHARS)).toBe("ag");
  });

  it("две подмены разом — берётся лучшая из них", () => {
    const actor = actorWith([`${INITIATIVE_CHAR_PREFIX}int`, `${INITIATIVE_CHAR_PREFIX}per`]);
    expect(initiativeCharKey(actor, CHARS)).toBe("int");
  });
});

describe("initiativeRolls: сколько раз кидать (wdbc-7zzr, wdbc-s2tp)", () => {
  it("обычный персонаж кидает один раз", () => {
    expect(initiativeRolls(actorWith())).toBe(1);
  });

  it("Молниеносные Рефлексы — два броска", () => {
    expect(initiativeRolls(actorWith([INITIATIVE_EXTRA_ROLL_CAPABILITY]))).toBe(2);
  });

  it("Эльдарское Тело / Отеший — три броска", () => {
    expect(initiativeRolls(actorWith([INITIATIVE_ADVANTAGE_CAPABILITY]))).toBe(3);
  });

  it("эльдар с Молниеносными Рефлексами — четыре, как в Книге Аэльдари", () => {
    const actor = actorWith([INITIATIVE_ADVANTAGE_CAPABILITY, INITIATIVE_EXTRA_ROLL_CAPABILITY]);
    expect(initiativeRolls(actor)).toBe(4);
  });
});

describe("fastestHandBonus: Самая Быстрая Рука (wdbc-7zzr)", () => {
  const knife  = weapon("melee", "Нож");
  const sword  = weapon("melee", "Меч");
  const pistol = weapon("pistol");
  const rifle  = weapon("basic");

  it("без Таланта надбавки нет, даже с ножом в руке", () => {
    expect(fastestHandBonus(actorWith([], [knife]), CHARS)).toBe(0);
  });

  it("только ножи — надбавка равна WS.b", () => {
    expect(fastestHandBonus(actorWith([FASTEST_HAND_CAPABILITY], [knife]), CHARS)).toBe(4);
  });

  it("только пистолеты — надбавка равна BS.b", () => {
    expect(fastestHandBonus(actorWith([FASTEST_HAND_CAPABILITY], [pistol]), CHARS)).toBe(5);
  });

  it("нож и пистолет вместе — берётся большая из двух («на выбор»)", () => {
    expect(fastestHandBonus(actorWith([FASTEST_HAND_CAPABILITY], [knife, pistol]), CHARS)).toBe(5);
  });

  it("любое другое оружие в руках отменяет надбавку целиком", () => {
    expect(fastestHandBonus(actorWith([FASTEST_HAND_CAPABILITY], [knife, sword]), CHARS)).toBe(0);
    expect(fastestHandBonus(actorWith([FASTEST_HAND_CAPABILITY], [pistol, rifle]), CHARS)).toBe(0);
  });

  it("пустые руки — надбавки нет: Талант описывает вооружённого персонажа", () => {
    expect(fastestHandBonus(actorWith([FASTEST_HAND_CAPABILITY]), CHARS)).toBe(0);
  });

  // Врождённая атака — часть тела, а не то, чем персонаж ВООРУЖЁН. Без фильтра
  // ошибались обе стороны сразу, и обычный человек этого не показывал: у него
  // кулак и пинок занимают 0 рук и в handHeldItems не попадают вовсе.
  it("врождённая атака с классом «ranged» НЕ гасит Талант (были «Шипы», «Рёв»)", () => {
    // weaponClass "ranged" не значится в RANGED_CLASS_HANDS — предмет получал
    // руку по умолчанию и выключал надбавку насовсем.
    const actor = actorWith([FASTEST_HAND_CAPABILITY], [knife, integral("ranged", "Шипы")]);
    expect(fastestHandBonus(actor, CHARS)).toBe(4);
  });

  it("врождённая атака с классом «pistol» НЕ даёт надбавку (были «Вопль», «Плевок»)", () => {
    // Иначе кислотный плевок считался пистолетом и давал +BS.b с пустыми руками.
    const actor = actorWith([FASTEST_HAND_CAPABILITY], [integral("pistol", "Кислотный Плевок")]);
    expect(fastestHandBonus(actor, CHARS)).toBe(0);
  });

  it("настоящий пистолет рядом с врождённой атакой считается как раньше", () => {
    const actor = actorWith([FASTEST_HAND_CAPABILITY],
                            [pistol, integral("pistol", "Вопль")]);
    expect(fastestHandBonus(actor, CHARS)).toBe(5);
  });
});

describe("имена возможностей значатся в реестре", () => {
  it("все четыре имени известны Конструктору", () => {
    for (const key of [INITIATIVE_ADVANTAGE_CAPABILITY, INITIATIVE_EXTRA_ROLL_CAPABILITY,
                       FASTEST_HAND_CAPABILITY, `${INITIATIVE_CHAR_PREFIX}int`,
                       `${INITIATIVE_CHAR_PREFIX}per`]) {
      expect(isKnownCapability(key), key).toBe(true);
    }
  });
});

describe("initiativeHint: подсказка на листе объясняет число (wdbc-7zzr)", () => {
  it("обычный персонаж — прежняя формула по Ловкости", () => {
    expect(initiativeHint(actorWith(), CHARS)).toBe("1d10 + Ag.Бонус + модификатор");
  });

  it("подмена характеристики названа вместе с источником", () => {
    const items = [{
      id: "t", type: "talent", name: "Combat Formation / Боевое Построение",
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: `${INITIATIVE_CHAR_PREFIX}int`, label: "" }
      ] }] } }
    }];
    const actor = { items: Object.assign([...items], { contents: items }) };
    const hint = initiativeHint(actor, CHARS);
    expect(hint).toContain("Int.Бонус");
    expect(hint).toContain("вместо Ag.Бонуса");
  });

  it("число бросков попадает в подсказку", () => {
    const actor = actorWith([INITIATIVE_ADVANTAGE_CAPABILITY, INITIATIVE_EXTRA_ROLL_CAPABILITY]);
    expect(initiativeHint(actor, CHARS)).toContain("бросков 4");
  });
});
