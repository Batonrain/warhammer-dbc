// test/rules/human-subraces.test.mjs
//
// Субрасы Людей (корбук, глава I) — сверка 26.09.2026: максимум Бесчестия
// Наследника/Затупленного, уровни Затупленного, закрытые Архетипы, пороги
// мутаций «как Космодесантник», выбор Навыка Мутанта (одна специализация
// Группы), выбор субмутации «в пределах 1-10». Данные субрас — из настоящих
// JSON packs-src.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { infamyMaxWithMod, actorInfamyMax } from "../../module/apps/infamy-points.mjs";
import { subraceCostAt, subraceEntries } from "../../module/apps/race-library.mjs";
import { archetypesForRace } from "../../module/apps/archetypes.mjs";
import { nextMutationThreshold } from "../../module/rules/character.mjs";
import { resolveAptitudeOverride } from "../../module/rules/aptitude-overrides.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { aptitudeOverrideMechanicsGroup, SUBRACE_APTITUDE_CHOICES } from "../../module/apps/subrace-choice.mjs";
import { choosableSubmutations } from "../../module/apps/submutations.mjs";
import { mechFormulaTotal, mechRollData } from "../../module/rules/mech-formula.mjs";

const SUB = "packs-src/races/Субрасы";
const entriesOf = doc => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

describe("максимум Очков Бесчестия со сдвигом субрасы", () => {
  it("Наследник +1", () => expect(infamyMaxWithMod(4, 1)).toBe(5));
  it("Затупленный −N, но не ниже 1", () => {
    expect(infamyMaxWithMod(4, -1)).toBe(3);
    expect(infamyMaxWithMod(3, -4)).toBe(1);
  });
  it("понижение не поднимает нулевой максимум до 1", () => expect(infamyMaxWithMod(0, -2)).toBe(0));
  it("сдвиг — только у Хаосита; лоялист — fate.max как было", () => {
    const sys = { characteristics: { inf: { bonus: 4 } }, infamyMaxMod: 1, fate: { max: 2 } };
    expect(actorInfamyMax({ type: "character", system: { ...sys, alignment: "heretic" } })).toBe(5);
    expect(actorInfamyMax({ type: "character", system: { ...sys, alignment: "loyalist" } })).toBe(2);
  });
  it("Наследник и Затупленный в паке пишут в цель «infamy»", () => {
    const heir = entriesOf(packDocById(SUB, "KqziTmtHgJvntkjH")).find(e => e.kind === "poolMax");
    const blunt = entriesOf(packDocById(SUB, "AYWhzwq9qbfsX6zJ")).find(e => e.kind === "poolMax");
    expect([heir.poolTarget, heir.value]).toEqual(["infamy", "1"]);
    expect([blunt.poolTarget, blunt.value]).toEqual(["infamy", "-subtier"]);
  });
});

describe("Затупленный — уровни 1–4", () => {
  const doc = packDocById(SUB, "AYWhzwq9qbfsX6zJ");
  it("цена по уровню из пака", () => {
    expect([1, 2, 3, 4].map(t => subraceCostAt(doc.system, t))).toEqual([500, 750, 1000, 1250]);
    expect(subraceCostAt(doc.system, 9)).toBe(1250);
  });
  it("без уровней — обычная цена", () => expect(subraceCostAt({ cost: 1500 }, 3)).toBe(1500));
  it("рейтинг Blunted и штраф — формулой от уровня", () => {
    const rd = mechRollData({ system: { subraceTier: 3 } });
    const blunted = entriesOf(doc).find(e => e.kind === "trait");
    expect(mechFormulaTotal(blunted.rating, rd)).toBe(3);
    expect(mechFormulaTotal("-subtier", rd)).toBe(-3);
  });
});

describe("закрытые Архетипы субрас", () => {
  const keys = sub => archetypesForRace("human", { subrace: sub }).map(([k]) => k);
  it("Затупленный и Пария — без Ведьмы и Беглого Псайкера", () => {
    for (const sub of ["stunted", "pariah"]) {
      expect(keys(sub)).not.toContain("witch");
      expect(keys(sub)).not.toContain("renegadePsyker");
    }
  });
  it("Дискордант — без Еретеха и Скитария", () => {
    expect(keys("discordant")).not.toContain("heretek");
    expect(keys("discordant")).not.toContain("skitarii");
  });
  it("без субрасы всё на месте (контроль)", () => {
    expect(keys("")).toEqual(expect.arrayContaining(["witch", "renegadePsyker", "heretek", "skitarii"]));
  });
  it("пак несёт те же списки, что и запасные данные", () => {
    expect(packDocById(SUB, "yhWmN6R4OVPU1YBn").system.bannedArchetypes).toEqual(subraceEntries().pariah.bannedArchetypes);
    expect(packDocById(SUB, "T1qnNY6k1t1Mqu7O").system.bannedArchetypes).toEqual(subraceEntries().discordant.bannedArchetypes);
  });
});

describe("пороги мутаций Затупленного — как у Космодесантника", () => {
  it("Cor 20 → следующий порог 30 (у человека был бы 40)", () => {
    expect(nextMutationThreshold({ race: "human", subrace: "stunted", corruption: { value: 20 } })).toBe(30);
    expect(nextMutationThreshold({ race: "human", corruption: { value: 20 } })).toBe(40);
  });
  it("поблажка лоялисту — только настоящим Астартес", () => {
    expect(nextMutationThreshold({ race: "human", subrace: "stunted", alignment: "loyalist", corruption: { value: 0 } })).toBe(10);
  });
});

describe("Мутант: Deceive ИЛИ For.Lore (Mutants)", () => {
  const saved = getRuleSources();
  afterEach(() => { clearRuleSources(); for (const [k, fn] of saved) registerRuleSource(k, fn); });
  const withMatch = match => {
    clearRuleSources();
    registerRuleSource("t", () => [{ id: "t", when: {}, effects: [{ kind: "grantAptitudeOverride", scope: "skill", match, align: "ally" }] }]);
  };
  const actor = { system: {}, items: [] };

  it("выбор — два варианта, один Навык", () => {
    const cfg = SUBRACE_APTITUDE_CHOICES.mutant;
    expect(cfg.skillCount).toBe(1);
    expect(cfg.skillOptions).toHaveLength(2);
  });
  it("Запретные знания (Мутанты) — дружественна только эта специализация", () => {
    const match = SUBRACE_APTITUDE_CHOICES.mutant.skillOptions[1].match;
    withMatch(match);
    expect(resolveAptitudeOverride(actor, "skill", "Запретные знания", "forbiddenLore", { specialty: "Мутанты" })).toBe("ally");
    expect(resolveAptitudeOverride(actor, "skill", "Запретные знания", "forbiddenLore", { specialty: "Демоны" })).toBeNull();
  });
  it("группа выбора пишет строку сопоставления как есть", () => {
    const g = aptitudeOverrideMechanicsGroup({ matches: ["Обман"] });
    expect(g.entries.map(e => [e.capabilityAptScope, e.capabilityAptMatch])).toEqual([["skill", "Обман"]]);
  });
});

describe("Мутант: доп. мутация из списка 12 и выбор субмутации", () => {
  const mutant = packDocById(SUB, "3TDfjUprrA0tWMRI");
  const pick = entriesOf(mutant).find(e => e.kind === "equipment" && e.equipMode === "choice");
  it("выбор сужен до 12 мутаций книги, строка выбирается", () => {
    expect(pick.equipChoiceIds).toHaveLength(12);
    expect(pick.submutationChoice).toBe(true);
  });
  it("строки 1–10 Хвоста; враждебный Бог закрыт", () => {
    const tail = packDocById("packs-src/mutations/Общие_мутации", "F7iMcjy64r5w52bz");
    const rows = choosableSubmutations(tail, "khorne");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => r.entry.lo >= 1 && r.entry.hi <= 10)).toBe(true);
    expect(rows.find(r => r.entry.god === "slaanesh")?.blocked).toBe(true);
  });
});
