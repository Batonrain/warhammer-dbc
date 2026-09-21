// test/rules/legacy-weapon.test.mjs
//
// Оружие Наследия (корбук стр. 426-428): порог Возвышения, счёт Мутаций по
// Порче и то, что Наследие делает с профилем оружия.
//
// Таблицы Историй и Характеров проверяются здесь же на полноту: они набраны
// с разворота книги вручную, и потерянная строка иначе всплыла бы только за
// столом, когда бросок укажет в пустоту.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  LEGACY_HISTORIES, LEGACY_CHARACTERS, CHARACTER_ORDER, LEGACY_COMMON,
  MUTATION_THRESHOLDS, historyByRoll, mutationByRoll, entryText, rangeLabel
} from "../../module/constants/legacy-weapon.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";
import {
  canAscend, ascensionRows, isAstartes, isHeavyWeapon, hardProps,
  legacyBonus, qualityAfterLegacy, propsAfterLegacy,
  mutationSlots, nextMutationAt, mutationsAvailable, takenMutationNames,
  preciseLegacyDamageBonus, wrathLegacyDamageBonus, legacyWrathRules,
  legacyWrathRangedRof, legacyWrathEffectiveRof, betrayalLegacyActive,
  painLegacyProps, excessLegacyExtraDeg, legacyExcessRules, EXCESS_LEGACY_RULE_ID,
  plagueLegacyProps, bloodLegacyDamageBonus,
  rollLegacyChangeBonus, legacyChangeTestBonus, legacyChangeDamageBonus,
  bloodthirstyLegacyMeleeActive, tearingLegacyProps, shatteringLegacyGrant,
  stunningLegacyGrant, swiftLegacyMeleeGrant, swiftLegacyRangedDodgePenalty,
  swiftLegacyMeleeDodgePenalty, dishonorableLegacyActive, distractingLegacyActive,
  legacyGuardianRules, LEGACY_GUARDIAN_FLAG,
  earlyDeathLegacyDamageBonus, markEarlyDeathLegacyUsed,
  adaptiveLegacyMeleeDamageBonus, adaptiveLegacyMeleeWsBonus,
  slaughterLegacyGrant, viciousLegacyGrant,
  legacyInstinctiveInitiativeBonus, legacyForewarnedInitiativeBonus,
  legacyBloodPsychicRules, legacyInstinctiveDisarmRules, legacyDistractingCharSwapRules,
  guardianLegacyMeleeActive, guardianLegacyBalanceFloor,
  unassailableLegacyDodgeAdvantage,
  unbreakableLegacyActive, unbreakableLegacyBalanceFloor,
  clearLegacyPunisherStacks
} from "../../module/rules/legacy-weapon.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";

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

  it("Перебор/fearsome 8-8 (стр. 427) — полный Inf.b вместо половины", () => {
    const w = weapon({ legacy: { mutations: [{ name: "Перебор" }] } });
    expect(legacyBonus(owner({ infBonus: 5 }), w)).toBe(5);
    expect(legacyBonus(owner({ infBonus: 4 }), w)).toBe(4);
  });

  it("без Мутации Перебор — половина, как обычно", () => {
    const w = weapon({ legacy: { mutations: [{ name: "Рваное" }] } });
    expect(legacyBonus(owner({ infBonus: 5 }), w)).toBe(3);
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

describe("Сверхточное (skilled 9-9, стр. 428)", () => {
  const preciseWeapon = () => weapon({ legacy: { mutations: [{ name: "Сверхточное" }] } });

  it("+1 Dmg за каждый чётный Успех, одиночный выстрел с Прицеливанием", () => {
    expect(preciseLegacyDamageBonus({ weapon: preciseWeapon(), hit: true, deg: 5, rofMode: "single", isMelee: false, aimed: true })).toBe(2);
    expect(preciseLegacyDamageBonus({ weapon: preciseWeapon(), hit: true, deg: 4, rofMode: "single", isMelee: false, aimed: true })).toBe(2);
    expect(preciseLegacyDamageBonus({ weapon: preciseWeapon(), hit: true, deg: 1, rofMode: "single", isMelee: false, aimed: true })).toBe(0);
  });

  it("рукопашная с Прицеливанием считается так же", () => {
    expect(preciseLegacyDamageBonus({ weapon: preciseWeapon(), hit: true, deg: 3, rofMode: "melee", isMelee: true, aimed: true })).toBe(1);
  });

  it("без Прицеливания бонуса нет — ни на выстреле, ни в рукопашной", () => {
    expect(preciseLegacyDamageBonus({ weapon: preciseWeapon(), hit: true, deg: 5, rofMode: "single", isMelee: false, aimed: false })).toBe(0);
    expect(preciseLegacyDamageBonus({ weapon: preciseWeapon(), hit: true, deg: 5, rofMode: "melee", isMelee: true, aimed: false })).toBe(0);
  });

  it("очередь (semi/full) не даёт бонуса даже с Прицеливанием — книга говорит «одиночные выстрелы»", () => {
    expect(preciseLegacyDamageBonus({ weapon: preciseWeapon(), hit: true, deg: 5, rofMode: "semi", isMelee: false, aimed: true })).toBe(0);
  });

  it("промах не даёт бонуса", () => {
    expect(preciseLegacyDamageBonus({ weapon: preciseWeapon(), hit: false, deg: 5, rofMode: "single", isMelee: false, aimed: true })).toBe(0);
  });

  it("без самой Мутации на оружии — 0", () => {
    const w = weapon({ legacy: { mutations: [{ name: "Рваное" }] } });
    expect(preciseLegacyDamageBonus({ weapon: w, hit: true, deg: 5, rofMode: "single", isMelee: false, aimed: true })).toBe(0);
  });
});

describe("Наследие Гнева (История 2, стр. 427)", () => {
  const wrathWeapon = () => weapon({ legacy: { historyName: "Наследие Гнева" } });

  it("+2 Dmg по цели Ненависти носителя", () => {
    const actor = { items: [{ type: "talent", name: "Hatred / Ненависть", system: { targets: [raceTarget("ork", "Орк")] } }] };
    const target = { system: { race: "ork" } };
    expect(wrathLegacyDamageBonus({ weapon: wrathWeapon(), actor, hit: true, targetActor: target })).toBe(2);
  });

  it("без совпавшей цели Ненависти — 0", () => {
    const actor = { items: [{ type: "talent", name: "Hatred / Ненависть", system: { targets: [raceTarget("ork", "Орк")] } }] };
    const target = { system: { race: "eldar" } };
    expect(wrathLegacyDamageBonus({ weapon: wrathWeapon(), actor, hit: true, targetActor: target })).toBe(0);
  });

  it("без самого Таланта Ненависти у носителя — 0", () => {
    const actor = { items: [] };
    expect(wrathLegacyDamageBonus({ weapon: wrathWeapon(), actor, hit: true, targetActor: { system: { race: "ork" } } })).toBe(0);
  });

  it("без Истории «Наследие Гнева» на оружии — 0", () => {
    const actor = { items: [{ type: "talent", name: "Hatred / Ненависть", system: { targets: [raceTarget("ork")] } }] };
    const w = weapon({ legacy: { historyName: "Наследие Бойни" } });
    expect(wrathLegacyDamageBonus({ weapon: w, actor, hit: true, targetActor: { system: { race: "ork" } } })).toBe(0);
  });

  it("промах не даёт бонуса", () => {
    const actor = { items: [{ type: "talent", name: "Hatred / Ненависть", system: { targets: [raceTarget("ork")] } }] };
    expect(wrathLegacyDamageBonus({ weapon: wrathWeapon(), actor, hit: false, targetActor: { system: { race: "ork" } } })).toBe(0);
  });
});

describe("Наследие Ярости (История 3, стр. 427) — штраф I/P", () => {
  const rageWeapon = ({ cls = "melee", historyName = "Наследие Ярости", equipped = true } = {}) => {
    const w = weapon({ cls, legacy: { active: true, historyName } });
    w.system.equipped = equipped;
    return w;
  };

  it("даёт штраф −10 на I/P, пока экипировано рукопашное Оружие Наследия", () => {
    const actor = { items: [rageWeapon()] };
    const rules = legacyWrathRules(actor);
    expect(rules).toHaveLength(1);
    expect(rules[0].when).toEqual({ charIn: ["int", "per"] });
    expect(rules[0].effects).toEqual([{ kind: "rollBonus", target: "all", value: -10, auto: true }]);
  });

  it("не экипировано — правил нет", () => {
    const actor = { items: [rageWeapon({ equipped: false })] };
    expect(legacyWrathRules(actor)).toEqual([]);
  });

  it("ранговая ветка той же Истории (иной weaponClass) — штрафа нет (другой книжный текст)", () => {
    const actor = { items: [rageWeapon({ cls: "basic" })] };
    expect(legacyWrathRules(actor)).toEqual([]);
  });

  it("без самой Истории на оружии — правил нет", () => {
    const actor = { items: [rageWeapon({ historyName: "Наследие Бойни" })] };
    expect(legacyWrathRules(actor)).toEqual([]);
  });
});

describe("Наследие Ярости (История 3, стр. 427) — ranged RoF-ветка", () => {
  const rangedWeapon = ({ cls = "basic", historyName = "Наследие Ярости", rof_semi = 0, rof_full = 0 } = {}) => ({
    type: "weapon", system: { weaponClass: cls, rof_single: 1, rof_semi, rof_full, legacy: { active: true, historyName } }
  });

  it("S/−/− (нет очередей) становится S/2/−", () => {
    expect(legacyWrathRangedRof(rangedWeapon())).toEqual({ rof_semi: 2, rof_full: 0 });
  });

  it("+1 к бОльшей из существующих очередей — full больше semi", () => {
    expect(legacyWrathRangedRof(rangedWeapon({ rof_semi: 2, rof_full: 6 }))).toEqual({ rof_semi: 2, rof_full: 7 });
  });

  it("+1 к бОльшей — semi больше full (full=0)", () => {
    expect(legacyWrathRangedRof(rangedWeapon({ rof_semi: 3, rof_full: 0 }))).toEqual({ rof_semi: 4, rof_full: 0 });
  });

  it("ничья — в пользу full", () => {
    expect(legacyWrathRangedRof(rangedWeapon({ rof_semi: 4, rof_full: 4 }))).toEqual({ rof_semi: 4, rof_full: 5 });
  });

  it("рукопашное оружие — null (другая ветка той же Истории)", () => {
    expect(legacyWrathRangedRof(rangedWeapon({ cls: "melee" }))).toBe(null);
  });

  it("без Истории — null", () => {
    expect(legacyWrathRangedRof(rangedWeapon({ historyName: "Наследие Бойни" }))).toBe(null);
  });

  it("legacyWrathEffectiveRof подмешивает бонус в клон sys, не трогая оригинал", () => {
    const w = rangedWeapon({ rof_semi: 0, rof_full: 0 });
    const eff = legacyWrathEffectiveRof(w.system, w);
    expect(eff.rof_semi).toBe(2);
    expect(w.system.rof_semi).toBe(0);
  });

  it("legacyWrathEffectiveRof без Истории отдаёт тот же sys без изменений", () => {
    const w = rangedWeapon({ historyName: "Наследие Бойни", rof_semi: 3 });
    expect(legacyWrathEffectiveRof(w.system, w)).toBe(w.system);
  });
});

describe("Наследие Предательства (История 4, стр. 427)", () => {
  const betrayalWeapon = () => weapon({ legacy: { historyName: "Наследие Предательства" } });

  it("цель не видит персонажа (unseen) — сработало", () => {
    expect(betrayalLegacyActive({ weapon: betrayalWeapon(), hit: true, unseen: true, targetSurprised: false })).toBe(true);
  });

  it("цель Застигнута Врасплох (targetSurprised) — сработало", () => {
    expect(betrayalLegacyActive({ weapon: betrayalWeapon(), hit: true, unseen: false, targetSurprised: true })).toBe(true);
  });

  it("ни то ни другое — не сработало", () => {
    expect(betrayalLegacyActive({ weapon: betrayalWeapon(), hit: true, unseen: false, targetSurprised: false })).toBe(false);
  });

  it("промах — не сработало, даже при unseen", () => {
    expect(betrayalLegacyActive({ weapon: betrayalWeapon(), hit: false, unseen: true, targetSurprised: false })).toBe(false);
  });

  it("без самой Истории на оружии — не сработало", () => {
    const w = weapon({ legacy: { historyName: "Наследие Бойни" } });
    expect(betrayalLegacyActive({ weapon: w, hit: true, unseen: true, targetSurprised: false })).toBe(false);
  });
});

describe("painLegacyProps — Наследие Боли (История 5, стр. 427)", () => {
  it("без Calling — добавляет Crippling(1)", () => {
    expect(painLegacyProps([])).toEqual([{ key: "crippling", rating: 1 }]);
  });

  it("уже есть Crippling — добавляет Shocking вместо второго Crippling", () => {
    const props = [{ key: "crippling", rating: 2 }];
    expect(painLegacyProps(props)).toEqual([{ key: "crippling", rating: 2 }, { key: "shocking" }]);
  });

  it("уже есть и Crippling, и Shocking — ничего не меняет", () => {
    const props = [{ key: "crippling", rating: 1 }, { key: "shocking" }];
    expect(painLegacyProps(props)).toEqual(props);
  });

  it("не мутирует исходный массив", () => {
    const props = [];
    painLegacyProps(props);
    expect(props).toEqual([]);
  });
});

describe("excessLegacyExtraDeg — Наследие Излишеств (История 6, стр. 427), половина 1", () => {
  const excessWeapon = () => weapon({ legacy: { historyName: "Наследие Излишеств" } });

  it("успешная атака этим оружием — +1 к Степени", () => {
    expect(excessLegacyExtraDeg({ hit: true, weapon: excessWeapon() })).toBe(1);
  });

  it("промах — 0", () => {
    expect(excessLegacyExtraDeg({ hit: false, weapon: excessWeapon() })).toBe(0);
  });

  it("другая История — 0", () => {
    const w = weapon({ legacy: { historyName: "Наследие Бойни" } });
    expect(excessLegacyExtraDeg({ hit: true, weapon: w })).toBe(0);
  });
});

describe("legacyExcessRules — Наследие Излишеств (История 6, стр. 427), половина 2", () => {
  const excessActor = ({ equipped = true, char = "int" } = {}) => {
    const w = weapon({ legacy: { active: true, historyName: "Наследие Излишеств", excessChar: char } });
    w.system.equipped = equipped;
    return { items: [w] };
  };

  it("даёт опциональную +10 на тест выбранной Характеристики", () => {
    const rules = legacyExcessRules(excessActor({ char: "int" }));
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe(EXCESS_LEGACY_RULE_ID);
    expect(rules[0].when).toEqual({ charIn: ["int"] });
    expect(rules[0].effects).toEqual([{ kind: "rollBonus", target: "all", value: 10 }]);
  });

  it("без выбранной Характеристики (ещё не выбрана игроком) — правил нет", () => {
    const rules = legacyExcessRules(excessActor({ char: "" }));
    expect(rules).toEqual([]);
  });

  it("не экипировано — правил нет", () => {
    expect(legacyExcessRules(excessActor({ equipped: false }))).toEqual([]);
  });

  it("эффект НЕ auto — опциональная галочка, не автоматический штраф/бонус", () => {
    const rules = legacyExcessRules(excessActor());
    expect(rules[0].effects[0].auto).toBeUndefined();
  });
});

describe("plagueLegacyProps — Наследие Чумы (История 7, стр. 427)", () => {
  it("без Toxic — добавляет Toxic(0)", () => {
    expect(plagueLegacyProps([])).toEqual([{ key: "toxic", rating: 0 }]);
  });

  it("уже есть Toxic — рейтинг +1", () => {
    expect(plagueLegacyProps([{ key: "toxic", rating: 2 }])).toEqual([{ key: "toxic", rating: 2 + 1 }]);
  });

  it("не трогает прочие свойства", () => {
    const props = [{ key: "tearing" }, { key: "toxic", rating: 0 }];
    expect(plagueLegacyProps(props)).toEqual([{ key: "tearing" }, { key: "toxic", rating: 1 }]);
  });

  it("не мутирует исходный массив", () => {
    const props = [{ key: "toxic", rating: 0 }];
    plagueLegacyProps(props);
    expect(props[0].rating).toBe(0);
  });
});

describe("bloodLegacyDamageBonus — Наследие Крови (История 8, стр. 427)", () => {
  it("+1 Dmg при попадании", () => {
    const w = weapon({ legacy: { historyName: "Наследие Крови" } });
    expect(bloodLegacyDamageBonus({ weapon: w, hit: true })).toBe(1);
  });

  it("промах — 0", () => {
    const w = weapon({ legacy: { historyName: "Наследие Крови" } });
    expect(bloodLegacyDamageBonus({ weapon: w, hit: false })).toBe(0);
  });

  it("другая История — 0", () => {
    const w = weapon({ legacy: { historyName: "Наследие Бойни" } });
    expect(bloodLegacyDamageBonus({ weapon: w, hit: true })).toBe(0);
  });
});

describe("Наследие Перемен (История 9, стр. 427)", () => {
  beforeEach(() => resetCaptured());
  const changeWeapon = (id = "w1") => { const w = weapon({ legacy: { active: true, historyName: "Наследие Перемен" } }); w.id = id; w.system.equipped = true; return w; };

  describe("rollLegacyChangeBonus", () => {
    it("не дубль — сумма идёт в testBonus, damageBonus 0", async () => {
      const w = changeWeapon();
      captured.dice = [2, 4];
      const flag = await rollLegacyChangeBonus({ items: [w] });
      expect(flag).toEqual({ weaponId: "w1", testBonus: 6, damageBonus: 0 });
    });

    it("дубль — testBonus 0, damageBonus = значение кубика", async () => {
      const w = changeWeapon();
      captured.dice = [3, 3];
      const flag = await rollLegacyChangeBonus({ items: [w] });
      expect(flag).toEqual({ weaponId: "w1", testBonus: 0, damageBonus: 3 });
    });

    it("нет экипированного Оружия Наследия с этой Историей — null", async () => {
      const flag = await rollLegacyChangeBonus({ items: [] });
      expect(flag).toBe(null);
    });
  });

  describe("legacyChangeTestBonus / legacyChangeDamageBonus", () => {
    it("флаг про ЭТО оружие — бонус теста отдаётся", () => {
      const w = changeWeapon("w1");
      const actor = { getFlag: () => ({ weaponId: "w1", testBonus: 6, damageBonus: 0 }) };
      expect(legacyChangeTestBonus(actor, w)).toBe(6);
    });

    it("флаг про ДРУГОЕ оружие — 0", () => {
      const w = changeWeapon("w1");
      const actor = { getFlag: () => ({ weaponId: "w2", testBonus: 6, damageBonus: 0 }) };
      expect(legacyChangeTestBonus(actor, w)).toBe(0);
    });

    it("нет флага — 0", () => {
      const w = changeWeapon("w1");
      const actor = { getFlag: () => undefined };
      expect(legacyChangeTestBonus(actor, w)).toBe(0);
    });

    it("damageBonus — только при попадании и совпавшем оружии", () => {
      const w = changeWeapon("w1");
      const actor = { getFlag: () => ({ weaponId: "w1", testBonus: 0, damageBonus: 3 }) };
      expect(legacyChangeDamageBonus(actor, w, true)).toBe(3);
      expect(legacyChangeDamageBonus(actor, w, false)).toBe(0);
    });
  });
});

describe("bloodthirstyLegacyMeleeActive — Кровожадное/fearsome 1-2, рукопашная (стр. 427)", () => {
  const meleeWeapon = () => weapon({ cls: "melee", legacy: { mutations: [{ name: "Кровожадное" }] } });

  it("совершал Натиск (meleeBase==='charge') — активно", () => {
    const actor = { system: { meleeBase: "charge" } };
    expect(bloodthirstyLegacyMeleeActive(actor, meleeWeapon())).toBe(true);
  });

  it("не Натиск — неактивно", () => {
    const actor = { system: { meleeBase: "standard" } };
    expect(bloodthirstyLegacyMeleeActive(actor, meleeWeapon())).toBe(false);
  });

  it("ранговое оружие с тем же именем Мутации — неактивно (другая ветка текста)", () => {
    const actor = { system: { meleeBase: "charge" } };
    const w = weapon({ cls: "basic", legacy: { mutations: [{ name: "Кровожадное" }] } });
    expect(bloodthirstyLegacyMeleeActive(actor, w)).toBe(false);
  });

  it("без самой Мутации — неактивно", () => {
    const actor = { system: { meleeBase: "charge" } };
    const w = weapon({ cls: "melee", legacy: { mutations: [{ name: "Рваное" }] } });
    expect(bloodthirstyLegacyMeleeActive(actor, w)).toBe(false);
  });
});

describe("tearingLegacyProps — Рваное/fearsome 3-4 (стр. 427)", () => {
  it("без Tearing — добавляет Tearing", () => {
    expect(tearingLegacyProps([], 4)).toEqual([{ key: "tearing" }]);
  });

  it("уже есть Tearing — добавляет Proven(½Inf.b окр.▲)", () => {
    expect(tearingLegacyProps([{ key: "tearing" }], 5)).toEqual([{ key: "tearing" }, { key: "proven", rating: 3 }]);
  });

  it("Inf.b=4 — Proven(2) (½×4, без округления)", () => {
    expect(tearingLegacyProps([{ key: "tearing" }], 4)).toEqual([{ key: "tearing" }, { key: "proven", rating: 2 }]);
  });

  it("уже есть и Tearing, и Proven — ничего не меняет", () => {
    const props = [{ key: "tearing" }, { key: "proven", rating: 2 }];
    expect(tearingLegacyProps(props, 5)).toEqual(props);
  });
});

describe("shatteringLegacyGrant — Разбивающее/fearsome 5-6 (стр. 427)", () => {
  it("рукопашное без Power Field — добавляет Power Field, penDelta 0", () => {
    const w = weapon({ cls: "melee", props: [] });
    expect(shatteringLegacyGrant(w)).toEqual({ props: [{ key: "powerField" }], penDelta: 0 });
  });

  it("рукопашное УЖЕ с Power Field — penDelta 2, props не меняются", () => {
    const w = weapon({ cls: "melee", props: [{ key: "powerField" }] });
    expect(shatteringLegacyGrant(w)).toEqual({ props: [{ key: "powerField" }], penDelta: 2 });
  });

  it("стрелковое без Razor Sharp — добавляет Razor Sharp, penDelta 0", () => {
    const w = weapon({ cls: "basic", props: [] });
    expect(shatteringLegacyGrant(w)).toEqual({ props: [{ key: "razorSharp" }], penDelta: 0 });
  });

  it("стрелковое УЖЕ с Razor Sharp — penDelta 2", () => {
    const w = weapon({ cls: "basic", props: [{ key: "razorSharp" }] });
    expect(shatteringLegacyGrant(w)).toEqual({ props: [{ key: "razorSharp" }], penDelta: 2 });
  });
});

describe("stunningLegacyGrant — Ошеломляющее/fearsome 7-7 (стр. 427)", () => {
  it("рукопашное без Concussive — Concussive(½Inf.b окр.▲)", () => {
    const w = weapon({ cls: "melee", props: [] });
    expect(stunningLegacyGrant(w, 5)).toEqual([{ key: "concussive", rating: 3 }]);
  });

  it("рукопашное УЖЕ с Concussive — +1 к рейтингу", () => {
    const w = weapon({ cls: "melee", props: [{ key: "concussive", rating: 2 }] });
    expect(stunningLegacyGrant(w, 5)).toEqual([{ key: "concussive", rating: 3 }]);
  });

  it("стрелковое без Concussive — фиксированный рейтинг 1, Inf.b не влияет", () => {
    const w = weapon({ cls: "basic", props: [] });
    expect(stunningLegacyGrant(w, 9)).toEqual([{ key: "concussive", rating: 1 }]);
  });

  it("стрелковое УЖЕ с Concussive — +1 к рейтингу", () => {
    const w = weapon({ cls: "basic", props: [{ key: "concussive", rating: 4 }] });
    expect(stunningLegacyGrant(w, 9)).toEqual([{ key: "concussive", rating: 5 }]);
  });
});

describe("swiftLegacyMeleeGrant — Быстрое/skilled 8-8, рукопашная (стр. 428)", () => {
  it("без Flexible — грантует Flexible, swiftDodgePenalty false", () => {
    const w = weapon({ cls: "melee", props: [] });
    expect(swiftLegacyMeleeGrant(w)).toEqual({ props: [{ key: "flexible" }], swiftDodgePenalty: false });
  });

  it("уже была Flexible — props не меняются, swiftDodgePenalty true", () => {
    const w = weapon({ cls: "melee", props: [{ key: "flexible" }] });
    expect(swiftLegacyMeleeGrant(w)).toEqual({ props: [{ key: "flexible" }], swiftDodgePenalty: true });
  });
});

describe("swiftLegacy*DodgePenalty — Быстрое/skilled 8-8 (стр. 428), живые модификаторы", () => {
  it("рукопашное с флагом swiftDodgePenalty — −10", () => {
    const w = weapon({ cls: "melee", legacy: { mutations: [{ name: "Быстрое" }], swiftDodgePenalty: true } });
    expect(swiftLegacyMeleeDodgePenalty(w)).toBe(-10);
  });

  it("рукопашное без флага (грант, не повтор) — 0", () => {
    const w = weapon({ cls: "melee", legacy: { mutations: [{ name: "Быстрое" }], swiftDodgePenalty: false } });
    expect(swiftLegacyMeleeDodgePenalty(w)).toBe(0);
  });

  it("стрелковое с Мутацией — безусловно −20", () => {
    const w = weapon({ cls: "basic", legacy: { mutations: [{ name: "Быстрое" }] } });
    expect(swiftLegacyRangedDodgePenalty(w)).toBe(-20);
  });

  it("без самой Мутации — 0 на обеих функциях", () => {
    const wMelee = weapon({ cls: "melee", legacy: { mutations: [], swiftDodgePenalty: true } });
    const wRanged = weapon({ cls: "basic", legacy: { mutations: [] } });
    expect(swiftLegacyMeleeDodgePenalty(wMelee)).toBe(0);
    expect(swiftLegacyRangedDodgePenalty(wRanged)).toBe(0);
  });
});

describe("dishonorableLegacyActive — Бесчестное/skilled 10-10 (стр. 428)", () => {
  const w = () => weapon({ legacy: { mutations: [{ name: "Бесчестное" }] } });

  it("unseen — активно", () => expect(dishonorableLegacyActive({ weapon: w(), hit: true, unseen: true, targetSurprised: false })).toBe(true));
  it("targetSurprised — активно", () => expect(dishonorableLegacyActive({ weapon: w(), hit: true, unseen: false, targetSurprised: true })).toBe(true));
  it("ни то ни другое — неактивно", () => expect(dishonorableLegacyActive({ weapon: w(), hit: true, unseen: false, targetSurprised: false })).toBe(false));
  it("промах — неактивно", () => expect(dishonorableLegacyActive({ weapon: w(), hit: false, unseen: true, targetSurprised: false })).toBe(false));
});

describe("distractingLegacyActive — Отвлекающее/skilled 3-4, стрелковая (стр. 427-428)", () => {
  it("стрелковое с Мутацией — активно", () => {
    expect(distractingLegacyActive(weapon({ cls: "basic", legacy: { mutations: [{ name: "Отвлекающее" }] } }))).toBe(true);
  });
  it("рукопашное с той же Мутацией — неактивно (другая ветка текста)", () => {
    expect(distractingLegacyActive(weapon({ cls: "melee", legacy: { mutations: [{ name: "Отвлекающее" }] } }))).toBe(false);
  });
  it("без Мутации — неактивно", () => {
    expect(distractingLegacyActive(weapon({ cls: "basic", legacy: { mutations: [] } }))).toBe(false);
  });
});

describe("legacyGuardianRules / legacyGuardianMarked — Защитник/vigilant 8-8, стрелковая (стр. 428)", () => {
  it("правило безусловно −30 на 'attack', гейтится предикатом legacyGuardianMarked", () => {
    const rules = legacyGuardianRules();
    expect(rules).toEqual([{
      id: "legacyGuardian.rangedPenalty", label: expect.any(String),
      when: { legacyGuardianMarked: true },
      effects: [{ kind: "rollBonus", target: "attack", value: -30 }]
    }]);
  });

  it("предикат: меченый атакует ИМЕННО отметившего стрелка — true", () => {
    const shooter = { uuid: "Actor.shooter" };
    const actor = { getFlag: (scope, key) => (key === LEGACY_GUARDIAN_FLAG ? { shooterUuid: shooter.uuid } : undefined) };
    expect(PREDICATES.legacyGuardianMarked(actor, { targetActor: shooter })).toBe(true);
  });

  it("предикат: меченый атакует ДРУГУЮ цель — false", () => {
    const shooter = { uuid: "Actor.shooter" };
    const other = { uuid: "Actor.other" };
    const actor = { getFlag: (scope, key) => (key === LEGACY_GUARDIAN_FLAG ? { shooterUuid: shooter.uuid } : undefined) };
    expect(PREDICATES.legacyGuardianMarked(actor, { targetActor: other })).toBe(false);
  });

  it("предикат: нет метки — false", () => {
    const actor = { getFlag: () => undefined };
    expect(PREDICATES.legacyGuardianMarked(actor, { targetActor: { uuid: "x" } })).toBe(false);
  });
});

describe("earlyDeathLegacyDamageBonus/markEarlyDeathLegacyUsed — Скорая Кончина/versatile 7-7 (стр. 428)", () => {
  const earlyDeathWeapon = () => weapon({ legacy: { mutations: [{ name: "Скорая Кончина" }] } });
  const battleActor = () => ({ flags: {}, getFlag(scope, key) { return this.flags[key]; }, async setFlag(scope, key, v) { this.flags[key] = v; } });

  beforeEach(() => { globalThis.game.combat = { id: "battle-1" }; });

  it("первое попадание за бой — +3 Dmg", () => {
    const actor = battleActor();
    expect(earlyDeathLegacyDamageBonus({ weapon: earlyDeathWeapon(), actor, hit: true })).toBe(3);
  });

  it("после markEarlyDeathLegacyUsed — второе попадание того же боя без бонуса", async () => {
    const actor = battleActor();
    const w = earlyDeathWeapon();
    await markEarlyDeathLegacyUsed(actor, w, true);
    expect(earlyDeathLegacyDamageBonus({ weapon: w, actor, hit: true })).toBe(0);
  });

  it("промах — 0, markEarlyDeathLegacyUsed ничего не пишет", async () => {
    const actor = battleActor();
    const w = earlyDeathWeapon();
    expect(earlyDeathLegacyDamageBonus({ weapon: w, actor, hit: false })).toBe(0);
    await markEarlyDeathLegacyUsed(actor, w, false);
    expect(actor.flags).toEqual({});
  });

  it("без самой Мутации — 0", () => {
    const actor = battleActor();
    const w = weapon({ legacy: { mutations: [{ name: "Рваное" }] } });
    expect(earlyDeathLegacyDamageBonus({ weapon: w, actor, hit: true })).toBe(0);
  });
});

describe("adaptiveLegacyMeleeDamageBonus/adaptiveLegacyMeleeWsBonus — Адаптивное/versatile 8-8, рукопашная (стр. 428)", () => {
  const adaptiveWeapon = () => weapon({ cls: "melee", legacy: { mutations: [{ name: "Адаптивное" }] } });

  it("2 врага в контакте с атакующим — +1 Dmg и +10 WS", () => {
    expect(adaptiveLegacyMeleeDamageBonus({ weapon: adaptiveWeapon(), hit: true, attackerContactCount: 2 })).toBe(1);
    expect(adaptiveLegacyMeleeWsBonus({ weapon: adaptiveWeapon(), attackerContactCount: 2 })).toBe(10);
  });

  it("3 врага — +1 Dmg (перевес есть), но WS-бонус только РОВНО за 2к1 — 0", () => {
    expect(adaptiveLegacyMeleeDamageBonus({ weapon: adaptiveWeapon(), hit: true, attackerContactCount: 3 })).toBe(1);
    expect(adaptiveLegacyMeleeWsBonus({ weapon: adaptiveWeapon(), attackerContactCount: 3 })).toBe(0);
  });

  it("1 враг (нет перевеса) — оба 0", () => {
    expect(adaptiveLegacyMeleeDamageBonus({ weapon: adaptiveWeapon(), hit: true, attackerContactCount: 1 })).toBe(0);
    expect(adaptiveLegacyMeleeWsBonus({ weapon: adaptiveWeapon(), attackerContactCount: 1 })).toBe(0);
  });

  it("стрелковое оружие с той же Мутацией — 0 (другая ветка книги)", () => {
    const w = weapon({ cls: "basic", legacy: { mutations: [{ name: "Адаптивное" }] } });
    expect(adaptiveLegacyMeleeDamageBonus({ weapon: w, hit: true, attackerContactCount: 3 })).toBe(0);
  });
});

describe("slaughterLegacyGrant — Резня/merciless 7-7 (стр. 428)", () => {
  it("без Devastating — грантует Devastating(½Inf.b окр.▲)", () => {
    expect(slaughterLegacyGrant({ system: { weaponProps: [] } }, 5)).toEqual([{ key: "devastating", rating: 3 }]);
  });

  it("уже есть Devastating — +1 к рейтингу", () => {
    const w = { system: { weaponProps: [{ key: "devastating", rating: 2 }] } };
    expect(slaughterLegacyGrant(w, 5)).toEqual([{ key: "devastating", rating: 3 }]);
  });
});

describe("viciousLegacyGrant — Злобное/merciless 9-9 (стр. 428)", () => {
  it("без Crippling — грантует Crippling(½Inf.b окр.▲)", () => {
    expect(viciousLegacyGrant({ system: { weaponProps: [] } }, 5)).toEqual([{ key: "crippling", rating: 3 }]);
  });

  it("уже есть Crippling — +1 к рейтингу", () => {
    const w = { system: { weaponProps: [{ key: "crippling", rating: 1 }] } };
    expect(viciousLegacyGrant(w, 4)).toEqual([{ key: "crippling", rating: 2 }]);
  });
});

describe("legacyInstinctiveInitiativeBonus — Инстинктивное/versatile 1-2 (стр. 428)", () => {
  const instinctiveWeapon = ({ equipped = true } = {}) => {
    const w = weapon({ legacy: { active: true, mutations: [{ name: "Инстинктивное" }] } });
    w.system.equipped = equipped;
    return w;
  };

  it("экипировано — +2 к Инициативе", () => {
    const actor = { items: [instinctiveWeapon()] };
    expect(legacyInstinctiveInitiativeBonus(actor)).toBe(2);
  });

  it("не экипировано — 0 (книга требует именно ношения)", () => {
    const actor = { items: [instinctiveWeapon({ equipped: false })] };
    expect(legacyInstinctiveInitiativeBonus(actor)).toBe(0);
  });

  it("нет такого оружия/Мутации — 0", () => {
    expect(legacyInstinctiveInitiativeBonus({ items: [] })).toBe(0);
  });
});

describe("legacyForewarnedInitiativeBonus — Без Предупреждения/versatile 9-9 (стр. 428)", () => {
  const forewarnedWeapon = ({ equipped = true } = {}) => {
    const w = weapon({ legacy: { active: true, mutations: [{ name: "Без Предупреждения" }] } });
    w.system.equipped = equipped;
    return w;
  };

  it("экипировано (даже сложено — гейт только по ношению) — +½Inf.b(окр.▲)", () => {
    const actor = { items: [forewarnedWeapon()] };
    expect(legacyForewarnedInitiativeBonus(actor, 5)).toBe(3); // ½×5=2.5→3
  });

  it("не экипировано — 0", () => {
    const actor = { items: [forewarnedWeapon({ equipped: false })] };
    expect(legacyForewarnedInitiativeBonus(actor, 5)).toBe(0);
  });

  it("нет такого оружия/Мутации — 0", () => {
    expect(legacyForewarnedInitiativeBonus({ items: [] }, 5)).toBe(0);
  });
});

describe("legacyBloodPsychicRules — Наследие Крови (История 8, стр. 427)", () => {
  const bloodWeapon = ({ equipped = true } = {}) => {
    const w = weapon({ legacy: { active: true, historyName: "Наследие Крови" } });
    w.system.equipped = equipped;
    return w;
  };

  it("экипировано — +10 на встречный тест против психической угрозы, авто", () => {
    const actor = { items: [bloodWeapon()] };
    const rules = legacyBloodPsychicRules(actor);
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([{ kind: "rollBonus", target: "psychicthreat", value: 10, auto: true }]);
  });

  it("не экипировано — правил нет", () => {
    const actor = { items: [bloodWeapon({ equipped: false })] };
    expect(legacyBloodPsychicRules(actor)).toEqual([]);
  });

  it("нет такой Истории — правил нет", () => {
    expect(legacyBloodPsychicRules({ items: [] })).toEqual([]);
  });
});

describe("legacyInstinctiveDisarmRules — Инстинктивное/versatile 1-2 (стр. 428)", () => {
  const instinctiveWeapon = ({ equipped = true } = {}) => {
    const w = weapon({ legacy: { active: true, mutations: [{ name: "Инстинктивное" }] } });
    w.system.equipped = equipped;
    return w;
  };

  it("экипировано — грантует combat.cannotBeDisarmed", () => {
    const actor = { items: [instinctiveWeapon()] };
    expect(legacyInstinctiveDisarmRules(actor)).toEqual([{
      id: "legacyInstinctive.disarmImmune",
      label: "Инстинктивное: нельзя быть обезоруженным",
      when: {},
      effects: [{ kind: "grantFlag", target: "combat.cannotBeDisarmed" }]
    }]);
  });

  it("не экипировано — правил нет", () => {
    const actor = { items: [instinctiveWeapon({ equipped: false })] };
    expect(legacyInstinctiveDisarmRules(actor)).toEqual([]);
  });

  it("нет такой Мутации — правил нет", () => {
    expect(legacyInstinctiveDisarmRules({ items: [] })).toEqual([]);
  });
});

describe("legacyDistractingCharSwapRules — Отвлекающее/skilled 3-4, рукопашная ветка (стр. 427-428)", () => {
  const distractingWeapon = ({ cls = "melee", equipped = true } = {}) => {
    const w = weapon({ cls, legacy: { active: true, mutations: [{ name: "Отвлекающее" }] } });
    w.system.equipped = equipped;
    return w;
  };

  it("экипировано рукопашное — грантует оба charSwap на Финт", () => {
    const actor = { items: [distractingWeapon()] };
    const rules = legacyDistractingCharSwapRules(actor);
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([
      { kind: "grantFlag", target: "charSwap.fel.forWs" },
      { kind: "grantFlag", target: "charSwap.int.forWs" }
    ]);
  });

  it("стрелковая ветка той же Мутации (другой weaponClass) — правил нет", () => {
    const actor = { items: [distractingWeapon({ cls: "basic" })] };
    expect(legacyDistractingCharSwapRules(actor)).toEqual([]);
  });

  it("не экипировано — правил нет", () => {
    const actor = { items: [distractingWeapon({ equipped: false })] };
    expect(legacyDistractingCharSwapRules(actor)).toEqual([]);
  });

  it("нет такой Мутации — правил нет", () => {
    expect(legacyDistractingCharSwapRules({ items: [] })).toEqual([]);
  });
});

describe("guardianLegacyMeleeActive / guardianLegacyBalanceFloor — Защитник/vigilant 8-8, рукопашная (стр. 428)", () => {
  it("рукопашное оружие с Мутацией — активно", () => {
    const w = weapon({ cls: "melee", legacy: { mutations: [{ name: "Защитник" }] } });
    expect(guardianLegacyMeleeActive(w)).toBe(true);
  });

  it("стрелковое оружие с той же Мутацией — не активно (другая ветка книги)", () => {
    const w = weapon({ cls: "basic", legacy: { mutations: [{ name: "Защитник" }] } });
    expect(guardianLegacyMeleeActive(w)).toBe(false);
  });

  it("активно и Баланс отрицательный — поднимается до 0", () => {
    const w = weapon({ cls: "melee", legacy: { mutations: [{ name: "Защитник" }] } });
    expect(guardianLegacyBalanceFloor(w, -3)).toBe(0);
  });

  it("активно и Баланс уже неотрицательный — не трогает", () => {
    const w = weapon({ cls: "melee", legacy: { mutations: [{ name: "Защитник" }] } });
    expect(guardianLegacyBalanceFloor(w, 2)).toBe(2);
  });

  it("не активно — Баланс проходит как есть, даже отрицательный", () => {
    const w = weapon({ cls: "basic", legacy: { mutations: [{ name: "Защитник" }] } });
    expect(guardianLegacyBalanceFloor(w, -3)).toBe(-3);
  });
});

describe("unassailableLegacyDodgeAdvantage — Неприкасаемый/vigilant 5-6 (стр. 428)", () => {
  const unassailableWeapon = ({ cls = "melee", equipped = true } = {}) => {
    const w = weapon({ cls, legacy: { active: true, mutations: [{ name: "Неприкасаемый" }] } });
    w.system.equipped = equipped;
    return w;
  };

  it("рукопашное, Защитная Стойка — переброс Избегания доступен", () => {
    const actor = { items: [unassailableWeapon()], system: { meleeStance: "defensive" } };
    expect(unassailableLegacyDodgeAdvantage(actor, false)).toBe(true);
  });

  it("рукопашное, не Защитная Стойка — недоступен, даже если inCover=true", () => {
    const actor = { items: [unassailableWeapon()], system: { meleeStance: "standard" } };
    expect(unassailableLegacyDodgeAdvantage(actor, true)).toBe(false);
  });

  it("метательное — та же (рукопашная) ветка условия, что и melee", () => {
    const actor = { items: [unassailableWeapon({ cls: "thrown" })], system: { meleeStance: "defensive" } };
    expect(unassailableLegacyDodgeAdvantage(actor, false)).toBe(true);
  });

  it("стрелковое, в Укрытии — переброс доступен", () => {
    const actor = { items: [unassailableWeapon({ cls: "basic" })], system: {} };
    expect(unassailableLegacyDodgeAdvantage(actor, true)).toBe(true);
  });

  it("стрелковое, не в Укрытии — недоступен", () => {
    const actor = { items: [unassailableWeapon({ cls: "basic" })], system: {} };
    expect(unassailableLegacyDodgeAdvantage(actor, false)).toBe(false);
  });

  it("не экипировано — недоступен", () => {
    const actor = { items: [unassailableWeapon({ equipped: false })], system: { meleeStance: "defensive" } };
    expect(unassailableLegacyDodgeAdvantage(actor, false)).toBe(false);
  });

  it("нет такой Мутации — недоступен", () => {
    expect(unassailableLegacyDodgeAdvantage({ items: [], system: {} }, true)).toBe(false);
  });
});

describe("unbreakableLegacyActive / unbreakableLegacyBalanceFloor — Неприступное/versatile 5-6 (стр. 428)", () => {
  it("есть Мутация — активно (не важно, экипировано ли — переброс завязан на само оружие)", () => {
    const w = weapon({ legacy: { mutations: [{ name: "Неприступное" }] } });
    expect(unbreakableLegacyActive(w)).toBe(true);
  });

  it("нет Мутации — не активно", () => {
    const w = weapon({ legacy: { mutations: [{ name: "Единство" }] } });
    expect(unbreakableLegacyActive(w)).toBe(false);
  });

  it("активно и Баланс отрицательный — поднимается до 0", () => {
    const w = weapon({ legacy: { mutations: [{ name: "Неприступное" }] } });
    expect(unbreakableLegacyBalanceFloor(w, -2)).toBe(0);
  });

  it("не активно — Баланс проходит как есть", () => {
    const w = weapon({ legacy: { mutations: [{ name: "Единство" }] } });
    expect(unbreakableLegacyBalanceFloor(w, -2)).toBe(-2);
  });
});

describe("clearLegacyPunisherStacks — Каратель, снятие на конец боя (module/hooks.mjs::deleteCombat)", () => {
  function actorWithPunisherFlag(flagValue) {
    const store = { flag: flagValue, unsetCalls: 0 };
    return {
      store,
      getFlag: (_scope, key) => (key === "legacyPunisherStacks" ? store.flag : undefined),
      async unsetFlag() { store.unsetCalls++; store.flag = undefined; }
    };
  }

  it("флаг есть — снимает его", async () => {
    const a = actorWithPunisherFlag({ w1: 6 });
    await clearLegacyPunisherStacks(a);
    expect(a.store.unsetCalls).toBe(1);
    expect(a.getFlag("warhammer-dbc", "legacyPunisherStacks")).toBeUndefined();
  });

  it("флага нет — не трогает (не падает, не зовёт unsetFlag)", async () => {
    const a = actorWithPunisherFlag(undefined);
    await clearLegacyPunisherStacks(a);
    expect(a.store.unsetCalls).toBe(0);
  });

  it("нет актора — не падает", async () => {
    await expect(clearLegacyPunisherStacks(null)).resolves.toBeUndefined();
  });
});
