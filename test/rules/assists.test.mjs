import { describe, it, expect } from "vitest";
import {
  canAssist, assistRejection, assistThresholdBonus, assistDegrees,
  DEFAULT_ASSIST_MAX, MIN_ASSIST_RANK
} from "../../module/rules/assists.mjs";

/** Подставной актор-помощник: обычный литерал, никакого Foundry. */
const helper = ({ id = "h1", name = "Помощник", skills = {}, groupSkills = {} } = {}) => ({
  id, name, uuid: `Actor.${id}`, system: { skills, groupSkills }
});

describe("canAssist", () => {
  it("тесту голой характеристики помогает кто угодно", () => {
    expect(canAssist(helper(), {})).toBe(true);
    expect(canAssist(helper(), { char: "s" })).toBe(true);
  });

  it("навыку нужен тот же навык рангом не ниже «Знает»", () => {
    expect(canAssist(helper({ skills: { medicae: { rank: "knows" } } }), { skill: "medicae" })).toBe(true);
    expect(canAssist(helper({ skills: { medicae: { rank: "expert" } } }), { skill: "medicae" })).toBe(true);
  });

  it("нетренированный и вовсе без навыка не помогают", () => {
    expect(canAssist(helper({ skills: { medicae: { rank: "untrained" } } }), { skill: "medicae" })).toBe(false);
    expect(canAssist(helper(), { skill: "medicae" })).toBe(false);
  });

  it("другой навык не считается", () => {
    expect(canAssist(helper({ skills: { athletics: { rank: "expert" } } }), { skill: "medicae" })).toBe(false);
  });

  describe("групповой навык", () => {
    const knower = helper({
      groupSkills: { commonLore: [{ specialty: "Империум", rank: "trained" }] }
    });

    it("нужна КОНКРЕТНАЯ специализация, а не сама группа", () => {
      expect(canAssist(knower, { group: "commonLore", specialty: "Империум" })).toBe(true);
      expect(canAssist(knower, { group: "commonLore", specialty: "Хаос" })).toBe(false);
    });

    it("специализация сравнивается без учёта регистра и пробелов", () => {
      expect(canAssist(knower, { group: "commonLore", specialty: "  империум " })).toBe(true);
    });

    it("ранг ниже «Знает» не проходит и в группе", () => {
      const weak = helper({ groupSkills: { commonLore: [{ specialty: "Империум", rank: "untrained" }] } });
      expect(canAssist(weak, { group: "commonLore", specialty: "Империум" })).toBe(false);
    });
  });

  it("пустого кандидата не берём", () => {
    expect(canAssist(null, {})).toBe(false);
  });
});

describe("assistRejection", () => {
  const actor = { id: "me", uuid: "Actor.me", name: "Я" };
  const ok = helper({ skills: { medicae: { rank: "knows" } } });

  it("подходящего помощника пропускает", () => {
    expect(assistRejection(ok, { actor, ctx: { skill: "medicae" } })).toBeNull();
  });

  it("сам себе не помогает", () => {
    const self = helper({ id: "me" });
    expect(assistRejection(self, { actor, ctx: {} })).toMatch(/самому себе/);
  });

  it("повтор отклоняется", () => {
    expect(assistRejection(ok, { actor, assistants: [{ uuid: ok.uuid }], ctx: {} }))
      .toMatch(/уже в списке/);
  });

  it("сверх лимита отклоняется, и лимит назван", () => {
    const full = [{ uuid: "Actor.a" }, { uuid: "Actor.b" }];
    expect(assistRejection(ok, { actor, assistants: full, ctx: {} }))
      .toMatch(new RegExp(`максимум помощников \\(${DEFAULT_ASSIST_MAX}\\)`));
  });

  it("лимит можно поднять — задел под предметы", () => {
    const two = [{ uuid: "Actor.a" }, { uuid: "Actor.b" }];
    expect(assistRejection(ok, { actor, assistants: two, max: 3, ctx: { skill: "medicae" } })).toBeNull();
  });

  it("без нужного навыка отклоняется с называнием ранга", () => {
    expect(assistRejection(helper(), { actor, ctx: { skill: "medicae" } })).toMatch(/Знает/);
  });

  // Лимит проверяется раньше остальных причин: игроку важнее узнать, что мест
  // нет, чем что перетащенный не владеет навыком.
  it("переполнение важнее прочих причин", () => {
    const full = [{ uuid: "Actor.a" }, { uuid: "Actor.b" }];
    expect(assistRejection(helper(), { actor, assistants: full, ctx: { skill: "medicae" } }))
      .toMatch(/максимум/);
  });
});

describe("assistThresholdBonus", () => {
  it("+10 за каждого", () => {
    expect(assistThresholdBonus(0)).toBe(0);
    expect(assistThresholdBonus(1)).toBe(10);
    expect(assistThresholdBonus(2)).toBe(20);
  });
});

describe("assistDegrees", () => {
  it("на успехе добавляют по степени", () => {
    expect(assistDegrees(1, 2, true)).toBe(3);
  });

  it("на провале не влияют вовсе", () => {
    expect(assistDegrees(3, 2, false)).toBe(3);
  });

  it("без помощников степень не меняется", () => {
    expect(assistDegrees(2, 0, true)).toBe(2);
    expect(assistDegrees(2, 0, false)).toBe(2);
  });
});

describe("константы", () => {
  it("минимальный ранг — «Знает»", () => {
    expect(MIN_ASSIST_RANK).toBe("knows");
  });
});
