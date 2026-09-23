// test/sheets/psy-focus-tab.test.mjs
//
// wdbc-l6zg: Фокус Дисциплины на вкладке МИСТИКА — контекст для чипов
// (buildGetData → context.psyFocus), бейдж «★ Фокус» на строке психосилы
// (context.psyPowers[].hasFocus) и клик по чипу (activatePsychicListeners).

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { listenerHtml } from "../support/foundry-stub.mjs";
import { sheetOf } from "../support/foundry-stub.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { buildGetData } from "../../module/sheets/sheet-helpers.mjs";
import { activatePsychicListeners } from "../../module/sheets/tabs/psychic.mjs";
import { PERFECT_SORCERER_CAPABILITY } from "../../module/rules/perfect-sorcerer.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function powerDoc(over = {}) {
  return {
    id: "p1", name: "Молот Ваула", type: "psychicPower",
    system: { testChar: "wp", powerType: "attack", prRequired: 2, discipline: "", ...over },
    getFlag: () => undefined
  };
}

describe("Фокус Дисциплины — чипы на вкладке МИСТИКА (buildGetData, wdbc-l6zg)", () => {
  it("без выбора — ни один чип не активен", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [], characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3 }
    });
    sheet.actor.items.contents = sheet.actor.items;
    const ctx = buildGetData(sheet.actor);
    expect(ctx.psyFocus.hasAny).toBe(false);
    expect(ctx.psyFocus.chips.every(c => !c.active)).toBe(true);
  });

  it("Регулярные дисциплины (Тауматургия/Колдовство/Демонология/Высшее Колдовство) и Руны Судьбы/Битвы в пикере не предлагаются", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [], characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3 }
    });
    sheet.actor.items.contents = sheet.actor.items;
    const keys = buildGetData(sheet.actor).psyFocus.chips.map(c => c.key);
    for (const k of ["thaumaturgy", "sorcery", "highSorcery", "daemonology", "runesFateBattle"]) {
      expect(keys).not.toContain(k);
    }
  });

  // wdbc-4umq (2): «Персонаж, ставший Ревенантом, получает Фокус Дисциплины
  // Ревенанта» (constants/disciplines.mjs, desc) — пробуждение на усмотрение
  // ГМа, предмета «Иннари-Ревенант» в системе нет, поэтому выбор в пикере — но
  // только эльдарам (книга: в том числе бывшим друкхари, экзодитам, корсарам).
  it("Ревенант предлагается эльдару и друкхари, но не человеку", () => {
    const keysFor = race => {
      const sheet = sheetOf(WarhammerCharacterSheet, {
        items: [], characteristics: {}, skills: {}, groupSkills: {}, race,
        psyker: { rating: 3, currentRating: 3 }
      });
      sheet.actor.items.contents = sheet.actor.items;
      return buildGetData(sheet.actor).psyFocus.chips.map(c => c.key);
    };
    expect(keysFor("ynnari")).toContain("revenant");
    expect(keysFor("drukhari")).toContain("revenant");
    expect(keysFor("human")).not.toContain("revenant");
  });

  it("свой выбор игрока отмечен активным чипом", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [], characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3, focusDisciplines: ["telekinesis"] }
    });
    sheet.actor.items.contents = sheet.actor.items;
    const chip = buildGetData(sheet.actor).psyFocus.chips.find(c => c.key === "telekinesis");
    expect(chip.active).toBe(true);
    expect(chip.forced).toBe(false);
  });

  it("психосила своей дисциплины Фокуса получает hasFocus:true в таблице", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [powerDoc({ discipline: "telekinesis" })], characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3, focusDisciplines: ["telekinesis"] }
    });
    sheet.actor.items.contents = sheet.actor.items;
    const row = buildGetData(sheet.actor).psyPowers.find(p => p.id === "p1");
    expect(row.hasFocus).toBe(true);
  });

  it("психосила другой дисциплины — hasFocus:false", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [powerDoc({ discipline: "biomancy" })], characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3, focusDisciplines: ["telekinesis"] }
    });
    sheet.actor.items.contents = sheet.actor.items;
    const row = buildGetData(sheet.actor).psyPowers.find(p => p.id === "p1");
    expect(row.hasFocus).toBe(false);
  });

  describe("Perfect Sorcerer — дарованные чипы отмечены и заблокированы", () => {
    const saved = getRuleSources();
    afterEach(() => {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    });

    it("Колдовство/Демонология/Высшее Колдовство появляются в чипах отмеченными и forced, хотя в обычном пикере их нет", () => {
      const sheet = sheetOf(WarhammerCharacterSheet, {
        items: [], characteristics: {}, skills: {}, groupSkills: {},
        psyker: { rating: 3, currentRating: 3 }
      });
      sheet.actor.items.contents = sheet.actor.items;
      clearRuleSources();
      registerRuleSource("test", a => a === sheet.actor
        ? [{ id: "test.ps", when: {}, effects: [{ kind: "grantFlag", target: PERFECT_SORCERER_CAPABILITY }] }]
        : []);
      const chips = buildGetData(sheet.actor).psyFocus.chips;
      for (const key of ["sorcery", "daemonology", "highSorcery"]) {
        const chip = chips.find(c => c.key === key);
        expect(chip.active).toBe(true);
        expect(chip.forced).toBe(true);
      }
    });
  });
});

describe("Фокус Дисциплины — клик по чипу (activatePsychicListeners, wdbc-l6zg)", () => {
  function actorStub(focusDisciplines = []) {
    const a = {
      items: [], updates: [],
      system: { psyker: { focusDisciplines } },
      update: async data => {
        a.updates.push(data);
        for (const [path, value] of Object.entries(data)) {
          const key = path.replace(/^system\.psyker\./, "");
          a.system.psyker[key] = value;
        }
        return data;
      }
    };
    a.items.get = () => null;
    return a;
  }

  it("клик по неотмеченному чипу добавляет дисциплину в выбор", async () => {
    const a = actorStub([]);
    const html = listenerHtml();
    activatePsychicListeners(html, a, {});
    await html.handlers[".psy-focus-chip:click"]({
      currentTarget: { disabled: false, dataset: { discipline: "telekinesis" } }
    });
    expect(a.updates).toContainEqual({ "system.psyker.focusDisciplines": ["telekinesis"] });
  });

  it("клик по уже отмеченному чипу снимает дисциплину", async () => {
    const a = actorStub(["telekinesis", "biomancy"]);
    const html = listenerHtml();
    activatePsychicListeners(html, a, {});
    await html.handlers[".psy-focus-chip:click"]({
      currentTarget: { disabled: false, dataset: { discipline: "telekinesis" } }
    });
    expect(a.updates).toContainEqual({ "system.psyker.focusDisciplines": ["biomancy"] });
  });

  it("заблокированный (дарованный) чип клик игнорирует", async () => {
    const a = actorStub([]);
    const html = listenerHtml();
    activatePsychicListeners(html, a, {});
    await html.handlers[".psy-focus-chip:click"]({
      currentTarget: { disabled: true, dataset: { discipline: "sorcery" } }
    });
    expect(a.updates).toEqual([]);
  });
});
