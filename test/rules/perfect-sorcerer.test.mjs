// test/rules/perfect-sorcerer.test.mjs
//
// Perfect Sorcerer / Совершенный Чародей (wdbc-1rno, Тзинч): книжный запрет
// Высшего Колдовства по Покровительству и его снятие этим Даром, плюс Фокус
// Дисциплины, дарованный этим же Даром (wdbc-l6zg). «Обучать других» вне
// рамок (заметка в шапке module/rules/perfect-sorcerer.mjs).

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { blocksHighSorcery, highSorceryManifestBlocked, PERFECT_SORCERER_CAPABILITY,
         perfectSorcererFocusDisciplines, PERFECT_SORCERER_FOCUS_DISCIPLINES }
  from "../../module/rules/perfect-sorcerer.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function grantPerfectSorcererTo(bearer) {
  clearRuleSources();
  registerRuleSource("test", a => a === bearer
    ? [{ id: "test.perfectSorcerer", when: {}, effects: [{ kind: "grantFlag", target: PERFECT_SORCERER_CAPABILITY }] }]
    : []);
}

describe("blocksHighSorcery", () => {
  it("один из 4 конкретных Богов — запрет", () => {
    expect(blocksHighSorcery("khorne")).toBe(true);
    expect(blocksHighSorcery("nurgle")).toBe(true);
    expect(blocksHighSorcery("tzeentch")).toBe(true);
    expect(blocksHighSorcery("slaanesh")).toBe(true);
  });

  it("Хаос Неделимый — не запрет", () => {
    expect(blocksHighSorcery("undivided")).toBe(false);
  });

  it("пустое/отсутствующее Покровительство — не запрет", () => {
    expect(blocksHighSorcery("")).toBe(false);
    expect(blocksHighSorcery(undefined)).toBe(false);
  });
});

describe("highSorceryManifestBlocked", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("другая дисциплина — не блокируется вовсе, даже с Патроном", () => {
    clearRuleSources();
    const actor = { system: { patronGod: "khorne" } };
    expect(highSorceryManifestBlocked(actor, "divination")).toBe(false);
  });

  it("Высшее Колдовство + Патрон Бога + БЕЗ Дара — блок", () => {
    clearRuleSources();
    const actor = { system: { patronGod: "tzeentch" } };
    expect(highSorceryManifestBlocked(actor, "highSorcery")).toBe(true);
  });

  it("Высшее Колдовство + Хаос Неделимый — не блок (книжное правило и так разрешает)", () => {
    clearRuleSources();
    const actor = { system: { patronGod: "undivided" } };
    expect(highSorceryManifestBlocked(actor, "highSorcery")).toBe(false);
  });

  it("Высшее Колдовство + Патрон Бога + Совершенный Чародей — Дар снимает блок", () => {
    const actor = { system: { patronGod: "slaanesh" } };
    grantPerfectSorcererTo(actor);
    expect(highSorceryManifestBlocked(actor, "highSorcery")).toBe(false);
  });
});

// wdbc-l6zg: Фокус Дисциплины — Дар обходит для НОСИТЕЛЯ общий книжный запрет
// Фокуса на Колдовство/Демонологию/Высшее Колдовство (disciplines.mjs::
// NO_FOCUS_DISCIPLINES), плюс все пять Фундаментальных.
describe("perfectSorcererFocusDisciplines", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("без Дара — пусто", () => {
    clearRuleSources();
    expect(perfectSorcererFocusDisciplines({ system: {} })).toEqual([]);
  });

  it("с Даром — Колдовство/Демонология/Высшее Колдовство + все Фундаментальные", () => {
    const actor = { system: {} };
    grantPerfectSorcererTo(actor);
    expect(perfectSorcererFocusDisciplines(actor)).toEqual(PERFECT_SORCERER_FOCUS_DISCIPLINES);
    expect(perfectSorcererFocusDisciplines(actor)).toEqual(
      expect.arrayContaining(["sorcery", "daemonology", "highSorcery",
        "telekinesis", "telepathy", "divination", "biomancy", "pyromancy"]));
  });

  it("Дар другого актора не трогает", () => {
    const bearer = { system: {} };
    const other = { system: {} };
    grantPerfectSorcererTo(bearer);
    expect(perfectSorcererFocusDisciplines(other)).toEqual([]);
  });
});
