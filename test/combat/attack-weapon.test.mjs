// test/combat/attack-weapon.test.mjs
//
// Фаза 1 конвейера со стороны оружия: чем именно бьют. Профиль и хват меняют
// урон, боеприпас и хват доливают свойства, выключенное оружие работает по
// правилу своего типа (стр. 209–211).
//
// Без Foundry: заглушка не импортируется, и это условие держится тестом.

import { describe, it, expect } from "vitest";
import { effectiveDamage, mergeExtraProps, weaponOffEffects } from "../../module/combat/attack-weapon.mjs";

describe("effectiveDamage", () => {
  const sys = { damage: "1d10+5", damageType: "X", penetration: 4 };

  it("без профиля берёт урон оружия", () => {
    expect(effectiveDamage({ sys })).toEqual({ damage: "1d10+5", damageType: "X", penetration: 4 });
  });

  it("профиль переопределяет урон, тип и Пробитие", () => {
    const profile = { damage: "1d10+9", damageType: "R", penetration: 7 };
    expect(effectiveDamage({ sys, profile })).toEqual({ damage: "1d10+9", damageType: "R", penetration: 7 });
  });

  it("профиль без своего урона оставляет урон оружия, но Пробитие берёт своё", () => {
    // Профиль без penetration — это Пробитие 0, а не «как у оружия»:
    // так записаны профили-захваты в книге.
    expect(effectiveDamage({ sys, profile: { label: "Захват" } }))
      .toEqual({ damage: "1d10+5", damageType: "X", penetration: 0 });
  });

  it("плоский мод хвата приписывается к формуле урона", () => {
    expect(effectiveDamage({ sys, gripDmgFlat: 3 }).damage).toBe("1d10+5+3");
    expect(effectiveDamage({ sys, gripDmgFlat: -2 }).damage).toBe("1d10+5-2");
  });

  it("пустому урону хват ничего не приписывает", () => {
    expect(effectiveDamage({ sys: { damage: "" }, gripDmgFlat: 3 }).damage).toBe("");
  });
});

describe("mergeExtraProps", () => {
  it("свойства хвата добавляются, если оружие их не имеет", () => {
    const entries = mergeExtraProps([{ key: "balanced", rating: 0, rating2: 0 }], { gripProps: ["precise"] });
    expect(entries.map(e => e.key)).toEqual(["balanced", "precise"]);
  });

  it("свойство боеприпаса добавляется, а совпавшее берёт больший рейтинг", () => {
    const entries = mergeExtraProps(
      [{ key: "felling", rating: 1, rating2: 0 }],
      { ammoProps: [{ key: "felling", rating: 3 }, { key: "toxic", rating: 2 }] }
    );
    expect(entries.find(e => e.key === "felling").rating).toBe(3);
    expect(entries.find(e => e.key === "toxic").rating).toBe(2);
  });

  it("больший рейтинг остаётся за оружием, если боеприпас слабее", () => {
    const entries = mergeExtraProps([{ key: "felling", rating: 4, rating2: 0 }], { ammoProps: [{ key: "felling", rating: 1 }] });
    expect(entries.find(e => e.key === "felling").rating).toBe(4);
  });

  it("свойство боеприпаса, записанное строкой, читается как ключ без рейтинга", () => {
    const entries = mergeExtraProps([], { ammoProps: ["tearing"] });
    expect(entries).toEqual([{ key: "tearing", rating: 0, rating2: 0 }]);
  });

  it("рейтинг-формула (строка) не участвует в максимизации", () => {
    const entries = mergeExtraProps([{ key: "blast", rating: "1d5", rating2: 0 }], { ammoProps: [{ key: "blast", rating: 2 }] });
    expect(entries.find(e => e.key === "blast").rating).toBe("1d5");
  });

  it("условные свойства боеприпаса, отмеченные игроком, доливаются как обычные", () => {
    const entries = mergeExtraProps([], { condProps: ["razorSharp"] });
    expect(entries).toEqual([{ key: "razorSharp", rating: 0, rating2: 0 }]);
  });

  it("свойства двуручного хвата приходят только в двуручном хвате", () => {
    const gripProps2h = [{ key: "concussive", rating: 0 }];
    expect(mergeExtraProps([], { gripKey: "2р", gripProps2h }).map(e => e.key)).toEqual(["concussive"]);
    expect(mergeExtraProps([], { gripKey: "1р", gripProps2h })).toEqual([]);
  });

  it("исходный список не портится", () => {
    const own = [{ key: "balanced", rating: 0, rating2: 0 }];
    mergeExtraProps(own, { ammoProps: [{ key: "toxic", rating: 2 }] });
    expect(own).toEqual([{ key: "balanced", rating: 0, rating2: 0 }]);
  });
});

describe("weaponOffEffects", () => {
  const chain = { weaponType: "chain", damage: "1d10+2", penetration: 2 };

  it("включённое оружие ничего не меняет", () => {
    const out = weaponOffEffects({ sys: chain, entries: [{ key: "tearing" }], on: false, basePen: 2 });
    expect(out).toMatchObject({ dmgMod: 0, penMod: 0, note: "", damage: null });
    expect(out.entries.map(e => e.key)).toEqual(["tearing"]);
  });

  it("цепное теряет 2 урона, 1 Пробитие и Рвущее", () => {
    const out = weaponOffEffects({ sys: chain, entries: [{ key: "tearing" }], on: true, basePen: 2 });
    expect(out.dmgMod).toBe(-2);
    expect(out.penMod).toBe(-1);
    expect(out.entries.map(e => e.key)).toEqual([]);
    expect(out.note).toContain("без Рвущего");
  });

  it("шоковое считается примитивным и теряет 2 урона", () => {
    const sys = { weaponType: "shock", damage: "1d10+3" };
    const out = weaponOffEffects({ sys, entries: [{ key: "shocking" }], on: true, basePen: 0 });
    expect(out.dmgMod).toBe(-2);
    expect(out.entries.map(e => e.key)).toEqual(["primitive"]);
  });

  it("силовое работает как свой примитивный аналог", () => {
    const sys = {
      weaponType: "power", damage: "1d10+9", penetration: 7,
      offProfile: { name: "Меч", damage: "1d10+2", penetration: 0 }
    };
    const out = weaponOffEffects({ sys, entries: [{ key: "powerField" }], on: true, basePen: 7 });
    expect(out.damage).toBe("1d10+2");
    expect(out.penMod).toBe(-7);                       // 0 − 7
    expect(out.entries.map(e => e.key)).toEqual(["primitive"]);
    expect(out.note).toContain("Меч");
  });

  it("силовое без примитивного профиля только предупреждает", () => {
    const sys = { weaponType: "power", damage: "1d10+9", penetration: 7 };
    const out = weaponOffEffects({ sys, entries: [], on: true, basePen: 7 });
    expect(out.damage).toBeNull();
    expect(out.penMod).toBe(0);
    expect(out.note).toContain("примитивное оружие");
  });

  it("мод хвата приписывается и к урону примитивного аналога", () => {
    const sys = { weaponType: "power", damage: "1d10+9", penetration: 7, offProfile: { name: "Меч", damage: "1d10+2", penetration: 0 } };
    expect(weaponOffEffects({ sys, entries: [], on: true, basePen: 7, gripDmgFlat: 3 }).damage).toBe("1d10+2+3");
  });

  it("оружие, которое не выключается, выключить нельзя", () => {
    const sys = { weaponType: "", damage: "1d10" };
    expect(weaponOffEffects({ sys, entries: [], on: true, basePen: 0 }).note).toBe("");
  });
});
