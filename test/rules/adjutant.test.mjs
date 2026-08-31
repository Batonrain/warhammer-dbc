// test/rules/adjutant.test.mjs
//
// module/rules/adjutant.mjs (wdbc-sk8s) — Adjutant/Адъютант даёт переброс
// СВОЕМУ КОМАНДИРУ, не себе. Регистрация как источник правил
// (module/rules/sources.mjs) не тестируется отдельно — только сама логика,
// тем же приёмом, что module/rules/dreadnought.mjs.

import { describe, it, expect } from "vitest";
import { adjutantsOf, adjutantRerollRules } from "../../module/rules/adjutant.mjs";

function squad({ commander, leader, coordinator, members = [] } = {}) {
  return {
    type: "squad",
    system: {
      posts: {
        commander: commander ? { uuid: commander } : {},
        leader: leader ? { uuid: leader } : {},
        coordinator: coordinator ? { uuid: coordinator } : {}
      },
      members: members.map(uuid => ({ uuid }))
    }
  };
}

function actor(uuid, { hasAdjutant = false, groupSkills = {} } = {}) {
  return {
    uuid,
    items: hasAdjutant ? [{ type: "talent", name: "Adjutant / Адъютант" }] : [],
    system: { groupSkills }
  };
}

describe("adjutantsOf", () => {
  it("находит Адъютантов среди подчинённых (не среди самого Командира)", () => {
    const cmd = actor("Actor.cmd");
    const adj = actor("Actor.adj", { hasAdjutant: true });
    const other = actor("Actor.other");
    const s = squad({ commander: "Actor.cmd", members: ["Actor.adj", "Actor.other"] });
    expect(adjutantsOf(cmd, [s, cmd, adj, other])).toEqual([adj]);
  });

  it("не Командир нигде — пусто", () => {
    const cmd = actor("Actor.cmd");
    const adj = actor("Actor.adj", { hasAdjutant: true });
    const s = squad({ commander: "Actor.someoneElse", members: ["Actor.adj"] });
    expect(adjutantsOf(cmd, [s, cmd, adj])).toEqual([]);
  });

  it("подчинённый = сам Командир (не должно случиться, но не роняет) — исключается", () => {
    const cmd = actor("Actor.cmd", { hasAdjutant: true });
    const s = squad({ commander: "Actor.cmd", members: ["Actor.cmd"] });
    expect(adjutantsOf(cmd, [s, cmd])).toEqual([]);
  });

  it("Адъютант может быть на посту Лидера/Координатора, не только в members", () => {
    const cmd = actor("Actor.cmd");
    const adjLeader = actor("Actor.adjL", { hasAdjutant: true });
    const s = squad({ commander: "Actor.cmd", leader: "Actor.adjL" });
    expect(adjutantsOf(cmd, [s, cmd, adjLeader])).toEqual([adjLeader]);
  });
});

describe("adjutantRerollRules", () => {
  it("нет Адъютантов — пустой список правил", () => {
    const cmd = actor("Actor.cmd");
    const s = squad({ commander: "Actor.cmd", members: ["Actor.m1"] });
    expect(adjutantRerollRules(cmd, [s, cmd, actor("Actor.m1")])).toEqual([]);
  });

  it("есть Адъютант — правило переброса Командования, без Lore (нет общей специализации ниже рангом)", () => {
    const cmd = actor("Actor.cmd", { groupSkills: { commonLore: [{ specKey: "imperium", rank: "trained" }] } });
    const adj = actor("Actor.adj", {
      hasAdjutant: true,
      groupSkills: { commonLore: [{ specKey: "imperium", rank: "trained" }] } // тот же ранг — не "ниже"
    });
    const s = squad({ commander: "Actor.cmd", members: ["Actor.adj"] });
    const rules = adjutantRerollRules(cmd, [s, cmd, adj]);
    expect(rules.map(r => r.id)).toEqual(["adjutant.command"]);
    expect(rules[0].effects[0].target).toBe("skill:command");
  });

  it("Адъютант с Lore рангом ниже Командира по той же специализации — добавляет 3 правила Знаний", () => {
    const cmd = actor("Actor.cmd", { groupSkills: { commonLore: [{ specKey: "imperium", rank: "veteran" }] } });
    const adj = actor("Actor.adj", {
      hasAdjutant: true,
      groupSkills: { commonLore: [{ specKey: "imperium", rank: "trained" }] } // ниже veteran
    });
    const s = squad({ commander: "Actor.cmd", members: ["Actor.adj"] });
    const rules = adjutantRerollRules(cmd, [s, cmd, adj]);
    expect(rules.map(r => r.id)).toEqual([
      "adjutant.command", "adjutant.lore.commonLore", "adjutant.lore.forbiddenLore", "adjutant.lore.scholasticLore"
    ]);
  });

  it("разные специализации (specKey не совпадает) — Lore не добавляется", () => {
    const cmd = actor("Actor.cmd", { groupSkills: { commonLore: [{ specKey: "imperium", rank: "veteran" }] } });
    const adj = actor("Actor.adj", {
      hasAdjutant: true,
      groupSkills: { commonLore: [{ specKey: "xenos", rank: "trained" }] }
    });
    const s = squad({ commander: "Actor.cmd", members: ["Actor.adj"] });
    const rules = adjutantRerollRules(cmd, [s, cmd, adj]);
    expect(rules.map(r => r.id)).toEqual(["adjutant.command"]);
  });

  it("Адъютант рангом ВЫШЕ или равным — Lore не добавляется", () => {
    const cmd = actor("Actor.cmd", { groupSkills: { commonLore: [{ specKey: "imperium", rank: "trained" }] } });
    const adj = actor("Actor.adj", {
      hasAdjutant: true,
      groupSkills: { commonLore: [{ specKey: "imperium", rank: "expert" }] } // выше
    });
    const s = squad({ commander: "Actor.cmd", members: ["Actor.adj"] });
    const rules = adjutantRerollRules(cmd, [s, cmd, adj]);
    expect(rules.map(r => r.id)).toEqual(["adjutant.command"]);
  });
});
