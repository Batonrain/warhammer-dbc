// test/rules/legacy-weapon.test.mjs
//
// Оружие Наследия (корбук стр. 426-428): порог Возвышения, счёт Мутаций по
// Порче и то, что Наследие делает с профилем оружия.
//
// Таблицы Историй и Характеров проверяются здесь же на полноту: они набраны
// с разворота книги вручную, и потерянная строка иначе всплыла бы только за
// столом, когда бросок укажет в пустоту.

import { describe, it, expect } from "vitest";
import {
  LEGACY_HISTORIES, LEGACY_CHARACTERS, CHARACTER_ORDER, LEGACY_COMMON,
  MUTATION_THRESHOLDS, historyByRoll, mutationByRoll, entryText, rangeLabel
} from "../../module/constants/legacy-weapon.mjs";
import {
  canAscend, ascensionRows, isAstartes, isHeavyWeapon, hardProps,
  legacyBonus, qualityAfterLegacy, propsAfterLegacy,
  mutationSlots, nextMutationAt, mutationsAvailable, takenMutationNames
} from "../../module/rules/legacy-weapon.mjs";

/** Оружие: класс, редкость, свойства и состояние Наследия. */
const weapon = ({ cls = "melee", availability = 0, props = [], legacy = {}, daemon = false } = {}) => ({
  type: "weapon",
  system: {
    weaponClass: cls, availability, weaponProps: props, quality: "common",
    damage: "1d10+4", penetration: 2,
    daemonWeapon: { bound: daemon },
    legacy: { active: false, mutations: [], ...legacy }
  }
});

/** Владелец: Бесчестие (значение и бонус) и Порча. */
const owner = ({ inf = 40, infBonus = 4, cor = 0, race = "", items = [] } = {}) => ({
  name: "Чемпион", items, system: {
    race, characteristics: { inf: { total: inf, bonus: infBonus } },
    corruption: { value: cor }
  }
});

describe("таблицы книги", () => {
  it("Историй ровно десять, по одной на каждый результат 1d10", () => {
    expect(LEGACY_HISTORIES).toHaveLength(10);
    expect(LEGACY_HISTORIES.map(h => h.roll)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  });

  it("Характеров пять, и каждый покрывает 1d10 без дыр", () => {
    expect(CHARACTER_ORDER).toHaveLength(5);
    for (const key of CHARACTER_ORDER) {
      const entries = LEGACY_CHARACTERS[key].entries;
      expect(entries[0].min).toBe(1);
      expect(entries.at(-1).max).toBe(10);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].min).toBe(entries[i - 1].max + 1);
      }
    }
  });

  it("у каждой записи есть текст: общий либо оба вида отдельно", () => {
    const all = [...LEGACY_HISTORIES, ...CHARACTER_ORDER.flatMap(k => LEGACY_CHARACTERS[k].entries)];
    for (const e of all) {
      const ok = e.both ? !!e.both.trim() : (!!e.melee?.trim() && !!e.ranged?.trim());
      expect({ name: e.name, ok }).toEqual({ name: e.name, ok: true });
    }
  });

  it("рукопашное и стрелковое расходятся там, где книга их развела", () => {
    const rage = historyByRoll(3);
    expect(entryText(rage, true)).toMatch(/Ярость/);
    expect(entryText(rage, false)).toMatch(/RoF/);
    // Общая запись отдаёт один текст обоим.
    const blood = historyByRoll(8);
    expect(entryText(blood, true)).toBe(entryText(blood, false));
  });

  it("Мутация ищется по диапазону броска", () => {
    expect(mutationByRoll("fearsome", 1).name).toBe("Кровожадное");
    expect(mutationByRoll("fearsome", 2).name).toBe("Кровожадное");
    expect(mutationByRoll("fearsome", 10).name).toBe("Кромсающее");
    expect(mutationByRoll("нет-такого", 5)).toBe(null);
    expect(rangeLabel(mutationByRoll("fearsome", 1))).toBe("1-2");
    expect(rangeLabel(mutationByRoll("fearsome", 7))).toBe("7");
  });

  it("общих свойств четыре, и Качество среди них", () => {
    expect(LEGACY_COMMON).toHaveLength(4);
    expect(LEGACY_COMMON.join(" ")).toMatch(/Качество/);
  });
});

describe("можно ли возвысить", () => {
  it("демоническое оружие Наследием не бывает", () => {
    const res = canAscend(weapon({ daemon: true }));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Демоническое/);
  });

  it("уже возвышенное не возвышают повторно", () => {
    expect(canAscend(weapon({ legacy: { active: true } })).ok).toBe(false);
  });

  it("обычное оружие возвысить можно", () => {
    expect(canAscend(weapon()).ok).toBe(true);
  });
});

describe("порог Возвышения", () => {
  it("основа — Бесчестие владельца", () => {
    const { threshold } = ascensionRows(owner({ inf: 45 }), weapon());
    expect(threshold).toBe(45);
  });

  it("Редкость сдвигает порог на −10 за ступень, а Качество не учитывается вовсе", () => {
    // Мутация «взять общую сложность реквизиции» провалила бы именно это:
    // Качество Best.Q даёт там −30, а книга велит его игнорировать.
    const rare = weapon({ availability: 2 });
    rare.system.quality = "best";
    expect(ascensionRows(owner({ inf: 40 }), rare).threshold).toBe(20);
  });

  it("Тяжёлое оружие и «громкие» свойства дают по −10", () => {
    const heavy = weapon({ cls: "heavy", props: [{ key: "storm" }, { key: "melta" }] });
    // Штраф за свойства берётся один раз, сколько бы их ни было.
    expect(ascensionRows(owner({ inf: 60 }), heavy).threshold).toBe(40);
    expect(hardProps(heavy)).toEqual(["melta", "storm"]);
    expect(isHeavyWeapon(heavy)).toBe(true);
  });

  it("Астартес с оружием Legion получает +10, обычный человек — нет", () => {
    const legion = weapon({ props: [{ key: "legion" }] });
    expect(ascensionRows(owner({ inf: 40, race: "astartes" }), legion).threshold).toBe(50);
    expect(ascensionRows(owner({ inf: 40 }), legion).threshold).toBe(40);
  });

  it("Астартес узнаётся и по Черте, не только по расе", () => {
    const byTrait = owner({ items: [{ type: "trait", name: "Astartes / Астартес" }] });
    expect(isAstartes(byTrait)).toBe(true);
    expect(isAstartes(owner())).toBe(false);
  });

  it("бонус за подвиги ограничен +30, а Легендарное берёт его всегда", () => {
    expect(ascensionRows(owner({ inf: 40 }), weapon(), { deedBonus: 99 }).threshold).toBe(70);
    expect(ascensionRows(owner({ inf: 40 }), weapon(), { deedBonus: -5 }).threshold).toBe(40);
    expect(ascensionRows(owner({ inf: 40 }), weapon(), { legendary: true }).threshold).toBe(70);
  });
});

describe("что Наследие делает с профилем", () => {
  it("бонус к Dmg и Pen — половина Inf.b, округляя вверх", () => {
    expect(legacyBonus(owner({ infBonus: 4 }))).toBe(2);
    expect(legacyBonus(owner({ infBonus: 5 }))).toBe(3);
    expect(legacyBonus(owner({ infBonus: 0 }))).toBe(0);
  });

  it("Качество поднимается на ступень и упирается в высшее", () => {
    expect(qualityAfterLegacy("poor")).toBe("common");
    expect(qualityAfterLegacy("good")).toBe("best");
    expect(qualityAfterLegacy("best")).toBe("best");
  });

  it("прибавляется Reinforced, снимается Primitive, прочее не трогается", () => {
    const out = propsAfterLegacy([{ key: "primitive" }, { key: "tearing", rating: 1 }]);
    expect(out.map(p => p.key).sort()).toEqual(["reinforced", "tearing"]);
    expect(out.find(p => p.key === "tearing").rating).toBe(1);
  });

  it("второй Reinforced не задваивается", () => {
    expect(propsAfterLegacy([{ key: "reinforced" }])).toHaveLength(1);
  });
});

describe("Мутации по Порче", () => {
  it("по одной на каждый пройденный порог 20/40/60/80", () => {
    expect(MUTATION_THRESHOLDS).toEqual([20, 40, 60, 80]);
    expect(mutationSlots(0)).toBe(0);
    expect(mutationSlots(19)).toBe(0);
    expect(mutationSlots(20)).toBe(1);
    expect(mutationSlots(59)).toBe(2);
    expect(mutationSlots(100)).toBe(4);
  });

  it("подсказывает, при какой Порче откроется следующая", () => {
    expect(nextMutationAt(0)).toBe(20);
    expect(nextMutationAt(45)).toBe(60);
    expect(nextMutationAt(80)).toBe(null);
  });

  it("доступно = положено минус взятое", () => {
    const w = weapon({ legacy: { active: true, mutations: [{ name: "Рваное" }] } });
    expect(mutationsAvailable(owner({ cor: 45 }), w)).toBe(1);
    expect(mutationsAvailable(owner({ cor: 20 }), w)).toBe(0);
  });

  it("унаследованное оружие не теряет Мутации при нехватке Порчи", () => {
    // Книга прямо разрешает держать чужие Мутации (стр. 428) — отрицательного
    // остатка тут быть не должно, иначе лист предложил бы «отобрать».
    const w = weapon({ legacy: { active: true, mutations: [{ name: "A" }, { name: "B" }, { name: "C" }] } });
    expect(mutationsAvailable(owner({ cor: 0 }), w)).toBe(0);
  });

  it("уже выпавшее помнится — по нему идёт переброс", () => {
    const w = weapon({ legacy: { mutations: [{ name: "Рваное" }, { name: "Убийца" }] } });
    expect([...takenMutationNames(w)].sort()).toEqual(["Рваное", "Убийца"]);
  });
});
