// test/rules/psy-focus.test.mjs
//
// Фокус Дисциплины (wdbc-l6zg) — чистые данные: выбор игрока
// (actor.system.psyker.focusDisciplines) объединённый с дисциплинами,
// дарованными способностями (Perfect Sorcerer). Проверяем только сложение
// множеств — сама механика «изучения» психосил ещё не существует.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { ownFocusDisciplines, grantedFocusDisciplines, effectiveFocusDisciplines, hasFocusDiscipline }
  from "../../module/rules/psy-focus.mjs";
import { PERFECT_SORCERER_CAPABILITY, PERFECT_SORCERER_FOCUS_DISCIPLINES }
  from "../../module/rules/perfect-sorcerer.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function grantPerfectSorcererTo(bearer) {
  registerRuleSource("test", a => a === bearer
    ? [{ id: "test.perfectSorcerer", when: {}, effects: [{ kind: "grantFlag", target: PERFECT_SORCERER_CAPABILITY }] }]
    : []);
}

describe("ownFocusDisciplines", () => {
  it("пусто, если поля нет вовсе (актор ещё не псайкер)", () => {
    expect(ownFocusDisciplines({ system: {} })).toEqual([]);
    expect(ownFocusDisciplines({ system: { psyker: {} } })).toEqual([]);
  });

  it("возвращает выбор игрока как есть", () => {
    const actor = { system: { psyker: { focusDisciplines: ["telekinesis", "biomancy"] } } };
    expect(ownFocusDisciplines(actor)).toEqual(["telekinesis", "biomancy"]);
  });
});

describe("grantedFocusDisciplines / effectiveFocusDisciplines / hasFocusDiscipline", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("без способностей — дарованных нет, итог равен своему выбору", () => {
    clearRuleSources();
    const actor = { system: { psyker: { focusDisciplines: ["pyromancy"] } } };
    expect(grantedFocusDisciplines(actor)).toEqual([]);
    expect(effectiveFocusDisciplines(actor)).toEqual(["pyromancy"]);
  });

  it("Perfect Sorcerer добавляет свой список поверх своего выбора игрока", () => {
    clearRuleSources();
    const actor = { system: { psyker: { focusDisciplines: ["pyromancy"] } } };
    grantPerfectSorcererTo(actor);
    const effective = effectiveFocusDisciplines(actor);
    expect(effective).toContain("pyromancy");
    for (const key of PERFECT_SORCERER_FOCUS_DISCIPLINES) expect(effective).toContain(key);
    expect(hasFocusDiscipline(actor, "sorcery")).toBe(true);
    expect(hasFocusDiscipline(actor, "daemonology")).toBe(true);
    expect(hasFocusDiscipline(actor, "highSorcery")).toBe(true);
  });

  it("пересечение своего выбора и дарованного не дублируется", () => {
    clearRuleSources();
    const actor = { system: { psyker: { focusDisciplines: ["telekinesis"] } } };
    grantPerfectSorcererTo(actor);
    expect(effectiveFocusDisciplines(actor).filter(k => k === "telekinesis")).toEqual(["telekinesis"]);
  });

  it("дисциплина вне списков — нет Фокуса", () => {
    clearRuleSources();
    const actor = { system: { psyker: { focusDisciplines: ["telekinesis"] } } };
    expect(hasFocusDiscipline(actor, "thaumaturgy")).toBe(false);
  });
});
