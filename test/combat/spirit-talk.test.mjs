// test/combat/spirit-talk.test.mjs
//
// Spirit Talk / Духовный Разговор (wdbc-q30d, Певцы Кости): захват контроля
// над психокостяным конструктом (Техника), 2 ОД, до 3 раз за сессию,
// конструкт встраивается в очередь ходов сразу за кастером на F.b раундов.
// module/combat/spirit-talk.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hasSpiritTalk, spiritTalkDuration, spiritTalkGate,
  applySpiritTalkPossession, processSpiritTalkRoundStart, triggerSpiritTalk
} from "../../module/combat/spirit-talk.mjs";

function actorWith({
  names = [], ap = 3, felBonus = 3, felTotal = 30, wpTotal = 40, id = "caster-1", type = "character"
} = {}) {
  const flags = {};
  return {
    id, name: `Кастер-${id}`, uuid: `Actor.${id}`, type,
    items: names.map(name => ({ type: "talent", name })),
    system: {
      actionPoints: { value: ap, max: 2 },
      characteristics: { fel: { bonus: felBonus, total: felTotal }, wp: { total: wpTotal } }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    getActiveTokens: () => [{ document: { id: `token-${id}`, disposition: 1 } }]
  };
}
// actorWith не даёт рабочий update() (actionPoints списываются реально только
// через триггер) — actorForTrigger добавляет его отдельным замыканием, чтобы
// не путать object-literal `this` в самой actorWith.
function actorForTrigger(opts = {}) {
  const a = actorWith(opts);
  a.update = async data => { if (data["system.actionPoints.value"] !== undefined) a.system.actionPoints.value = data["system.actionPoints.value"]; };
  return a;
}

function vehicleTarget({ id = "vehicle-1", disposition = -1, name = `Конструкт-${id}` } = {}) {
  const actor = { id, name, uuid: `Actor.${id}`, type: "vehicle" };
  return { actor, document: { id: `token-${id}`, disposition } };
}

/** Подставной Combatant — тот же приём, что middle-of-the-hunt.test.mjs. */
function combatant({ id, actorId, initiative = null } = {}) {
  const flags = {};
  const c = {
    id, actorId, initiative,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    update: async data => { if (data.initiative !== undefined) c.initiative = data.initiative; }
  };
  return c;
}

/** Подставной Combat — тот же приём, что extra-turn.test.mjs. */
function fakeCombat({ round = 1, started = true, existing = [] } = {}) {
  const combatants = [...existing];
  let nextId = 100;
  return {
    round, started, combatants,
    async createEmbeddedDocuments(type, docs) {
      const created = docs.map(d => combatant({ id: `combatant-${nextId++}`, actorId: d.actorId, initiative: d.initiative ?? null }));
      combatants.push(...created);
      return created;
    },
    async deleteEmbeddedDocuments(type, ids) {
      for (const id of ids) {
        const idx = combatants.findIndex(c => c.id === id);
        if (idx !== -1) combatants.splice(idx, 1);
      }
    }
  };
}

const setTargets = (...tokens) => { globalThis.game.user.targets = new Set(tokens); };

beforeEach(() => {
  resetCaptured();
  globalThis.game.user.targets = new Set();
  globalThis.game.combat = undefined;
});
afterEach(() => {
  globalThis.game.user.targets = new Set();
  globalThis.game.combat = undefined;
});

describe("hasSpiritTalk", () => {
  it("находит Талант по билингвальному имени", () => {
    expect(hasSpiritTalk(actorWith({ names: ["Spirit Talk / Духовный Разговор"] }))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasSpiritTalk(actorWith({ names: ["Dodge"] }))).toBe(false);
  });
});

describe("spiritTalkDuration", () => {
  it("F.b раундов", () => {
    expect(spiritTalkDuration(actorWith({ felBonus: 4 }))).toBe(4);
  });
  it("F.b = 0 — 0, не отрицательное", () => {
    expect(spiritTalkDuration(actorWith({ felBonus: 0 }))).toBe(0);
  });
});

describe("spiritTalkGate", () => {
  it("F.b = 0 — disabled", () => {
    globalThis.game.combat = fakeCombat();
    setTargets(vehicleTarget());
    expect(spiritTalkGate(actorWith({ felBonus: 0 })).disabled).toBe(true);
  });
  it("нет боя — disabled", () => {
    setTargets(vehicleTarget());
    expect(spiritTalkGate(actorWith({})).disabled).toBe(true);
  });
  it("нет цели — disabled", () => {
    globalThis.game.combat = fakeCombat();
    expect(spiritTalkGate(actorWith({})).disabled).toBe(true);
  });
  it("две цели — disabled (нужна ровно одна)", () => {
    globalThis.game.combat = fakeCombat();
    setTargets(vehicleTarget({ id: "v1" }), vehicleTarget({ id: "v2" }));
    expect(spiritTalkGate(actorWith({})).disabled).toBe(true);
  });
  it("цель не Техника — disabled", () => {
    globalThis.game.combat = fakeCombat();
    setTargets({ actor: { id: "npc-1", type: "character" }, document: { id: "t1", disposition: -1 } });
    expect(spiritTalkGate(actorWith({})).disabled).toBe(true);
  });
  it("не хватает ОД — disabled", () => {
    globalThis.game.combat = fakeCombat();
    setTargets(vehicleTarget());
    expect(spiritTalkGate(actorWith({ ap: 1 })).disabled).toBe(true);
  });
  it("всё в порядке — disabled:false", () => {
    globalThis.game.combat = fakeCombat();
    setTargets(vehicleTarget());
    expect(spiritTalkGate(actorWith({})).disabled).toBe(false);
  });
});

describe("applySpiritTalkPossession", () => {
  it("у кастера нет Combatant — null, ничего не создаёт", async () => {
    const combat = fakeCombat();
    const result = await applySpiritTalkPossession(combat, actorWith({ id: "c1" }), { id: "v1", name: "Конструкт" }, { duration: 3 });
    expect(result).toBeNull();
    expect(combat.combatants).toHaveLength(0);
  });

  it("у цели ещё нет Combatant — заводит новый, тегует, ставит инициативу за кастером", async () => {
    const caster = combatant({ id: "cc1", actorId: "c1", initiative: 40 });
    const combat = fakeCombat({ round: 2, existing: [caster] });
    const result = await applySpiritTalkPossession(combat, { id: "c1" }, { id: "v1", name: "Конструкт" }, { targetTokenId: "tok-v1", duration: 3 });
    expect(result).toBeTruthy();
    expect(combat.combatants).toHaveLength(2);
    expect(result.initiative).toBe(39.99);
    const possession = result.getFlag("warhammer-dbc", "spiritTalkPossession");
    expect(possession).toEqual({ casterCombatantId: "cc1", casterActorId: "c1", expiresRound: 4, added: true });
  });

  it("у цели уже есть Combatant в бою — использует его, не создаёт второй", async () => {
    const caster = combatant({ id: "cc1", actorId: "c1", initiative: 40 });
    const targetC = combatant({ id: "tc1", actorId: "v1", initiative: 10 });
    const combat = fakeCombat({ round: 1, existing: [caster, targetC] });
    const result = await applySpiritTalkPossession(combat, { id: "c1" }, { id: "v1", name: "Конструкт" }, { duration: 2 });
    expect(result.id).toBe("tc1");
    expect(combat.combatants).toHaveLength(2);
    expect(result.getFlag("warhammer-dbc", "spiritTalkPossession").added).toBe(false);
  });

  it("кастер ещё не бросил инициативу (null) — синхронизация откладывается", async () => {
    const caster = combatant({ id: "cc1", actorId: "c1", initiative: null });
    const combat = fakeCombat({ existing: [caster] });
    const result = await applySpiritTalkPossession(combat, { id: "c1" }, { id: "v1", name: "Конструкт" }, { duration: 2 });
    expect(result.initiative).toBeNull();
  });
});

describe("processSpiritTalkRoundStart", () => {
  it("пере-выставляет инициативу цели за сдвинувшимся кастером, идемпотентно в том же раунде", async () => {
    const caster = combatant({ id: "cc1", actorId: "c1", initiative: 40 });
    const target = combatant({ id: "tc1", actorId: "v1", initiative: 39.99 });
    await target.setFlag("warhammer-dbc", "spiritTalkPossession", { casterCombatantId: "cc1", casterActorId: "c1", expiresRound: 5, added: false });
    const combat = fakeCombat({ round: 2, existing: [caster, target] });

    caster.initiative = 55; // кастер сдвинулся (Last Actor/Middle of the Hunt)
    await processSpiritTalkRoundStart(combat);
    expect(target.initiative).toBe(54.99);

    target.initiative = 999; // руками сбить — повторный вызов того же раунда не должен трогать
    await processSpiritTalkRoundStart(combat);
    expect(target.initiative).toBe(999);
  });

  it("истёк F.b (раунд > expiresRound) — снимает метку, удаляет добавленный Combatant", async () => {
    const caster = combatant({ id: "cc1", actorId: "c1", initiative: 40 });
    const target = combatant({ id: "tc1", actorId: "v1", initiative: 39.99 });
    await target.setFlag("warhammer-dbc", "spiritTalkPossession", { casterCombatantId: "cc1", casterActorId: "c1", expiresRound: 2, added: true });
    const combat = fakeCombat({ round: 3, existing: [caster, target] });

    await processSpiritTalkRoundStart(combat);
    expect(combat.combatants).toHaveLength(1);
    expect(combat.combatants[0].id).toBe("cc1");
  });

  it("истёк F.b, Combatant цели был уже в бою (added:false) — снимает метку, НЕ удаляет Combatant", async () => {
    const caster = combatant({ id: "cc1", actorId: "c1", initiative: 40 });
    const target = combatant({ id: "tc1", actorId: "v1", initiative: 39.99 });
    await target.setFlag("warhammer-dbc", "spiritTalkPossession", { casterCombatantId: "cc1", casterActorId: "c1", expiresRound: 2, added: false });
    const combat = fakeCombat({ round: 3, existing: [caster, target] });

    await processSpiritTalkRoundStart(combat);
    expect(combat.combatants).toHaveLength(2);
    expect(target.getFlag("warhammer-dbc", "spiritTalkPossession")).toBeUndefined();
  });

  it("кастер выбыл из боя — снимает захват досрочно", async () => {
    const target = combatant({ id: "tc1", actorId: "v1", initiative: 39.99 });
    await target.setFlag("warhammer-dbc", "spiritTalkPossession", { casterCombatantId: "cc1", casterActorId: "c1", expiresRound: 5, added: true });
    const combat = fakeCombat({ round: 2, existing: [target] });

    await processSpiritTalkRoundStart(combat);
    expect(combat.combatants).toHaveLength(0);
  });

  it("нет захваченных Combatant — не падает", async () => {
    const combat = fakeCombat({ existing: [combatant({ id: "c1", actorId: "a1" })] });
    await expect(processSpiritTalkRoundStart(combat)).resolves.toBeUndefined();
  });

  it("нет combat — не падает", async () => {
    await expect(processSpiritTalkRoundStart(null)).resolves.toBeUndefined();
  });
});

describe("triggerSpiritTalk", () => {
  it("нет Таланта — null, ОД не тратятся", async () => {
    globalThis.game.combat = fakeCombat();
    setTargets(vehicleTarget());
    const actor = actorForTrigger({ names: ["Dodge"] });
    expect(await triggerSpiritTalk(actor)).toBeNull();
    expect(actor.system.actionPoints.value).toBe(3);
  });

  it("гейт не пройден (нет цели) — null, предупреждение", async () => {
    globalThis.game.combat = fakeCombat();
    const actor = actorForTrigger({ names: ["Spirit Talk / Духовный Разговор"] });
    expect(await triggerSpiritTalk(actor)).toBeNull();
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("союзная цель — автоматический захват, без броска, тратит 2 ОД", async () => {
    const caster = combatant({ id: "cc1", actorId: "caster-1", initiative: 30 });
    globalThis.game.combat = fakeCombat({ existing: [caster] });
    setTargets(vehicleTarget({ disposition: 1 })); // та же диспозиция, что кастер (getActiveTokens → disposition 1)
    const actor = actorForTrigger({ names: ["Spirit Talk / Духовный Разговор"], felBonus: 2 });

    const result = await triggerSpiritTalk(actor);
    expect(result).toEqual({ success: true, hostile: false, roll: null, applied: true, duration: 2 });
    expect(actor.system.actionPoints.value).toBe(1);
    expect(globalThis.game.combat.combatants).toHaveLength(2);
    expect(captured.rolls).toHaveLength(0); // союзник — без встречного теста
  });

  it("враждебная цель, стол подтверждает победу — захват применяется", async () => {
    const caster = combatant({ id: "cc1", actorId: "caster-1", initiative: 30 });
    globalThis.game.combat = fakeCombat({ existing: [caster] });
    setTargets(vehicleTarget({ disposition: -1 }));
    captured.nextRoll = 20;
    captured.confirmAnswer = true;
    const actor = actorForTrigger({ names: ["Spirit Talk / Духовный Разговор"], wpTotal: 40, felTotal: 30 });

    const result = await triggerSpiritTalk(actor);
    expect(result.success).toBe(true);
    expect(result.hostile).toBe(true);
    expect(result.applied).toBe(true);
    // WP+0=40 vs Fel+10=40 — равны, useChar остаётся "wp" (строгое >).
    expect(result.roll.threshold).toBe(40);
    expect(globalThis.game.combat.combatants).toHaveLength(2);
  });

  it("враждебная цель, стол НЕ подтверждает — захват не применяется, ОД всё равно потрачены", async () => {
    const caster = combatant({ id: "cc1", actorId: "caster-1", initiative: 30 });
    globalThis.game.combat = fakeCombat({ existing: [caster] });
    setTargets(vehicleTarget({ disposition: -1 }));
    captured.nextRoll = 90;
    captured.confirmAnswer = false;
    const actor = actorForTrigger({ names: ["Spirit Talk / Духовный Разговор"] });

    const result = await triggerSpiritTalk(actor);
    expect(result).toEqual({ success: false, hostile: true, roll: expect.any(Object) });
    expect(actor.system.actionPoints.value).toBe(1); // 2 ОД потрачены — действие израсходовано
    expect(globalThis.game.combat.combatants).toHaveLength(1); // Combatant цели не создан
  });

  it("Fel+10 выгоднее WP+0 — берёт Fel", async () => {
    const caster = combatant({ id: "cc1", actorId: "caster-1", initiative: 30 });
    globalThis.game.combat = fakeCombat({ existing: [caster] });
    setTargets(vehicleTarget({ disposition: -1 }));
    captured.nextRoll = 20;
    captured.confirmAnswer = true;
    const actor = actorForTrigger({ names: ["Spirit Talk / Духовный Разговор"], wpTotal: 30, felTotal: 40 });

    const result = await triggerSpiritTalk(actor);
    expect(result.roll.useChar).toBe("fel");
    expect(result.roll.threshold).toBe(50);
  });

  it("у кастера нет Combatant в этом бою — предупреждение, applied:false, ОД потрачены", async () => {
    globalThis.game.combat = fakeCombat(); // пустой бой, кастера в нём нет
    setTargets(vehicleTarget({ disposition: 1 }));
    const actor = actorForTrigger({ names: ["Spirit Talk / Духовный Разговор"] });

    const result = await triggerSpiritTalk(actor);
    expect(result.applied).toBe(false);
    expect(actor.system.actionPoints.value).toBe(1);
  });
});
