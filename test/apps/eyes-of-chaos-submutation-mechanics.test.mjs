// test/apps/eyes-of-chaos-submutation-mechanics.test.mjs
//
// wdbc-5inv/wdbc-e9e: субмутации 6-10 мутации Eyes of Chaos/Глаза Хаоса
// заведены Механикой самого предмета — тот же приём when.submutations, что у
// Multiple Eyes/Множественных Глаз, Tentacle/Щупальца и Strange Tongue.
//
// Тест появился при приёме стопки #441-#462: пять новых записей приехали без
// единого сторожа, при живом именном паттерне test/apps/<мутация>-submutation-
// mechanics.test.mjs у трёх соседних мутаций. Ровно такой тест и поймал бы
// подмену книжного «P метров» на «P.b» (wdbc-kcw).

import { describe, it, expect } from "vitest";
import { parseSubmutations } from "../../module/rules/submutations.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const eyesOfChaos = packDocById("packs-src/mutations/Общие_мутации", "U5BlbfojB0YMxHAf");
const submutations = parseSubmutations(eyesOfChaos.system.benefit);
const mechEntries = eyesOfChaos.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const withSub = mechEntries.filter(e => (e.when?.submutations ?? []).length);

const SKILL_BY_SUB = {
  "6":  { god: "slaanesh", skill: "interrogate" },
  "7":  { god: "nurgle",   skill: "charm" },
  "8":  { god: "khorne",   skill: "intimidate" },
  "9":  { god: "tzeentch", skill: "scrutiny" }
};

describe("Eyes of Chaos/Глаза Хаоса: Механика субмутаций 6-10 — данные согласованы", () => {
  it("в таблице СУБМУТАЦИИ реально есть строки 6, 7, 8, 9 и 10", () => {
    const labels = submutations.entries.map(e => e.label);
    for (const l of ["6", "7", "8", "9", "10"]) expect(labels).toContain(l);
  });

  it("каждая запись Механики с when.submutations ссылается на существующую строку таблицы", () => {
    const known = new Set(submutations.entries.map(e => e.label));
    const offenders = withSub.flatMap(e => e.when.submutations.filter(l => !known.has(l)));
    expect(offenders).toEqual([]);
  });

  it("ровно пять записей гейтованы субмутацией (6/7/8/9 — testMod, 10 — trait)", () => {
    expect(withSub).toHaveLength(5);
  });

  for (const [sub, { god, skill }] of Object.entries(SKILL_BY_SUB)) {
    it(`субмутация ${sub}: +10 к Навыку «${skill}», только у последователя ${god}`, () => {
      const e = withSub.find(x => x.when.submutations.includes(sub));
      expect(e.kind).toBe("testMod");
      expect(e.modScope).toBe("skill");
      expect(e.skillKey).toBe(skill);
      expect(Number(e.value)).toBe(10);
      expect(e.when.patronGod).toEqual([god]);
    });
  }

  // wdbc-kcw: книга даёт «на дальность до P метров» — ГОЛОЕ значение
  // Восприятия, не Бонус. «P.b» урезал бы дальность примерно вдесятеро.
  it("субмутация 10 выдаёт Черту «Взор сквозь Преграды» с рейтингом «perv», не «P.b»", () => {
    const e = withSub.find(x => x.when.submutations.includes("10"));
    expect(e.kind).toBe("trait");
    expect(e.sourceUuid).toContain("kYwoc0XZcFa0aUfF");
    expect(e.rating).toBe("perv");
    expect(e.rating).not.toBe("P.b");
  });

  // +10, а не +20: сверено с книжным текстом в system.benefit того же
  // документа («Он получает +10 на тесты Interrogate» и т.д.).
  // Двойной гейт submutation + patronGod складывается через «И»
  // (rules/mech-when.mjs) — иначе +20 достался бы всем подряд.
  it("гейт Покровителя реально работает: чужой Бог записи не получает", () => {
    const e = withSub.find(x => x.when.submutations.includes("8"));   // Кхорн
    const item = { system: { submutation: { label: "8" } } };
    const khorne = { system: { patronGod: "khorne" } };
    const nurgle = { system: { patronGod: "nurgle" } };
    expect(entryWhenOk(khorne, e, item)).toBe(true);
    expect(entryWhenOk(nurgle, e, item)).toBe(false);
  });

  it("субмутация не выбрана — ни одна запись не включается", () => {
    const item = { system: { submutation: { label: "" } } };
    const khorne = { system: { patronGod: "khorne" } };
    for (const e of withSub) expect(entryWhenOk(khorne, e, item)).toBe(false);
  });
});
