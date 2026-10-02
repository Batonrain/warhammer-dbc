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
  promptSubraceAptitudeChoice,
  ARCHETYPE_APTITUDE_CHOICES, needsArchetypeAptitudeChoice, promptArchetypeAptitudeChoice
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

// Благородная Евгеника (Благородный, сверка Архетипов 28.09.2026): «При
// создании персонажа, Благородный выбирает 2 Характеристики – они становятся
// дружественными в плане продвижений, и остаются таковыми, невзирая на его
// Покровительства» — тот же диалог и те же записи aptOverride, что у Африэль,
// только ключ — Архетип, а Навыков нет.
describe("Архетип: Благородная Евгеника — выбор 2 Характеристик", () => {
  it("noble — 2 характеристики, без навыков; прочие архетипы — без выбора", () => {
    expect(ARCHETYPE_APTITUDE_CHOICES.noble).toEqual({ charCount: 2, skillCount: 0 });
    expect(needsArchetypeAptitudeChoice("noble")).toBe(true);
    expect(needsArchetypeAptitudeChoice("savage")).toBe(false);
  });

  it("диалог без Навыков: Принять отдаёт только Характеристики", async () => {
    resetCaptured();
    const promise = promptArchetypeAptitudeChoice("noble", "Благородный");
    expect(captured.dialog.content).not.toContain("sub-apt-skill");
    const html = fakeHtml({}, { ".sub-apt-char": [{ dataset: {}, value: "ag" }, { dataset: {}, value: "fel" }], ".sub-apt-skill": [] });
    captured.dialog.buttons.ok.callback(html);
    expect(await promise).toEqual({ chars: ["ag", "fel"], skills: [] });
  });
});

// task-7b94: игрок мог выбрать одну Характеристику дважды — Set в
// aptitudeOverrideMechanicsGroup молча схлопывал дубль, и Благородный
// оставался с одной Дружественной вместо двух.
describe("Диалог: повтор одного выбора запрещён", () => {
  /** Подставной <select>: options с флагом disabled, слушатели собираются в handlers. */
  function fakeSelect(value, keys) {
    const el = {
      dataset: {}, value,
      options: ["", ...keys].map(v => ({ value: v, disabled: false })),
      handlers: [],
      addEventListener(type, fn) { if (type === "change") this.handlers.push(fn); }
    };
    return el;
  }
  const KEYS = ["s", "ag", "fel"];

  it("render: выбранное в одном дропдауне гасится в соседнем и возвращается при смене", () => {
    resetCaptured();
    promptArchetypeAptitudeChoice("noble", "Благородный");
    const a = fakeSelect("", KEYS), b = fakeSelect("", KEYS);
    const html = fakeHtml({}, { ".sub-apt-char": [a, b], ".sub-apt-skill": [] });
    captured.dialog.render(html);

    a.value = "ag";
    a.handlers.forEach(fn => fn());
    expect(b.options.find(o => o.value === "ag").disabled).toBe(true);
    expect(a.options.find(o => o.value === "ag").disabled).toBe(false); // свой выбор не гасится
    expect(b.options.find(o => o.value === "s").disabled).toBe(false);

    a.value = "s";
    a.handlers.forEach(fn => fn());
    expect(b.options.find(o => o.value === "ag").disabled).toBe(false);
    expect(b.options.find(o => o.value === "s").disabled).toBe(true);
  });

  it("Принять с дублем — отказ с понятным сообщением, окно остаётся открытым (выбор не отдан)", async () => {
    resetCaptured();
    const promise = promptArchetypeAptitudeChoice("noble", "Благородный");
    let settled = false;
    promise.then(() => { settled = true; });
    const dup = fakeHtml({}, { ".sub-apt-char": [{ dataset: {}, value: "ag" }, { dataset: {}, value: "ag" }], ".sub-apt-skill": [] });
    expect(() => captured.dialog.buttons.ok.callback(dup)).toThrow(/дважды|повтор/i);
    await Promise.resolve();
    expect(settled).toBe(false);
    // после исправления выбор проходит
    const ok = fakeHtml({}, { ".sub-apt-char": [{ dataset: {}, value: "ag" }, { dataset: {}, value: "fel" }], ".sub-apt-skill": [] });
    captured.dialog.buttons.ok.callback(ok);
    expect(await promise).toEqual({ chars: ["ag", "fel"], skills: [] });
  });

  it("дубль среди Навыков тоже отвергается; один и тот же ключ в Характеристиках и Навыках — не дубль", async () => {
    resetCaptured();
    const promise = promptSubraceAptitudeChoice("afriel", "Африэль");
    const dupSkills = fakeHtml({}, { ".sub-apt-char": [], ".sub-apt-skill": [{ dataset: {}, value: "charm" }, { dataset: {}, value: "charm" }] });
    expect(() => captured.dialog.buttons.ok.callback(dupSkills)).toThrow();
    const fine = fakeHtml({}, { ".sub-apt-char": [{ dataset: {}, value: "s" }], ".sub-apt-skill": [{ dataset: {}, value: "charm" }] });
    captured.dialog.buttons.ok.callback(fine);
    expect(await promise).toEqual({ chars: ["s"], skills: ["charm"] });
  });
});
