// test/combat/infernal-will-shock.test.mjs
//
// Инфернальная Воля (Мутация 44, wdbc-1rno.22): «когда он проваливает любой
// тест Навыка на 4+ Провала, кроме Критических Провалов, он должен бросить по
// таблице Шока». Здесь — бросок и применение строки (combat/fear.mjs::
// rollInfernalWillShock) и сквозной путь через общий исход теста
// (rules/kind-outcome.mjs) на НАСТОЯЩЕЙ записи мутации из packs-src: сама
// мутация несёт Возможность mutation.infernalWill, отдельного флага актору
// никто не ставит.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { rollInfernalWillShock } from "../../module/combat/fear.mjs";
import { resolveKindOutcome } from "../../module/rules/kind-outcome.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";

const MUTATION = packDocById("packs-src/mutations/Общие_мутации", "vOiGjH4Hhao5ChM1");

/** Актор с настоящей записью по путям (как в shock-rows.test.mjs). */
function makeActor({ patronGod = "", cor = 0, withMutation = true } = {}) {
  const a = {
    id: "a1", uuid: "Actor.a1", name: "Подставной", type: "character", effects: [],
    items: withMutation
      ? [{ id: "m1", type: "mutation", name: MUTATION.name, system: structuredClone(MUTATION.system),
           flags: structuredClone(MUTATION.flags) }]
      : [],
    system: {
      characteristics: { wp: { total: 40 }, fel: { total: 20 }, int: { total: 30 }, t: { total: 35 } },
      fatigue: { value: 0 }, fate: { value: 0 }, conditions: { shocked: false },
      patronGod, corruption: { value: cor }
    },
    flags: { "warhammer-dbc": {} },
    getFlag(scope, key) { return key.split(".").reduce((o, k) => o?.[k], this.flags[scope]); },
    async setFlag(scope, key, v) { (this.flags[scope] ??= {})[key] = v; },
    async unsetFlag(scope, key) { delete this.flags[scope]?.[key]; },
    async update(data) {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        const last = parts.pop();
        let node = this;
        for (const k of parts) node = (node[k] ??= {});
        if (last.startsWith("-=")) delete node[last.slice(2)];
        else node[last] = v;
      }
    },
    async createEmbeddedDocuments(type, docs) {
      const made = docs.map(d => ({ ...d, getFlag: (s, k) => d.flags?.[s]?.[k], delete: async () => {} }));
      a.effects.push(...made);
      return made;
    }
  };
  return a;
}

beforeEach(resetCaptured);

describe("rollInfernalWillShock — бросок по таблице Шока", () => {
  it("1d100 + 10×(Провалы−1): 50 + 30 = 80 → строка 61–80 «замер от ужаса» применена", async () => {
    captured.nextRoll = 50;
    const a = makeActor({ patronGod: "khorne", cor: 0 });
    const html = await rollInfernalWillShock(a, { deg: 4, ctx: { skill: "charm" } });
    expect(html).toContain("= 80");
    expect(html).toContain("Замер от ужаса");
    expect(a.system.conditions.shocked).toBe(true);
  });

  it("Неделимый снижает на ½Cor (окр.▲): 50 + 30 − 23 = 57 → строка 41–60", async () => {
    captured.nextRoll = 50;
    const a = makeActor({ patronGod: "", cor: 45 });
    const html = await rollInfernalWillShock(a, { deg: 4, ctx: { skill: "charm" } });
    expect(html).toContain("− 23");
    expect(html).toContain("= 57");
    expect(html).toContain("Ошарашен");
  });

  it("строка про «источник Страха» — источником назван предмет проваленного теста", async () => {
    captured.nextRoll = 50;
    const a = makeActor({ patronGod: "", cor: 45 });
    const html = await rollInfernalWillShock(a, { deg: 4, ctx: { skill: "charm" } });
    expect(html).toMatch(/Источник Страха — предмет проваленного теста/);
    expect(html).toContain("Обаяние");
  });

  it("Бог-Покровитель, дружественный Навык: полный Cor уводит итог в 0 — Шока нет", async () => {
    captured.nextRoll = 10;
    const a = makeActor({ patronGod: "khorne", cor: 45 });
    const html = await rollInfernalWillShock(a, { deg: 4, ctx: { skill: "athletics" } });
    expect(html).toContain("Шок предотвращён");
    expect(a.system.conditions.shocked).toBe(false);
  });

  it("Infamy не вычитается (решение владельца, Q-2): Важному персонажу бросок тот же", async () => {
    captured.nextRoll = 50;
    const a = makeActor({ patronGod: "khorne", cor: 0 });
    a.system.infamy = { value: 60 };
    const html = await rollInfernalWillShock(a, { deg: 4, ctx: { skill: "charm" } });
    expect(html).toContain("= 80");
  });
});

describe("Инфернальная Воля в общем исходе теста — настоящая запись пака", () => {
  it("запись мутации из packs-src даёт Возможность mutation.infernalWill", () => {
    expect(hasRuleFlag(makeActor(), "mutation.infernalWill")).toBe(true);
    expect(hasRuleFlag(makeActor({ withMutation: false }), "mutation.infernalWill")).toBe(false);
  });

  it("тест Навыка провален на 4 Провала — Шок брошен и наложен, строка в карточке теста", async () => {
    captured.nextRoll = 50;     // бросок Шока
    const a = makeActor({ patronGod: "khorne" });
    const o = await resolveKindOutcome(a, { baseEff: 20, rv: 50,
      ctx: { actor: a, kind: "skill", skill: "charm", char: "fel" } });
    expect(o.success).toBe(false);
    expect(o.deg).toBe(4);
    expect(o.critLine).toContain("Инфернальная Воля");
    expect(a.system.conditions.shocked).toBe(true);
  });

  it("групповой Навык (ctx.group) — тоже тест Навыка", async () => {
    captured.nextRoll = 50;
    const a = makeActor({ patronGod: "khorne" });
    const o = await resolveKindOutcome(a, { baseEff: 20, rv: 50,
      ctx: { actor: a, kind: "skill", group: "navigation", specialty: "Surface", char: "int" } });
    expect(o.critLine).toContain("Инфернальная Воля");
  });

  it("3 Провала — Шока нет", async () => {
    const a = makeActor({ patronGod: "khorne" });
    const o = await resolveKindOutcome(a, { baseEff: 20, rv: 49,
      ctx: { actor: a, kind: "skill", skill: "charm", char: "fel" } });
    expect(o.deg).toBe(3);
    expect(o.critLine).not.toContain("Инфернальная Воля");
    expect(a.system.conditions.shocked).toBe(false);
  });

  it("Критический Провал (98) — Шока нет, хотя Провалов 8", async () => {
    const a = makeActor({ patronGod: "khorne" });
    const o = await resolveKindOutcome(a, { baseEff: 20, rv: 98,
      ctx: { actor: a, kind: "skill", skill: "charm", char: "fel" } });
    expect(o.crit.failure).toBe(true);
    expect(o.critLine).not.toContain("Инфернальная Воля");
    expect(a.system.conditions.shocked).toBe(false);
  });

  it("тест Характеристики на 4 Провала — Шока нет (только тест Навыка)", async () => {
    const a = makeActor({ patronGod: "khorne" });
    const o = await resolveKindOutcome(a, { baseEff: 20, rv: 50,
      ctx: { actor: a, kind: "skill", char: "fel" } });
    expect(o.critLine).not.toContain("Инфернальная Воля");
    expect(a.system.conditions.shocked).toBe(false);
  });

  it("без мутации — Шока нет", async () => {
    const a = makeActor({ withMutation: false });
    const o = await resolveKindOutcome(a, { baseEff: 20, rv: 50,
      ctx: { actor: a, kind: "skill", skill: "charm", char: "fel" } });
    expect(o.critLine).not.toContain("Инфернальная Воля");
  });
});
