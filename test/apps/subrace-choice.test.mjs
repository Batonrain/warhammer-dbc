// test/apps/subrace-choice.test.mjs
//
// Африэль/Эльданар (wdbc-iu53): выбор игрока при получении субрасы — N
// Характеристик и M Навыков становятся Дружественными независимо от
// Покровительства (kind:"capability"+capabilityMode:"aptOverride").

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { fakeHtml, captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  SUBRACE_APTITUDE_CHOICES, needsAptitudeChoice,
  aptitudeOverrideMechanicsGroup, applySubraceAptitudeChoice,
  promptSubraceAptitudeChoice
} from "../../module/apps/subrace-choice.mjs";

describe("needsAptitudeChoice / SUBRACE_APTITUDE_CHOICES", () => {
  it("afriel — 2 характеристики, 3 навыка", () => {
    expect(SUBRACE_APTITUDE_CHOICES.afriel).toEqual({ charCount: 2, skillCount: 3 });
    expect(needsAptitudeChoice("afriel")).toBe(true);
  });
  it("eldanar — 3 характеристики, 6 навыков", () => {
    expect(SUBRACE_APTITUDE_CHOICES.eldanar).toEqual({ charCount: 3, skillCount: 6 });
    expect(needsAptitudeChoice("eldanar")).toBe(true);
  });
  it("прочие субрасы — false", () => {
    expect(needsAptitudeChoice("tzaangor")).toBe(false);
    expect(needsAptitudeChoice("")).toBe(false);
  });
});

describe("aptitudeOverrideMechanicsGroup: чистая функция", () => {
  it("характеристики матчатся по ключу (точное совпадение), навыки — по русскому label (подстрока)", () => {
    const group = aptitudeOverrideMechanicsGroup({ chars: ["s", "ag"], skills: ["charm"] });
    expect(group.operator).toBe("AND");
    expect(group.entries).toHaveLength(3);
    const charEntries = group.entries.filter(e => e.capabilityAptScope === "characteristic");
    expect(charEntries.map(e => e.capabilityAptMatch).sort()).toEqual(["ag", "s"]);
    const skillEntries = group.entries.filter(e => e.capabilityAptScope === "skill");
    expect(skillEntries).toHaveLength(1);
    expect(skillEntries[0].capabilityAptMatch).toBe("Обаяние"); // SKILLS_DEF.charm.label
    for (const e of group.entries) {
      expect(e.kind).toBe("capability");
      expect(e.capabilityMode).toBe("aptOverride");
      expect(e.capabilityAptAlign).toBe("ally");
    }
  });

  it("пустые picks — null (нечего дописывать)", () => {
    expect(aptitudeOverrideMechanicsGroup({ chars: [], skills: [] })).toBe(null);
    expect(aptitudeOverrideMechanicsGroup({})).toBe(null);
    expect(aptitudeOverrideMechanicsGroup(null)).toBe(null);
  });

  it("неизвестные ключи молча отбрасываются, не портят остальные", () => {
    const group = aptitudeOverrideMechanicsGroup({ chars: ["s", "nonsense"], skills: ["charm", "bogus"] });
    expect(group.entries).toHaveLength(2);
  });

  it("дубли одного ключа не плодят повторных записей", () => {
    const group = aptitudeOverrideMechanicsGroup({ chars: ["s", "s"], skills: [] });
    expect(group.entries).toHaveLength(1);
  });
});

describe("applySubraceAptitudeChoice: дописывает Механику предмета", () => {
  function fakeItem(existingMechanics = []) {
    const updates = [];
    return {
      flags: { "warhammer-dbc": { mechanics: existingMechanics } },
      update: async data => { updates.push(data); return data; },
      _updates: updates
    };
  }

  it("предмет без прежней Механики — новая группа становится единственной", async () => {
    const item = fakeItem([]);
    await applySubraceAptitudeChoice(item, { chars: ["s"], skills: [] });
    expect(item._updates).toHaveLength(1);
    const arr = item._updates[0]["flags.warhammer-dbc.mechanics"];
    expect(arr).toHaveLength(1);
    expect(arr[0].entries[0].capabilityAptMatch).toBe("s");
  });

  it("существующая Механика не теряется — новая группа дописывается", async () => {
    const item = fakeItem([{ id: "g0", operator: "AND", entries: [{ id: "e0", kind: "characteristic" }] }]);
    await applySubraceAptitudeChoice(item, { chars: ["s"], skills: [] });
    const arr = item._updates[0]["flags.warhammer-dbc.mechanics"];
    expect(arr).toHaveLength(2);
    expect(arr[0].id).toBe("g0"); // прежняя группа цела и первая
  });

  it("пустой выбор — update не шлётся вовсе", async () => {
    const item = fakeItem([]);
    await applySubraceAptitudeChoice(item, { chars: [], skills: [] });
    expect(item._updates).toHaveLength(0);
  });
});

describe("promptSubraceAptitudeChoice: диалог", () => {
  it("Принять — читает выбранные значения дропдаунов", async () => {
    resetCaptured();
    const promise = promptSubraceAptitudeChoice("afriel", "Африэль");
    const charSelects  = [{ dataset: {}, value: "s" }, { dataset: {}, value: "ag" }];
    const skillSelects = [{ dataset: {}, value: "charm" }, { dataset: {}, value: "" }, { dataset: {}, value: "dodge" }];
    const html = fakeHtml({}, { ".sub-apt-char": charSelects, ".sub-apt-skill": skillSelects });
    captured.dialog.buttons.ok.callback(html);
    const picks = await promise;
    expect(picks).toEqual({ chars: ["s", "ag"], skills: ["charm", "dodge"] });
  });

  it("Пропустить — null", async () => {
    resetCaptured();
    const promise = promptSubraceAptitudeChoice("eldanar", "Эльданар");
    captured.dialog.buttons.cancel.callback();
    expect(await promise).toBe(null);
  });

  it("незнакомый ключ субрасы — сразу null, без диалога", async () => {
    resetCaptured();
    expect(await promptSubraceAptitudeChoice("human", "Человек")).toBe(null);
    expect(captured.dialog).toBe(null);
  });
});
