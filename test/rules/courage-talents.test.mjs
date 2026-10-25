// test/rules/courage-talents.test.mjs
//
// Таланты «Смелость» главы 3 (Sahara 3-scope, решения владельца 24.10.2026):
//   • Fearless / Бесстрашный — «автоматически проходит тесты Морали» (как Ярость:
//     бросок идёт, провал не засчитывается), включая преодоление Подавления;
//   • Idolater / Идолопоклонник — то же при галочке «кумир рядом»;
//   • Fireman / Пожарный — не паникует от Горения, +30 на тушение;
//   • Jaded / Пресыщенный — галочка «Земной ужас» в окне Страха даёт автоуспех.
// Возможность выдаётся тестовым источником правил, как у остальных тестов
// Талантов (сам Талант в паке несёт запись «Возможность» — это проверяет храповик).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { moraleAutoPass } from "../../module/rules/morale-auto.mjs";
import { rollMoraleTest } from "../../module/rules/morale-test.mjs";
import { _executeFearRoll, rollShockRecovery } from "../../module/combat/fear.mjs";
import { rollIntimidateContest } from "../../module/combat/intimidate.mjs";
import { rollFieldExecutionContest } from "../../module/combat/field-execution.mjs";
import { rollSuppressionRecovery } from "../../module/combat/suppression.mjs";
import { rollBurningPanicTest } from "../../module/combat/condition-ticks.mjs";
import { extinguishBurning } from "../../module/combat/extinguish.mjs";
import {
  FEARLESS_CAP, FIREMAN_CAP, JADED_CAP, IDOLATER_CAP, FIREMAN_EXTINGUISH_BONUS, isIdolNearby
} from "../../module/rules/courage-talents.mjs";

const DEFAULT_SOURCES = getRuleSources();

const grant = (...keys) => {
  clearRuleSources();
  registerRuleSource("test", () => keys.map((f, i) =>
    ({ id: `test.courage${i}`, when: {}, effects: [{ kind: "grantFlag", target: f }] })));
};

function person(name = "Боец", { wp = 40, idolNearby = false, inRage = false, conditions = {} } = {}) {
  const flags = {};
  const a = {
    id: name, name, uuid: `Actor.${name}`, type: "character", items: [], effects: [],
    system: {
      inRage, idolNearby, characteristics: { wp: { total: wp }, ag: { total: 40, bonus: 4 }, t: { total: 40, bonus: 4 } },
      skills: { intimidate: { total: 50 } },
      fatigue: { value: 0, max: 0 }, fate: { value: 0 }, actionPoints: { value: 3, max: 3 },
      conditions: { ...conditions }
    },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    createEmbeddedDocuments: async () => [],
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
        if (m) { if (m[1]) delete flags[m[2]]; else flags[m[2]] = value; continue; }
        const parts = path.split(".");
        let t = a;
        for (const p of parts.slice(0, -1)) t = (t[p] ??= {});
        t[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return a;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.settings = { get: () => "publicroll" };
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("moraleAutoPass: кто проходит Мораль автоматически", () => {
  it("обычный персонаж — никто", () => {
    expect(moraleAutoPass(person())).toBeNull();
    expect(moraleAutoPass(null)).toBeNull();
  });

  it("Ярость остаётся первой причиной (прежнее поведение)", () => {
    grant(FEARLESS_CAP);
    expect(moraleAutoPass(person("Берсерк", { inRage: true })).by).toBe("rage");
  });

  it("Бесстрашный — всегда, без галочки", () => {
    grant(FEARLESS_CAP);
    expect(moraleAutoPass(person()).by).toBe("fearless");
  });

  it("Идолопоклонник — только пока галочка «кумир рядом»", () => {
    grant(IDOLATER_CAP);
    expect(moraleAutoPass(person("Фанатик", { idolNearby: false }))).toBeNull();
    expect(moraleAutoPass(person("Фанатик", { idolNearby: true })).by).toBe("idolater");
  });

  it("галочка без Таланта ничего не даёт", () => {
    grant();
    expect(isIdolNearby(person("Чужой", { idolNearby: true }))).toBe(true);
    expect(moraleAutoPass(person("Чужой", { idolNearby: true }))).toBeNull();
  });
});

describe("Бесстрашный: тесты Морали на месте", () => {
  it("rollMoraleTest при заведомо плохом броске — успех, подпись в карточке", async () => {
    grant(FEARLESS_CAP);
    captured.nextRoll = 99;
    const r = await rollMoraleTest(person(), 10);
    expect(r.success).toBe(true);
    expect(r.dof).toBe(0);
    expect(r.parts.join(" ")).toMatch(/Бесстрашн/);
  });

  it("контроль: без Таланта тот же бросок — провал", async () => {
    grant();
    captured.nextRoll = 99;
    expect((await rollMoraleTest(person(), 10)).success).toBe(false);
  });

  it("Идолопоклонник с галочкой проходит, без галочки — нет", async () => {
    grant(IDOLATER_CAP);
    captured.nextRoll = 99;
    expect((await rollMoraleTest(person("И", { idolNearby: true }), 10)).success).toBe(true);
    expect((await rollMoraleTest(person("И", { idolNearby: false }), 10)).success).toBe(false);
  });

  it("тест Страха — «выстоял» без Infamy", async () => {
    grant(FEARLESS_CAP);
    captured.nextRoll = 99;
    await _executeFearRoll(person(), 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("выстоял");
  });

  it("выход из Шока — успех при плохом броске, Шок снят", async () => {
    grant(FEARLESS_CAP);
    const a = person("Шок", { conditions: { shocked: true } });
    captured.nextRoll = 99;
    const res = await rollShockRecovery(a);
    expect(res.success).toBe(true);
    expect(a.system.conditions.shocked).toBe(false);
  });

  it("преодоление Подавления в конце Хода — тоже автоуспех", async () => {
    grant(FEARLESS_CAP);
    const a = person("Прижатый", { conditions: { pinned: true } });
    captured.nextRoll = 99;
    const { success } = await rollSuppressionRecovery(a, { bonus: 0 });
    expect(success).toBe(true);
    expect(a.system.conditions.pinned).toBe(false);
  });

  it("встречное Запугивание: цель проходит, на карточке «(Бесстрашный)»", async () => {
    grant(FEARLESS_CAP);
    captured.dice = [95, 95];
    const { winner } = await rollIntimidateContest(person("Командир"), person("Бесстрашный"));
    expect(winner).toBe("theirs");
    expect(captured.chat.at(-1).content).toContain("(Бесстрашный)");
  });

  it("Полевая Казнь: цель проходит тест Морали", async () => {
    grant(FEARLESS_CAP);
    captured.dice = [95, 95];
    const { winner } = await rollFieldExecutionContest(person("Палач"), person("Бесстрашный"));
    expect(winner).toBe("theirs");
  });
});

describe("Пожарный: Горение", () => {
  it("не паникует: теста нет, ОД на месте", async () => {
    grant(FIREMAN_CAP);
    const a = person("Огнеборец", { wp: 10, conditions: { burning: true } });
    captured.dice = [90];
    const { success } = await rollBurningPanicTest(a);
    expect(success).toBe(true);
    expect(a.system.actionPoints.value).toBe(3);
    expect(captured.chat.at(-1).content).toContain("Пожарный");
  });

  it("контроль: без Таланта тот же бросок — паника, ОД обнулены", async () => {
    grant();
    const a = person("Новичок", { wp: 10, conditions: { burning: true } });
    captured.dice = [90];
    const { success } = await rollBurningPanicTest(a);
    expect(success).toBe(false);
    expect(a.system.actionPoints.value).toBe(0);
  });

  it("+30 на тушение, когда тушит он сам: себя Ag−20+30=50, другого Ag+0+30=70", async () => {
    grant(FIREMAN_CAP);
    const selfFire = person("Пожарный", { conditions: { burning: true } });
    captured.nextRoll = 45;
    const own = await extinguishBurning(selfFire);
    expect(own.eff).toBe(40 - 20 + FIREMAN_EXTINGUISH_BONUS);
    expect(own.success).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Пожарный");

    resetCaptured();
    const fireman = person("Пожарный");
    const victim = person("Горящий", { conditions: { burning: true } });
    captured.nextRoll = 65;
    const other = await extinguishBurning(fireman, victim);
    expect(other.eff).toBe(70);
    expect(victim.system.conditions.burning).toBe(false);
  });

  it("горящего тушит обычный товарищ — без бонуса, даже если горит Пожарный", async () => {
    grant();
    const helper = person("Товарищ");
    const victim = person("Горящий Пожарный", { conditions: { burning: true } });
    captured.nextRoll = 35;
    const res = await extinguishBurning(helper, victim);
    expect(res.eff).toBe(40);
  });
});

describe("Пресыщенный: «Земной ужас» в тесте Страха", () => {
  it("с Талантом и галочкой — автоуспех при заведомо плохом броске", async () => {
    grant(JADED_CAP);
    captured.nextRoll = 99;
    await _executeFearRoll(person(), 1, "normal", 0, 0, { mundaneHorror: true });
    expect(captured.chat.at(-1).content).toContain("выстоял");
    expect(captured.chat.at(-1).content).toContain("Пресыщенный");
  });

  it("с Талантом, но без галочки (сверхъестественный ужас) — тест как обычно", async () => {
    grant(JADED_CAP);
    captured.nextRoll = 99;
    await _executeFearRoll(person(), 1, "normal", 0, 0, {});
    expect(captured.chat.at(-1).content).not.toContain("выстоял");
  });

  it("галочка без Таланта не действует (защита от чужого флага)", async () => {
    grant();
    captured.nextRoll = 99;
    await _executeFearRoll(person(), 1, "normal", 0, 0, { mundaneHorror: true });
    expect(captured.chat.at(-1).content).not.toContain("выстоял");
  });
});
