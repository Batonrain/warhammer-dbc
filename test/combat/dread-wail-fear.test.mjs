// test/combat/dread-wail-fear.test.mjs
//
// Грозный Вопль (Dread Wail), ветка звуковой волны «рейтинг Страха 2 до конца
// боя» (Sahara dread-wail-2): настоящий временный эффект на system.fearRating у
// ЦЕЛИ (чужого актора — пишет ГМ-релей, combat/gm-relay.mjs), который снимается
// вместе с боем (deleteCombat → clearDreadWailFear), а не метка вручную.
// Образец — Боевой Клич (combat/timed-effects.mjs), но срок не «до Хода».

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyDreadWailWave } from "../../module/combat/dread-wail.mjs";
import { checkTargetWrite, performTargetWrite } from "../../module/combat/gm-relay.mjs";
import { dreadWailFearEffectData, grantDreadWailFear, clearDreadWailFear, DREAD_WAIL_FEAR_FLAG }
  from "../../module/combat/timed-effects.mjs";

const NS = "warhammer-dbc";

/** Актор с настоящей семантикой effects: create/delete/flags по документам. */
function actorWithEffects({ name = "Жертва", uuid = "Actor.v1", traits = [], wp = 40 } = {}) {
  const flags = {};
  const effects = [];
  let seq = 0;
  const a = {
    name, uuid, items: traits.map(n => ({ type: "trait", name: n })),
    system: { characteristics: { wp: { total: wp } }, fatigue: { value: 0 }, conditions: {}, corruptionBonus: 4,
      fate: { value: 2, max: 5 } },
    effects,
    getFlag: (s, k) => flags[`${s}.${k}`],
    setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; },
    unsetFlag: async (s, k) => { delete flags[`${s}.${k}`]; },
    update: async patch => { if (patch["system.fate.value"] !== undefined) a.system.fate.value = patch["system.fate.value"]; },
    createEmbeddedDocuments: async (_t, list) => list.map(d => {
      const e = { ...structuredClone(d), id: `e${++seq}`,
        getFlag: (s, k) => e.flags?.[s]?.[k], parent: a };
      effects.push(e);
      return e;
    }),
    deleteEmbeddedDocuments: async (_t, ids) => {
      for (const id of ids) { const i = effects.findIndex(e => e.id === id); if (i >= 0) effects.splice(i, 1); }
    }
  };
  return a;
}
const fearEffects = a => a.effects.filter(e => e.flags?.[NS]?.[DREAD_WAIL_FEAR_FLAG]);

const fearCombatId = a => fearEffects(a)[0]?.flags?.[NS]?.[DREAD_WAIL_FEAR_FLAG]?.combatId;
const startedCombat = (id, actors = [], round = 1) => ({
  id, started: true, round, combatants: actors.map(actor => ({ actor }))
});

afterEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
  globalThis.game.combats = undefined;
});

describe("данные эффекта", () => {
  it("рейтинг Страха 2 как upgrade (не складывается с другими источниками Страха), фаза final, срок — флаг боя", () => {
    const d = dreadWailFearEffectData({ id: "c7", round: 3 });
    expect(d.system.changes).toEqual([{ key: "system.fearRating", type: "upgrade", value: 2, phase: "final", priority: 0 }]);
    expect(d.flags[NS][DREAD_WAIL_FEAR_FLAG]).toEqual({ combatId: "c7" });
    expect(dreadWailFearEffectData(null).flags[NS][DREAD_WAIL_FEAR_FLAG]).toEqual({ combatId: "" });
  });
});

describe("ГМ-релей: белый список", () => {
  const caster = actorWithEffects({ traits: ["Dread Wail / Грозный Вопль"] });
  it("op dreadWailFear принимается только от носителя Грозного Вопля, без лишних полей", () => {
    expect(checkTargetWrite({ kind: "dreadWailFear" }, { initiatorOwned: true, initiator: caster }).ok).toBe(true);
    expect(checkTargetWrite({ kind: "dreadWailFear" }, { initiatorOwned: true, initiator: actorWithEffects() }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "dreadWailFear" }, { initiatorOwned: false, initiator: caster }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "dreadWailFear", value: 20 }, { initiatorOwned: true, initiator: caster }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "dreadWailFear", changes: [{ key: "system.fearRating", value: 99 }] },
      { initiatorOwned: true, initiator: caster }).ok).toBe(false);
  });
  it("performTargetWrite создаёт эффект Страха 2 и метку на цели", async () => {
    const victim = actorWithEffects({ uuid: "Actor.victim" });
    globalThis.game.combats = [startedCombat("c1", [victim])];
    await performTargetWrite(victim, { kind: "dreadWailFear" }, caster);
    expect(fearEffects(victim)).toHaveLength(1);
    expect(fearEffects(victim)[0].system.changes[0]).toMatchObject({ key: "system.fearRating", type: "upgrade", value: 2 });
    expect(victim.getFlag(NS, "dreadWailFeared")).toBe(true);
    expect(fearCombatId(victim)).toBe("c1");
  });
  it("ГМ-релей передаёт заклинателя: цель вне боя привязывается к бою заклинателя", async () => {
    const wailer = actorWithEffects({ uuid: "Actor.wailer", traits: ["Dread Wail / Грозный Вопль"] });
    const bystander = actorWithEffects({ uuid: "Actor.bystander" });
    globalThis.game.combats = [startedCombat("c9", [wailer])];
    await performTargetWrite(bystander, { kind: "dreadWailFear" }, wailer);
    expect(fearCombatId(bystander)).toBe("c9");
  });
});

describe("grantDreadWailFear / clearDreadWailFear", () => {
  it("повторное попадание заменяет эффект, а не множит", async () => {
    const victim = actorWithEffects();
    globalThis.game.combats = [startedCombat("c1", [victim])];
    await grantDreadWailFear(victim);
    await grantDreadWailFear(victim);
    expect(fearEffects(victim)).toHaveLength(1);
  });

  it("срок привязан к бою ЦЕЛИ, а не к бою, открытому в трекере у ГМа", async () => {
    const victim = actorWithEffects({ uuid: "Actor.victim" });
    globalThis.game.combat = startedCombat("gm-view", [], 4);
    globalThis.game.combats = [globalThis.game.combat, startedCombat("real", [victim])];
    await grantDreadWailFear(victim);
    expect(fearCombatId(victim)).toBe("real");
    await clearDreadWailFear({ id: "real", combatants: [{ actor: victim }], scene: { tokens: [] } });
    expect(fearEffects(victim)).toHaveLength(0);
  });

  it("цель не в бою — берётся бой заклинателя; волна по прохожему снимается с концом этого боя", async () => {
    const wailer = actorWithEffects({ uuid: "Actor.wailer" });
    const bystander = actorWithEffects({ uuid: "Actor.bystander" });
    globalThis.game.combat = startedCombat("gm-view", [], 4);
    globalThis.game.combats = [globalThis.game.combat, startedCombat("c9", [wailer])];
    await grantDreadWailFear(bystander, wailer);
    expect(fearCombatId(bystander)).toBe("c9");
    await clearDreadWailFear({ id: "c9", combatants: [{ actor: wailer }], scene: { tokens: [{ actor: bystander }] } });
    expect(fearEffects(bystander)).toHaveLength(0);
  });

  it("ни цель, ни заклинатель не в бою — срок пустой (снимется с первым концом боя), не бой ГМа из трекера", async () => {
    const victim = actorWithEffects({ uuid: "Actor.victim" });
    globalThis.game.combat = startedCombat("gm-view", [], 4);
    globalThis.game.combats = [globalThis.game.combat];
    await grantDreadWailFear(victim, actorWithEffects({ uuid: "Actor.wailer" }));
    expect(fearEffects(victim)).toHaveLength(1);
    expect(fearCombatId(victim)).toBe("");
  });

  it("конец боя снимает эффект и метку у участников и у токенов сцены; чужие эффекты не трогаются", async () => {
    const inCombat = actorWithEffects({ uuid: "Actor.a" });
    const onScene = actorWithEffects({ uuid: "Actor.b" });
    globalThis.game.combats = [startedCombat("c1", [inCombat, onScene], 2)];
    await grantDreadWailFear(inCombat);
    await grantDreadWailFear(onScene);
    await inCombat.createEmbeddedDocuments("ActiveEffect", [{ name: "Боевой клич", flags: { [NS]: { timedEffect: { key: "warCry" } } } }]);
    const combat = { id: "c1", combatants: [{ actor: inCombat }], scene: { tokens: [{ actor: onScene }] } };
    await clearDreadWailFear(combat);
    expect(fearEffects(inCombat)).toHaveLength(0);
    expect(fearEffects(onScene)).toHaveLength(0);
    expect(inCombat.getFlag(NS, "dreadWailFeared")).toBeUndefined();
    expect(onScene.getFlag(NS, "dreadWailFeared")).toBeUndefined();
    expect(inCombat.effects).toHaveLength(1);   // Боевой клич остался
  });

  it("старая метка «Устрашён» без эффекта (оставшаяся от прежней версии) уходит с концом боя", async () => {
    const victim = actorWithEffects();
    await victim.setFlag(NS, "dreadWailFeared", true);
    await clearDreadWailFear({ id: "c1", combatants: [{ actor: victim }], scene: { tokens: [] } });
    expect(victim.getFlag(NS, "dreadWailFeared")).toBeUndefined();
  });

  it("эффект другого боя конец этого боя не снимает", async () => {
    const victim = actorWithEffects();
    globalThis.game.combats = [startedCombat("other", [victim])];
    await grantDreadWailFear(victim);
    await clearDreadWailFear({ id: "c1", combatants: [{ actor: victim }], scene: { tokens: [] } });
    expect(fearEffects(victim)).toHaveLength(1);
  });
});

describe("звуковая волна: ветка «Страх 2»", () => {
  it("провалившая тест цель получает настоящий эффект, а не только отметку вручную", async () => {
    const caster = actorWithEffects({ name: "Шумовой", uuid: "Actor.caster", traits: ["Dread Wail / Грозный Вопль"] });
    const victim = actorWithEffects({ uuid: "Actor.victim", wp: 20 });
    globalThis.game.combats = [startedCombat("c1", [caster, victim])];
    const casterToken = { id: "c", x: 0, y: 0, width: 1, height: 1, hidden: false, actor: caster };
    const tokens = [casterToken, { id: "t", x: 100, y: 0, width: 1, height: 1, hidden: false, actor: victim }];
    casterToken.parent = { grid: { size: 100, distance: 2 }, tokens: { contents: tokens } };
    captured.nextRoll = 99;
    await applyDreadWailWave(caster, casterToken, "fear");
    expect(fearEffects(victim)).toHaveLength(1);
    expect(captured.chat.at(-1).content).toContain("Рейтинг Страха 2");
    expect(captured.chat.at(-1).content).not.toContain("отметьте вручную");
  });
});
