// test/combat/hallucinogenic.test.mjs
//
// Галлюцинации (свойство оружия Hallucinogenic (X), стр. 168 Арсенала,
// wdbc-r5o7.8): 1d10 определяет, какая из десяти книжных граней выпала.
// Триггер (тест T-10X → Состояние на deg Раундов) уже собран общим
// движком «Эффекты свойств» (weapon-properties.mjs/hooks.mjs) — здесь
// только сама таблица и её механические грани (1/7/8/9).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  HALLUCINOGENIC_TABLE, rollHallucinogenicEffect, isHallucinatingCannotAttack
} from "../../module/combat/hallucinogenic.mjs";

function actorFor(overrides = {}) {
  const flags = {};
  const actor = {
    name: "Подставной",
    system: { conditions: {}, inRage: false, ...overrides },
    getFlag: (_s, k) => flags[k],
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
        if (m) { if (m[1]) delete flags[m[2]]; else flags[m[2]] = value; continue; }
        const keys = path.split(".");
        let node = actor;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  return actor;
}

beforeEach(resetCaptured);

describe("HALLUCINOGENIC_TABLE", () => {
  it("ровно 10 граней, у каждой есть title и text", () => {
    expect(HALLUCINOGENIC_TABLE).toHaveLength(10);
    for (const e of HALLUCINOGENIC_TABLE) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.text).toBe("string");
      expect(e.text.length).toBeGreaterThan(0);
    }
  });
});

describe("rollHallucinogenicEffect", () => {
  it("грань 1 (Жукижукижуки) — Ступор И Повален разом", async () => {
    captured.nextRoll = 1;
    const actor = actorFor();
    const { entry } = await rollHallucinogenicEffect(actor);
    expect(entry.title).toBe("Жукижукижуки!");
    expect(actor.system.conditions.dazed).toBe(true);
    expect(actor.system.conditions.prone).toBe(true);
  });

  it("грань 2 (Мои руки) — только Ступор, не Повален", async () => {
    captured.nextRoll = 2;
    const actor = actorFor();
    await rollHallucinogenicEffect(actor);
    expect(actor.system.conditions.dazed).toBe(true);
    expect(actor.system.conditions.prone).toBeUndefined();
  });

  it("грань 7 (Они достали меня) — Беспомощен", async () => {
    captured.nextRoll = 7;
    const actor = actorFor();
    const { entry } = await rollHallucinogenicEffect(actor);
    expect(entry.title).toBe("Они достали меня");
    expect(actor.system.conditions.helpless).toBe(true);
  });

  it("грань 8 (Порррррву) — Ярость (system.inRage)", async () => {
    captured.nextRoll = 8;
    const actor = actorFor();
    const { entry } = await rollHallucinogenicEffect(actor);
    expect(entry.title).toBe("Порррррву!!!");
    expect(actor.system.inRage).toBe(true);
  });

  it("грань 9 (Я маленький) — только флаг граней, никакого Состояния напрямую", async () => {
    captured.nextRoll = 9;
    const actor = actorFor();
    await rollHallucinogenicEffect(actor);
    expect(actor.getFlag("warhammer-dbc", "hallucinationEffect")).toBe(9);
    expect(actor.system.conditions.dazed).toBeUndefined();
    expect(actor.system.conditions.helpless).toBeUndefined();
    expect(actor.system.inRage).toBe(false);
  });

  it.each([3, 4, 5, 6, 10])("грань %i — только текст, никакой механики не применяется", async n => {
    captured.nextRoll = n;
    const actor = actorFor();
    await rollHallucinogenicEffect(actor);
    expect(actor.system.conditions).toEqual({});
    expect(actor.system.inRage).toBe(false);
  });

  it("запоминает выпавшую грань флагом hallucinationEffect", async () => {
    captured.nextRoll = 4;
    const actor = actorFor();
    await rollHallucinogenicEffect(actor);
    expect(actor.getFlag("warhammer-dbc", "hallucinationEffect")).toBe(4);
  });
});

describe("isHallucinatingCannotAttack", () => {
  it("грань 9 И Состояние всё ещё стоит — true", () => {
    const actor = actorFor({ conditions: { hallucinogenic: true } });
    actor.getFlag = () => 9;
    expect(isHallucinatingCannotAttack(actor)).toBe(true);
  });

  it("грань 9, но Состояние уже снято (прошло/вылечено) — false", () => {
    const actor = actorFor({ conditions: { hallucinogenic: false } });
    actor.getFlag = () => 9;
    expect(isHallucinatingCannotAttack(actor)).toBe(false);
  });

  it("Состояние стоит, но выпала другая грань — false", () => {
    const actor = actorFor({ conditions: { hallucinogenic: true } });
    actor.getFlag = () => 3;
    expect(isHallucinatingCannotAttack(actor)).toBe(false);
  });

  it("ни того ни другого — false", () => {
    expect(isHallucinatingCannotAttack(actorFor())).toBe(false);
  });
});
