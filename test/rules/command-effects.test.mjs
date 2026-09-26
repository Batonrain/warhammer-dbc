// test/rules/command-effects.test.mjs
//
// Бонусы Команд в бросках подчинённых (глава «Командование», wdbc-x1nz.2).
// Раньше Команды жили только карточкой в чате — игрок прибавлял «+6» сам.

import { describe, it, expect } from "vitest";
import { commandRulesFor, shortCommandEligible, matchesGeneralKind,
         braveryActive, moraleCommandActive, detailSpentOf, commandEffectNode,
         syncAssaultBonus, volleySuppressionMod, trainingSuccessCap } from "../../module/rules/command-effects.mjs";
import { DETAIL_COMMANDS } from "../../module/constants/squad.mjs";

const soldier = (over = {}) => ({
  uuid: "Actor.s", type: "character",
  system: { characteristics: { wp: { total: 30 }, per: { bonus: 4 } }, conditions: {}, ...over }
});

const node = (over = {}) => ({
  label: "Отряд «Копьё»",
  presence: { active: false, benefit: "extreme" },
  presenceWp: 50,
  short: { active: false },
  detail: { active: false, picks: [] },
  ...over
});

const bonusOf = rules => rules.filter(r => r.effects[0].kind === "rollBonus")
  .reduce((s, r) => s + r.effects[0].value, 0);

const ATTACK = { kind: "attack", isMelee: false };
const DODGE  = { kind: "skill", skill: "dodge", char: "ag" };
const MORALE = { kind: "skill", char: "wp", morale: true };

describe("Короткие Команды: к каким тестам", () => {
  it("атака, навык, Мораль — да; соц. навык, психосила, голые T/W — нет", () => {
    expect(shortCommandEligible(ATTACK)).toBe(true);
    expect(shortCommandEligible(DODGE)).toBe(true);
    expect(shortCommandEligible(MORALE)).toBe(true);
    expect(shortCommandEligible({ kind: "skill", skill: "charm", char: "fel" })).toBe(false);
    expect(shortCommandEligible({ kind: "power" })).toBe(false);
    expect(shortCommandEligible({ kind: "skill", char: "t" })).toBe(false);
    expect(shortCommandEligible({ kind: "skill", char: "wp" })).toBe(false);
    expect(shortCommandEligible({ kind: "skill", char: "t", poisonTest: true })).toBe(false);
    // Бросок Запугивания атакующего несёт morale:true, но тестом Морали не является.
    expect(shortCommandEligible({ kind: "skill", skill: "intimidate", char: "wp", morale: true })).toBe(false);
  });

  it("Общая Команда — только выбранный вид тестов", () => {
    expect(matchesGeneralKind("evasion", DODGE)).toBe(true);
    expect(matchesGeneralKind("evasion", ATTACK)).toBe(false);
    expect(matchesGeneralKind("skill:awareness", { kind: "skill", skill: "awareness" })).toBe(true);
    expect(matchesGeneralKind("terrain", { kind: "skill", char: "ag", terrain: true })).toBe(true);
  });
});

describe("commandRulesFor", () => {
  it("Воодушевление: +Успехи ко всем подходящим тестам", () => {
    const n = node({ short: { active: true, key: "inspire", successes: 4 } });
    expect(bonusOf(commandRulesFor(soldier(), [n], ATTACK))).toBe(4);
    expect(bonusOf(commandRulesFor(soldier(), [n], { kind: "power" }))).toBe(0);
  });

  it("Общая: ×3 на свой вид, Личная: ×5 только получателю", () => {
    const gen = node({ short: { active: true, key: "general", successes: 2, testKind: "evasion" } });
    expect(bonusOf(commandRulesFor(soldier(), [gen], DODGE))).toBe(6);
    expect(bonusOf(commandRulesFor(soldier(), [gen], ATTACK))).toBe(0);
    const pers = node({ short: { active: true, key: "personal", successes: 2, recipientUuid: "Actor.s" } });
    expect(bonusOf(commandRulesFor(soldier(), [pers], ATTACK))).toBe(10);
    expect(bonusOf(commandRulesFor({ ...soldier(), uuid: "Actor.x" }, [pers], ATTACK))).toBe(0);
  });

  it("несколько Коротких Команд не складываются — берётся наибольшая", () => {
    const a = node({ short: { active: true, key: "inspire", successes: 3 } });
    const b = node({ label: "Сержант", short: { active: true, key: "inspire", successes: 5 } });
    const rules = commandRulesFor(soldier(), [a, b], ATTACK);
    expect(bonusOf(rules)).toBe(5);
    expect(rules[0].label).toContain("Сержант");
  });

  it("Воля Командира: разница W к тесту Морали, только если выше своей", () => {
    const n = node({ presence: { active: true, benefit: "morale" }, presenceWp: 50 });
    expect(bonusOf(commandRulesFor(soldier(), [n], MORALE))).toBe(20);
    expect(bonusOf(commandRulesFor(soldier(), [{ ...n, presenceWp: 20 }], MORALE))).toBe(0);
    expect(bonusOf(commandRulesFor(soldier(), [n], ATTACK))).toBe(0);
  });

  it("Укрепление Морали ×5 и Воля Командира складываются (Присутствие — не Короткая Команда)", () => {
    const n = node({ presence: { active: true, benefit: "morale" }, presenceWp: 40,
                     short: { active: true, key: "morale", successes: 2 } });
    expect(bonusOf(commandRulesFor(soldier(), [n], MORALE))).toBe(20);
  });

  it("Храбрость — переброс Морали, Прикрытие — вложенные Успехи ×3 к Избеганию", () => {
    const n = node({ detail: { active: true, picks: ["bravery", "cover"], coverSuccesses: 4 } });
    const moraleRules = commandRulesFor(soldier(), [n], MORALE);
    expect(moraleRules.some(r => r.effects[0].kind === "rollMode")).toBe(true);
    expect(bonusOf(commandRulesFor(soldier(), [n], DODGE))).toBe(12);
    expect(braveryActive(soldier(), [n])).toBe(true);
  });

  it("проваливший Мораль слышит только «Укрепление Морали» и «Храбрость»", () => {
    const inspire = node({ moraleLost: true, short: { active: true, key: "inspire", successes: 4 } });
    expect(commandRulesFor(soldier(), [inspire], ATTACK)).toEqual([]);
    const morale = node({ moraleLost: true, short: { active: true, key: "morale", successes: 2 },
                          detail: { active: true, picks: ["bravery", "cover"], coverSuccesses: 3 } });
    expect(bonusOf(commandRulesFor(soldier(), [morale], MORALE))).toBe(10);
    expect(bonusOf(commandRulesFor(soldier(), [morale], DODGE))).toBe(0);
    expect(braveryActive(soldier(), [morale])).toBe(true);
    expect(moraleCommandActive(soldier(), [morale])).toBe(true);
    // Метка на самом акторе (проваленный Страх/Подавление) — то же самое.
    expect(commandRulesFor(soldier(), [node({ short: { active: true, key: "inspire", successes: 4 } })],
      ATTACK, { commandLost: true })).toEqual([]);
  });

  it("Оглохший и Орда Коротких Команд не получают; сверх F.b×2 — тоже", () => {
    const n = node({ short: { active: true, key: "inspire", successes: 4 } });
    expect(commandRulesFor(soldier({ conditions: { deafened: true } }), [n], ATTACK)).toEqual([]);
    expect(commandRulesFor({ ...soldier(), type: "horde" }, [n], ATTACK)).toEqual([]);
    expect(commandRulesFor(soldier(), [{ ...n, overCapacity: true }], ATTACK)).toEqual([]);
  });

  it("не больше ½ P.b командиров: при P.b 2 — один, сильнейший", () => {
    const a = node({ short: { active: true, key: "general", successes: 5, testKind: "evasion" } });
    const b = node({ label: "Сержант", short: { active: true, key: "inspire", successes: 2 } });
    const dull = soldier({ characteristics: { wp: { total: 30 }, per: { bonus: 2 } } });
    // Остаётся только a (5 Успехов) — его Общая на атаку не действует.
    expect(bonusOf(commandRulesFor(dull, [a, b], ATTACK))).toBe(0);
    expect(bonusOf(commandRulesFor(soldier(), [a, b], ATTACK))).toBe(2);
  });
});

describe("detailSpentOf", () => {
  it("Прикрытие стоит вложенные Успехи, не меньше 3", () => {
    expect(detailSpentOf({ picks: ["bravery", "cover"], coverSuccesses: 5 }, DETAIL_COMMANDS)).toBe(6);
    expect(detailSpentOf({ picks: ["cover"], coverSuccesses: 0 }, DETAIL_COMMANDS)).toBe(3);
  });
});

describe("остатки главы: Натиск, Залп, Дрессировка, эффект узла", () => {
  it("Синхронный Натиск: +10 за соратника в контакте", () => {
    expect(syncAssaultBonus(2)).toBe(20);
    expect(syncAssaultBonus(0)).toBe(0);
  });

  it("Залповый Огонь: Подавление +20 от трёх стрелков, −5 за каждые следующие три", () => {
    expect(volleySuppressionMod(2)).toBe(null);
    expect(volleySuppressionMod(3)).toBe(20);
    expect(volleySuppressionMod(6)).toBe(15);
    expect(volleySuppressionMod(9)).toBe(10);
  });

  it("Дрессировка: лимит 2 + продвижения Awareness и Survival (пример книги: +10 и +30 → 6)", () => {
    expect(trainingSuccessCap(10, 30)).toBe(6);
    expect(trainingSuccessCap(-20, 0)).toBe(2);
  });

  it("эффект Детальной Команды доходит до слышащего; «Храбрость» — и до проваливших Мораль", () => {
    const n = node({ detail: { active: true, picks: ["volley", "bravery"] } });
    expect(commandEffectNode(soldier(), [n], "volley")).toBe(n);
    expect(commandEffectNode(soldier(), [{ ...n, moraleLost: true }], "volley")).toBe(null);
    expect(commandEffectNode(soldier(), [{ ...n, moraleLost: true }], "bravery")).toBeTruthy();
    const p = node({ presence: { active: true, benefit: "focus" } });
    expect(commandEffectNode(soldier(), [p], "presence:focus")).toBe(p);
    expect(commandEffectNode({ ...soldier(), type: "horde" }, [p], "presence:focus")).toBe(null);
  });
});
